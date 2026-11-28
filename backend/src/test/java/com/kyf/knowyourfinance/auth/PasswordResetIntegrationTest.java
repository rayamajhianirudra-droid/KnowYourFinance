package com.kyf.knowyourfinance.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * End-to-end test of the forgot/reset flow against a real PostgreSQL. A fake
 * {@link ResetEmailSender} stands in for SMTP and captures the link that would
 * have been emailed, so the test can follow the token the way a person would
 * follow it from their inbox - without sending real mail.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
class PasswordResetIntegrationTest {
    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "create-drop");
    }

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @MockBean ResetEmailSender emailSender;

    private static final String OLD = "original-password-1";
    private static final String NEW = "brand-new-password-2";

    @Test
    void forgotThenResetChangesThePasswordAndEndsSessions() throws Exception {
        String email = "reset@example.test";
        signUp(email, OLD);
        MockHttpSession signedIn = signIn(email, OLD);
        mvc.perform(get("/api/auth/session").session(signedIn)).andExpect(status().isOk());

        forgot(email).andExpect(status().isAccepted());
        String token = capturedToken();

        reset(token, NEW).andExpect(status().isOk());

        // The reset ends every session the account had open.
        assertTrue(signedIn.isInvalid(), "existing sessions should be ended by a password reset");

        // The old password stops working and the new one starts.
        mvc.perform(withCsrf(post("/api/auth/signin"))
                        .contentType(MediaType.APPLICATION_JSON).content(credentials(email, OLD)))
                .andExpect(status().isUnauthorized());
        signIn(email, NEW);

        // The token is single-use: trying it again is refused.
        reset(token, "yet-another-pass-3").andExpect(status().isBadRequest());
    }

    @Test
    void forgotPasswordForAnUnknownEmailSendsNothingButAnswersTheSame() throws Exception {
        forgot("nobody@example.test").andExpect(status().isAccepted());
        verifyNoInteractions(emailSender);
    }

    @Test
    void resetWithAnUnknownTokenIsRefused() throws Exception {
        reset("not-a-real-token", NEW).andExpect(status().isBadRequest());
    }

    @Test
    void aTooShortNewPasswordIsRefusedWithoutSpendingTheToken() throws Exception {
        String email = "short@example.test";
        signUp(email, OLD);
        forgot(email).andExpect(status().isAccepted());
        String token = capturedToken();

        reset(token, "short").andExpect(status().isBadRequest());
        // The token was not spent, so it still works with a valid password.
        reset(token, NEW).andExpect(status().isOk());
    }

    private String capturedToken() {
        ArgumentCaptor<String> url = ArgumentCaptor.forClass(String.class);
        verify(emailSender, atLeastOnce()).sendResetLink(anyString(), url.capture());
        String link = url.getValue();
        int at = link.indexOf("token=");
        assertTrue(at >= 0, "the reset link should contain a token: " + link);
        return link.substring(at + "token=".length());
    }

    private org.springframework.test.web.servlet.ResultActions forgot(String email) throws Exception {
        return mvc.perform(withCsrf(post("/api/auth/forgot-password"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(new AuthController.ForgotPasswordRequest(email))));
    }

    private org.springframework.test.web.servlet.ResultActions reset(String token, String newPassword) throws Exception {
        return mvc.perform(withCsrf(post("/api/auth/reset-password"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(new AuthController.ResetPasswordRequest(token, newPassword))));
    }

    private void signUp(String email, String password) throws Exception {
        authenticate("signup", email, password);
    }

    private MockHttpSession signIn(String email, String password) throws Exception {
        return authenticate("signin", email, password);
    }

    private MockHttpSession authenticate(String action, String email, String password) throws Exception {
        MockHttpSession session = new MockHttpSession();
        mvc.perform(withCsrf(post("/api/auth/" + action)).session(session)
                        .contentType(MediaType.APPLICATION_JSON).content(credentials(email, password)))
                .andExpect(status().isOk());
        return session;
    }

    private static MockHttpServletRequestBuilder withCsrf(MockHttpServletRequestBuilder builder) {
        return builder.with(SecurityMockMvcRequestPostProcessors.csrf());
    }

    private String credentials(String email, String password) throws Exception {
        return json.writeValueAsString(new AuthController.Credentials(email, password));
    }
}

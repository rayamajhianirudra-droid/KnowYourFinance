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
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * End-to-end test of email verification against a real PostgreSQL. A fake
 * {@link MailSender} stands in for SMTP and captures the link that would have
 * been emailed, so the test follows the token the way a person would follow it
 * from their inbox.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
class EmailVerificationIntegrationTest {
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
    @MockBean MailSender mail;

    private static final String EMAIL = "verify@example.test";
    private static final String PASSWORD = "synthetic-password-1";

    @Test
    void signUpSendsAVerificationLinkAndTheLinkVerifiesTheEmail() throws Exception {
        MockHttpSession session = new MockHttpSession();
        mvc.perform(withCsrf(post("/api/auth/signup")).session(session)
                        .contentType(MediaType.APPLICATION_JSON).content(credentials(EMAIL, PASSWORD)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.emailVerified").value(false));

        // A new account starts unverified but is NOT locked out of the app.
        mvc.perform(get("/api/auth/session").session(session))
                .andExpect(status().isOk()).andExpect(jsonPath("$.emailVerified").value(false));
        mvc.perform(get("/api/transactions").session(session)).andExpect(status().isOk());

        String token = capturedToken();

        // Opening the link verifies the email.
        openVerifyLink(token).andExpect(status().isOk());
        mvc.perform(get("/api/auth/session").session(session))
                .andExpect(status().isOk()).andExpect(jsonPath("$.emailVerified").value(true));

        // The token is single-use, and a nonsense token is refused.
        openVerifyLink(token).andExpect(status().isBadRequest());
        openVerifyLink("not-a-real-token").andExpect(status().isBadRequest());
    }

    @Test
    void resendSendsAnotherLinkWhileUnverifiedAndNothingOnceVerified() throws Exception {
        String email = "resend@example.test";
        MockHttpSession session = new MockHttpSession();
        mvc.perform(withCsrf(post("/api/auth/signup")).session(session)
                        .contentType(MediaType.APPLICATION_JSON).content(credentials(email, PASSWORD)))
                .andExpect(status().isOk());

        // Resend while unverified sends a fresh link (2 sends so far for this email).
        mvc.perform(withCsrf(post("/api/auth/resend-verification")).session(session))
                .andExpect(status().isOk());
        verify(mail, atLeastOnce()).send(eq(email), anyString(), anyString());

        // Verify, then resend: already verified, so no further email is sent.
        String token = capturedTokenFor(email);
        openVerifyLink(token).andExpect(status().isOk());
        mvc.perform(withCsrf(post("/api/auth/resend-verification")).session(session))
                .andExpect(status().isOk());
        // Exactly two sends happened for this email (signup + the one resend), none after verifying.
        verify(mail, org.mockito.Mockito.times(2)).send(eq(email), anyString(), anyString());
    }

    private String capturedToken() {
        return capturedTokenFor(EMAIL);
    }

    private String capturedTokenFor(String email) {
        ArgumentCaptor<String> body = ArgumentCaptor.forClass(String.class);
        verify(mail, atLeastOnce()).send(eq(email), anyString(), body.capture());
        String text = body.getValue();
        int at = text.indexOf("token=");
        assertTrue(at >= 0, "the verification email should contain a token: " + text);
        String rest = text.substring(at + "token=".length());
        int end = 0;
        while (end < rest.length() && (Character.isLetterOrDigit(rest.charAt(end)) || rest.charAt(end) == '-' || rest.charAt(end) == '_')) {
            end++;
        }
        return rest.substring(0, end);
    }

    private ResultActions openVerifyLink(String token) throws Exception {
        return mvc.perform(withCsrf(post("/api/auth/verify-email"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(new AuthController.TokenRequest(token))));
    }

    private static MockHttpServletRequestBuilder withCsrf(MockHttpServletRequestBuilder builder) {
        return builder.with(SecurityMockMvcRequestPostProcessors.csrf());
    }

    private String credentials(String email, String password) throws Exception {
        return json.writeValueAsString(new AuthController.Credentials(email, password));
    }
}

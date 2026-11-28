package com.kyf.knowyourfinance.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * End-to-end test of changing a password against a real PostgreSQL (started
 * by Testcontainers, same approach as AccountIsolationIntegrationTest). It
 * drives the actual HTTP endpoints - sign up, sign in on a second device,
 * change the password - and proves the three things that matter for this
 * feature: the current password is required, the stored hash really changes
 * (old password stops working, new one starts), and the account's other
 * sessions are ended server-side while the current device stays signed in.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
class AccountSecurityIntegrationTest {
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

    private static final String EMAIL = "security@example.test";
    private static final String CURRENT = "original-password-1";
    private static final String NEXT = "replacement-password-2";

    @Test
    void changingThePasswordUpdatesTheHashAndSignsOutOtherDevices() throws Exception {
        MockHttpSession laptop = authenticate("signup", EMAIL, CURRENT);
        MockHttpSession phone = authenticate("signin", EMAIL, CURRENT);

        // Both devices start out signed in.
        mvc.perform(get("/api/auth/session").session(laptop)).andExpect(status().isOk());
        mvc.perform(get("/api/auth/session").session(phone)).andExpect(status().isOk());

        // A wrong current password is refused (403) and changes nothing.
        mvc.perform(changePassword(laptop, "wrong-password-9", NEXT))
                .andExpect(status().isForbidden());
        // A too-short new password is refused (400).
        mvc.perform(changePassword(laptop, CURRENT, "short"))
                .andExpect(status().isBadRequest());
        // Reusing the current password is refused (400).
        mvc.perform(changePassword(laptop, CURRENT, CURRENT))
                .andExpect(status().isBadRequest());

        // A valid change succeeds and reports the one other device signed out.
        mvc.perform(changePassword(laptop, CURRENT, NEXT))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.signedOutOtherDevices").value(1));

        // The other device's session was invalidated server-side,
        assertTrue(phone.isInvalid(), "the other device's session should be invalidated");
        // while the device that made the change stays signed in.
        mvc.perform(get("/api/auth/session").session(laptop)).andExpect(status().isOk());

        // The old password no longer works; the new one does.
        mvc.perform(withCsrf(post("/api/auth/signin"), new MockHttpSession())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(credentialsBody(EMAIL, CURRENT)))
                .andExpect(status().isUnauthorized());
        mvc.perform(withCsrf(post("/api/auth/signin"), new MockHttpSession())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(credentialsBody(EMAIL, NEXT)))
                .andExpect(status().isOk());
    }

    @Test
    void changingAPasswordRequiresAuthentication() throws Exception {
        mvc.perform(changePassword(new MockHttpSession(), CURRENT, NEXT))
                .andExpect(status().isUnauthorized());
    }

    private MockHttpSession authenticate(String action, String email, String password) throws Exception {
        MockHttpSession session = new MockHttpSession();
        mvc.perform(withCsrf(post("/api/auth/" + action), session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(credentialsBody(email, password)))
                .andExpect(status().isOk());
        return session;
    }

    private MockHttpServletRequestBuilder changePassword(MockHttpSession session, String current, String next)
            throws Exception {
        return withCsrf(post("/api/auth/change-password"), session)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(new AuthController.PasswordChange(current, next)));
    }

    private static MockHttpServletRequestBuilder withCsrf(MockHttpServletRequestBuilder builder,
                                                          MockHttpSession session) {
        return builder.session(session).with(SecurityMockMvcRequestPostProcessors.csrf());
    }

    private String credentialsBody(String email, String password) throws Exception {
        return json.writeValueAsString(new AuthController.Credentials(email, password));
    }
}

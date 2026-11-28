package com.kyf.knowyourfinance.auth;

import com.fasterxml.jackson.databind.JsonNode;
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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * End-to-end test of login history and active-session management against a real
 * PostgreSQL. It drives the actual endpoints and checks the security-relevant
 * behaviour: an account sees its own sign-in attempts, can list and sign out its
 * devices, keeps the current one when signing out "others", and cannot touch
 * another account's sessions.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
class SessionManagementIntegrationTest {
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

    private static final String PASSWORD = "synthetic-password-1";

    @Test
    void anAccountSeesAndControlsItsOwnSessionsAndHistory() throws Exception {
        String email = "sessions@example.test";
        MockHttpSession laptop = signUp(email, PASSWORD);   // device 1 (will be "current")
        MockHttpSession phone = signIn(email, PASSWORD);     // device 2
        // A failed attempt on this account, so history has a FAILURE too.
        mvc.perform(withCsrf(post("/api/auth/signin")).session(new MockHttpSession())
                        .contentType(MediaType.APPLICATION_JSON).content(credentials(email, "wrong-password-9")))
                .andExpect(status().isUnauthorized());

        // Login history: a SUCCESS (the phone sign-in) and a FAILURE, newest first.
        String history = mvc.perform(get("/api/auth/login-history").session(laptop))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        JsonNode events = json.readTree(history);
        assertTrue(events.size() >= 2, "expected at least a success and a failure: " + history);
        boolean hasSuccess = false;
        boolean hasFailure = false;
        for (JsonNode event : events) {
            String outcome = event.get("outcome").asText();
            hasSuccess |= outcome.equals("SUCCESS");
            hasFailure |= outcome.equals("FAILURE");
        }
        assertTrue(hasSuccess && hasFailure, "history should have both a success and a failure: " + history);

        // Sessions: two devices, exactly one marked current (the laptop making the call).
        JsonNode sessions = json.readTree(mvc.perform(get("/api/auth/sessions").session(laptop))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertEquals(2, sessions.size());
        long current = count(sessions, true);
        assertEquals(1, current);
        String otherHandle = handleOf(sessions, false);

        // Sign out the other device by its handle.
        mvc.perform(withCsrf(delete("/api/auth/sessions/{handle}", otherHandle)).session(laptop))
                .andExpect(status().isNoContent());
        assertTrue(phone.isInvalid(), "the signed-out device's session should be invalidated");
        JsonNode afterDelete = json.readTree(mvc.perform(get("/api/auth/sessions").session(laptop))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertEquals(1, afterDelete.size());

        // Sign in again on a third device, then "sign out other devices" keeps only the laptop.
        MockHttpSession tablet = signIn(email, PASSWORD);
        String revoke = mvc.perform(withCsrf(post("/api/auth/sessions/revoke-others")).session(laptop))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertEquals(1, json.readTree(revoke).get("signedOutOtherDevices").asInt());
        assertTrue(tablet.isInvalid(), "revoke-others should end the tablet session");
        mvc.perform(get("/api/auth/session").session(laptop)).andExpect(status().isOk());
    }

    @Test
    void oneAccountCannotSignOutAnothersDevice() throws Exception {
        MockHttpSession alice = signUp("alice@example.test", PASSWORD);
        MockHttpSession bob = signUp("bob@example.test", PASSWORD);

        // Bob lists his own sessions and takes his handle.
        JsonNode bobSessions = json.readTree(mvc.perform(get("/api/auth/sessions").session(bob))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        String bobHandle = bobSessions.get(0).get("handle").asText();

        // Alice tries to end Bob's session by his handle: not found, and Bob stays in.
        mvc.perform(withCsrf(delete("/api/auth/sessions/{handle}", bobHandle)).session(alice))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/auth/session").session(bob)).andExpect(status().isOk());
    }

    private long count(JsonNode sessions, boolean current) {
        long n = 0;
        for (JsonNode s : sessions) {
            if (s.get("current").asBoolean() == current) n++;
        }
        return n;
    }

    private String handleOf(JsonNode sessions, boolean current) {
        for (JsonNode s : sessions) {
            if (s.get("current").asBoolean() == current) return s.get("handle").asText();
        }
        throw new AssertionError("no session with current=" + current);
    }

    private MockHttpSession signUp(String email, String password) throws Exception {
        return authenticate("signup", email, password);
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

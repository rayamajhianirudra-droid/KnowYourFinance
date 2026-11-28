package com.kyf.knowyourfinance.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kyf.knowyourfinance.model.Transaction;
import com.kyf.knowyourfinance.model.TransactionCategory;
import com.kyf.knowyourfinance.model.TransactionType;
import com.kyf.knowyourfinance.repository.TransactionRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
class AccountIsolationIntegrationTest {
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
    @Autowired TransactionRepository transactions;

    @Test
    void copiesPreviousBudgetLimitsAcrossYearsWithoutOverwritingOrSharing() throws Exception {
        var first = credentials("signup", "budget-copy@example.test");
        var second = credentials("signup", "budget-neighbor@example.test");
        saveLimit(first, "DINING", 2026, 12, "125.50");
        saveLimit(first, "GROCERIES", 2026, 12, "240.75");
        saveLimit(first, "DINING", 2027, 1, "99.00");
        saveLimit(second, "TRAVEL", 2026, 12, "300.00");

        String copy = "/api/budgets/copy-previous-month?year=2027&month=1";
        mvc.perform(post(copy).session(first)).andExpect(status().isForbidden());
        mvc.perform(withCsrf(post("/api/budgets/copy-previous-month?year=1900&month=1"), first))
                .andExpect(status().isBadRequest());
        mvc.perform(withCsrf(post("/api/budgets/copy-previous-month?year=2026&month=11"), first))
                .andExpect(status().isOk()).andExpect(jsonPath("$.copied").value(0));
        mvc.perform(withCsrf(post(copy), first)).andExpect(status().isOk())
                .andExpect(jsonPath("$.copied").value(1));
        mvc.perform(withCsrf(post(copy), first)).andExpect(status().isOk())
                .andExpect(jsonPath("$.copied").value(0));
        mvc.perform(get("/api/budgets?year=2027&month=1").session(first))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(content().json("""
                        [
                          {"category":"DINING","limitAmount":99.00,"spent":0},
                          {"category":"GROCERIES","limitAmount":240.75,"spent":0}
                        ]
                        """));
        mvc.perform(get("/api/budgets?year=2027&month=1").session(second))
                .andExpect(status().isOk()).andExpect(content().json("[]"));
    }

    private void saveLimit(MockHttpSession session, String category, int year, int month, String amount)
            throws Exception {
        mvc.perform(withCsrf(put("/api/budgets/{category}", category)
                        .param("year", Integer.toString(year)).param("month", Integer.toString(month)), session)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"limitAmount\":" + amount + "}"))
                .andExpect(status().isOk());
    }

    private static final String TRANSACTION = """
        {"date":"2026-09-02","description":"Synthetic coffee","amount":4.25,"type":"EXPENSE","userId":42}
        """;

    @Test
    void sessionAndFinancialDataAreIsolated() throws Exception {
        Transaction legacy = transactions.save(new Transaction(LocalDate.parse("2026-09-02"), "Legacy test",
                new BigDecimal("5.75"), TransactionType.EXPENSE, TransactionCategory.DINING, 42L));
        mvc.perform(get("/api/transactions")).andExpect(status().isUnauthorized());

        MockHttpSession first = credentials("signup", " First@Example.test ");
        MockHttpSession second = credentials("signup", "second@example.test");

        mvc.perform(get("/api/auth/session").session(first))
                .andExpect(status().isOk()).andExpect(jsonPath("$.email").value("first@example.test"));
        mvc.perform(get("/api/transactions").session(first).param("userId", "42"))
                .andExpect(status().isOk()).andExpect(content().json("[]"));
        mvc.perform(get("/api/transactions/{id}", legacy.getId()).session(first))
                .andExpect(status().isNotFound());

        mvc.perform(post("/api/transactions").session(first)
                        .contentType(MediaType.APPLICATION_JSON).content(TRANSACTION))
                .andExpect(status().isForbidden());

        String created = mvc.perform(withCsrf(post("/api/transactions"), first)
                        .contentType(MediaType.APPLICATION_JSON).content(TRANSACTION))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        long id = json.readTree(created).get("id").asLong();
        long owner = json.readTree(created).get("userId").asLong();
        assertNotEquals(42L, owner);

        mvc.perform(get("/api/transactions/{id}", id).session(second).param("userId", Long.toString(owner)))
                .andExpect(status().isNotFound());
        mvc.perform(withCsrf(put("/api/transactions/{id}", id), second)
                        .contentType(MediaType.APPLICATION_JSON).content(TRANSACTION))
                .andExpect(status().isNotFound());
        mvc.perform(withCsrf(delete("/api/transactions/{id}", id), second))
                .andExpect(status().isNotFound());
        // The filtered CSV feature exports rows returned by the transaction list.
        mvc.perform(get("/api/transactions").session(second).param("userId", Long.toString(owner)))
                .andExpect(status().isOk()).andExpect(content().json("[]"));
        mvc.perform(withCsrf(delete("/api/data"), second).param("userId", Long.toString(owner))
                        .param("confirm", "DELETE"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.deletedTransactions").value(0));
        assertTrue(transactions.existsById(id));
        assertTrue(transactions.existsById(legacy.getId()));

        var statement = new MockMultipartFile("files", "synthetic.csv", "text/csv",
                "Date,Description,Amount\n2026-09-03,Synthetic bus ticket,-3.50\n"
                        .getBytes(StandardCharsets.UTF_8));
        mvc.perform(withCsrf(multipart("/api/statements/upload-batch").file(statement), second)
                        .param("userId", Long.toString(owner)).param("preview", "true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.files[0].result.transactionsSaved").value(1));
        mvc.perform(get("/api/transactions").session(second))
                .andExpect(status().isOk()).andExpect(content().json("[]"));
        mvc.perform(withCsrf(multipart("/api/statements/upload-batch").file(statement), second)
                        .param("userId", Long.toString(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.files[0].result.transactionsSaved").value(1));
        mvc.perform(get("/api/transactions").session(second))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].description").value("Synthetic bus ticket"));
        mvc.perform(get("/api/transactions").session(first))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(id));

        mvc.perform(withCsrf(post("/api/auth/signout"), first)).andExpect(status().isNoContent());
        assertTrue(first.isInvalid());
        MockHttpSession restored = credentials("signin", "FIRST@example.test");
        mvc.perform(get("/api/transactions").session(restored))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].id").value(id));
    }

    @Test
    void planningRecordsPersistWithinOneAccountAndAreRemovedOnReset() throws Exception {
        MockHttpSession first = credentials("signup", "planner-one@example.test");
        MockHttpSession second = credentials("signup", "planner-two@example.test");
        String draft = """
                {"name":"Emergency fund","targetAmount":1000,"savedAmount":250,"deadline":"2027-06-30"}
                """;
        String created = mvc.perform(withCsrf(post("/api/planning/goals"), first)
                        .contentType(MediaType.APPLICATION_JSON).content(draft))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        String goalId = json.readTree(created).get("id").asText();

        mvc.perform(get("/api/planning/goals").session(second))
                .andExpect(status().isOk()).andExpect(content().json("[]"));
        mvc.perform(withCsrf(delete("/api/planning/goals/{id}", goalId), second))
                .andExpect(status().isNotFound());
        mvc.perform(withCsrf(put("/api/planning/goals/{id}", goalId), first)
                        .contentType(MediaType.APPLICATION_JSON).content(draft.replace("250", "300")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.savedAmount").value(300));

        for (String status : new String[]{"ESSENTIAL", "CANCELLED"}) {
            mvc.perform(withCsrf(put("/api/planning/subscriptions"), first)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(json.writeValueAsString(Map.of("merchantKey", "MUSIC", "status", status))))
                    .andExpect(status().isNoContent());
        }
        mvc.perform(get("/api/planning/subscriptions").session(first))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].status").value("CANCELLED"));
        mvc.perform(get("/api/planning/subscriptions").session(second))
                .andExpect(status().isOk()).andExpect(content().json("[]"));

        mvc.perform(get("/api/data/summary").session(first)).andExpect(status().isOk())
                .andExpect(jsonPath("$.goals").value(1))
                .andExpect(jsonPath("$.subscriptionReviews").value(1));
        mvc.perform(withCsrf(delete("/api/data"), first).param("confirm", "DELETE"))
                .andExpect(status().isOk());
        mvc.perform(get("/api/planning/goals").session(first))
                .andExpect(status().isOk()).andExpect(content().json("[]"));
        mvc.perform(get("/api/planning/subscriptions").session(first))
                .andExpect(status().isOk()).andExpect(content().json("[]"));
    }

    private MockHttpSession credentials(String action, String email) throws Exception {
        var session = new MockHttpSession();
        String preAuthId = session.getId();
        var request = post("/api/auth/{action}", action).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("email", email, "password", "Synthetic test password")));
        var authenticated = (MockHttpSession) mvc.perform(withCsrf(request, session))
                .andExpect(status().isOk()).andReturn().getRequest().getSession(false);
        assertNotEquals(preAuthId, authenticated.getId());
        return authenticated;
    }

    private MockHttpServletRequestBuilder withCsrf(MockHttpServletRequestBuilder request,
                                                   MockHttpSession session) throws Exception {
        String body = mvc.perform(get("/api/auth/csrf").session(session))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        var csrf = json.readTree(body);
        return request.session(session).header(csrf.get("headerName").asText(), csrf.get("token").asText());
    }
}

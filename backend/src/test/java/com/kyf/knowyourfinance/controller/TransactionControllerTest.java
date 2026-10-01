package com.kyf.knowyourfinance.controller;

import com.kyf.knowyourfinance.model.Transaction;
import com.kyf.knowyourfinance.model.TransactionType;
import com.kyf.knowyourfinance.repository.TransactionRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * This is a different KIND of test than DashboardServiceTest - that one
 * called a plain Java method directly. This one goes through the real
 * HTTP layer: @WebMvcTest starts just enough of Spring (routing, JSON
 * conversion, validation) to simulate a real request hitting
 * TransactionController, WITHOUT starting the full app or a real
 * database. MockMvc is the tool that sends fake HTTP requests into that
 * mini Spring context and lets us assert on the actual HTTP response -
 * status code, JSON body, headers.
 *
 * Combined with GlobalExceptionHandler (picked up automatically here
 * since it's a @RestControllerAdvice, not tied to one specific
 * controller), this is what actually proves end-to-end that an invalid
 * request produces the clean error JSON described in build-log 04 -
 * not just that the handler class compiles, but that Spring really
 * wires it in front of a real validation failure.
 */
@WebMvcTest(TransactionController.class)
class TransactionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private TransactionRepository transactionRepository;

    @Test
    void creatingAValidTransactionReturns200() throws Exception {
        Transaction saved = new Transaction(
                LocalDate.of(2026, 9, 1), "STARBUCKS #4521", new BigDecimal("5.75"),
                TransactionType.EXPENSE, null, 1L);
        when(transactionRepository.save(any())).thenReturn(saved);

        mockMvc.perform(post("/api/transactions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "date": "2026-09-01",
                                  "description": "STARBUCKS #4521",
                                  "amount": 5.75,
                                  "type": "EXPENSE",
                                  "userId": 1
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.description").value("STARBUCKS #4521"));
    }

    @Test
    void missingRequiredFieldReturnsCleanValidationError() throws Exception {
        // No "amount" field at all - @NotNull on Transaction.amount should
        // reject this before it ever reaches the repository, and
        // GlobalExceptionHandler should turn that rejection into the
        // documented fieldErrors JSON shape instead of a raw stack trace.
        mockMvc.perform(post("/api/transactions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "date": "2026-09-01",
                                  "description": "STARBUCKS #4521",
                                  "type": "EXPENSE",
                                  "userId": 1
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Validation failed"))
                .andExpect(jsonPath("$.fieldErrors.amount").exists());
    }

    @Test
    void getByIdReturns404WhenNotFound() throws Exception {
        when(transactionRepository.findById(99L)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/transactions/99"))
                .andExpect(status().isNotFound());
    }

    @Test
    void listReturnsTransactionsForUser() throws Exception {
        Transaction t = new Transaction(
                LocalDate.of(2026, 9, 1), "PAYROLL DEPOSIT", new BigDecimal("2450.00"),
                TransactionType.INCOME, null, 1L);
        when(transactionRepository.findByUserIdAndDateBetween(any(), any(), any()))
                .thenReturn(List.of(t));

        mockMvc.perform(get("/api/transactions").param("userId", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].description").value("PAYROLL DEPOSIT"));
    }
}

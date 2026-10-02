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
    void updatingAnExistingTransactionSavesTheChanges() throws Exception {
        // The most common real reason to edit a transaction: fixing a
        // category AutoCategorizer guessed wrong (build-log 02).
        Transaction existing = new Transaction(
                LocalDate.of(2026, 9, 2), "XZQ MERCHANT 991", new BigDecimal("12.00"),
                TransactionType.EXPENSE, null, 1L);
        when(transactionRepository.findById(5L)).thenReturn(Optional.of(existing));
        when(transactionRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        mockMvc.perform(put("/api/transactions/5")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "date": "2026-09-02",
                                  "description": "XZQ MERCHANT 991",
                                  "amount": 12.00,
                                  "type": "EXPENSE",
                                  "category": "DINING",
                                  "userId": 1
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.category").value("DINING"));
    }

    @Test
    void updatingATransactionClearsTheLowConfidenceFlag() throws Exception {
        // This transaction was auto-imported with a low-confidence guess
        // (e.g. it landed in OTHER). Once a human reviews and saves it -
        // even if they leave the category as-is - it's no longer an
        // unreviewed AI guess (FR-306), so the flag should clear.
        Transaction existing = new Transaction(
                LocalDate.of(2026, 9, 2), "XZQ MERCHANT 991", new BigDecimal("12.00"),
                TransactionType.EXPENSE, null, 1L);
        existing.setLowConfidence(true);
        when(transactionRepository.findById(5L)).thenReturn(Optional.of(existing));
        when(transactionRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        mockMvc.perform(put("/api/transactions/5")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "date": "2026-09-02",
                                  "description": "XZQ MERCHANT 991",
                                  "amount": 12.00,
                                  "type": "EXPENSE",
                                  "category": "DINING",
                                  "userId": 1
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lowConfidence").value(false));
    }

    @Test
    void updatingAMissingTransactionReturns404() throws Exception {
        when(transactionRepository.findById(404L)).thenReturn(Optional.empty());

        mockMvc.perform(put("/api/transactions/404")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "date": "2026-09-02",
                                  "description": "Anything",
                                  "amount": 1.00,
                                  "type": "EXPENSE",
                                  "userId": 1
                                }
                                """))
                .andExpect(status().isNotFound());
    }

    @Test
    void listWithNoDateRangeReturnsEveryTransactionForUser() throws Exception {
        // This is the "Transactions" tab's request: userId only, no
        // start/end. It must go through findByUserId - a previous bug
        // used findByUserIdAndDateBetween(userId, LocalDate.MIN,
        // LocalDate.MAX) as a stand-in for "no filter," but MIN/MAX are
        // years far outside what a database DATE column can hold, so
        // that version silently returned nothing. Mocking
        // findByUserIdAndDateBetween here (instead of findByUserId)
        // would make this test pass even with that bug back in place,
        // so it deliberately only stubs findByUserId.
        Transaction t = new Transaction(
                LocalDate.of(2026, 9, 1), "PAYROLL DEPOSIT", new BigDecimal("2450.00"),
                TransactionType.INCOME, null, 1L);
        when(transactionRepository.findByUserId(1L)).thenReturn(List.of(t));

        mockMvc.perform(get("/api/transactions").param("userId", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].description").value("PAYROLL DEPOSIT"));
    }

    @Test
    void listWithDateRangeUsesTheRangeQuery() throws Exception {
        Transaction t = new Transaction(
                LocalDate.of(2026, 9, 1), "PAYROLL DEPOSIT", new BigDecimal("2450.00"),
                TransactionType.INCOME, null, 1L);
        when(transactionRepository.findByUserIdAndDateBetween(
                        1L, LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 30)))
                .thenReturn(List.of(t));

        mockMvc.perform(get("/api/transactions")
                        .param("userId", "1")
                        .param("start", "2026-09-01")
                        .param("end", "2026-09-30"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].description").value("PAYROLL DEPOSIT"));
    }
}

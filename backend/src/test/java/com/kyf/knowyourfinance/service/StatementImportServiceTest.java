package com.kyf.knowyourfinance.service;

import com.kyf.knowyourfinance.dto.StatementImportResponse;
import com.kyf.knowyourfinance.model.Transaction;
import com.kyf.knowyourfinance.model.TransactionCategory;
import com.kyf.knowyourfinance.model.TransactionType;
import com.kyf.knowyourfinance.repository.TransactionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * This is the test that actually proves the project's core security
 * claim, not just documents it: StatementImportService is wired
 * end-to-end here with REAL CsvStatementParser and AutoCategorizer
 * instances (both are pure/dependency-free, so there's no reason to
 * fake them) and only TransactionRepository mocked - meaning this test
 * exercises the exact same redact-then-categorize-then-save order the
 * real pipeline runs, just without a real database underneath it.
 */
@ExtendWith(MockitoExtension.class)
class StatementImportServiceTest {

    @Mock
    private TransactionRepository transactionRepository;

    private StatementImportService statementImportService;

    @BeforeEach
    void setUp() {
        statementImportService = new StatementImportService(
                new CsvStatementParser(), new AutoCategorizer(), transactionRepository);
    }

    private java.io.InputStream csv(String content) {
        return new ByteArrayInputStream(content.getBytes(StandardCharsets.UTF_8));
    }

    @Test
    void redactsSensitiveNumbersBeforeSaving() throws IOException {
        String csvContent = """
                Date,Description,Amount
                2026-09-07,ACH TRANSFER REF 48217536901,-200.00
                """;

        // Whatever gets passed to save() is captured here so we can
        // inspect it directly - this is the proof that the saved
        // Transaction's description never contains the original,
        // unredacted account-number-looking text.
        when(transactionRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(transactionRepository.existsByUserIdAndDateAndDescriptionAndAmountAndType(
                any(), any(), any(), any(), any())).thenReturn(false);

        StatementImportResponse response = statementImportService.importCsv(csv(csvContent), 1L);

        assertEquals(1, response.getRowsRedacted());
        Transaction saved = response.getTransactions().get(0);
        assertEquals("ACH TRANSFER REF [REDACTED]", saved.getDescription());
        assertFalse(saved.getDescription().contains("48217536901"));
    }

    @Test
    void negativeAmountBecomesAnExpenseWithPositiveMagnitude() throws IOException {
        String csvContent = """
                Date,Description,Amount
                2026-09-02,STARBUCKS #4521,-5.75
                """;

        when(transactionRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(transactionRepository.existsByUserIdAndDateAndDescriptionAndAmountAndType(
                any(), any(), any(), any(), any())).thenReturn(false);

        StatementImportResponse response = statementImportService.importCsv(csv(csvContent), 1L);

        Transaction saved = response.getTransactions().get(0);
        assertEquals(TransactionType.EXPENSE, saved.getType());
        assertEquals(new BigDecimal("5.75"), saved.getAmount()); // stored positive, not -5.75
    }

    @Test
    void positiveAmountBecomesIncome() throws IOException {
        String csvContent = """
                Date,Description,Amount
                2026-09-01,PAYROLL DEPOSIT,2450.00
                """;

        when(transactionRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(transactionRepository.existsByUserIdAndDateAndDescriptionAndAmountAndType(
                any(), any(), any(), any(), any())).thenReturn(false);

        StatementImportResponse response = statementImportService.importCsv(csv(csvContent), 1L);

        Transaction saved = response.getTransactions().get(0);
        assertEquals(TransactionType.INCOME, saved.getType());
        assertEquals(TransactionCategory.INCOME, saved.getCategory());
    }

    @Test
    void skipsRowsThatAlreadyExistInsteadOfSavingDuplicates() throws IOException {
        String csvContent = """
                Date,Description,Amount
                2026-09-01,PAYROLL DEPOSIT,2450.00
                2026-09-02,STARBUCKS #4521,-5.75
                """;

        // Pretend the FIRST row is already in the database (e.g. the
        // statement was already imported once) but the second is new.
        when(transactionRepository.existsByUserIdAndDateAndDescriptionAndAmountAndType(
                eq(1L), eq(LocalDate.of(2026, 9, 1)), eq("PAYROLL DEPOSIT"),
                eq(new BigDecimal("2450.00")), eq(TransactionType.INCOME)))
                .thenReturn(true);
        when(transactionRepository.existsByUserIdAndDateAndDescriptionAndAmountAndType(
                eq(1L), eq(LocalDate.of(2026, 9, 2)), eq("STARBUCKS #4521"),
                eq(new BigDecimal("5.75")), eq(TransactionType.EXPENSE)))
                .thenReturn(false);
        when(transactionRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        StatementImportResponse response = statementImportService.importCsv(csv(csvContent), 1L);

        assertEquals(2, response.getRowsParsed());
        assertEquals(1, response.getTransactionsSaved());
        assertEquals(1, response.getDuplicatesSkipped());
        verify(transactionRepository, times(1)).save(any());
    }
}

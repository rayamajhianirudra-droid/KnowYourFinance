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
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
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
        // lenient: tests that never reach the save step should not fail
        // just because this stub went unused.
        lenient().when(transactionRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));
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
        // The database already holds the payroll row. Note the amount comes
        // back with four decimals (2450.0000) while the CSV says 2450.00,
        // which the duplicate check must treat as the same number.
        when(transactionRepository.findByUserIdAndDateBetween(
                eq(1L), eq(LocalDate.of(2026, 9, 1)), eq(LocalDate.of(2026, 9, 2))))
                .thenReturn(List.of(new Transaction(LocalDate.of(2026, 9, 1), "PAYROLL DEPOSIT",
                        new BigDecimal("2450.0000"), TransactionType.INCOME,
                        TransactionCategory.INCOME, 1L)));

        StatementImportResponse response = statementImportService.importCsv(csv(csvContent), 1L);

        assertEquals(2, response.getRowsParsed());
        assertEquals(1, response.getTransactionsSaved());
        assertEquals(1, response.getDuplicatesSkipped());
        verify(transactionRepository, times(1)).saveAll(any());
        assertEquals(1, response.getTransactions().size());
    }

    @Test
    void reportsHowManyRowsFailedToParse() throws IOException {
        // Row 2 has a non-numeric amount and should be dropped and
        // counted, while row 1 and row 3 still get imported (FR-104).
        String csvContent = """
                Date,Description,Amount
                2026-09-01,GOOD ROW,10.00
                2026-09-02,BAD AMOUNT,not-a-number
                2026-09-03,ANOTHER GOOD ROW,20.00
                """;

        StatementImportResponse response = statementImportService.importCsv(csv(csvContent), 1L);

        assertEquals(2, response.getRowsParsed());
        assertEquals(2, response.getTransactionsSaved());
        assertEquals(1, response.getRowsSkipped());
    }

    @Test
    void flagsALowConfidenceCategoryOnTheSavedTransaction() throws IOException {
        // "XZQ MERCHANT 991" matches none of AutoCategorizer's keywords,
        // so it falls back to OTHER with confidence below the 0.70
        // threshold - the saved transaction should be flagged (FR-303).
        String csvContent = """
                Date,Description,Amount
                2026-09-01,XZQ MERCHANT 991,-15.00
                """;

        StatementImportResponse response = statementImportService.importCsv(csv(csvContent), 1L);

        Transaction saved = response.getTransactions().get(0);
        assertEquals(TransactionCategory.OTHER, saved.getCategory());
        assertEquals(true, saved.isLowConfidence());
    }

    @Test
    void previewModeReturnsWhatWouldBeSavedWithoutActuallySavingIt() throws IOException {
        String csvContent = """
                Date,Description,Amount
                2026-09-01,PAYROLL DEPOSIT,2450.00
                2026-09-02,STARBUCKS #4521,-5.75
                """;

        // persist = false: the preview path. Note save() is never stubbed
        // at all here - if the service called it, Mockito would return
        // null and this test would fail with a NullPointerException,
        // which is exactly the point.
        StatementImportResponse response = statementImportService.importCsv(csv(csvContent), 1L, false);

        assertEquals(2, response.getRowsParsed());
        assertEquals(2, response.getTransactionsSaved());
        assertEquals(2, response.getTransactions().size());
        verify(transactionRepository, never()).saveAll(any());
    }

    @Test
    void doesNotFlagAConfidentCategoryMatch() throws IOException {
        String csvContent = """
                Date,Description,Amount
                2026-09-02,STARBUCKS #4521,-5.75
                """;

        StatementImportResponse response = statementImportService.importCsv(csv(csvContent), 1L);

        Transaction saved = response.getTransactions().get(0);
        assertEquals(TransactionCategory.DINING, saved.getCategory());
        assertFalse(saved.isLowConfidence());
    }

    @Test
    void checksForDuplicatesWithOneLookupNoMatterHowManyRows() throws IOException {
        String csvContent = """
                Date,Description,Amount
                2026-09-01,PAYROLL DEPOSIT,2450.00
                2026-09-02,STARBUCKS #4521,-5.75
                2026-09-03,SHELL GAS STATION,-40.00
                2026-09-04,NETFLIX,-15.49
                """;

        statementImportService.importCsv(csv(csvContent), 1L);

        verify(transactionRepository, times(1)).findByUserIdAndDateBetween(
                eq(1L), eq(LocalDate.of(2026, 9, 1)), eq(LocalDate.of(2026, 9, 4)));
    }

    @Test
    void aRowRepeatedInsideTheSameFileIsCountedAsADuplicate() throws IOException {
        String csvContent = """
                Date,Description,Amount
                2026-09-02,STARBUCKS #4521,-5.75
                2026-09-02,STARBUCKS #4521,-5.75
                """;

        StatementImportResponse response = statementImportService.importCsv(csv(csvContent), 1L);

        assertEquals(1, response.getTransactionsSaved());
        assertEquals(1, response.getDuplicatesSkipped());
    }

    @Test
    void anEmptyFileSkipsTheDatabaseEntirely() throws IOException {
        StatementImportResponse response = statementImportService.importCsv(
                csv("Date,Description,Amount\n"), 1L);

        assertEquals(0, response.getRowsParsed());
        verify(transactionRepository, never()).findByUserIdAndDateBetween(any(), any(), any());
    }

    @Test
    void theSummaryCountsRedactedRowsAndSavedRowsSeparately() throws IOException {
        String csvContent = """
                Date,Description,Amount
                2026-09-07,ACH TRANSFER REF 48217536901,-200.00
                2026-09-08,ACH TRANSFER REF 99887766554,-75.00
                2026-09-09,STARBUCKS #4521,-5.75
                """;

        StatementImportResponse response = statementImportService.importCsv(csv(csvContent), 1L);

        assertEquals(3, response.getRowsParsed());
        assertEquals(3, response.getTransactionsSaved());
        assertEquals(2, response.getRowsRedacted());
        assertEquals(0, response.getDuplicatesSkipped());
    }
}

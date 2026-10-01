package com.kyf.knowyourfinance.service;

import com.kyf.knowyourfinance.dto.MonthlyReportResponse;
import com.kyf.knowyourfinance.model.TransactionCategory;
import com.kyf.knowyourfinance.model.TransactionType;
import com.kyf.knowyourfinance.repository.TransactionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/**
 * This is exactly the test the "layered architecture" write-up in the
 * learning notes doc promised would be easy: DashboardService doesn't
 * touch a real database, it only calls methods on TransactionRepository
 * - so here we hand it a FAKE repository (a Mockito mock) that returns
 * made-up numbers instead of hitting H2. That's the whole point of
 * splitting service logic out from the repository layer: we can test
 * "does the math work" completely separately from "does the database
 * query work."
 *
 * DashboardService now also builds a report for the PREVIOUS month
 * (feeding InsightsService), so every test here has to stub that
 * second month's queries too - not just the "current" one being
 * asserted on. InsightsService itself is wired in for real rather than
 * mocked, same reasoning as StatementImportServiceTest wiring in real
 * CsvStatementParser/AutoCategorizer: it's pure, dependency-free logic,
 * so faking it would only hide bugs instead of catching them.
 *
 * @ExtendWith(MockitoExtension.class) is what turns on Mockito's
 * annotation processing (@Mock) for this test class - without it, the
 * @Mock field below would just be null.
 */
@ExtendWith(MockitoExtension.class)
class DashboardServiceTest {

    @Mock
    private TransactionRepository transactionRepository;

    private DashboardService dashboardService() {
        return new DashboardService(transactionRepository, new InsightsService());
    }

    @Test
    void calculatesNetSavingsAsIncomeMinusExpenses() {
        Long userId = 1L;
        LocalDate start = LocalDate.of(2026, 9, 1);
        LocalDate end = LocalDate.of(2026, 9, 30);
        LocalDate previousStart = LocalDate.of(2026, 8, 1);
        LocalDate previousEnd = LocalDate.of(2026, 8, 31);

        // "when the repository is asked for income in this exact range,
        // pretend it found $2450" - this is the core trick of mocking:
        // we're not testing the repository here, we're testing what
        // DashboardService DOES with whatever number it gets back.
        when(transactionRepository.sumAmountByUserAndTypeAndDateRange(
                eq(userId), eq(TransactionType.INCOME), eq(start), eq(end)))
                .thenReturn(new BigDecimal("2450.00"));
        when(transactionRepository.sumAmountByUserAndTypeAndDateRange(
                eq(userId), eq(TransactionType.EXPENSE), eq(start), eq(end)))
                .thenReturn(new BigDecimal("1561.66"));
        when(transactionRepository.sumExpensesByCategory(eq(userId), eq(start), eq(end)))
                .thenReturn(List.of());

        // Last month's (August's) numbers - only here so InsightsService
        // has something to compare against; this test doesn't assert on
        // them, so they're just zeroed out.
        when(transactionRepository.sumAmountByUserAndTypeAndDateRange(
                eq(userId), any(), eq(previousStart), eq(previousEnd)))
                .thenReturn(BigDecimal.ZERO);
        when(transactionRepository.sumExpensesByCategory(eq(userId), eq(previousStart), eq(previousEnd)))
                .thenReturn(List.of());

        MonthlyReportResponse report = dashboardService().getMonthlyReport(userId, 2026, 9);

        assertEquals(new BigDecimal("2450.00"), report.getTotalIncome());
        assertEquals(new BigDecimal("1561.66"), report.getTotalExpenses());
        assertEquals(new BigDecimal("888.34"), report.getNetSavings());
        assertEquals(2026, report.getYear());
        assertEquals(9, report.getMonth());
    }

    @Test
    void mapsCategoryTotalsIntoTheResponse() {
        Long userId = 1L;

        TransactionRepository.CategoryTotal groceries = fakeCategoryTotal(
                TransactionCategory.GROCERIES, new BigDecimal("84.12"));
        TransactionRepository.CategoryTotal dining = fakeCategoryTotal(
                TransactionCategory.DINING, new BigDecimal("21.24"));

        when(transactionRepository.sumAmountByUserAndTypeAndDateRange(any(), any(), any(), any()))
                .thenReturn(BigDecimal.ZERO);
        when(transactionRepository.sumExpensesByCategory(eq(userId), any(), any()))
                .thenReturn(List.of(groceries, dining));

        MonthlyReportResponse report = dashboardService().getMonthlyReport(userId, 2026, 9);

        assertEquals(2, report.getCategoryBreakdown().size());
        assertEquals(TransactionCategory.GROCERIES, report.getCategoryBreakdown().get(0).getCategory());
        assertEquals(new BigDecimal("84.12"), report.getCategoryBreakdown().get(0).getTotal());
    }

    @Test
    void netSavingsIsNegativeWhenSpendingExceedsIncome() {
        Long userId = 1L;

        when(transactionRepository.sumAmountByUserAndTypeAndDateRange(
                eq(userId), eq(TransactionType.INCOME), any(), any()))
                .thenReturn(new BigDecimal("500.00"));
        when(transactionRepository.sumAmountByUserAndTypeAndDateRange(
                eq(userId), eq(TransactionType.EXPENSE), any(), any()))
                .thenReturn(new BigDecimal("700.00"));
        when(transactionRepository.sumExpensesByCategory(eq(userId), any(), any()))
                .thenReturn(List.of());

        MonthlyReportResponse report = dashboardService().getMonthlyReport(userId, 2026, 3);

        assertEquals(new BigDecimal("-200.00"), report.getNetSavings());
    }

    @Test
    void trendsReturnsOneSummaryPerMonthOldestFirst() {
        Long userId = 1L;

        when(transactionRepository.sumAmountByUserAndTypeAndDateRange(
                eq(userId), eq(TransactionType.INCOME), any(), any()))
                .thenReturn(new BigDecimal("1000.00"));
        when(transactionRepository.sumAmountByUserAndTypeAndDateRange(
                eq(userId), eq(TransactionType.EXPENSE), any(), any()))
                .thenReturn(new BigDecimal("400.00"));

        var trends = dashboardService().getTrends(userId, 2026, 9, 3);

        // monthsBack=3 ending at September 2026 -> July, August, September,
        // in that order, so a chart can read the list left to right.
        assertEquals(3, trends.size());
        assertEquals(7, trends.get(0).getMonth());
        assertEquals(8, trends.get(1).getMonth());
        assertEquals(9, trends.get(2).getMonth());
        assertEquals(new BigDecimal("600.00"), trends.get(2).getNetSavings());
    }

    /**
     * TransactionRepository.CategoryTotal is an interface Spring Data
     * JPA normally implements automatically for real query results.
     * Since we're not running a real query in this test, we fake one
     * with a tiny anonymous implementation instead.
     */
    private TransactionRepository.CategoryTotal fakeCategoryTotal(
            TransactionCategory category, BigDecimal total) {
        return new TransactionRepository.CategoryTotal() {
            @Override
            public TransactionCategory getCategory() {
                return category;
            }

            @Override
            public BigDecimal getTotal() {
                return total;
            }
        };
    }
}

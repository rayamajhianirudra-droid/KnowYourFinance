package com.kyf.knowyourfinance.service;

import com.kyf.knowyourfinance.dto.MonthlyReportResponse;
import com.kyf.knowyourfinance.model.TransactionCategory;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * InsightsService is pure logic with no repository or database
 * involved at all, so every test here just builds two
 * MonthlyReportResponse objects by hand (one "current," one
 * "previous") and checks what sentences come out - no mocking needed.
 */
class InsightsServiceTest {

    private final InsightsService insightsService = new InsightsService();

    private MonthlyReportResponse report(
            BigDecimal income, BigDecimal expenses,
            List<MonthlyReportResponse.CategoryBreakdownItem> breakdown) {
        return new MonthlyReportResponse(2026, 9, income, expenses, income.subtract(expenses), breakdown);
    }

    @Test
    void emptyMonthProducesAStarterMessageAndNothingElse() {
        MonthlyReportResponse current = report(BigDecimal.ZERO, BigDecimal.ZERO, List.of());
        MonthlyReportResponse previous = report(BigDecimal.ZERO, BigDecimal.ZERO, List.of());

        List<String> insights = insightsService.generate(current, previous);

        assertEquals(1, insights.size());
        assertTrue(insights.get(0).contains("No transactions recorded"));
    }

    @Test
    void flagsOverspendingWhenNetSavingsIsNegative() {
        MonthlyReportResponse current = report(
                new BigDecimal("500.00"), new BigDecimal("700.00"), List.of());
        MonthlyReportResponse previous = report(BigDecimal.ZERO, BigDecimal.ZERO, List.of());

        List<String> insights = insightsService.generate(current, previous);

        assertTrue(insights.stream().anyMatch(s -> s.contains("$200.00 more than you earned")));
    }

    @Test
    void flagsMissingIncomeWhenOnlyExpensesAreRecorded() {
        MonthlyReportResponse current = report(
                BigDecimal.ZERO, new BigDecimal("150.00"), List.of());
        MonthlyReportResponse previous = report(BigDecimal.ZERO, BigDecimal.ZERO, List.of());

        List<String> insights = insightsService.generate(current, previous);

        assertTrue(insights.stream().anyMatch(s -> s.contains("No income recorded this month")));
    }

    @Test
    void flagsASignificantSpendingIncreaseComparedToLastMonth() {
        MonthlyReportResponse current = report(
                new BigDecimal("2000.00"), new BigDecimal("1200.00"), List.of());
        MonthlyReportResponse previous = report(
                new BigDecimal("2000.00"), new BigDecimal("1000.00"), List.of());

        List<String> insights = insightsService.generate(current, previous);

        // (1200 - 1000) / 1000 = 20% increase
        assertTrue(insights.stream().anyMatch(s -> s.contains("up 20%")));
    }

    @Test
    void ignoresSmallSpendingChangesAsNotWorthMentioning() {
        MonthlyReportResponse current = report(
                new BigDecimal("2000.00"), new BigDecimal("1030.00"), List.of());
        MonthlyReportResponse previous = report(
                new BigDecimal("2000.00"), new BigDecimal("1000.00"), List.of());

        List<String> insights = insightsService.generate(current, previous);

        // Only a 3% change - below the 10% noteworthy threshold.
        assertTrue(insights.stream().noneMatch(s -> s.contains("compared to last month")));
    }

    @Test
    void flagsTheCategoryWithTheBiggestDollarIncrease() {
        var currentBreakdown = List.of(
                new MonthlyReportResponse.CategoryBreakdownItem(
                        TransactionCategory.DINING, new BigDecimal("150.00")),
                new MonthlyReportResponse.CategoryBreakdownItem(
                        TransactionCategory.GROCERIES, new BigDecimal("210.00")));
        var previousBreakdown = List.of(
                new MonthlyReportResponse.CategoryBreakdownItem(
                        TransactionCategory.DINING, new BigDecimal("40.00")),
                new MonthlyReportResponse.CategoryBreakdownItem(
                        TransactionCategory.GROCERIES, new BigDecimal("200.00")));

        MonthlyReportResponse current = report(
                new BigDecimal("3000.00"), new BigDecimal("360.00"), currentBreakdown);
        MonthlyReportResponse previous = report(
                new BigDecimal("3000.00"), new BigDecimal("240.00"), previousBreakdown);

        List<String> insights = insightsService.generate(current, previous);

        // DINING jumped $110 (40 -> 150), GROCERIES only jumped $10 -
        // DINING should be called out, not GROCERIES.
        assertTrue(insights.stream().anyMatch(
                s -> s.contains("DINING") && s.contains("$40.00") && s.contains("$150.00")));
        assertTrue(insights.stream().noneMatch(s -> s.contains("GROCERIES")));
    }
}

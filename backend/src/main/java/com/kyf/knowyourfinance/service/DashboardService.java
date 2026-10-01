package com.kyf.knowyourfinance.service;

import com.kyf.knowyourfinance.dto.MonthlyReportResponse;
import com.kyf.knowyourfinance.model.TransactionType;
import com.kyf.knowyourfinance.repository.TransactionRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;

/**
 * The SERVICE layer sits between the controller (which only knows about
 * HTTP - requests and responses) and the repository (which only knows
 * about the database). Its job is business logic: given a year and a
 * month, what does "the report for that period" actually mean, and how
 * do we build it out of the raw repository queries?
 *
 * Why not just do this math inside the controller? Two reasons we'll
 * actually feel later: (1) when the statement-upload feature arrives, it
 * will probably need these exact same totals too - separating this logic
 * out means both the dashboard endpoint and the upload-confirmation
 * screen can call the same method instead of duplicating it; (2) it's
 * much easier to unit-test a plain service method than a controller
 * wired to a real HTTP server.
 */
@Service
public class DashboardService {

    private final TransactionRepository transactionRepository;

    /**
     * Constructor injection: Spring sees this class needs a
     * TransactionRepository to do its job, and automatically hands one in
     * when it creates this DashboardService - we never type `new
     * DashboardService(...)` ourselves anywhere. This is "Dependency
     * Injection," one of the core ideas Spring is built around.
     */
    public DashboardService(TransactionRepository transactionRepository) {
        this.transactionRepository = transactionRepository;
    }

    /**
     * Builds the month/year income-vs-expense report - the feature we
     * keep calling KYF's main differentiator versus apps like Rocket
     * Money. The user picks any year + month; this turns that into a
     * concrete date range and asks the repository for three numbers:
     * total income, total expenses, and a per-category expense
     * breakdown.
     */
    public MonthlyReportResponse getMonthlyReport(Long userId, int year, int month) {
        YearMonth yearMonth = YearMonth.of(year, month);
        LocalDate start = yearMonth.atDay(1);
        LocalDate end = yearMonth.atEndOfMonth();

        var totalIncome = transactionRepository.sumAmountByUserAndTypeAndDateRange(
                userId, TransactionType.INCOME, start, end);
        var totalExpenses = transactionRepository.sumAmountByUserAndTypeAndDateRange(
                userId, TransactionType.EXPENSE, start, end);
        var netSavings = totalIncome.subtract(totalExpenses);

        List<MonthlyReportResponse.CategoryBreakdownItem> breakdown =
                transactionRepository.sumExpensesByCategory(userId, start, end).stream()
                        .map(row -> new MonthlyReportResponse.CategoryBreakdownItem(
                                row.getCategory(), row.getTotal()))
                        .toList();

        return new MonthlyReportResponse(year, month, totalIncome, totalExpenses, netSavings, breakdown);
    }
}

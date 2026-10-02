package com.kyf.knowyourfinance.service;

import com.kyf.knowyourfinance.dto.MonthlyReportResponse;
import com.kyf.knowyourfinance.dto.MonthlySummary;
import com.kyf.knowyourfinance.model.TransactionType;
import com.kyf.knowyourfinance.repository.TransactionRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
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
    private final InsightsService insightsService;

    /**
     * Constructor injection: Spring sees this class needs a
     * TransactionRepository (and now an InsightsService) to do its job,
     * and automatically hands both in when it creates this
     * DashboardService - we never type `new DashboardService(...)`
     * ourselves anywhere. This is "Dependency Injection," one of the
     * core ideas Spring is built around.
     */
    public DashboardService(TransactionRepository transactionRepository, InsightsService insightsService) {
        this.transactionRepository = transactionRepository;
        this.insightsService = insightsService;
    }

    /**
     * Builds the month/year income-vs-expense report - the feature we
     * keep calling KYF's main differentiator versus apps like Rocket
     * Money. The user picks any year + month; this turns that into a
     * concrete date range and asks the repository for three numbers:
     * total income, total expenses, and a per-category expense
     * breakdown - then also builds last month's version of the same
     * report (without recursing into ITS insights) purely so
     * InsightsService has something to compare against.
     */
    public MonthlyReportResponse getMonthlyReport(Long userId, int year, int month) {
        MonthlyReportResponse current = buildReport(userId, year, month);

        YearMonth previousMonth = YearMonth.of(year, month).minusMonths(1);
        MonthlyReportResponse previous =
                buildReport(userId, previousMonth.getYear(), previousMonth.getMonthValue());

        applyPreviousPeriod(current, previous);
        current.setInsights(insightsService.generate(current, previous));
        return current;
    }

    /**
     * The "Custom date range" dashboard option: the same report shape as
     * getMonthlyReport, but for an arbitrary start/end instead of a
     * calendar month. The comparison period is an equal-length window
     * immediately before the requested range, so a 10-day range gets
     * compared against the 10 days before it, not an unrelated calendar
     * month.
     *
     * No insights sentences here - InsightsService's wording ("up 18%
     * compared to last month") is written for calendar months, and
     * reusing it for an arbitrary range would misstate what it's
     * comparing. The raw numbers (including the previous-period ones)
     * are still returned, so the frontend's stat cards still get a real
     * comparison - they just don't get an auto-generated sentence.
     */
    public MonthlyReportResponse getReportForRange(Long userId, LocalDate start, LocalDate end) {
        MonthlyReportResponse current = buildReportForRange(userId, start, end);

        long daysInRange = java.time.temporal.ChronoUnit.DAYS.between(start, end) + 1;
        LocalDate previousEnd = start.minusDays(1);
        LocalDate previousStart = previousEnd.minusDays(daysInRange - 1);
        MonthlyReportResponse previous = buildReportForRange(userId, previousStart, previousEnd);

        applyPreviousPeriod(current, previous);
        return current;
    }

    /**
     * Copies the previous period's totals onto the current report and
     * decides whether that comparison is worth showing at all - a
     * previous period with literally nothing recorded in it (income,
     * expenses, and net savings all zero) almost certainly just means
     * there's no history there yet, not that spending genuinely dropped
     * to zero, so the frontend is told not to present that as a real
     * comparison.
     */
    private void applyPreviousPeriod(MonthlyReportResponse current, MonthlyReportResponse previous) {
        current.setPreviousTotalIncome(previous.getTotalIncome());
        current.setPreviousTotalExpenses(previous.getTotalExpenses());
        current.setPreviousNetSavings(previous.getNetSavings());
        boolean hasData = previous.getTotalIncome().signum() != 0
                || previous.getTotalExpenses().signum() != 0;
        current.setPreviousPeriodHasData(hasData);
    }

    private MonthlyReportResponse buildReport(Long userId, int year, int month) {
        YearMonth yearMonth = YearMonth.of(year, month);
        MonthlyReportResponse report = buildReportForRange(
                userId, yearMonth.atDay(1), yearMonth.atEndOfMonth());
        report.setYear(year);
        report.setMonth(month);
        return report;
    }

    /**
     * The actual totals-and-breakdown calculation, for any start/end
     * date range - a calendar month is just one particular range.
     * year/month on the returned response are left at their default (0)
     * here; buildReport() fills them in for the calendar-month case,
     * and a range report simply doesn't use them (the frontend already
     * knows the start/end it asked for).
     */
    private MonthlyReportResponse buildReportForRange(Long userId, LocalDate start, LocalDate end) {
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

        return new MonthlyReportResponse(0, 0, totalIncome, totalExpenses, netSavings, breakdown);
    }

    /**
     * Builds the "spending trends" chart data: one summary per month,
     * for the `monthsBack` months ending at (and including) the given
     * year/month, oldest first - so a chart can just iterate the list
     * left to right. Deliberately lighter than buildReport() above: no
     * category breakdown, no insights, just the three headline numbers
     * per month, since that's all a multi-month bar chart needs.
     */
    public List<MonthlySummary> getTrends(Long userId, int year, int month, int monthsBack) {
        int clampedMonthsBack = Math.max(1, Math.min(monthsBack, 24));
        YearMonth endMonth = YearMonth.of(year, month);

        List<MonthlySummary> summaries = new ArrayList<>();
        for (int i = clampedMonthsBack - 1; i >= 0; i--) {
            YearMonth yearMonth = endMonth.minusMonths(i);
            LocalDate start = yearMonth.atDay(1);
            LocalDate end = yearMonth.atEndOfMonth();

            var totalIncome = transactionRepository.sumAmountByUserAndTypeAndDateRange(
                    userId, TransactionType.INCOME, start, end);
            var totalExpenses = transactionRepository.sumAmountByUserAndTypeAndDateRange(
                    userId, TransactionType.EXPENSE, start, end);

            summaries.add(new MonthlySummary(
                    yearMonth.getYear(), yearMonth.getMonthValue(),
                    totalIncome, totalExpenses, totalIncome.subtract(totalExpenses)));
        }
        return summaries;
    }
}

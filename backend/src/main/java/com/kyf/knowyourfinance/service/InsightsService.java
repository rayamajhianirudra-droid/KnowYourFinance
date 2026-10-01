package com.kyf.knowyourfinance.service;

import com.kyf.knowyourfinance.dto.MonthlyReportResponse;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Turns two MonthlyReportResponses (this month and last month) into a
 * handful of plain-English sentences - the "Smart insights" feature.
 * The point isn't to say anything a person couldn't figure out by
 * reading the numbers themselves; it's to say it FOR them, so the
 * dashboard reads as "here's what's going on" instead of "here are some
 * numbers, you do the comparing."
 *
 * This is a pure, dependency-free class on purpose - it only takes the
 * two reports it's given and returns sentences, with no repository or
 * database calls of its own. That mirrors RedactionUtil and
 * AutoCategorizer: logic like this is easiest to trust (and to unit
 * test) when it can't reach out and touch anything else.
 */
@Service
public class InsightsService {

    // Below this percent change, we don't bother commenting on it - a
    // 2% swing in spending isn't interesting, it's just noise.
    private static final BigDecimal NOTEWORTHY_PERCENT_CHANGE = new BigDecimal("10");

    public List<String> generate(MonthlyReportResponse current, MonthlyReportResponse previous) {
        List<String> insights = new ArrayList<>();

        boolean currentHasAnyData =
                current.getTotalIncome().signum() != 0 || current.getTotalExpenses().signum() != 0;
        if (!currentHasAnyData) {
            insights.add("No transactions recorded yet for this period — upload a statement "
                    + "or add one by hand to start seeing insights here.");
            return insights;
        }

        if (current.getNetSavings().signum() < 0) {
            insights.add("You spent " + money(current.getNetSavings().abs())
                    + " more than you earned this month.");
        } else if (current.getTotalIncome().signum() > 0) {
            insights.add("You saved " + money(current.getNetSavings()) + " this month.");
        }

        if (current.getTotalIncome().signum() == 0 && current.getTotalExpenses().signum() > 0) {
            insights.add("No income recorded this month — if you got paid, add it under "
                    + "\"Add cash transaction\" or upload a statement so your net savings reflects reality.");
        }

        addSpendingTrendInsight(insights, current, previous);
        addBiggestCategoryIncreaseInsight(insights, current, previous);

        return insights;
    }

    private void addSpendingTrendInsight(
            List<String> insights, MonthlyReportResponse current, MonthlyReportResponse previous) {
        BigDecimal previousExpenses = previous.getTotalExpenses();
        if (previousExpenses == null || previousExpenses.signum() <= 0) {
            return; // nothing to compare against
        }

        BigDecimal change = current.getTotalExpenses().subtract(previousExpenses);
        BigDecimal percentChange = change
                .divide(previousExpenses, 4, RoundingMode.HALF_UP)
                .multiply(new BigDecimal("100"));

        if (percentChange.abs().compareTo(NOTEWORTHY_PERCENT_CHANGE) < 0) {
            return; // small enough swing that it isn't worth mentioning
        }

        int wholePercent = percentChange.abs().setScale(0, RoundingMode.HALF_UP).intValue();
        if (percentChange.signum() > 0) {
            insights.add("Your spending is up " + wholePercent + "% compared to last month.");
        } else {
            insights.add("Your spending is down " + wholePercent + "% compared to last month — nice work.");
        }
    }

    private void addBiggestCategoryIncreaseInsight(
            List<String> insights, MonthlyReportResponse current, MonthlyReportResponse previous) {
        Map<String, BigDecimal> previousByCategory = new HashMap<>();
        for (var item : previous.getCategoryBreakdown()) {
            previousByCategory.put(item.getCategory().name(), item.getTotal());
        }

        String biggestIncreaseCategory = null;
        BigDecimal biggestIncreaseAmount = BigDecimal.ZERO;
        BigDecimal biggestIncreasePreviousAmount = BigDecimal.ZERO;

        for (var item : current.getCategoryBreakdown()) {
            BigDecimal previousAmount = previousByCategory.getOrDefault(
                    item.getCategory().name(), BigDecimal.ZERO);
            BigDecimal increase = item.getTotal().subtract(previousAmount);

            // Require a real jump, not just "$1 more than last month" -
            // both a meaningful dollar amount AND it has to be the
            // largest increase seen so far.
            if (increase.compareTo(new BigDecimal("20")) > 0
                    && increase.compareTo(biggestIncreaseAmount) > 0) {
                biggestIncreaseCategory = item.getCategory().name();
                biggestIncreaseAmount = increase;
                biggestIncreasePreviousAmount = previousAmount;
            }
        }

        if (biggestIncreaseCategory != null) {
            BigDecimal newAmount = biggestIncreasePreviousAmount.add(biggestIncreaseAmount);
            insights.add(biggestIncreaseCategory.replace('_', ' ') + " spending went from "
                    + money(biggestIncreasePreviousAmount) + " to " + money(newAmount)
                    + " — the biggest jump this month.");
        }
    }

    private String money(BigDecimal amount) {
        return "$" + amount.setScale(2, RoundingMode.HALF_UP).toPlainString();
    }
}

package com.kyf.knowyourfinance.dto;

import java.math.BigDecimal;

/**
 * One month's worth of totals, with no category breakdown - this is
 * deliberately lighter than MonthlyReportResponse. It exists for the
 * trends endpoint, which returns several months at once (e.g. the last
 * 6), so each entry stays small: just enough to draw one bar/point per
 * month on a chart, not a full report for every month in the range.
 */
public class MonthlySummary {

    private int year;
    private int month;
    private BigDecimal totalIncome;
    private BigDecimal totalExpenses;
    private BigDecimal netSavings;

    public MonthlySummary() {
    }

    public MonthlySummary(int year, int month, BigDecimal totalIncome,
                           BigDecimal totalExpenses, BigDecimal netSavings) {
        this.year = year;
        this.month = month;
        this.totalIncome = totalIncome;
        this.totalExpenses = totalExpenses;
        this.netSavings = netSavings;
    }

    public int getYear() {
        return year;
    }

    public void setYear(int year) {
        this.year = year;
    }

    public int getMonth() {
        return month;
    }

    public void setMonth(int month) {
        this.month = month;
    }

    public BigDecimal getTotalIncome() {
        return totalIncome;
    }

    public void setTotalIncome(BigDecimal totalIncome) {
        this.totalIncome = totalIncome;
    }

    public BigDecimal getTotalExpenses() {
        return totalExpenses;
    }

    public void setTotalExpenses(BigDecimal totalExpenses) {
        this.totalExpenses = totalExpenses;
    }

    public BigDecimal getNetSavings() {
        return netSavings;
    }

    public void setNetSavings(BigDecimal netSavings) {
        this.netSavings = netSavings;
    }
}

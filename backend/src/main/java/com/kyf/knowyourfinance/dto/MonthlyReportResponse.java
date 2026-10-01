package com.kyf.knowyourfinance.dto;

import com.kyf.knowyourfinance.model.TransactionCategory;

import java.math.BigDecimal;
import java.util.List;

/**
 * A DTO ("Data Transfer Object") is a plain class whose only job is to
 * define the exact shape of JSON we send to the frontend. We don't reuse
 * the Transaction entity directly for this because the dashboard doesn't
 * want a raw list of transactions - it wants totals that have already
 * been calculated. Keeping a separate "response shape" class also means
 * we can change the Transaction entity later (add a field, rename
 * something) without automatically changing - and possibly breaking -
 * what the frontend receives.
 *
 * This is the response for KYF's core differentiator: "pick any
 * month/year (or range) and tell me what I made vs. what I spent."
 */
public class MonthlyReportResponse {

    private int year;
    private int month;
    private BigDecimal totalIncome;
    private BigDecimal totalExpenses;
    private BigDecimal netSavings;
    private List<CategoryBreakdownItem> categoryBreakdown;

    public MonthlyReportResponse() {
    }

    public MonthlyReportResponse(int year, int month, BigDecimal totalIncome,
                                  BigDecimal totalExpenses, BigDecimal netSavings,
                                  List<CategoryBreakdownItem> categoryBreakdown) {
        this.year = year;
        this.month = month;
        this.totalIncome = totalIncome;
        this.totalExpenses = totalExpenses;
        this.netSavings = netSavings;
        this.categoryBreakdown = categoryBreakdown;
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

    public List<CategoryBreakdownItem> getCategoryBreakdown() {
        return categoryBreakdown;
    }

    public void setCategoryBreakdown(List<CategoryBreakdownItem> categoryBreakdown) {
        this.categoryBreakdown = categoryBreakdown;
    }

    /**
     * One slice of the category pie chart: a category name plus how much
     * was spent in it during the chosen period.
     */
    public static class CategoryBreakdownItem {
        private TransactionCategory category;
        private BigDecimal total;

        public CategoryBreakdownItem() {
        }

        public CategoryBreakdownItem(TransactionCategory category, BigDecimal total) {
            this.category = category;
            this.total = total;
        }

        public TransactionCategory getCategory() {
            return category;
        }

        public void setCategory(TransactionCategory category) {
            this.category = category;
        }

        public BigDecimal getTotal() {
            return total;
        }

        public void setTotal(BigDecimal total) {
            this.total = total;
        }
    }
}

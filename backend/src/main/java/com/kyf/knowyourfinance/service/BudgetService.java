package com.kyf.knowyourfinance.service;

import com.kyf.knowyourfinance.dto.BudgetProgress;
import com.kyf.knowyourfinance.model.*;
import com.kyf.knowyourfinance.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.YearMonth;
import java.util.*;

@Service
public class BudgetService {
    private final MonthlyBudgetRepository budgets;
    private final TransactionRepository transactions;
    public BudgetService(MonthlyBudgetRepository budgets, TransactionRepository transactions) {
        this.budgets = budgets;
        this.transactions = transactions;
    }

    @Transactional(readOnly = true)
    public List<BudgetProgress> progress(Long userId, YearMonth month) {
        Map<TransactionCategory, BigDecimal> spending = new EnumMap<>(TransactionCategory.class);
        for (Transaction t : transactions.findByUserIdAndDateBetween(userId, month.atDay(1), month.atEndOfMonth())) {
            if (t.getType() == TransactionType.EXPENSE) {
                TransactionCategory category = t.getCategory() == null ? TransactionCategory.OTHER : t.getCategory();
                spending.merge(category, t.getAmount(), BigDecimal::add);
            }
        }
        return budgets.findByUserIdAndMonthStartOrderByCategory(userId, month.atDay(1)).stream().map(b -> {
            BigDecimal spent = spending.getOrDefault(b.getCategory(), BigDecimal.ZERO);
            BigDecimal limit = b.getLimitAmount();
            BigDecimal percent = spent.multiply(BigDecimal.valueOf(100)).divide(limit, 2, RoundingMode.HALF_UP);
            String status = spent.compareTo(limit) > 0 ? "OVER" : spent.compareTo(limit) == 0 ? "REACHED"
                    : spent.compareTo(limit.multiply(new BigDecimal("0.8"))) >= 0 ? "WARNING" : "ON_TRACK";
            return new BudgetProgress(b.getCategory(), limit, spent, limit.subtract(spent), percent, status);
        }).toList();
    }

    @Transactional
    public MonthlyBudget save(Long userId, YearMonth month, TransactionCategory category, BigDecimal amount) {
        MonthlyBudget budget = budgets.findByUserIdAndMonthStartAndCategory(userId, month.atDay(1), category)
                .orElseGet(() -> new MonthlyBudget(userId, month.atDay(1), category, amount));
        budget.setLimitAmount(amount);
        return budgets.save(budget);
    }

    @Transactional
    public int clearMonth(Long userId, YearMonth month) {
        return budgets.deleteLimitsForMonth(userId, month.atDay(1));
    }

    @Transactional
    public boolean remove(Long userId, YearMonth month, TransactionCategory category) {
        return budgets.findByUserIdAndMonthStartAndCategory(userId, month.atDay(1), category).map(budget -> {
            budgets.delete(budget);
            return true;
        }).orElse(false);
    }
}

package com.kyf.knowyourfinance.service;

import com.kyf.knowyourfinance.dto.DataSummary;
import com.kyf.knowyourfinance.dto.ResetResult;
import com.kyf.knowyourfinance.repository.MonthlyBudgetRepository;
import com.kyf.knowyourfinance.repository.SavingsGoalRepository;
import com.kyf.knowyourfinance.repository.SubscriptionDecisionRepository;
import com.kyf.knowyourfinance.repository.TransactionRepository;
import com.kyf.knowyourfinance.repository.UserProfileRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Lets a person wipe their own data and start again. It removes their
 * transactions and monthly budgets, and optionally the saved name.
 * Everything runs in one database transaction, so a failure part way
 * through leaves the data exactly as it was.
 */
@Service
public class DataResetService {

    private final TransactionRepository transactions;
    private final MonthlyBudgetRepository budgets;
    private final UserProfileRepository profiles;
    private final SavingsGoalRepository goals;
    private final SubscriptionDecisionRepository decisions;

    public DataResetService(TransactionRepository transactions,
                            MonthlyBudgetRepository budgets,
                            UserProfileRepository profiles,
                            SavingsGoalRepository goals,
                            SubscriptionDecisionRepository decisions) {
        this.transactions = transactions;
        this.budgets = budgets;
        this.profiles = profiles;
        this.goals = goals;
        this.decisions = decisions;
    }

    @Transactional(readOnly = true)
    public DataSummary summary(Long userId) {
        return new DataSummary(transactions.countByUserId(userId), budgets.countByUserId(userId),
                goals.countByOwnerId(userId), decisions.countByOwnerId(userId));
    }

    @Transactional
    public ResetResult reset(Long userId, boolean includeName) {
        long deletedTransactions = transactions.deleteAllForUser(userId);
        long deletedBudgets = budgets.deleteAllForUser(userId);
        goals.deleteForOwner(userId);
        decisions.deleteForOwner(userId);
        boolean nameRemoved = false;
        if (includeName && profiles.existsById(userId)) {
            profiles.deleteById(userId);
            nameRemoved = true;
        }
        return new ResetResult(deletedTransactions, deletedBudgets, nameRemoved);
    }
}

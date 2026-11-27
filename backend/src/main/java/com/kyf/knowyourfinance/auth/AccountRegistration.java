package com.kyf.knowyourfinance.auth;

import com.kyf.knowyourfinance.repository.MonthlyBudgetRepository;
import com.kyf.knowyourfinance.repository.TransactionRepository;
import com.kyf.knowyourfinance.repository.UserProfileRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AccountRegistration {
    private final AccountRepository accounts;
    private final PasswordEncoder passwords;
    private final TransactionRepository transactions;
    private final MonthlyBudgetRepository budgets;
    private final UserProfileRepository profiles;

    AccountRegistration(AccountRepository accounts, PasswordEncoder passwords, TransactionRepository transactions,
                        MonthlyBudgetRepository budgets, UserProfileRepository profiles) {
        this.accounts = accounts;
        this.passwords = passwords;
        this.transactions = transactions;
        this.budgets = budgets;
        this.profiles = profiles;
    }

    @Transactional
    public Account register(String email, String password) {
        Account account = accounts.saveAndFlush(new Account(email, passwords.encode(password)));
        long owner = account.ownerId();
        if (transactions.countByUserId(owner) != 0 || budgets.countByUserId(owner) != 0 || profiles.existsById(owner)) {
            throw new IllegalStateException("The generated account ID overlaps an existing data owner.");
        }
        return account;
    }
}

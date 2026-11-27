package com.kyf.knowyourfinance.auth;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class AccountTableProtection implements ApplicationRunner {
    private final JdbcTemplate database;

    AccountTableProtection(JdbcTemplate database) {
        this.database = database;
    }

    @Override
    public void run(ApplicationArguments args) {
        // Hosted databases may grant new public tables to browser-facing roles.
        // The owner used by this backend can still read and write credentials.
        database.execute("ALTER TABLE kyf_accounts ENABLE ROW LEVEL SECURITY");
        database.execute("ALTER TABLE savings_goals ENABLE ROW LEVEL SECURITY");
        database.execute("ALTER TABLE subscription_decisions ENABLE ROW LEVEL SECURITY");
    }
}

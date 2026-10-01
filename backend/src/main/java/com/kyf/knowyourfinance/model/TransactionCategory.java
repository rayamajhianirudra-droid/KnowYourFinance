package com.kyf.knowyourfinance.model;

/**
 * A fixed starter set of spending/income categories. This is what the
 * AI categorization feature will assign to each parsed transaction.
 *
 * Starting as an enum (fixed list) rather than a free-text field keeps
 * the dashboard's "spending by category" charts simple and reliable -
 * every transaction falls into one of a known, finite set of buckets,
 * so grouping and summing them is trivial. If we later want users to
 * create fully custom categories, that's a deliberate upgrade (a
 * separate Category table), not something to bolt on halfway through.
 */
public enum TransactionCategory {
    GROCERIES,
    DINING,
    RENT_MORTGAGE,
    UTILITIES,
    SUBSCRIPTIONS,
    TRANSPORTATION,
    SHOPPING,
    ENTERTAINMENT,
    HEALTHCARE,
    EDUCATION,
    TRAVEL,
    INCOME,          // paychecks, deposits, refunds
    TRANSFER,        // money moved between the user's own accounts
    OTHER            // fallback when nothing else fits, or AI confidence is low
}

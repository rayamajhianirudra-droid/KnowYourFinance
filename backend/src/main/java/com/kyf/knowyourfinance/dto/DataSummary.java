package com.kyf.knowyourfinance.dto;

/** What a user currently has stored, shown before they confirm a reset. */
public record DataSummary(long transactions, long budgets, long goals, long subscriptionReviews) {
}

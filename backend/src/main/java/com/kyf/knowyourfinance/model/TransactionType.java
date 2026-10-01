package com.kyf.knowyourfinance.model;

/**
 * Every transaction is either money coming IN (income - a deposit,
 * paycheck, refund) or money going OUT (expense - a purchase, a bill).
 *
 * Using an enum (a fixed, named set of values) instead of a plain
 * String ("income"/"expense") means the compiler catches typos for us.
 * TransactionType.INCOME can't be misspelled the way a raw string like
 * "incom" could - that bug would only show up at runtime, often much
 * later and harder to trace.
 */
public enum TransactionType {
    INCOME,
    EXPENSE
}

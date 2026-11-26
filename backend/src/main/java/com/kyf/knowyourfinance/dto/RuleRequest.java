package com.kyf.knowyourfinance.dto;

import com.kyf.knowyourfinance.model.TransactionCategory;

/** Asks to remember a merchant. applyToExisting also fixes rows already stored. */
public record RuleRequest(String pattern, TransactionCategory category, boolean applyToExisting) {
}

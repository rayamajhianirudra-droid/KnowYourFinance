package com.kyf.knowyourfinance.dto;

import com.kyf.knowyourfinance.model.TransactionCategory;

import java.math.BigDecimal;
import java.util.List;

/**
 * Asks to divide one transaction into several category lines, for example
 * a Walmart receipt that holds both food and a TV.
 */
public record SplitRequest(List<Part> parts) {

    /** One line of the receipt. The label is optional ("TV", "Food"). */
    public record Part(BigDecimal amount, TransactionCategory category, String label) {
    }
}

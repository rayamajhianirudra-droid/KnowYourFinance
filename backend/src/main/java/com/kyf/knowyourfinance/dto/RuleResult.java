package com.kyf.knowyourfinance.dto;

import com.kyf.knowyourfinance.model.CategoryRule;

/** The saved rule and how many existing transactions it changed. */
public record RuleResult(CategoryRule rule, int updated) {
}

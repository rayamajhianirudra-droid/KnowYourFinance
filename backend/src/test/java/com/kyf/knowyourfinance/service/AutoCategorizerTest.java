package com.kyf.knowyourfinance.service;

import com.kyf.knowyourfinance.model.TransactionCategory;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Tests the keyword-matching categorizer. Cheap and fast like
 * RedactionUtilTest - no Spring context needed, @Component is only
 * relevant when Spring is wiring this into another class, not when we
 * construct it directly with `new` in a test.
 */
class AutoCategorizerTest {

    private final AutoCategorizer categorizer = new AutoCategorizer();

    @Test
    void matchesKnownMerchantKeywords() {
        assertEquals(TransactionCategory.DINING, categorizer.categorize("STARBUCKS #4521"));
        assertEquals(TransactionCategory.TRANSPORTATION, categorizer.categorize("UBER TRIP 4A2B"));
        assertEquals(TransactionCategory.SUBSCRIPTIONS, categorizer.categorize("NETFLIX.COM"));
        assertEquals(TransactionCategory.GROCERIES, categorizer.categorize("WALMART GROCERY"));
    }

    @Test
    void isCaseInsensitive() {
        assertEquals(TransactionCategory.DINING, categorizer.categorize("starbucks #4521"));
    }

    @Test
    void fallsBackToOtherWhenNothingMatches() {
        assertEquals(TransactionCategory.OTHER, categorizer.categorize("XZQ MERCHANT 991"));
    }

    @Test
    void fallsBackToOtherForBlankOrNullDescription() {
        assertEquals(TransactionCategory.OTHER, categorizer.categorize(""));
        assertEquals(TransactionCategory.OTHER, categorizer.categorize(null));
    }

    @Test
    void recognizesIncomeKeywords() {
        assertEquals(TransactionCategory.INCOME, categorizer.categorize("PAYROLL DEPOSIT"));
        assertEquals(TransactionCategory.INCOME, categorizer.categorize("DIRECT DEPOSIT ACME CORP"));
    }

    @Test
    void aKeywordMatchMeetsTheConfidenceThreshold() {
        AutoCategorizer.CategorizationResult result =
                categorizer.categorizeWithConfidence("NETFLIX.COM");

        assertEquals(TransactionCategory.SUBSCRIPTIONS, result.getCategory());
        assertTrue(result.getConfidence() >= AutoCategorizer.CONFIDENCE_THRESHOLD);
        assertFalse(result.isLowConfidence());
    }

    @Test
    void noMatchFallsBelowTheConfidenceThresholdAndIsFlaggedLowConfidence() {
        AutoCategorizer.CategorizationResult result =
                categorizer.categorizeWithConfidence("XZQ MERCHANT 991");

        assertEquals(TransactionCategory.OTHER, result.getCategory());
        assertTrue(result.getConfidence() < AutoCategorizer.CONFIDENCE_THRESHOLD);
        assertTrue(result.isLowConfidence());
    }

    @Test
    void blankOrNullDescriptionIsLowConfidence() {
        assertTrue(categorizer.categorizeWithConfidence("").isLowConfidence());
        assertTrue(categorizer.categorizeWithConfidence(null).isLowConfidence());
    }
}

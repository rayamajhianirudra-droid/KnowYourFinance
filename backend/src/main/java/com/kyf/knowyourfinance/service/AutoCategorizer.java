package com.kyf.knowyourfinance.service;

import com.kyf.knowyourfinance.model.TransactionCategory;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Assigns a TransactionCategory to a transaction description using
 * simple keyword matching. This is a deliberate v1: it's rule-based, not
 * AI-based. Milestone docs talk about "AI categorization" as a future
 * feature - this class is the seam where that upgrade plugs in later
 * (swap the body of categorize() for a call to a classification model,
 * keep the same method signature, nothing else in the app has to
 * change).
 *
 * Keyword matching gets a surprisingly large fraction of real
 * transactions right because merchant names are fairly predictable
 * ("UBER", "NETFLIX", "SAFEWAY"...), which is exactly why it's a
 * reasonable place to start rather than reaching for a model on day one.
 */
@Component
public class AutoCategorizer {

    /**
     * The minimum confidence a match needs before we trust it (FR-302).
     * Anything below this is treated the same as "no match at all":
     * fall back to OTHER rather than guess. 0.0 to 1.0 scale, where 1.0
     * would mean total certainty.
     */
    public static final double CONFIDENCE_THRESHOLD = 0.70;

    /**
     * The confidence given to a plain keyword match. This is a simple
     * v1 scoring model to match - a direct, unambiguous keyword hit
     * either happened or it didn't, so there is one score for "matched"
     * and one for "didn't" rather than a sliding scale. A future,
     * smarter categorizer (the "AI" upgrade this class is the seam
     * for - see the class comment) is where a real sliding-scale score
     * per match would come in.
     */
    private static final double MATCH_CONFIDENCE = 0.85;

    /**
     * LinkedHashMap because order matters here: we check keywords in
     * insertion order and return on the first match, so more specific
     * keywords should be listed before more general ones if they could
     * ever overlap.
     */
    private static final Map<String, TransactionCategory> KEYWORD_MAP = new LinkedHashMap<>();

    static {
        KEYWORD_MAP.put("uber", TransactionCategory.TRANSPORTATION);
        KEYWORD_MAP.put("lyft", TransactionCategory.TRANSPORTATION);
        KEYWORD_MAP.put("shell", TransactionCategory.TRANSPORTATION);
        KEYWORD_MAP.put("gas station", TransactionCategory.TRANSPORTATION);
        KEYWORD_MAP.put("transit", TransactionCategory.TRANSPORTATION);

        KEYWORD_MAP.put("netflix", TransactionCategory.SUBSCRIPTIONS);
        KEYWORD_MAP.put("spotify", TransactionCategory.SUBSCRIPTIONS);
        KEYWORD_MAP.put("hulu", TransactionCategory.SUBSCRIPTIONS);
        KEYWORD_MAP.put("subscription", TransactionCategory.SUBSCRIPTIONS);

        KEYWORD_MAP.put("starbucks", TransactionCategory.DINING);
        KEYWORD_MAP.put("mcdonald", TransactionCategory.DINING);
        KEYWORD_MAP.put("restaurant", TransactionCategory.DINING);
        KEYWORD_MAP.put("cafe", TransactionCategory.DINING);
        KEYWORD_MAP.put("coffee", TransactionCategory.DINING);

        KEYWORD_MAP.put("walmart", TransactionCategory.GROCERIES);
        KEYWORD_MAP.put("safeway", TransactionCategory.GROCERIES);
        KEYWORD_MAP.put("grocery", TransactionCategory.GROCERIES);
        KEYWORD_MAP.put("kroger", TransactionCategory.GROCERIES);
        KEYWORD_MAP.put("aldi", TransactionCategory.GROCERIES);

        KEYWORD_MAP.put("rent", TransactionCategory.RENT_MORTGAGE);
        KEYWORD_MAP.put("mortgage", TransactionCategory.RENT_MORTGAGE);

        KEYWORD_MAP.put("electric", TransactionCategory.UTILITIES);
        KEYWORD_MAP.put("water bill", TransactionCategory.UTILITIES);
        KEYWORD_MAP.put("utility", TransactionCategory.UTILITIES);
        KEYWORD_MAP.put("internet", TransactionCategory.UTILITIES);

        KEYWORD_MAP.put("amazon", TransactionCategory.SHOPPING);
        KEYWORD_MAP.put("target", TransactionCategory.SHOPPING);
        KEYWORD_MAP.put("best buy", TransactionCategory.SHOPPING);

        KEYWORD_MAP.put("movie", TransactionCategory.ENTERTAINMENT);
        KEYWORD_MAP.put("cinema", TransactionCategory.ENTERTAINMENT);
        KEYWORD_MAP.put("theater", TransactionCategory.ENTERTAINMENT);

        KEYWORD_MAP.put("pharmacy", TransactionCategory.HEALTHCARE);
        KEYWORD_MAP.put("clinic", TransactionCategory.HEALTHCARE);
        KEYWORD_MAP.put("urgent care", TransactionCategory.HEALTHCARE);

        KEYWORD_MAP.put("tuition", TransactionCategory.EDUCATION);
        KEYWORD_MAP.put("university", TransactionCategory.EDUCATION);
        KEYWORD_MAP.put("college", TransactionCategory.EDUCATION);

        KEYWORD_MAP.put("airline", TransactionCategory.TRAVEL);
        KEYWORD_MAP.put("hotel", TransactionCategory.TRAVEL);
        KEYWORD_MAP.put("airbnb", TransactionCategory.TRAVEL);

        KEYWORD_MAP.put("payroll", TransactionCategory.INCOME);
        KEYWORD_MAP.put("direct deposit", TransactionCategory.INCOME);
        KEYWORD_MAP.put("paycheck", TransactionCategory.INCOME);

        KEYWORD_MAP.put("transfer", TransactionCategory.TRANSFER);
    }

    /**
     * Looks for the first keyword that appears anywhere in the
     * (lowercased) description. Falls back to OTHER when nothing
     * matches - we'd rather show the user a clearly-unsorted bucket
     * than guess wrong and silently miscategorize their spending.
     *
     * This overload exists for callers (and existing tests) that only
     * care about the category itself. Anything that needs to know HOW
     * confident that guess was - the statement import pipeline, in
     * particular - should call categorizeWithConfidence() instead.
     */
    public TransactionCategory categorize(String description) {
        return categorizeWithConfidence(description).getCategory();
    }

    /**
     * Same matching logic as categorize(), but also reports a
     * confidence score alongside the category (FR-301, FR-302). A
     * keyword match scores above the 0.70 threshold; no match scores
     * 0.0 and falls back to OTHER (FR-303) - the two are structurally
     * the same "fallback" case, just arrived at two different ways
     * (an empty/unreadable description vs. a description with no
     * recognizable signal), matching FR-304's edge case.
     */
    public CategorizationResult categorizeWithConfidence(String description) {
        if (description == null || description.isBlank()) {
            return new CategorizationResult(TransactionCategory.OTHER, 0.0);
        }
        String lower = description.toLowerCase(Locale.ROOT);
        for (Map.Entry<String, TransactionCategory> entry : KEYWORD_MAP.entrySet()) {
            if (lower.contains(entry.getKey())) {
                return new CategorizationResult(entry.getValue(), MATCH_CONFIDENCE);
            }
        }
        return new CategorizationResult(TransactionCategory.OTHER, 0.0);
    }

    /**
     * A category paired with how confident the categorizer was in it.
     * isLowConfidence() is the one piece of logic callers actually need
     * (FR-303): below CONFIDENCE_THRESHOLD, the transaction should be
     * flagged to the user as an auto-guess rather than a real match.
     */
    public static class CategorizationResult {
        private final TransactionCategory category;
        private final double confidence;

        public CategorizationResult(TransactionCategory category, double confidence) {
            this.category = category;
            this.confidence = confidence;
        }

        public TransactionCategory getCategory() {
            return category;
        }

        public double getConfidence() {
            return confidence;
        }

        public boolean isLowConfidence() {
            return confidence < CONFIDENCE_THRESHOLD;
        }
    }
}

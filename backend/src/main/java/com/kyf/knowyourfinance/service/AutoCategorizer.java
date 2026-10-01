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
     */
    public TransactionCategory categorize(String description) {
        if (description == null || description.isBlank()) {
            return TransactionCategory.OTHER;
        }
        String lower = description.toLowerCase(Locale.ROOT);
        for (Map.Entry<String, TransactionCategory> entry : KEYWORD_MAP.entrySet()) {
            if (lower.contains(entry.getKey())) {
                return entry.getValue();
            }
        }
        return TransactionCategory.OTHER;
    }
}

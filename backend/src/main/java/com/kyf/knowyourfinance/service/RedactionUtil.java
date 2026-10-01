package com.kyf.knowyourfinance.service;

import java.util.regex.Pattern;

/**
 * THE most important class in this whole codebase, security-wise.
 *
 * This is the "redaction step" referenced in every comment about why
 * Transaction has no account/routing number fields. Every line of text
 * that comes out of an uploaded statement passes through here BEFORE it
 * touches anything else - before it's logged, before it's categorized,
 * before it's handed to the repository to save. If a statement line
 * happens to contain a long run of digits (which is what account
 * numbers, routing numbers, and card numbers all look like), it gets
 * masked out right here, at the earliest possible point, so there is no
 * later code path that could accidentally persist it.
 *
 * Why regex on "long digit runs" instead of trying to detect "this
 * specific number is a routing number"? Because we don't actually need
 * to know what a number IS to decide it shouldn't be stored - bank
 * statement description lines never legitimately need an 8+ digit
 * number for anything useful to the user (a "STARBUCKS #4521" style
 * store number is short; a loyalty/reference number that long isn't
 * something a budgeting app needs to show). Being aggressive here is a
 * deliberate security trade-off: we would rather occasionally redact a
 * harmless long number than ever risk keeping a real account/routing
 * number.
 */
public final class RedactionUtil {

    /**
     * Matches runs of 8 or more consecutive digits. US routing numbers
     * are 9 digits; account numbers are typically 8-17 digits; card
     * numbers are 13-19. Eight is a deliberately low floor - better to
     * over-redact than under-redact.
     */
    private static final Pattern LONG_DIGIT_RUN = Pattern.compile("\\d{8,}");

    private RedactionUtil() {
        // utility class - never instantiated
    }

    /**
     * Returns the input with every long digit run replaced by a fixed
     * placeholder. Returns the (possibly unchanged) text plus whether a
     * redaction actually happened, so callers can report "N lines had
     * sensitive numbers removed" without storing what those numbers were.
     */
    public static RedactionResult redact(String rawText) {
        if (rawText == null) {
            return new RedactionResult("", false);
        }
        String redacted = LONG_DIGIT_RUN.matcher(rawText).replaceAll("[REDACTED]");
        boolean changed = !redacted.equals(rawText);
        return new RedactionResult(redacted, changed);
    }

    /**
     * A tiny record-like holder for the redacted text and whether
     * anything was actually removed. We never return or log the
     * original text alongside this - only the redacted version leaves
     * this class.
     */
    public static class RedactionResult {
        private final String text;
        private final boolean redacted;

        public RedactionResult(String text, boolean redacted) {
            this.text = text;
            this.redacted = redacted;
        }

        public String getText() {
            return text;
        }

        public boolean isRedacted() {
            return redacted;
        }
    }
}

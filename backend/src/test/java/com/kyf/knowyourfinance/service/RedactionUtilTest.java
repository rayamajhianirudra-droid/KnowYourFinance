package com.kyf.knowyourfinance.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Tests for the single most security-critical class in the app.
 * RedactionUtil has no Spring dependencies at all (no @Autowired, no
 * database, nothing) - it's a pure function from String to String - so
 * these are plain JUnit tests with no Spring context needed to spin up.
 * That's deliberate: keeping security logic in a dependency-free class
 * means it's this cheap and this fast to verify thoroughly.
 */
class RedactionUtilTest {

    @Test
    void redactsLongDigitRunsLikeAccountNumbers() {
        var result = RedactionUtil.redact("ACH TRANSFER REF 48217536901");

        assertTrue(result.isRedacted());
        assertEquals("ACH TRANSFER REF [REDACTED]", result.getText());
    }

    @Test
    void leavesShortStoreNumbersAlone() {
        // "STARBUCKS #4521" has only 4 digits - well under the 8-digit
        // threshold - so it should pass through completely untouched.
        var result = RedactionUtil.redact("STARBUCKS #4521");

        assertFalse(result.isRedacted());
        assertEquals("STARBUCKS #4521", result.getText());
    }

    @Test
    void leavesPlainDescriptionsUntouched() {
        var result = RedactionUtil.redact("PAYROLL DEPOSIT");

        assertFalse(result.isRedacted());
        assertEquals("PAYROLL DEPOSIT", result.getText());
    }

    @Test
    void redactsMultipleLongNumbersInOneLine() {
        var result = RedactionUtil.redact("REF 123456789 TO 987654321012");

        assertTrue(result.isRedacted());
        assertEquals("REF [REDACTED] TO [REDACTED]", result.getText());
    }

    @Test
    void handlesNullInputSafely() {
        // A malformed CSV row could theoretically produce a null
        // description before this is called - redact() should never
        // throw, just return an empty, unredacted result.
        var result = RedactionUtil.redact(null);

        assertFalse(result.isRedacted());
        assertEquals("", result.getText());
    }

    @Test
    void exactlyEightDigitsIsTheRedactionThreshold() {
        // 7 digits: a merchant reference number, left alone.
        var sevenDigits = RedactionUtil.redact("REF 1234567");
        assertFalse(sevenDigits.isRedacted());

        // 8 digits: treated as potentially sensitive, redacted.
        var eightDigits = RedactionUtil.redact("REF 12345678");
        assertTrue(eightDigits.isRedacted());
    }
}

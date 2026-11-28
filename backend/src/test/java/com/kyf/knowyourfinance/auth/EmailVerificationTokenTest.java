package com.kyf.knowyourfinance.auth;

import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Pins down exactly when an email-verification token may be spent. */
class EmailVerificationTokenTest {
    private static final Instant NOW = Instant.parse("2026-11-28T12:00:00Z");

    @Test
    void aFreshTokenIsUsableUntilItExpires() {
        EmailVerificationToken token = new EmailVerificationToken(1L, "hash", NOW, NOW.plusSeconds(3600));
        assertTrue(token.isUsable(NOW));
        assertTrue(token.isUsable(NOW.plusSeconds(3599)));
        assertFalse(token.isUsable(NOW.plusSeconds(3600)));
    }

    @Test
    void anExpiredOrSpentTokenIsNotUsable() {
        EmailVerificationToken expired = new EmailVerificationToken(1L, "hash", NOW.minusSeconds(7200), NOW.minusSeconds(3600));
        assertFalse(expired.isUsable(NOW));

        EmailVerificationToken spent = new EmailVerificationToken(1L, "hash", NOW, NOW.plusSeconds(3600));
        spent.markUsed(NOW.plusSeconds(10));
        assertFalse(spent.isUsable(NOW.plusSeconds(20)));
    }
}

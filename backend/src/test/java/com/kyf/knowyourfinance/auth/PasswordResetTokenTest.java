package com.kyf.knowyourfinance.auth;

import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Pins down exactly when a reset token may and may not be spent. */
class PasswordResetTokenTest {
    private static final Instant NOW = Instant.parse("2026-11-28T12:00:00Z");

    @Test
    void aFreshTokenIsUsableUntilTheInstantItExpires() {
        PasswordResetToken token = new PasswordResetToken(1L, "hash", NOW, NOW.plusSeconds(1800));
        assertTrue(token.isUsable(NOW));
        assertTrue(token.isUsable(NOW.plusSeconds(1799)));
        // Expiry is exclusive: at and after the expiry instant it is done.
        assertFalse(token.isUsable(NOW.plusSeconds(1800)));
        assertFalse(token.isUsable(NOW.plusSeconds(1801)));
    }

    @Test
    void anExpiredTokenIsNotUsable() {
        PasswordResetToken token = new PasswordResetToken(1L, "hash", NOW.minusSeconds(3600), NOW.minusSeconds(1800));
        assertFalse(token.isUsable(NOW));
    }

    @Test
    void aSpentTokenIsNotUsableEvenBeforeExpiry() {
        PasswordResetToken token = new PasswordResetToken(1L, "hash", NOW, NOW.plusSeconds(1800));
        token.markUsed(NOW.plusSeconds(10));
        assertFalse(token.isUsable(NOW.plusSeconds(20)));
    }
}

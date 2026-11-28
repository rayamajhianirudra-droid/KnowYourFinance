package com.kyf.knowyourfinance.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * A single-use, time-limited ticket that lets someone who asked to reset their
 * password actually set a new one.
 *
 * <p>Only the SHA-256 <em>hash</em> of the token is stored. The real token is
 * put in the emailed link and never written to the database or the logs, so a
 * database leak does not hand an attacker working reset links - a stolen hash
 * cannot be turned back into the token that produces it.
 */
@Entity
@Table(name = "password_reset_tokens",
        indexes = @Index(name = "idx_reset_token_hash", columnList = "tokenHash"))
public class PasswordResetToken {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // The kyf_accounts row this token resets. Stored as a plain id rather than
    // a JPA relation to keep the auth tables small and independent.
    @Column(nullable = false)
    private Long accountId;

    // SHA-256 of the random token, hex-encoded (64 characters).
    @Column(nullable = false, unique = true, length = 64)
    private String tokenHash;

    @Column(nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant expiresAt;

    // Set the moment the token is spent, so it can never be used a second time.
    private Instant usedAt;

    protected PasswordResetToken() {}

    PasswordResetToken(Long accountId, String tokenHash, Instant createdAt, Instant expiresAt) {
        this.accountId = accountId;
        this.tokenHash = tokenHash;
        this.createdAt = createdAt;
        this.expiresAt = expiresAt;
    }

    Long accountId() {
        return accountId;
    }

    /** True only while the token is unspent and not yet past its expiry. */
    boolean isUsable(Instant now) {
        return usedAt == null && now.isBefore(expiresAt);
    }

    void markUsed(Instant now) {
        this.usedAt = now;
    }
}

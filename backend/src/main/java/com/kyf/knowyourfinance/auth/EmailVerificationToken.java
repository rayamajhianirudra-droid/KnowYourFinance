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
 * A single-use, time-limited ticket proving that whoever opened the emailed
 * link controls the account's email address. Like the account's credentials,
 * only the SHA-256 hash of the token is stored - the real token lives only in
 * the email - so a database leak yields no usable links.
 */
@Entity
@Table(name = "email_verification_tokens",
        indexes = @Index(name = "idx_verif_token_hash", columnList = "tokenHash"))
public class EmailVerificationToken {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long accountId;

    @Column(nullable = false, unique = true, length = 64)
    private String tokenHash;

    @Column(nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant expiresAt;

    private Instant usedAt;

    protected EmailVerificationToken() {}

    EmailVerificationToken(Long accountId, String tokenHash, Instant createdAt, Instant expiresAt) {
        this.accountId = accountId;
        this.tokenHash = tokenHash;
        this.createdAt = createdAt;
        this.expiresAt = expiresAt;
    }

    Long accountId() {
        return accountId;
    }

    boolean isUsable(Instant now) {
        return usedAt == null && now.isBefore(expiresAt);
    }

    void markUsed(Instant now) {
        this.usedAt = now;
    }
}

package com.kyf.knowyourfinance.auth;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.Optional;

public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, Long> {
    Optional<PasswordResetToken> findByTokenHash(String tokenHash);

    // When a new reset is requested, any earlier unspent tokens for that
    // account are dropped so only the newest link works.
    @Modifying
    @Query("delete from PasswordResetToken t where t.accountId = :accountId and t.usedAt is null")
    void deleteUnusedForAccount(Long accountId);

    // Housekeeping: lets expired rows be cleared out. Returns how many were removed.
    @Modifying
    @Query("delete from PasswordResetToken t where t.expiresAt < :cutoff")
    int deleteExpiredBefore(Instant cutoff);
}

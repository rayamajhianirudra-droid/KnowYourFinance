package com.kyf.knowyourfinance.auth;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.Optional;

public interface EmailVerificationTokenRepository extends JpaRepository<EmailVerificationToken, Long> {
    Optional<EmailVerificationToken> findByTokenHash(String tokenHash);

    // A resend drops any earlier unused token so only the newest link works.
    @Modifying
    @Query("delete from EmailVerificationToken t where t.accountId = :accountId and t.usedAt is null")
    void deleteUnusedForAccount(Long accountId);

    @Modifying
    @Query("delete from EmailVerificationToken t where t.expiresAt < :cutoff")
    int deleteExpiredBefore(Instant cutoff);
}

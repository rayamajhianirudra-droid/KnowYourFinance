package com.kyf.knowyourfinance.auth;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;

/**
 * The password-reset flow: emailing a one-time link to someone who asked, and
 * spending that link to set a new password.
 *
 * <p>Two things are deliberate here. First, {@link #requestReset} behaves the
 * same whether or not the email belongs to an account, so it cannot be used to
 * discover which emails are registered (account enumeration). Second, the raw
 * token is generated from {@link SecureRandom}, handed only to the email, and
 * stored only as a SHA-256 hash; a database leak therefore yields no usable
 * links.
 */
@Service
public class PasswordResetService {
    static final Duration TOKEN_LIFETIME = Duration.ofMinutes(30);
    private static final int TOKEN_BYTES = 32; // 256 bits of entropy

    private final AccountRepository accounts;
    private final PasswordResetTokenRepository tokens;
    private final PasswordEncoder passwords;
    private final ResetEmailSender emailSender;
    private final SessionTracker sessionTracker;
    private final String appBaseUrl;
    private final SecureRandom random = new SecureRandom();

    PasswordResetService(AccountRepository accounts, PasswordResetTokenRepository tokens, PasswordEncoder passwords,
                         ResetEmailSender emailSender, SessionTracker sessionTracker,
                         @Value("${kyf.app.base-url:http://localhost:3000}") String appBaseUrl) {
        this.accounts = accounts;
        this.tokens = tokens;
        this.passwords = passwords;
        this.emailSender = emailSender;
        this.sessionTracker = sessionTracker;
        this.appBaseUrl = stripTrailingSlash(appBaseUrl);
    }

    /**
     * Begins a reset for the given (already normalised) email. If the email
     * matches an account, any earlier unspent tokens are dropped and a fresh
     * single-use token is emailed. If it does not match, nothing happens - but
     * from the caller's side the two cases are indistinguishable.
     */
    @Transactional
    public void requestReset(String normalizedEmail) {
        accounts.findByEmail(normalizedEmail).ifPresent(account -> {
            tokens.deleteUnusedForAccount(account.id());
            String rawToken = newRawToken();
            Instant now = Instant.now();
            tokens.save(new PasswordResetToken(account.id(), hash(rawToken), now, now.plus(TOKEN_LIFETIME)));
            emailSender.sendResetLink(account.email(), appBaseUrl + "/reset-password?token=" + rawToken);
        });
    }

    /**
     * Spends a reset token to set a new password. Returns true only when the
     * token was valid (known, unspent, unexpired) and the password was changed.
     * On success the token is marked used and every session for the account is
     * ended, so a reset also drops any session an attacker may hold.
     */
    @Transactional
    public boolean resetPassword(String rawToken, String newPassword) {
        PasswordResetToken token = tokens.findByTokenHash(hash(rawToken)).orElse(null);
        Instant now = Instant.now();
        if (token == null || !token.isUsable(now)) {
            return false;
        }
        Account account = accounts.lockById(token.accountId()).orElse(null);
        if (account == null) {
            return false;
        }
        account.changePassword(passwords.encode(newPassword));
        accounts.save(account);
        token.markUsed(now);
        tokens.save(token);
        sessionTracker.endAllSessions(account.ownerId());
        return true;
    }

    private String newRawToken() {
        byte[] bytes = new byte[TOKEN_BYTES];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static String hash(String rawToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(rawToken.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException impossible) {
            // Every Java platform is required to provide SHA-256.
            throw new IllegalStateException("SHA-256 is unavailable", impossible);
        }
    }

    private static String stripTrailingSlash(String url) {
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }
}

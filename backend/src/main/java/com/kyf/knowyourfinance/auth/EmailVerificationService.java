package com.kyf.knowyourfinance.auth;

import org.springframework.beans.factory.annotation.Value;
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
 * Confirms that a person controls the email address on their account, by
 * emailing a one-time link and marking the account verified when the link is
 * opened.
 *
 * <p>Verification is a reminder, not a gate: an unverified account still works
 * (see how the app only nudges rather than blocks), and accounts that existed
 * before this feature are treated as already verified, so nobody is locked out
 * unexpectedly. Tokens are generated from {@link SecureRandom}, stored only as
 * a SHA-256 hash, single-use, and expire after a day.
 */
@Service
public class EmailVerificationService {
    static final Duration TOKEN_LIFETIME = Duration.ofHours(24);
    private static final int TOKEN_BYTES = 32;

    private final AccountRepository accounts;
    private final EmailVerificationTokenRepository tokens;
    private final MailSender mail;
    private final String appBaseUrl;
    private final SecureRandom random = new SecureRandom();

    EmailVerificationService(AccountRepository accounts, EmailVerificationTokenRepository tokens, MailSender mail,
                             @Value("${kyf.app.base-url:http://localhost:3000}") String appBaseUrl) {
        this.accounts = accounts;
        this.tokens = tokens;
        this.mail = mail;
        this.appBaseUrl = appBaseUrl.endsWith("/") ? appBaseUrl.substring(0, appBaseUrl.length() - 1) : appBaseUrl;
    }

    /** Emails a fresh verification link, unless the account is already verified. */
    @Transactional
    public void issueFor(Account account) {
        if (account.emailVerified()) {
            return;
        }
        tokens.deleteUnusedForAccount(account.id());
        String rawToken = newRawToken();
        Instant now = Instant.now();
        tokens.save(new EmailVerificationToken(account.id(), hash(rawToken), now, now.plus(TOKEN_LIFETIME)));
        mail.send(account.email(), "Verify your KnowYourFinance email",
                """
                Confirm this email address for your KnowYourFinance account by opening
                the link below. It expires in 24 hours:

                %s

                If you did not create an account, you can ignore this email.
                """.formatted(appBaseUrl + "/verify-email?token=" + rawToken));
    }

    /**
     * Marks the account behind a token verified. Returns true when the token
     * was valid (known, unspent, unexpired); a bad token changes nothing.
     */
    @Transactional
    public boolean verify(String rawToken) {
        EmailVerificationToken token = tokens.findByTokenHash(hash(rawToken)).orElse(null);
        Instant now = Instant.now();
        if (token == null || !token.isUsable(now)) {
            return false;
        }
        Account account = accounts.lockById(token.accountId()).orElse(null);
        if (account == null) {
            return false;
        }
        account.markEmailVerified();
        accounts.save(account);
        token.markUsed(now);
        tokens.save(token);
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
            throw new IllegalStateException("SHA-256 is unavailable", impossible);
        }
    }
}

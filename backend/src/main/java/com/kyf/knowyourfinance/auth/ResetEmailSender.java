package com.kyf.knowyourfinance.auth;

/**
 * Sends the password-reset email. Kept as a small interface so the token logic
 * in {@link PasswordResetService} does not depend on how the mail is delivered,
 * and so tests can substitute a sender that captures the link instead of
 * talking to a real SMTP server.
 */
interface ResetEmailSender {
    void sendResetLink(String email, String resetUrl);
}

package com.kyf.knowyourfinance.auth;

/**
 * Sends a plain-text email. A small seam so the auth code does not depend on
 * how mail is delivered, and so tests can capture messages instead of sending
 * real ones.
 */
interface MailSender {
    void send(String to, String subject, String body);
}

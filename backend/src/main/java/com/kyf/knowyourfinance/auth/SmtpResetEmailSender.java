package com.kyf.knowyourfinance.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

/**
 * Delivers the reset email over SMTP. In development that SMTP server is the
 * local Mailpit container, so no real mail leaves the machine and the link can
 * be read from Mailpit's web inbox; in production SPRING_MAIL_* points at a
 * real server.
 *
 * <p>The mail sender is optional: when no mail host is configured Spring does
 * not create a {@code JavaMailSender}, and this class simply skips sending
 * rather than failing the request. Either way the reset URL - which carries the
 * one-time token - is never written to the logs.
 */
@Component
class SmtpResetEmailSender implements ResetEmailSender {
    private static final Logger log = LoggerFactory.getLogger(SmtpResetEmailSender.class);

    private final ObjectProvider<JavaMailSender> mailSender;
    private final String from;

    SmtpResetEmailSender(ObjectProvider<JavaMailSender> mailSender,
                         @Value("${kyf.mail.from:no-reply@knowyourfinance.local}") String from) {
        this.mailSender = mailSender;
        this.from = from;
    }

    @Override
    public void sendResetLink(String email, String resetUrl) {
        JavaMailSender sender = mailSender.getIfAvailable();
        if (sender == null) {
            // No SMTP configured (a test run, or a deployment that has not set
            // SPRING_MAIL_HOST). Do not fail the request, and do not log the
            // URL - it contains the one-time token.
            log.warn("Password reset requested but no mail server is configured; no email was sent.");
            return;
        }
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(from);
        message.setTo(email);
        message.setSubject("Reset your KnowYourFinance password");
        message.setText("""
                We received a request to reset your KnowYourFinance password.

                Open this link to choose a new password. It expires in 30 minutes
                and can only be used once:

                %s

                If you did not ask for this, you can ignore this email - your
                password stays the same.
                """.formatted(resetUrl));
        sender.send(message);
    }
}

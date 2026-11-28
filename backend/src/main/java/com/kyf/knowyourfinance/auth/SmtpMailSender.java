package com.kyf.knowyourfinance.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

/**
 * Delivers mail over SMTP. In development the SMTP server is the local Mailpit
 * container, so nothing leaves the machine and messages can be read in Mailpit's
 * web inbox; in production SPRING_MAIL_* points at a real server.
 *
 * <p>The sender is optional and failures are swallowed: when no mail host is
 * configured Spring creates no {@code JavaMailSender}, and a transient SMTP
 * error must not break the request that triggered the email (for example
 * sign-up). The body is never logged, because verification and reset links
 * carry one-time tokens.
 */
@Component
class SmtpMailSender implements MailSender {
    private static final Logger log = LoggerFactory.getLogger(SmtpMailSender.class);

    private final ObjectProvider<JavaMailSender> mailSender;
    private final String from;

    SmtpMailSender(ObjectProvider<JavaMailSender> mailSender,
                   @Value("${kyf.mail.from:no-reply@knowyourfinance.local}") String from) {
        this.mailSender = mailSender;
        this.from = from;
    }

    @Override
    public void send(String to, String subject, String body) {
        JavaMailSender sender = mailSender.getIfAvailable();
        if (sender == null) {
            log.warn("Email requested but no mail server is configured; nothing was sent.");
            return;
        }
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(from);
            message.setTo(to);
            message.setSubject(subject);
            message.setText(body);
            sender.send(message);
        } catch (MailException failure) {
            // Best effort: the user can ask for a new link. Do not log the body.
            log.warn("Could not send an email: {}", failure.getMessage());
        }
    }
}

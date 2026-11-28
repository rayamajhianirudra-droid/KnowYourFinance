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
 * One recorded sign-in attempt against an account - successful or not - so the
 * owner can review recent activity and spot a sign-in they do not recognise.
 *
 * <p>Deliberately spare: it stores the owner it belongs to, whether the attempt
 * succeeded, when, and the browser's own User-Agent and address, all shown only
 * to that one account. It never stores the password tried or anything typed.
 */
@Entity
@Table(name = "login_events",
        indexes = @Index(name = "idx_login_events_owner", columnList = "ownerId, occurredAt"))
public class LoginEvent {
    public enum Outcome { SUCCESS, FAILURE }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long ownerId;

    @Column(nullable = false, length = 16)
    private String outcome;

    @Column(nullable = false)
    private Instant occurredAt;

    @Column(length = 256)
    private String userAgent;

    @Column(length = 64)
    private String ipAddress;

    protected LoginEvent() {}

    LoginEvent(Long ownerId, Outcome outcome, Instant occurredAt, String userAgent, String ipAddress) {
        this.ownerId = ownerId;
        this.outcome = outcome.name();
        this.occurredAt = occurredAt;
        this.userAgent = userAgent;
        this.ipAddress = ipAddress;
    }

    public String getOutcome() {
        return outcome;
    }

    public Instant getOccurredAt() {
        return occurredAt;
    }

    public String getUserAgent() {
        return userAgent;
    }

    public String getIpAddress() {
        return ipAddress;
    }
}

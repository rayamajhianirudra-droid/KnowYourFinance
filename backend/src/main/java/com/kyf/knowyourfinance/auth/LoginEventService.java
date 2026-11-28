package com.kyf.knowyourfinance.auth;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

/**
 * Records sign-in attempts and reads an account's recent activity back. Writing
 * an event never blocks or fails a sign-in: it is best-effort bookkeeping.
 */
@Service
public class LoginEventService {
    private final LoginEventRepository events;

    LoginEventService(LoginEventRepository events) {
        this.events = events;
    }

    @Transactional
    public void record(Long ownerId, LoginEvent.Outcome outcome, HttpServletRequest request) {
        String userAgent = truncate(request.getHeader("User-Agent"));
        String ip = truncate64(request.getRemoteAddr());
        events.save(new LoginEvent(ownerId, outcome, Instant.now(), userAgent, ip));
    }

    @Transactional(readOnly = true)
    public List<LoginEvent> recent(Long ownerId) {
        return events.findTop20ByOwnerIdOrderByOccurredAtDesc(ownerId);
    }

    private static String truncate(String value) {
        if (value == null) {
            return null;
        }
        return value.length() > 256 ? value.substring(0, 256) : value;
    }

    private static String truncate64(String value) {
        if (value == null) {
            return null;
        }
        return value.length() > 64 ? value.substring(0, 64) : value;
    }
}

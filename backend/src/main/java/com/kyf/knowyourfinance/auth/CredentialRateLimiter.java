package com.kyf.knowyourfinance.auth;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

@Component
public class CredentialRateLimiter {
    private static final long WINDOW = Duration.ofMinutes(1).toNanos();
    private static final int MAX_PER_ADDRESS = 30;
    private static final int MAX_TOTAL = 120;

    private final Map<String, Integer> attempts = new HashMap<>();
    private long windowStarted = System.nanoTime();
    private int total;

    synchronized void check(String address) {
        long now = System.nanoTime();
        if (now - windowStarted >= WINDOW) {
            attempts.clear();
            total = 0;
            windowStarted = now;
        }
        int count = attempts.getOrDefault(address, 0);
        if (count >= MAX_PER_ADDRESS || total >= MAX_TOTAL) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Try again in a minute.");
        }
        attempts.put(address, count + 1);
        total++;
    }
}

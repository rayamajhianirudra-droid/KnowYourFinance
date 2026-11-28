package com.kyf.knowyourfinance.auth;

import jakarta.servlet.http.HttpSession;
import jakarta.servlet.http.HttpSessionEvent;
import jakarta.servlet.http.HttpSessionListener;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Keeps track of each signed-in account's live HTTP sessions so the person can
 * see the devices they are signed in on and sign any of them out from the
 * server. The web app stores its login in the HTTP session, so invalidating a
 * session immediately drops its login - the next request from that device
 * arrives unauthenticated and the API answers 401.
 *
 * <p>Each session is given a random opaque <em>handle</em> that the browser
 * uses to refer to it. The real session id (the value of the cookie, which is
 * effectively the password for that session) is never sent to the browser, so
 * the list of devices cannot be turned into a way to hijack one of them.
 *
 * <p>Sessions live in this one backend's memory, exactly like the HTTP sessions
 * themselves, so a restart ends them all and the maps start empty again. The
 * {@link HttpSessionListener} half removes an entry when its session times out
 * or is invalidated; Spring Boot registers a bean implementing it automatically.
 */
@Component
public class SessionTracker implements HttpSessionListener {

    private record Tracked(String handle, String sessionId, Instant createdAt,
                           String userAgent, String ipAddress, HttpSession session) {}

    /** What the browser is shown about one signed-in device. No real session id. */
    public record SessionSummary(String handle, Instant createdAt, String device, boolean current) {}

    // ownerId -> (handle -> tracked session).
    private final Map<Long, Map<String, Tracked>> byOwner = new ConcurrentHashMap<>();
    // sessionId -> (ownerId, handle), so a destroyed session is found without scanning.
    private final Map<String, Long> ownerBySessionId = new ConcurrentHashMap<>();
    private final Map<String, String> handleBySessionId = new ConcurrentHashMap<>();

    /** Records a newly authenticated session and returns its opaque handle. */
    String register(Long ownerId, HttpSession session, String userAgent, String ipAddress) {
        String handle = UUID.randomUUID().toString();
        Tracked tracked = new Tracked(handle, session.getId(), Instant.now(),
                truncate(userAgent), ipAddress, session);
        byOwner.computeIfAbsent(ownerId, key -> new ConcurrentHashMap<>()).put(handle, tracked);
        ownerBySessionId.put(session.getId(), ownerId);
        handleBySessionId.put(session.getId(), handle);
        return handle;
    }

    /** The account's live sessions, oldest first, with the current one flagged. */
    List<SessionSummary> list(Long ownerId, String currentSessionId) {
        Map<String, Tracked> sessions = byOwner.get(ownerId);
        if (sessions == null) {
            return List.of();
        }
        return sessions.values().stream()
                .sorted(Comparator.comparing(Tracked::createdAt))
                .map(t -> new SessionSummary(t.handle(), t.createdAt(), t.userAgent(),
                        t.sessionId().equals(currentSessionId)))
                .toList();
    }

    /** Ends one of this account's sessions by its handle. Returns true if it was found. */
    boolean endSession(Long ownerId, String handle) {
        Map<String, Tracked> sessions = byOwner.get(ownerId);
        if (sessions == null) {
            return false;
        }
        Tracked tracked = sessions.get(handle);
        if (tracked == null) {
            return false;
        }
        invalidateQuietly(tracked);
        return true;
    }

    /** Ends every session for the account except the current one. Returns how many were ended. */
    int endOtherSessions(Long ownerId, String currentSessionId) {
        Map<String, Tracked> sessions = byOwner.get(ownerId);
        if (sessions == null) {
            return 0;
        }
        int ended = 0;
        for (Tracked tracked : List.copyOf(sessions.values())) {
            if (tracked.sessionId().equals(currentSessionId)) {
                continue;
            }
            invalidateQuietly(tracked);
            ended++;
        }
        return ended;
    }

    int sessionCount(Long ownerId) {
        Map<String, Tracked> sessions = byOwner.get(ownerId);
        return sessions == null ? 0 : sessions.size();
    }

    private void invalidateQuietly(Tracked tracked) {
        try {
            tracked.session().invalidate();
        } catch (IllegalStateException alreadyGone) {
            // Already invalidated; fall through to forget it.
        }
        forget(tracked.sessionId());
    }

    private void forget(String sessionId) {
        Long ownerId = ownerBySessionId.remove(sessionId);
        String handle = handleBySessionId.remove(sessionId);
        if (ownerId == null || handle == null) {
            return;
        }
        Map<String, Tracked> sessions = byOwner.get(ownerId);
        if (sessions != null) {
            sessions.remove(handle);
            if (sessions.isEmpty()) {
                byOwner.remove(ownerId);
            }
        }
    }

    private static String truncate(String userAgent) {
        if (userAgent == null || userAgent.isBlank()) {
            return "Unknown device";
        }
        return userAgent.length() > 256 ? userAgent.substring(0, 256) : userAgent;
    }

    @Override
    public void sessionDestroyed(HttpSessionEvent event) {
        forget(event.getSession().getId());
    }
}

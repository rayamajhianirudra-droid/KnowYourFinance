package com.kyf.knowyourfinance.auth;

import jakarta.servlet.http.HttpSession;
import jakarta.servlet.http.HttpSessionEvent;
import jakarta.servlet.http.HttpSessionListener;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Keeps a reference to each signed-in account's live HTTP sessions so a
 * credential change can end that account's <em>other</em> sessions
 * server-side - not just on the device that made the change.
 *
 * <p>The web app stores its login state inside the HTTP session (see
 * {@link SecurityConfiguration}'s {@code HttpSessionSecurityContextRepository}),
 * so invalidating a session immediately drops its {@code SecurityContext}:
 * the next request from that device arrives unauthenticated and the API
 * answers 401. That is the whole mechanism - there is no separate token to
 * revoke.
 *
 * <p>Sessions live only in this one backend's memory (a single instance in
 * Docker Compose), exactly like the HTTP sessions themselves, so this
 * registry shares their lifetime: a restart ends every session and this map
 * starts empty again. The {@link HttpSessionListener} half removes an entry
 * when its session times out or is invalidated, so the map never grows past
 * the set of genuinely active sessions. Spring Boot registers a bean that
 * implements {@code HttpSessionListener} with the embedded servlet container
 * automatically.
 */
@Component
public class SessionTracker implements HttpSessionListener {
    // ownerId -> (sessionId -> session). Concurrent maps so parallel sign-ins
    // and the container's session-expiry thread never corrupt the structure.
    private final Map<Long, Map<String, HttpSession>> byOwner = new ConcurrentHashMap<>();
    // sessionId -> ownerId, so a destroyed session can be found without
    // scanning every account.
    private final Map<String, Long> ownerBySession = new ConcurrentHashMap<>();

    /** Records a session as belonging to an account. Safe to call again for the same session. */
    void register(Long ownerId, HttpSession session) {
        byOwner.computeIfAbsent(ownerId, key -> new ConcurrentHashMap<>()).put(session.getId(), session);
        ownerBySession.put(session.getId(), ownerId);
    }

    /**
     * Ends every session for this account except the one given, and returns
     * how many were ended. Used after a password change so other devices are
     * signed out while the current one stays in.
     */
    int endOtherSessions(Long ownerId, String keepSessionId) {
        Map<String, HttpSession> sessions = byOwner.get(ownerId);
        if (sessions == null) {
            return 0;
        }
        int ended = 0;
        // Copy first: invalidate() triggers sessionDestroyed, which edits the map.
        for (HttpSession session : List.copyOf(sessions.values())) {
            if (session.getId().equals(keepSessionId)) {
                continue;
            }
            if (invalidateQuietly(session)) {
                ended++;
            }
        }
        return ended;
    }

    /**
     * Ends every session for this account, keeping none. Used after a password
     * reset, where the person is not signed in on the device completing the
     * reset, so any existing session (including an attacker's) must go.
     */
    int endAllSessions(Long ownerId) {
        return endOtherSessions(ownerId, null);
    }

    /** How many sessions this account currently has open. */
    int sessionCount(Long ownerId) {
        Map<String, HttpSession> sessions = byOwner.get(ownerId);
        return sessions == null ? 0 : sessions.size();
    }

    private boolean invalidateQuietly(HttpSession session) {
        try {
            session.invalidate();
            forget(session.getId());
            return true;
        } catch (IllegalStateException alreadyInvalidated) {
            forget(session.getId());
            return false;
        }
    }

    private void forget(String sessionId) {
        Long ownerId = ownerBySession.remove(sessionId);
        if (ownerId == null) {
            return;
        }
        Map<String, HttpSession> sessions = byOwner.get(ownerId);
        if (sessions != null) {
            sessions.remove(sessionId);
            if (sessions.isEmpty()) {
                byOwner.remove(ownerId);
            }
        }
    }

    @Override
    public void sessionDestroyed(HttpSessionEvent event) {
        forget(event.getSession().getId());
    }
}

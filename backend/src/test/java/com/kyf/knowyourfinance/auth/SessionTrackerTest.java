package com.kyf.knowyourfinance.auth;

import jakarta.servlet.http.HttpSession;
import jakarta.servlet.http.HttpSessionEvent;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Plain unit test for the session bookkeeping - no Spring, no database, no
 * container - so the "sign out my other devices" logic is pinned down
 * deterministically. The end-to-end wiring (a real sign-in actually ending
 * another real session) is covered by AccountSecurityIntegrationTest.
 */
class SessionTrackerTest {

    private static HttpSession session(String id) {
        HttpSession session = mock(HttpSession.class);
        when(session.getId()).thenReturn(id);
        return session;
    }

    @Test
    void endsEveryOtherSessionButKeepsTheCurrentOne() {
        SessionTracker tracker = new SessionTracker();
        HttpSession laptop = session("laptop");
        HttpSession phone = session("phone");
        HttpSession tablet = session("tablet");
        tracker.register(7L, laptop);
        tracker.register(7L, phone);
        tracker.register(7L, tablet);

        int ended = tracker.endOtherSessions(7L, "phone");

        assertEquals(2, ended);
        verify(laptop).invalidate();
        verify(tablet).invalidate();
        verify(phone, never()).invalidate();
        assertEquals(1, tracker.sessionCount(7L));
    }

    @Test
    void doesNotTouchAnotherAccountsSessions() {
        SessionTracker tracker = new SessionTracker();
        HttpSession mine = session("mine");
        HttpSession theirs = session("theirs");
        tracker.register(1L, mine);
        tracker.register(2L, theirs);

        int ended = tracker.endOtherSessions(1L, "keeps-nothing-of-mine");

        assertEquals(1, ended);
        verify(mine).invalidate();
        verify(theirs, never()).invalidate();
        assertEquals(0, tracker.sessionCount(1L));
        assertEquals(1, tracker.sessionCount(2L));
    }

    @Test
    void anAlreadyInvalidatedSessionIsForgottenWithoutCrashing() {
        SessionTracker tracker = new SessionTracker();
        HttpSession live = session("live");
        HttpSession dead = session("dead");
        doThrow(new IllegalStateException("already invalidated")).when(dead).invalidate();
        tracker.register(5L, live);
        tracker.register(5L, dead);

        int ended = tracker.endOtherSessions(5L, "keep-none");

        // live was ended (counts); dead threw so it is not counted, but both
        // are forgotten either way.
        assertEquals(1, ended);
        assertEquals(0, tracker.sessionCount(5L));
    }

    @Test
    void sessionDestroyedForgetsTheSession() {
        SessionTracker tracker = new SessionTracker();
        HttpSession gone = session("gone");
        tracker.register(9L, gone);
        assertEquals(1, tracker.sessionCount(9L));

        tracker.sessionDestroyed(new HttpSessionEvent(gone));

        assertEquals(0, tracker.sessionCount(9L));
    }
}

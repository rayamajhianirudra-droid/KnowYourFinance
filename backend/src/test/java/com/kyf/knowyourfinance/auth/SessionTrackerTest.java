package com.kyf.knowyourfinance.auth;

import jakarta.servlet.http.HttpSession;
import jakarta.servlet.http.HttpSessionEvent;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Unit test for the device/session bookkeeping - no Spring, no database. */
class SessionTrackerTest {

    private static HttpSession session(String id) {
        HttpSession session = mock(HttpSession.class);
        when(session.getId()).thenReturn(id);
        return session;
    }

    @Test
    void listsSessionsWithTheCurrentOneFlaggedAndNeverLeaksSessionIds() {
        SessionTracker tracker = new SessionTracker();
        String laptop = tracker.register(7L, session("sid-laptop"), "LaptopUA", "1.1.1.1");
        String phone = tracker.register(7L, session("sid-phone"), "PhoneUA", "2.2.2.2");

        List<SessionTracker.SessionSummary> list = tracker.list(7L, "sid-phone");

        assertEquals(2, list.size());
        assertTrue(list.stream().anyMatch(s -> s.handle().equals(phone) && s.current()));
        assertTrue(list.stream().anyMatch(s -> s.handle().equals(laptop) && !s.current()));
        // Handles are opaque, not the real session ids.
        assertTrue(list.stream().noneMatch(s -> s.handle().startsWith("sid-")));
    }

    @Test
    void endsOneSessionByHandleWithoutTouchingOthers() {
        SessionTracker tracker = new SessionTracker();
        HttpSession a = session("sid-a");
        HttpSession b = session("sid-b");
        String ha = tracker.register(7L, a, "UA", "ip");
        tracker.register(7L, b, "UA", "ip");

        assertTrue(tracker.endSession(7L, ha));
        verify(a).invalidate();
        verify(b, never()).invalidate();
        assertEquals(1, tracker.sessionCount(7L));
    }

    @Test
    void oneAccountCannotEndAnotherAccountsSession() {
        SessionTracker tracker = new SessionTracker();
        HttpSession mine = session("sid-mine");
        HttpSession theirs = session("sid-theirs");
        String hMine = tracker.register(1L, mine, "UA", "ip");
        String hTheirs = tracker.register(2L, theirs, "UA", "ip");

        // Account 1 presenting account 2's handle: refused, and nothing happens.
        assertFalse(tracker.endSession(1L, hTheirs));
        verify(theirs, never()).invalidate();
        // Its own handle still works.
        assertTrue(tracker.endSession(1L, hMine));
        verify(mine).invalidate();
        assertEquals(1, tracker.sessionCount(2L));
    }

    @Test
    void endsEveryOtherSessionButTheCurrentOne() {
        SessionTracker tracker = new SessionTracker();
        HttpSession a = session("sid-a");
        HttpSession b = session("sid-b");
        HttpSession c = session("sid-c");
        tracker.register(5L, a, "UA", "ip");
        tracker.register(5L, b, "UA", "ip");
        tracker.register(5L, c, "UA", "ip");

        int ended = tracker.endOtherSessions(5L, "sid-b");

        assertEquals(2, ended);
        verify(a).invalidate();
        verify(c).invalidate();
        verify(b, never()).invalidate();
        assertEquals(1, tracker.sessionCount(5L));
    }

    @Test
    void sessionDestroyedForgetsTheSession() {
        SessionTracker tracker = new SessionTracker();
        HttpSession gone = session("sid-gone");
        tracker.register(9L, gone, "UA", "ip");
        assertEquals(1, tracker.sessionCount(9L));

        tracker.sessionDestroyed(new HttpSessionEvent(gone));

        assertEquals(0, tracker.sessionCount(9L));
    }
}

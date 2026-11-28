package com.kyf.knowyourfinance.auth;

import com.kyf.knowyourfinance.service.DataResetService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.csrf.CsrfTokenRepository;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.Locale;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AccountRepository accounts;
    private final PasswordEncoder passwords;
    private final AccountRegistration registration;
    private final HttpSessionSecurityContextRepository sessions;
    private final CsrfTokenRepository csrfTokens;
    private final CredentialRateLimiter rateLimiter;
    private final DataResetService dataReset;
    private final SessionTracker sessionTracker;
    private final LoginEventService loginEvents;
    private final String dummyHash;

    AuthController(AccountRepository accounts, PasswordEncoder passwords, AccountRegistration registration,
                   HttpSessionSecurityContextRepository sessions, CsrfTokenRepository csrfTokens,
                   CredentialRateLimiter rateLimiter, DataResetService dataReset,
                   SessionTracker sessionTracker, LoginEventService loginEvents) {
        this.accounts = accounts;
        this.passwords = passwords;
        this.registration = registration;
        this.sessions = sessions;
        this.csrfTokens = csrfTokens;
        this.rateLimiter = rateLimiter;
        this.dataReset = dataReset;
        this.sessionTracker = sessionTracker;
        this.loginEvents = loginEvents;
        dummyHash = passwords.encode(java.util.UUID.randomUUID().toString());
    }

    @GetMapping("/csrf")
    public CsrfToken csrf(CsrfToken token) {
        return token;
    }

    @GetMapping("/session")
    public SessionView session(@AuthenticationPrincipal AccountPrincipal principal) {
        return new SessionView(principal.email());
    }

    @PostMapping("/signup")
    public SessionView signup(@Valid @RequestBody Credentials credentials,
                              HttpServletRequest request, HttpServletResponse response) {
        rateLimiter.check(request.getRemoteAddr());
        checkPasswordLength(credentials.password());
        if (credentials.password().length() < 12) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Use at least 12 characters.");
        }
        try {
            Account account = registration.register(credentials.normalizedEmail(), credentials.password());
            return authenticate(account, request, response);
        } catch (DataIntegrityViolationException duplicate) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Could not create this account.");
        }
    }

    @PostMapping("/signin")
    public SessionView signin(@Valid @RequestBody Credentials credentials,
                              HttpServletRequest request, HttpServletResponse response) {
        rateLimiter.check(request.getRemoteAddr());
        checkPasswordLength(credentials.password());
        Account account = accounts.findByEmail(credentials.normalizedEmail()).orElse(null);
        boolean valid = passwords.matches(credentials.password(), account == null ? dummyHash : account.passwordHash());
        if (!valid || account == null) {
            // Record the failed attempt only when the email belongs to a real
            // account, so the owner can see it and we never log arbitrary
            // addresses that were simply typed wrong.
            if (account != null) {
                loginEvents.record(account.ownerId(), LoginEvent.Outcome.FAILURE, request);
            }
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password.");
        }
        loginEvents.record(account.ownerId(), LoginEvent.Outcome.SUCCESS, request);
        return authenticate(account, request, response);
    }

    /**
     * Deletes the signed-in account and everything stored for it. The
     * password is asked for again so that a left-open browser cannot
     * remove an account.
     */
    @DeleteMapping("/account")
    public ResponseEntity<Void> deleteAccount(@AuthenticationPrincipal AccountPrincipal principal,
                                              @Valid @RequestBody PasswordConfirmation confirmation,
                                              HttpServletRequest request) {
        rateLimiter.check(request.getRemoteAddr());
        checkPasswordLength(confirmation.password());
        Account account = accounts.findByEmail(principal.email()).orElse(null);
        if (account == null || !passwords.matches(confirmation.password(), account.passwordHash())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "That password is not correct.");
        }
        dataReset.reset(account.ownerId(), true);
        accounts.delete(account);
        var session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        SecurityContextHolder.clearContext();
        return ResponseEntity.noContent().build();
    }

    private SessionView authenticate(Account account, HttpServletRequest request, HttpServletResponse response) {
        request.getSession();
        request.changeSessionId();
        csrfTokens.saveToken(null, request, response);
        AccountPrincipal principal = new AccountPrincipal(account.ownerId(), account.email());
        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(UsernamePasswordAuthenticationToken.authenticated(principal, null, List.of()));
        SecurityContextHolder.setContext(context);
        sessions.saveContext(context, request, response);
        sessionTracker.register(account.ownerId(), request.getSession(),
                request.getHeader("User-Agent"), request.getRemoteAddr());
        return new SessionView(account.email());
    }

    /**
     * GET /api/auth/login-history - the signed-in account's recent sign-in
     * attempts, successful and failed, newest first. Scoped to the account, so
     * it can only ever show that account's own activity.
     */
    @GetMapping("/login-history")
    public List<LoginEventView> loginHistory(@AuthenticationPrincipal AccountPrincipal principal) {
        return loginEvents.recent(principal.ownerId()).stream()
                .map(event -> new LoginEventView(event.getOutcome(), event.getOccurredAt(),
                        event.getUserAgent(), event.getIpAddress()))
                .toList();
    }

    /**
     * GET /api/auth/sessions - the devices this account is currently signed in
     * on, with the current one flagged. Only opaque handles are returned, never
     * the real session ids.
     */
    @GetMapping("/sessions")
    public List<SessionTracker.SessionSummary> sessions(@AuthenticationPrincipal AccountPrincipal principal,
                                                        HttpServletRequest request) {
        return sessionTracker.list(principal.ownerId(), currentSessionId(request));
    }

    /**
     * DELETE /api/auth/sessions/{handle} - signs out one device by its handle.
     * endSession only looks within this account's own sessions, so one account
     * cannot end another's.
     */
    @DeleteMapping("/sessions/{handle}")
    public ResponseEntity<Void> endSession(@AuthenticationPrincipal AccountPrincipal principal,
                                           @PathVariable String handle) {
        return sessionTracker.endSession(principal.ownerId(), handle)
                ? ResponseEntity.noContent().build()
                : ResponseEntity.notFound().build();
    }

    /**
     * POST /api/auth/sessions/revoke-others - signs out every other device for
     * this account, keeping the current one. Returns how many were ended.
     */
    @PostMapping("/sessions/revoke-others")
    public RevokeResult revokeOtherSessions(@AuthenticationPrincipal AccountPrincipal principal,
                                            HttpServletRequest request) {
        return new RevokeResult(sessionTracker.endOtherSessions(principal.ownerId(), currentSessionId(request)));
    }

    private static String currentSessionId(HttpServletRequest request) {
        var session = request.getSession(false);
        return session == null ? null : session.getId();
    }

    private static void checkPasswordLength(String password) {
        if (password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password exceeds 72 UTF-8 bytes.");
        }
    }

    public record Credentials(@NotBlank @Email @Size(max = 254) String email,
                              @NotBlank @Size(max = 72) String password) {
        public Credentials {
            if (email != null) email = email.strip();
        }

        String normalizedEmail() {
            return email.toLowerCase(Locale.ROOT);
        }
    }

    public record PasswordConfirmation(@NotBlank @Size(max = 72) String password) {}

    public record LoginEventView(String outcome, Instant at, String device, String ipAddress) {}

    public record RevokeResult(int signedOutOtherDevices) {}

    public record SessionView(String email) {}
}

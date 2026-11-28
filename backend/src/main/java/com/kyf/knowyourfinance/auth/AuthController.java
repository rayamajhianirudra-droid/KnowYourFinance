package com.kyf.knowyourfinance.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
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
    private final SessionTracker sessionTracker;
    private final String dummyHash;

    AuthController(AccountRepository accounts, PasswordEncoder passwords, AccountRegistration registration,
                   HttpSessionSecurityContextRepository sessions, CsrfTokenRepository csrfTokens,
                   CredentialRateLimiter rateLimiter, SessionTracker sessionTracker) {
        this.accounts = accounts;
        this.passwords = passwords;
        this.registration = registration;
        this.sessions = sessions;
        this.csrfTokens = csrfTokens;
        this.rateLimiter = rateLimiter;
        this.sessionTracker = sessionTracker;
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
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password.");
        }
        return authenticate(account, request, response);
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
        sessionTracker.register(account.ownerId(), request.getSession());
        return new SessionView(account.email());
    }

    /**
     * POST /api/auth/change-password - a signed-in account changes its own
     * password. The current password must be supplied and must match: a
     * walk-up to an unlocked browser cannot silently take the account over,
     * and a hijacked session alone cannot lock the real owner out without
     * knowing the existing password.
     *
     * On success every OTHER session for this account is ended server-side
     * (see {@link SessionTracker}) - so changing the password on one device
     * signs out the laptop left logged in elsewhere, which is the whole point
     * of changing a password you fear someone else knows. The device that
     * made the change stays signed in. The method is transactional so the
     * pessimistic row lock from {@code lockByEmail} is held until the new
     * hash is committed, serialising concurrent changes to the same account.
     */
    @org.springframework.transaction.annotation.Transactional
    @PostMapping("/change-password")
    public PasswordChangeResult changePassword(@AuthenticationPrincipal AccountPrincipal principal,
                                               @Valid @RequestBody PasswordChange change,
                                               HttpServletRequest request) {
        rateLimiter.check(request.getRemoteAddr());
        checkPasswordLength(change.newPassword());
        Account account = accounts.lockByEmail(principal.email())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sign in again."));
        if (!passwords.matches(change.currentPassword(), account.passwordHash())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Current password is incorrect.");
        }
        if (change.newPassword().length() < 12) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Use at least 12 characters.");
        }
        if (passwords.matches(change.newPassword(), account.passwordHash())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Choose a password different from your current one.");
        }
        account.changePassword(passwords.encode(change.newPassword()));
        accounts.save(account);
        HttpSession current = request.getSession();
        sessionTracker.register(account.ownerId(), current);
        int endedOthers = sessionTracker.endOtherSessions(account.ownerId(), current.getId());
        return new PasswordChangeResult(endedOthers);
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

    public record SessionView(String email) {}

    public record PasswordChange(@NotBlank @Size(max = 72) String currentPassword,
                                 @NotBlank @Size(max = 72) String newPassword) {}

    public record PasswordChangeResult(int signedOutOtherDevices) {}
}

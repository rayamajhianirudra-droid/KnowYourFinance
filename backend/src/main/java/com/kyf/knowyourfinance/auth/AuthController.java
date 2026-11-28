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
    private final String dummyHash;

    AuthController(AccountRepository accounts, PasswordEncoder passwords, AccountRegistration registration,
                   HttpSessionSecurityContextRepository sessions, CsrfTokenRepository csrfTokens,
                   CredentialRateLimiter rateLimiter, DataResetService dataReset) {
        this.accounts = accounts;
        this.passwords = passwords;
        this.registration = registration;
        this.sessions = sessions;
        this.csrfTokens = csrfTokens;
        this.rateLimiter = rateLimiter;
        this.dataReset = dataReset;
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
    public SignupView signup(@Valid @RequestBody Credentials credentials,
                              HttpServletRequest request, HttpServletResponse response) {
        rateLimiter.check(request.getRemoteAddr());
        checkPasswordLength(credentials.password());
        if (credentials.password().length() < 12) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Use at least 12 characters.");
        }
        try {
            Account account = registration.register(credentials.normalizedEmail(), credentials.password());
            String recoveryCode = issueRecoveryCode(account);
            return new SignupView(authenticate(account, request, response).email(), recoveryCode);
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

    /** Sets a new password for the signed-in account; the current password must be given. */
    @PostMapping("/password")
    public ResponseEntity<Void> changePassword(@AuthenticationPrincipal AccountPrincipal principal,
                                               @Valid @RequestBody PasswordChange change,
                                               HttpServletRequest request) {
        rateLimiter.check(request.getRemoteAddr());
        checkPasswordLength(change.currentPassword());
        checkNewPassword(change.newPassword());
        Account account = accounts.findByEmail(principal.email()).orElse(null);
        if (account == null || !passwords.matches(change.currentPassword(), account.passwordHash())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Your current password is not correct.");
        }
        account.changePassword(passwords.encode(change.newPassword()));
        accounts.save(account);
        return ResponseEntity.noContent().build();
    }

    /** Replaces the recovery code with a new one, shown once. The old code stops working. */
    @PostMapping("/recovery-code")
    public RecoveryView newRecoveryCode(@AuthenticationPrincipal AccountPrincipal principal,
                                        @Valid @RequestBody PasswordConfirmation confirmation,
                                        HttpServletRequest request) {
        rateLimiter.check(request.getRemoteAddr());
        checkPasswordLength(confirmation.password());
        Account account = accounts.findByEmail(principal.email()).orElse(null);
        if (account == null || !passwords.matches(confirmation.password(), account.passwordHash())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "That password is not correct.");
        }
        return new RecoveryView(issueRecoveryCode(account));
    }

    /**
     * For someone who forgot their password: the email plus the recovery code
     * saved at sign-up sets a new password. The code works once; a fresh one
     * is returned to be saved. A wrong email and a wrong code look the same.
     */
    @PostMapping("/reset-password")
    public RecoveryView resetPassword(@Valid @RequestBody PasswordReset reset, HttpServletRequest request) {
        rateLimiter.check(request.getRemoteAddr());
        checkNewPassword(reset.newPassword());
        Account account = accounts.findByEmail(reset.normalizedEmail()).orElse(null);
        String stored = account == null || account.recoveryHash() == null ? dummyHash : account.recoveryHash();
        boolean valid = passwords.matches(RecoveryCodes.normalize(reset.recoveryCode()), stored);
        if (!valid || account == null || account.recoveryHash() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "The email or recovery code is not correct.");
        }
        account.changePassword(passwords.encode(reset.newPassword()));
        return new RecoveryView(issueRecoveryCode(account));
    }

    private String issueRecoveryCode(Account account) {
        String code = RecoveryCodes.generate();
        account.replaceRecoveryHash(passwords.encode(RecoveryCodes.normalize(code)));
        accounts.save(account);
        return code;
    }

    private static void checkNewPassword(String password) {
        checkPasswordLength(password);
        if (password.length() < 12) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Use at least 12 characters.");
        }
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
        return new SessionView(account.email());
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

    public record PasswordChange(@NotBlank @Size(max = 72) String currentPassword,
                                 @NotBlank @Size(max = 72) String newPassword) {}

    public record PasswordReset(@NotBlank @Email @Size(max = 254) String email,
                                @NotBlank @Size(max = 64) String recoveryCode,
                                @NotBlank @Size(max = 72) String newPassword) {
        String normalizedEmail() {
            return email.strip().toLowerCase(Locale.ROOT);
        }
    }

    public record RecoveryView(String recoveryCode) {}

    public record SignupView(String email, String recoveryCode) {}

    public record SessionView(String email) {}
}

package com.kyf.knowyourfinance.auth;

import com.kyf.knowyourfinance.service.DataResetService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.HttpSessionCsrfTokenRepository;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PasswordRecoveryTest {

    private static final String EMAIL = "student@example.test";
    private static final String OLD_PASSWORD = "an old long password";
    private static final String NEW_PASSWORD = "a brand new password";

    private final AccountRepository accounts = mock(AccountRepository.class);
    private final PasswordEncoder passwords = new BCryptPasswordEncoder(4);
    private final AccountPrincipal principal = new AccountPrincipal(-7L, EMAIL);
    private AuthController controller;
    private Account account;
    private String recoveryCode;

    @BeforeEach
    void setUp() {
        controller = new AuthController(accounts, passwords, mock(AccountRegistration.class),
                new HttpSessionSecurityContextRepository(), new HttpSessionCsrfTokenRepository(),
                new CredentialRateLimiter(), mock(DataResetService.class));
        account = new Account(EMAIL, passwords.encode(OLD_PASSWORD));
        ReflectionTestUtils.setField(account, "id", 7L);
        recoveryCode = RecoveryCodes.generate();
        account.replaceRecoveryHash(passwords.encode(RecoveryCodes.normalize(recoveryCode)));
        when(accounts.findByEmail(EMAIL)).thenReturn(Optional.of(account));
    }

    private AuthController.PasswordReset reset(String email, String code, String password) {
        return new AuthController.PasswordReset(email, code, password);
    }

    @Test
    void theRightCodeSetsANewPasswordAndGivesANewCode() {
        String typedLoosely = recoveryCode.toLowerCase().replace("-", " ");

        AuthController.RecoveryView view = controller.resetPassword(
                reset(" Student@Example.test ", typedLoosely, NEW_PASSWORD), new MockHttpServletRequest());

        assertTrue(passwords.matches(NEW_PASSWORD, account.passwordHash()));
        assertFalse(passwords.matches(OLD_PASSWORD, account.passwordHash()));
        assertNotEquals(recoveryCode, view.recoveryCode());
        assertTrue(passwords.matches(RecoveryCodes.normalize(view.recoveryCode()), account.recoveryHash()));
        assertFalse(passwords.matches(RecoveryCodes.normalize(recoveryCode), account.recoveryHash()));
        verify(accounts).save(account);
    }

    @Test
    void aWrongCodeChangesNothing() {
        ResponseStatusException error = assertThrows(ResponseStatusException.class, () ->
                controller.resetPassword(reset(EMAIL, "AAAA-AAAA-AAAA-AAAA-AAAA", NEW_PASSWORD),
                        new MockHttpServletRequest()));

        assertEquals(HttpStatus.UNAUTHORIZED, error.getStatusCode());
        assertTrue(passwords.matches(OLD_PASSWORD, account.passwordHash()));
        verify(accounts, never()).save(account);
    }

    @Test
    void anUnknownEmailGetsTheSameAnswerAsAWrongCode() {
        when(accounts.findByEmail("nobody@example.test")).thenReturn(Optional.empty());

        ResponseStatusException error = assertThrows(ResponseStatusException.class, () ->
                controller.resetPassword(reset("nobody@example.test", recoveryCode, NEW_PASSWORD),
                        new MockHttpServletRequest()));

        assertEquals(HttpStatus.UNAUTHORIZED, error.getStatusCode());
        assertEquals("The email or recovery code is not correct.", error.getReason());
    }

    @Test
    void anOlderAccountWithoutACodeCannotBeResetThisWay() {
        account.replaceRecoveryHash(null);

        ResponseStatusException error = assertThrows(ResponseStatusException.class, () ->
                controller.resetPassword(reset(EMAIL, recoveryCode, NEW_PASSWORD), new MockHttpServletRequest()));

        assertEquals(HttpStatus.UNAUTHORIZED, error.getStatusCode());
    }

    @Test
    void aShortNewPasswordIsRefused() {
        ResponseStatusException error = assertThrows(ResponseStatusException.class, () ->
                controller.resetPassword(reset(EMAIL, recoveryCode, "short"), new MockHttpServletRequest()));

        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
        verify(accounts, never()).save(account);
    }

    @Test
    void changingThePasswordNeedsTheCurrentOne() {
        controller.changePassword(principal, new AuthController.PasswordChange(OLD_PASSWORD, NEW_PASSWORD),
                new MockHttpServletRequest());

        assertTrue(passwords.matches(NEW_PASSWORD, account.passwordHash()));
        verify(accounts).save(account);
    }

    @Test
    void aWrongCurrentPasswordIsRefused() {
        ResponseStatusException error = assertThrows(ResponseStatusException.class, () ->
                controller.changePassword(principal, new AuthController.PasswordChange("not it at all", NEW_PASSWORD),
                        new MockHttpServletRequest()));

        assertEquals(HttpStatus.FORBIDDEN, error.getStatusCode());
        assertTrue(passwords.matches(OLD_PASSWORD, account.passwordHash()));
    }

    @Test
    void aNewCodeReplacesTheOldOneAndNeedsThePassword() {
        AuthController.RecoveryView view = controller.newRecoveryCode(principal,
                new AuthController.PasswordConfirmation(OLD_PASSWORD), new MockHttpServletRequest());

        assertTrue(passwords.matches(RecoveryCodes.normalize(view.recoveryCode()), account.recoveryHash()));
        assertFalse(passwords.matches(RecoveryCodes.normalize(recoveryCode), account.recoveryHash()));

        assertThrows(ResponseStatusException.class, () -> controller.newRecoveryCode(principal,
                new AuthController.PasswordConfirmation("wrong password here"), new MockHttpServletRequest()));
    }
}

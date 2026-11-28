package com.kyf.knowyourfinance.auth;

import com.kyf.knowyourfinance.service.DataResetService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.HttpSessionCsrfTokenRepository;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AccountDeletionTest {

    private final AccountRepository accounts = mock(AccountRepository.class);
    private final DataResetService dataReset = mock(DataResetService.class);
    private final PasswordEncoder passwords = new BCryptPasswordEncoder(4);
    private AuthController controller;
    private Account account;
    private final AccountPrincipal principal = new AccountPrincipal(-7L, "student@example.test");

    @BeforeEach
    void setUp() {
        controller = new AuthController(accounts, passwords, mock(AccountRegistration.class),
                new HttpSessionSecurityContextRepository(), new HttpSessionCsrfTokenRepository(),
                new CredentialRateLimiter(), dataReset, mock(EmailVerificationService.class));
        account = new Account("student@example.test", passwords.encode("a long enough password"));
        ReflectionTestUtils.setField(account, "id", 7L);
        when(accounts.findByEmail("student@example.test")).thenReturn(Optional.of(account));
    }

    @Test
    void theRightPasswordRemovesTheDataAndTheAccount() {
        var response = controller.deleteAccount(principal,
                new AuthController.PasswordConfirmation("a long enough password"), new MockHttpServletRequest());

        assertEquals(HttpStatus.NO_CONTENT, response.getStatusCode());
        verify(dataReset).reset(-7L, true);
        verify(accounts).delete(account);
    }

    @Test
    void aWrongPasswordChangesNothing() {
        ResponseStatusException error = assertThrows(ResponseStatusException.class, () ->
                controller.deleteAccount(principal, new AuthController.PasswordConfirmation("not the password"),
                        new MockHttpServletRequest()));

        assertEquals(HttpStatus.FORBIDDEN, error.getStatusCode());
        verify(dataReset, never()).reset(anyLong(), anyBoolean());
        verify(accounts, never()).delete(account);
    }
}

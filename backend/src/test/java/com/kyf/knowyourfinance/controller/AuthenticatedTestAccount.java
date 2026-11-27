package com.kyf.knowyourfinance.controller;

import com.kyf.knowyourfinance.auth.AccountPrincipal;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.test.context.support.WithSecurityContext;
import org.springframework.security.test.context.support.WithSecurityContextFactory;

import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.util.List;

@Retention(RetentionPolicy.RUNTIME)
@WithSecurityContext(factory = AuthenticatedTestAccount.Factory.class)
@interface AuthenticatedTestAccount {
    class Factory implements WithSecurityContextFactory<AuthenticatedTestAccount> {
        @Override
        public SecurityContext createSecurityContext(AuthenticatedTestAccount annotation) {
            var context = SecurityContextHolder.createEmptyContext();
            context.setAuthentication(UsernamePasswordAuthenticationToken.authenticated(
                    new AccountPrincipal(1L, "mock@example.test"), null, List.of()));
            return context;
        }
    }
}

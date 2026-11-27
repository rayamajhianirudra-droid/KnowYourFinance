package com.kyf.knowyourfinance.auth;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.CsrfTokenRepository;
import org.springframework.security.web.csrf.HttpSessionCsrfTokenRepository;

@Configuration
public class SecurityConfiguration {
    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    HttpSessionSecurityContextRepository sessionContexts() {
        return new HttpSessionSecurityContextRepository();
    }

    @Bean
    CsrfTokenRepository csrfTokens() {
        return new HttpSessionCsrfTokenRepository();
    }

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http,
                                          HttpSessionSecurityContextRepository contexts,
                                          CsrfTokenRepository csrfTokens) throws Exception {
        return http
                .securityContext(config -> config.securityContextRepository(contexts))
                .requestCache(cache -> cache.disable())
                .csrf(config -> config.csrfTokenRepository(csrfTokens))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.GET, "/api/health", "/api/auth/csrf").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/signup", "/api/auth/signin").permitAll()
                        .anyRequest().authenticated())
                .exceptionHandling(errors -> errors.authenticationEntryPoint((request, response, failure) ->
                        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED)))
                .logout(logout -> logout.logoutUrl("/api/auth/signout")
                        .deleteCookies("JSESSIONID")
                        .logoutSuccessHandler((request, response, authentication) ->
                                response.setStatus(HttpServletResponse.SC_NO_CONTENT)))
                .build();
    }
}

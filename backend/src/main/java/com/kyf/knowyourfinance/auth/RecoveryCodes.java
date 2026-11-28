package com.kyf.knowyourfinance.auth;

import java.security.SecureRandom;
import java.util.Locale;

/**
 * One-time recovery codes: how someone who forgot their password proves the
 * account is theirs without an email service. A code is 20 characters (about
 * 100 bits) from an alphabet without look-alike letters and digits, shown in
 * groups of four. Only a BCrypt hash of it is stored.
 */
final class RecoveryCodes {
    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int LENGTH = 20;
    private static final SecureRandom RANDOM = new SecureRandom();

    private RecoveryCodes() {}

    static String generate() {
        StringBuilder code = new StringBuilder();
        for (int i = 0; i < LENGTH; i++) {
            if (i > 0 && i % 4 == 0) {
                code.append('-');
            }
            code.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
        }
        return code.toString();
    }

    /** Ignores case, spaces and dashes, so a code typed by hand still matches. */
    static String normalize(String typed) {
        return typed == null ? "" : typed.toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]", "");
    }
}

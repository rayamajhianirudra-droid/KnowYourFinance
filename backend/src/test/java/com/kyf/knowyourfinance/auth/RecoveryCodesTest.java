package com.kyf.knowyourfinance.auth;

import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RecoveryCodesTest {

    @Test
    void aCodeHasFiveGroupsOfFourEasyToReadCharacters() {
        assertTrue(RecoveryCodes.generate().matches("([A-HJ-NP-Z2-9]{4}-){4}[A-HJ-NP-Z2-9]{4}"));
    }

    @Test
    void codesDoNotRepeat() {
        Set<String> seen = new HashSet<>();
        for (int i = 0; i < 500; i++) {
            assertTrue(seen.add(RecoveryCodes.generate()));
        }
    }

    @Test
    void typingStyleDoesNotMatter() {
        assertEquals("ABCD2345EFGH6789JKLM", RecoveryCodes.normalize("abcd-2345 efgh-6789  jklm"));
        assertEquals("", RecoveryCodes.normalize(null));
    }
}

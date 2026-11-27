package com.kyf.knowyourfinance.auth;

import java.io.Serializable;
import java.security.Principal;

public record AccountPrincipal(Long ownerId, String email) implements Principal, Serializable {
    @Override
    public String getName() {
        return email;
    }
}

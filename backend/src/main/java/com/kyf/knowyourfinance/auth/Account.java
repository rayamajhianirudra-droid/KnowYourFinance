package com.kyf.knowyourfinance.auth;

import jakarta.persistence.*;

@Entity
@Table(name = "kyf_accounts")
public class Account {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 254)
    private String email;

    @Column(nullable = false, length = 100)
    private String passwordHash;

    protected Account() {}

    Account(String email, String passwordHash) {
        this.email = email;
        this.passwordHash = passwordHash;
    }

    public long ownerId() {
        return -id;
    }

    String email() {
        return email;
    }

    String passwordHash() {
        return passwordHash;
    }

    /**
     * Replaces the stored BCrypt hash. The caller is responsible for having
     * encoded the new password and for checking the current one first; this
     * entity only holds the value.
     */
    void changePassword(String newPasswordHash) {
        this.passwordHash = newPasswordHash;
    }
}

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

    /** BCrypt hash of the one-time recovery code; empty for accounts made before codes existed. */
    @Column(length = 100)
    private String recoveryHash;

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

    String recoveryHash() {
        return recoveryHash;
    }

    void changePassword(String newPasswordHash) {
        this.passwordHash = newPasswordHash;
    }

    void replaceRecoveryHash(String newRecoveryHash) {
        this.recoveryHash = newRecoveryHash;
    }
}

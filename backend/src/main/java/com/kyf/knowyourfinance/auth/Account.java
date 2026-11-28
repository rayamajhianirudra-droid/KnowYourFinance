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

    // Whether the person has confirmed this email address. The column defaults
    // to true so accounts that existed before email verification are treated as
    // already verified and never nagged; new accounts are created unverified
    // (the field below starts false), so only they get a verification email.
    @Column(name = "email_verified", nullable = false, columnDefinition = "boolean not null default true")
    private boolean emailVerified = false;

    protected Account() {}

    Account(String email, String passwordHash) {
        this.email = email;
        this.passwordHash = passwordHash;
    }

    public long ownerId() {
        return -id;
    }

    Long id() {
        return id;
    }

    String email() {
        return email;
    }

    String passwordHash() {
        return passwordHash;
    }

    boolean emailVerified() {
        return emailVerified;
    }

    void markEmailVerified() {
        this.emailVerified = true;
    }
}

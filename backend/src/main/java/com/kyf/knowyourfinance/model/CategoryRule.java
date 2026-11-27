package com.kyf.knowyourfinance.model;

import jakarta.persistence.*;

/**
 * "Always put this merchant in this category." The pattern is a short,
 * lowercase piece of a transaction description, such as "starbucks".
 * A rule beats the built-in keyword guesses, and is used for every later
 * upload.
 */
@Entity
@Table(name = "category_rules", uniqueConstraints = {
        @UniqueConstraint(name = "uq_category_rules_user_pattern", columnNames = {"userId", "pattern"})
})
public class CategoryRule {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "category_rules_seq")
    @SequenceGenerator(name = "category_rules_seq", sequenceName = "category_rules_seq", allocationSize = 1)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false, length = 60)
    private String pattern;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TransactionCategory category;

    protected CategoryRule() {
    }

    public CategoryRule(Long userId, String pattern, TransactionCategory category) {
        this.userId = userId;
        this.pattern = pattern;
        this.category = category;
    }

    public Long getId() {
        return id;
    }

    public Long getUserId() {
        return userId;
    }

    public String getPattern() {
        return pattern;
    }

    public TransactionCategory getCategory() {
        return category;
    }

    public void setCategory(TransactionCategory category) {
        this.category = category;
    }
}

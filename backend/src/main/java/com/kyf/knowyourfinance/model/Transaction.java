package com.kyf.knowyourfinance.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * The core data object of the entire app. Every feature - the
 * dashboard, category breakdowns, month/year reports, recurring
 * charge detection - is really just different ways of querying and
 * grouping a list of Transactions.
 *
 * WHAT THIS CLASS INTENTIONALLY DOES NOT HAVE:
 * No account number. No routing number. No bank name tied to an
 * account identifier. That's not an oversight - it's the central
 * security decision of this whole project. A Transaction only ever
 * stores what's needed to answer "what happened, when, how much, and
 * what category" - nothing that could identify a real bank account.
 * The redaction step (built later) is what guarantees sensitive
 * fields never make it this far upstream to even be saved.
 *
 * @Entity tells Spring/Hibernate: "this class represents a database
 * table." Hibernate will create a `transaction` table automatically
 * (because of spring.jpa.hibernate.ddl-auto=update in our config) with
 * one column per field below.
 */
@Entity
@Table(name = "transactions")
public class Transaction {

    /**
     * The primary key - a unique ID for every row. GenerationType.IDENTITY
     * means the database itself assigns the next number automatically
     * (1, 2, 3...) every time a new Transaction is saved. We never set
     * this by hand.
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * The calendar date the transaction happened (not when it was
     * uploaded/parsed). LocalDate (not a full timestamp) because bank
     * statements give a date, not a time of day.
     */
    @NotNull
    private LocalDate date;

    /**
     * The merchant/description text from the statement, e.g. "STARBUCKS #4521"
     * or "PAYROLL DEPOSIT". This is the raw-ish text the AI categorizer reads
     * to decide a category - but note: by the time it reaches this field,
     * it has already passed through the redaction step, so even if a
     * statement line somehow contained extra sensitive digits, they're
     * stripped before this is ever saved.
     */
    @NotBlank
    private String description;

    /**
     * The dollar amount. We use BigDecimal, NEVER a double/float, for money.
     * This is a real, important rule: floating-point numbers (double/float)
     * cannot represent most decimal fractions exactly in binary - 0.1 + 0.2
     * famously does not equal 0.3 in floating point. For money, that kind of
     * tiny rounding error compounding across thousands of transactions is
     * unacceptable. BigDecimal does exact decimal arithmetic instead.
     */
    @NotNull
    @Column(precision = 19, scale = 4)
    private BigDecimal amount;

    /**
     * Whether this row is money coming in or going out.
     * EnumType.STRING stores the readable word ("INCOME") in the database
     * column instead of a number (0, 1). Slightly more storage, but it
     * means the raw database is human-readable, and - importantly - if we
     * ever reorder the enum's values in code, existing data doesn't
     * silently become wrong (which WOULD happen with the default numeric
     * storage, since it stores the enum's position, not its name).
     */
    @NotNull
    @Enumerated(EnumType.STRING)
    private TransactionType type;

    /**
     * The spending category - set by the AI categorization feature after
     * parsing. Nullable for now: a freshly parsed transaction may not be
     * categorized yet (e.g. if categorization runs as a separate step).
     */
    @Enumerated(EnumType.STRING)
    private TransactionCategory category;

    /**
     * Which user this transaction belongs to. For now this is a plain
     * Long placeholder (no real User entity or login yet, per today's
     * decision to defer auth). Once we build accounts, this becomes a
     * proper relationship to a User entity - but every transaction needs
     * to belong to *someone* from day one, so the dashboard can eventually
     * filter "show me only my data" instead of everyone's.
     */
    @NotNull
    private Long userId;

    /**
     * JPA requires a no-argument constructor - it builds the object first
     * (blank), then fills in each field by calling the setters below.
     * We don't call this ourselves in normal code.
     */
    protected Transaction() {
    }

    public Transaction(LocalDate date, String description, BigDecimal amount,
                        TransactionType type, TransactionCategory category, Long userId) {
        this.date = date;
        this.description = description;
        this.amount = amount;
        this.type = type;
        this.category = category;
        this.userId = userId;
    }

    // --- Getters and setters ---
    // Plain fields are kept private; these methods are the only way
    // outside code reads or changes them. This is "encapsulation" -
    // it means later we could add validation or logging inside a
    // setter without changing how any other code calls it.

    public Long getId() {
        return id;
    }

    public LocalDate getDate() {
        return date;
    }

    public void setDate(LocalDate date) {
        this.date = date;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }

    public TransactionType getType() {
        return type;
    }

    public void setType(TransactionType type) {
        this.type = type;
    }

    public TransactionCategory getCategory() {
        return category;
    }

    public void setCategory(TransactionCategory category) {
        this.category = category;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }
}

package com.kyf.knowyourfinance.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "savings_goals", indexes = @Index(name = "ix_savings_goal_owner", columnList = "owner_id"))
public class SavingsGoal {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(name = "owner_id", nullable = false)
    private Long ownerId;
    @Column(nullable = false, length = 80)
    private String name;
    @Column(nullable = false, precision = 11, scale = 2)
    private BigDecimal targetAmount;
    @Column(nullable = false, precision = 11, scale = 2)
    private BigDecimal savedAmount;
    @Column(nullable = false)
    private LocalDate deadline;

    protected SavingsGoal() {}

    public SavingsGoal(Long ownerId, String name, BigDecimal targetAmount, BigDecimal savedAmount, LocalDate deadline) {
        this.ownerId = ownerId;
        update(name, targetAmount, savedAmount, deadline);
    }

    public void update(String name, BigDecimal targetAmount, BigDecimal savedAmount, LocalDate deadline) {
        this.name = name.strip();
        this.targetAmount = targetAmount;
        this.savedAmount = savedAmount;
        this.deadline = deadline;
    }

    public UUID getId() { return id; }
    public String getName() { return name; }
    public BigDecimal getTargetAmount() { return targetAmount; }
    public BigDecimal getSavedAmount() { return savedAmount; }
    public LocalDate getDeadline() { return deadline; }
}

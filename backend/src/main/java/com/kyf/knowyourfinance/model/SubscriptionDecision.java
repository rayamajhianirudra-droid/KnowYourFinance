package com.kyf.knowyourfinance.model;

import jakarta.persistence.*;
import java.io.Serializable;

@Entity
@IdClass(SubscriptionDecision.Key.class)
@Table(name = "subscription_decisions")
public class SubscriptionDecision {
    public enum Status { ESSENTIAL, UNNECESSARY, CANCELLED }
    public record Key(Long ownerId, String merchantKey) implements Serializable {}

    @Id
    private Long ownerId;
    @Id
    @Column(length = 500)
    private String merchantKey;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status;

    protected SubscriptionDecision() {}

    public SubscriptionDecision(Long ownerId, String merchantKey, Status status) {
        this.ownerId = ownerId;
        this.merchantKey = merchantKey;
        this.status = status;
    }

    public String getMerchantKey() { return merchantKey; }
    public Status getStatus() { return status; }
}

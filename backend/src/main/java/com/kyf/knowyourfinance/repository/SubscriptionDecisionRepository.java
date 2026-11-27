package com.kyf.knowyourfinance.repository;

import com.kyf.knowyourfinance.model.SubscriptionDecision;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface SubscriptionDecisionRepository
        extends JpaRepository<SubscriptionDecision, SubscriptionDecision.Key> {
    List<SubscriptionDecision> findByOwnerId(Long ownerId);
    long countByOwnerId(Long ownerId);

    @Modifying
    @Query("delete from SubscriptionDecision decision where decision.ownerId = :ownerId")
    void deleteForOwner(Long ownerId);
}

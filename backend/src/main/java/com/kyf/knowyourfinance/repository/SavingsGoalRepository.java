package com.kyf.knowyourfinance.repository;

import com.kyf.knowyourfinance.model.SavingsGoal;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SavingsGoalRepository extends JpaRepository<SavingsGoal, UUID> {
    List<SavingsGoal> findByOwnerIdOrderByDeadlineAscIdAsc(Long ownerId);
    Optional<SavingsGoal> findByIdAndOwnerId(UUID id, Long ownerId);
    long countByOwnerId(Long ownerId);

    @Modifying
    @Query("delete from SavingsGoal goal where goal.ownerId = :ownerId")
    void deleteForOwner(Long ownerId);
}

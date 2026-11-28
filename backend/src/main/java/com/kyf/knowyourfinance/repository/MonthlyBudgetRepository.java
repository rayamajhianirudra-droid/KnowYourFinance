package com.kyf.knowyourfinance.repository;

import com.kyf.knowyourfinance.model.MonthlyBudget;
import com.kyf.knowyourfinance.model.TransactionCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface MonthlyBudgetRepository extends JpaRepository<MonthlyBudget, Long> {
    List<MonthlyBudget> findByUserIdAndMonthStartOrderByCategory(Long userId, LocalDate monthStart);
    Optional<MonthlyBudget> findByUserIdAndMonthStartAndCategory(Long userId, LocalDate monthStart, TransactionCategory category);
    long countByUserId(Long userId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM MonthlyBudget b WHERE b.userId = :userId")
    int deleteAllForUser(@Param("userId") Long userId);

    @Modifying
    @Query("DELETE FROM MonthlyBudget b WHERE b.userId = :userId AND b.monthStart = :monthStart")
    int deleteLimitsForMonth(@Param("userId") Long userId, @Param("monthStart") LocalDate monthStart);
}

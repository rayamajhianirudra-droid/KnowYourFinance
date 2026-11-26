package com.kyf.knowyourfinance.repository;

import com.kyf.knowyourfinance.model.CategoryRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface CategoryRuleRepository extends JpaRepository<CategoryRule, Long> {

    List<CategoryRule> findByUserIdOrderByPatternAsc(Long userId);

    Optional<CategoryRule> findByUserIdAndPattern(Long userId, String pattern);

    Optional<CategoryRule> findByIdAndUserId(Long id, Long userId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM CategoryRule r WHERE r.userId = :userId")
    int deleteAllForUser(@Param("userId") Long userId);
}

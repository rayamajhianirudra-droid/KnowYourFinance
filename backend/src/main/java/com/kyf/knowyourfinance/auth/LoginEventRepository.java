package com.kyf.knowyourfinance.auth;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface LoginEventRepository extends JpaRepository<LoginEvent, Long> {
    // Most recent first, capped so the history query never returns an unbounded
    // list. Scoped to one owner, so an account only ever sees its own activity.
    List<LoginEvent> findTop20ByOwnerIdOrderByOccurredAtDesc(Long ownerId);
}

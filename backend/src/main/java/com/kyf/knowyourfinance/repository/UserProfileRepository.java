package com.kyf.knowyourfinance.repository;

import com.kyf.knowyourfinance.model.UserProfile;
import org.springframework.data.jpa.repository.JpaRepository;

/** Plain lookups by user id; Spring Data supplies everything needed. */
public interface UserProfileRepository extends JpaRepository<UserProfile, Long> {
}

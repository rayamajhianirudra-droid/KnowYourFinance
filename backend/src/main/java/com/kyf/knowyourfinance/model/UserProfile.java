package com.kyf.knowyourfinance.model;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * The little bit of information the app keeps about the person using it:
 * their full name. There is no login yet, so there is one profile per
 * user id, and the id is the same user id every transaction already
 * carries. Once real accounts exist, this table grows into the user
 * record.
 */
@Entity
@Table(name = "user_profile")
public class UserProfile {

    @Id
    private Long userId;

    private String fullName;

    public UserProfile() {
    }

    public UserProfile(Long userId, String fullName) {
        this.userId = userId;
        this.fullName = fullName;
    }

    public Long getUserId() {
        return userId;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }
}

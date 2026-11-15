package com.kyf.knowyourfinance.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** What the browser sends when the user saves their name. */
public class ProfileRequest {

    @NotBlank(message = "Enter your full name.")
    @Size(max = 80, message = "Use 80 characters or fewer.")
    private String fullName;

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }
}

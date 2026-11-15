package com.kyf.knowyourfinance.controller;

import com.kyf.knowyourfinance.dto.ProfileRequest;
import com.kyf.knowyourfinance.model.UserProfile;
import com.kyf.knowyourfinance.repository.UserProfileRepository;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * GET /api/profile?userId=1 returns the saved name (null until one is
 * saved). PUT /api/profile?userId=1 saves or replaces it. The name is
 * trimmed and extra spaces inside it are collapsed, so "  Ada   Lovelace "
 * is stored as "Ada Lovelace".
 */
@RestController
@RequestMapping("/api/profile")
public class ProfileController {

    private final UserProfileRepository repository;

    public ProfileController(UserProfileRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    public UserProfile get(@RequestParam Long userId) {
        return repository.findById(userId).orElseGet(() -> new UserProfile(userId, null));
    }

    @PutMapping
    public UserProfile save(@RequestParam Long userId, @Valid @RequestBody ProfileRequest request) {
        String name = request.getFullName().trim().replaceAll("\\s+", " ");
        UserProfile profile = repository.findById(userId).orElseGet(() -> new UserProfile(userId, name));
        profile.setFullName(name);
        return repository.save(profile);
    }
}

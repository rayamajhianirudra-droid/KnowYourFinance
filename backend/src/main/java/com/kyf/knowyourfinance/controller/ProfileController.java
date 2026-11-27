package com.kyf.knowyourfinance.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import com.kyf.knowyourfinance.auth.AccountPrincipal;
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
 * GET /api/profile returns the saved name (null until one is
 * saved). PUT /api/profile saves or replaces it. The name is
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
    public UserProfile get(@AuthenticationPrincipal AccountPrincipal account) {
        Long userId = account.ownerId();
        return repository.findById(userId).orElseGet(() -> new UserProfile(userId, null));
    }

    @PutMapping
    public UserProfile save(@AuthenticationPrincipal AccountPrincipal account, @Valid @RequestBody ProfileRequest request) {
        Long userId = account.ownerId();
        String name = request.getFullName().trim().replaceAll("\\s+", " ");
        UserProfile profile = repository.findById(userId).orElseGet(() -> new UserProfile(userId, name));
        profile.setFullName(name);
        return repository.save(profile);
    }
}

package com.kyf.knowyourfinance.controller;

import com.kyf.knowyourfinance.auth.AccountPrincipal;
import com.kyf.knowyourfinance.dto.RuleRequest;
import com.kyf.knowyourfinance.dto.RuleResult;
import com.kyf.knowyourfinance.model.CategoryRule;
import com.kyf.knowyourfinance.service.CategoryRuleService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;

@RestController
@RequestMapping("/api/rules")
public class CategoryRuleController {

    private final CategoryRuleService service;

    public CategoryRuleController(CategoryRuleService service) {
        this.service = service;
    }

    @GetMapping
    public List<CategoryRule> list(@AuthenticationPrincipal AccountPrincipal account) {
        return service.list(account.ownerId());
    }

    @PostMapping
    public RuleResult save(@AuthenticationPrincipal AccountPrincipal account, @RequestBody RuleRequest request) {
        return service.save(account.ownerId(), request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal AccountPrincipal account, @PathVariable Long id) {
        try {
            service.delete(account.ownerId(), id);
            return ResponseEntity.noContent().build();
        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> badRequest(IllegalArgumentException e) {
        return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
    }
}

package com.kyf.knowyourfinance.controller;

import com.kyf.knowyourfinance.dto.RuleRequest;
import com.kyf.knowyourfinance.dto.RuleResult;
import com.kyf.knowyourfinance.model.CategoryRule;
import com.kyf.knowyourfinance.service.CategoryRuleService;
import org.springframework.http.ResponseEntity;
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
    public List<CategoryRule> list(@RequestParam Long userId) {
        checkUser(userId);
        return service.list(userId);
    }

    @PostMapping
    public RuleResult save(@RequestParam Long userId, @RequestBody RuleRequest request) {
        checkUser(userId);
        return service.save(userId, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, @RequestParam Long userId) {
        checkUser(userId);
        try {
            service.delete(userId, id);
            return ResponseEntity.noContent().build();
        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> badRequest(IllegalArgumentException e) {
        return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
    }

    private static void checkUser(Long userId) {
        if (userId == null || userId < 1) {
            throw new IllegalArgumentException("Choose a valid user.");
        }
    }
}

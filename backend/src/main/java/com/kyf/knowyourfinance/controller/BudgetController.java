package com.kyf.knowyourfinance.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import com.kyf.knowyourfinance.auth.AccountPrincipal;
import com.kyf.knowyourfinance.dto.*;
import com.kyf.knowyourfinance.model.*;
import com.kyf.knowyourfinance.service.BudgetService;
import jakarta.validation.Valid;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/budgets")
public class BudgetController {
    private final BudgetService service;
    public BudgetController(BudgetService service) { this.service = service; }

    private YearMonth period(int year, int month) {
        if (year < 1900 || year > 9999 || month < 1 || month > 12)
            throw new IllegalArgumentException("Choose a valid month (1900–9999).");
        return YearMonth.of(year, month);
    }
    private void spendingCategory(TransactionCategory category) {
        if (category == TransactionCategory.INCOME)
            throw new IllegalArgumentException("Choose a spending category, not Income.");
    }
    @GetMapping
    public List<BudgetProgress> list(@AuthenticationPrincipal AccountPrincipal account, @RequestParam int year, @RequestParam int month) {
        Long userId = account.ownerId();
        return service.progress(userId, period(year, month));
    }
    @PostMapping("/copy-previous-month")
    public Map<String, Integer> copyPreviousMonth(@AuthenticationPrincipal AccountPrincipal account,
                                                   @RequestParam int year, @RequestParam int month) {
        YearMonth target = period(year, month);
        if (target.equals(YearMonth.of(1900, 1))) {
            throw new IllegalArgumentException("There is no supported budget month before January 1900.");
        }
        return Map.of("copied", service.copyPreviousMonth(account.ownerId(), target));
    }

    @PutMapping("/{category}")
    public MonthlyBudget save(@AuthenticationPrincipal AccountPrincipal account, @RequestParam int year, @RequestParam int month,
            @PathVariable TransactionCategory category, @Valid @RequestBody BudgetRequest request) {
        Long userId = account.ownerId();
        YearMonth period = period(year, month);
        spendingCategory(category);
        return service.save(userId, period, category, request.limitAmount());
    }
    @DeleteMapping("/{category}")
    public ResponseEntity<Void> remove(@AuthenticationPrincipal AccountPrincipal account, @RequestParam int year, @RequestParam int month,
            @PathVariable TransactionCategory category) {
        Long userId = account.ownerId();
        YearMonth period = period(year, month);
        spendingCategory(category);
        return service.remove(userId, period, category) ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
    }
    @ExceptionHandler(org.springframework.http.converter.HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, String>> malformed() {
        return ResponseEntity.badRequest().body(Map.of("message", "Enter a valid numeric budget limit."));
    }
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> invalid(IllegalArgumentException error) {
        return ResponseEntity.badRequest().body(Map.of("message", error.getMessage()));
    }
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, String>> conflict() {
        return ResponseEntity.status(409).body(Map.of("message", "This budget changed in another request. Reload and try again."));
    }
}

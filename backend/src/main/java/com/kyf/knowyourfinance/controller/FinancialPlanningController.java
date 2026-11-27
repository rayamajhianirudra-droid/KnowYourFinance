package com.kyf.knowyourfinance.controller;

import com.kyf.knowyourfinance.auth.AccountPrincipal;
import com.kyf.knowyourfinance.auth.AccountRepository;
import com.kyf.knowyourfinance.model.SavingsGoal;
import com.kyf.knowyourfinance.model.SubscriptionDecision;
import com.kyf.knowyourfinance.repository.SavingsGoalRepository;
import com.kyf.knowyourfinance.repository.SubscriptionDecisionRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/planning")
public class FinancialPlanningController {
    private final SavingsGoalRepository goals;
    private final SubscriptionDecisionRepository decisions;
    private final AccountRepository accounts;

    public FinancialPlanningController(SavingsGoalRepository goals, SubscriptionDecisionRepository decisions,
                                       AccountRepository accounts) {
        this.goals = goals;
        this.decisions = decisions;
        this.accounts = accounts;
    }

    public record GoalInput(
            @NotBlank @Size(max = 80) String name,
            @NotNull @DecimalMin("0.01") @Digits(integer = 9, fraction = 2) BigDecimal targetAmount,
            @NotNull @DecimalMin("0") @Digits(integer = 9, fraction = 2) BigDecimal savedAmount,
            @NotNull LocalDate deadline) {}

    public record SubscriptionInput(
            @NotBlank @Size(max = 500) @Pattern(regexp = "[A-Z]+( [A-Z]+)*") String merchantKey,
            @NotNull SubscriptionDecision.Status status) {}

    @GetMapping("/goals")
    public List<SavingsGoal> goals(@AuthenticationPrincipal AccountPrincipal account) {
        return goals.findByOwnerIdOrderByDeadlineAscIdAsc(account.ownerId());
    }

    @PostMapping("/goals")
    @ResponseStatus(HttpStatus.CREATED)
    public SavingsGoal create(@AuthenticationPrincipal AccountPrincipal account, @Valid @RequestBody GoalInput input) {
        validate(input);
        return goals.save(new SavingsGoal(account.ownerId(), input.name(), input.targetAmount(),
                input.savedAmount(), input.deadline()));
    }

    @PutMapping("/goals/{id}")
    @Transactional
    public SavingsGoal update(@AuthenticationPrincipal AccountPrincipal account, @PathVariable UUID id,
                              @Valid @RequestBody GoalInput input) {
        validate(input);
        SavingsGoal goal = ownGoal(account, id);
        goal.update(input.name(), input.targetAmount(), input.savedAmount(), input.deadline());
        return goal;
    }

    @DeleteMapping("/goals/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void remove(@AuthenticationPrincipal AccountPrincipal account, @PathVariable UUID id) {
        goals.delete(ownGoal(account, id));
    }

    @GetMapping("/subscriptions")
    public List<SubscriptionDecision> decisions(@AuthenticationPrincipal AccountPrincipal account) {
        return decisions.findByOwnerId(account.ownerId());
    }

    @PutMapping("/subscriptions")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void decide(@AuthenticationPrincipal AccountPrincipal account,
                       @Valid @RequestBody SubscriptionInput input) {
        // Serialize writes for this account so concurrent first-time reviews cannot insert twice.
        accounts.lockByEmail(account.email())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        decisions.save(new SubscriptionDecision(account.ownerId(), input.merchantKey(), input.status()));
    }

    private SavingsGoal ownGoal(AccountPrincipal account, UUID id) {
        return goals.findByIdAndOwnerId(id, account.ownerId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Goal not found."));
    }

    private void validate(GoalInput input) {
        if (input.deadline().getYear() < 1900 || input.deadline().getYear() > 9999) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter a deadline between 1900 and 9999.");
        }
    }
}

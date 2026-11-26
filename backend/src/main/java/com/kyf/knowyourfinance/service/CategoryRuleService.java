package com.kyf.knowyourfinance.service;

import com.kyf.knowyourfinance.dto.RuleRequest;
import com.kyf.knowyourfinance.dto.RuleResult;
import com.kyf.knowyourfinance.model.CategoryRule;
import com.kyf.knowyourfinance.model.Transaction;
import com.kyf.knowyourfinance.model.TransactionCategory;
import com.kyf.knowyourfinance.repository.CategoryRuleRepository;
import com.kyf.knowyourfinance.repository.TransactionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.NoSuchElementException;
import java.util.Optional;

/**
 * Remembers "always put this merchant in this category" choices.
 *
 * A rule matches when its pattern appears anywhere in a transaction
 * description, ignoring case. When several rules match, the longest
 * pattern wins, so "whole foods cafe" beats "whole foods".
 */
@Service
public class CategoryRuleService {

    static final int MIN_PATTERN = 2;
    static final int MAX_PATTERN = 60;

    private final CategoryRuleRepository rules;
    private final TransactionRepository transactions;

    public CategoryRuleService(CategoryRuleRepository rules, TransactionRepository transactions) {
        this.rules = rules;
        this.transactions = transactions;
    }

    @Transactional(readOnly = true)
    public List<CategoryRule> list(Long userId) {
        return rules.findByUserIdOrderByPatternAsc(userId);
    }

    @Transactional
    public RuleResult save(Long userId, RuleRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("Choose a merchant and a category.");
        }
        String pattern = normalize(request.pattern());
        if (pattern.length() < MIN_PATTERN || pattern.length() > MAX_PATTERN
                || pattern.chars().noneMatch(Character::isLetter)) {
            throw new IllegalArgumentException("Use a merchant name between " + MIN_PATTERN + " and "
                    + MAX_PATTERN + " characters that includes a letter.");
        }
        if (request.category() == null) {
            throw new IllegalArgumentException("Choose a category.");
        }

        Optional<CategoryRule> existing = rules.findByUserIdAndPattern(userId, pattern);
        CategoryRule rule = existing.orElseGet(() -> new CategoryRule(userId, pattern, request.category()));
        rule.setCategory(request.category());
        CategoryRule saved = rules.save(rule);

        int updated = request.applyToExisting() ? applyToExisting(userId, saved) : 0;
        return new RuleResult(saved, updated);
    }

    @Transactional
    public void delete(Long userId, Long id) {
        CategoryRule rule = rules.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new NoSuchElementException("Rule not found."));
        rules.delete(rule);
    }

    /** Re-categorizes stored transactions that match the rule. Split lines are left alone. */
    private int applyToExisting(Long userId, CategoryRule rule) {
        List<Transaction> changed = new ArrayList<>();
        for (Transaction t : transactions.findByUserId(userId)) {
            if (t.getSplitGroup() != null || t.getDescription() == null) {
                continue;
            }
            boolean matches = t.getDescription().toLowerCase(Locale.ROOT).contains(rule.getPattern());
            if (matches && (t.getCategory() != rule.getCategory() || t.isLowConfidence())) {
                t.setCategory(rule.getCategory());
                t.setLowConfidence(false);
                changed.add(t);
            }
        }
        if (!changed.isEmpty()) {
            transactions.saveAll(changed);
        }
        return changed.size();
    }

    /** The category a rule picks for this description, if any rule matches. */
    public static Optional<TransactionCategory> match(List<CategoryRule> userRules, String description) {
        if (description == null || description.isBlank() || userRules == null) {
            return Optional.empty();
        }
        String lower = description.toLowerCase(Locale.ROOT);
        return userRules.stream()
                .filter(rule -> lower.contains(rule.getPattern()))
                .max(Comparator.comparingInt(rule -> rule.getPattern().length()))
                .map(CategoryRule::getCategory);
    }

    static String normalize(String pattern) {
        if (pattern == null) {
            return "";
        }
        return pattern.trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
    }
}

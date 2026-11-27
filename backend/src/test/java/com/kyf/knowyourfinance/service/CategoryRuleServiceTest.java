package com.kyf.knowyourfinance.service;

import com.kyf.knowyourfinance.dto.RuleRequest;
import com.kyf.knowyourfinance.dto.RuleResult;
import com.kyf.knowyourfinance.model.CategoryRule;
import com.kyf.knowyourfinance.model.Transaction;
import com.kyf.knowyourfinance.model.TransactionCategory;
import com.kyf.knowyourfinance.model.TransactionType;
import com.kyf.knowyourfinance.repository.CategoryRuleRepository;
import com.kyf.knowyourfinance.repository.TransactionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CategoryRuleServiceTest {

    private final CategoryRuleRepository rules = mock(CategoryRuleRepository.class);
    private final TransactionRepository transactions = mock(TransactionRepository.class);
    private final CategoryRuleService service = new CategoryRuleService(rules, transactions);

    @BeforeEach
    void setUp() {
        when(rules.save(any(CategoryRule.class))).thenAnswer(inv -> inv.getArgument(0));
        when(rules.findByUserIdAndPattern(any(), any())).thenReturn(Optional.empty());
    }

    private static Transaction tx(String description, TransactionCategory category) {
        return new Transaction(LocalDate.of(2026, 9, 3), description, new BigDecimal("10.00"),
                TransactionType.EXPENSE, category, 1L);
    }

    @Test
    void savesAMerchantInLowercaseWithTidySpaces() {
        RuleResult result = service.save(1L, new RuleRequest("  Whole   FOODS ", TransactionCategory.GROCERIES, false));

        assertEquals("whole foods", result.rule().getPattern());
        assertEquals(TransactionCategory.GROCERIES, result.rule().getCategory());
        assertEquals(0, result.updated());
        verify(transactions, never()).findByUserId(any());
    }

    @Test
    void savingTheSameMerchantAgainChangesItsCategoryInsteadOfAddingAnother() {
        CategoryRule existing = new CategoryRule(1L, "starbucks", TransactionCategory.DINING);
        when(rules.findByUserIdAndPattern(1L, "starbucks")).thenReturn(Optional.of(existing));

        RuleResult result = service.save(1L, new RuleRequest("STARBUCKS", TransactionCategory.ENTERTAINMENT, false));

        assertEquals(TransactionCategory.ENTERTAINMENT, existing.getCategory());
        assertEquals(existing, result.rule());
    }

    @Test
    void refusesUnusableMerchantsAndMissingCategories() {
        assertThrows(IllegalArgumentException.class,
                () -> service.save(1L, new RuleRequest("", TransactionCategory.DINING, false)));
        assertThrows(IllegalArgumentException.class,
                () -> service.save(1L, new RuleRequest("a", TransactionCategory.DINING, false)));
        assertThrows(IllegalArgumentException.class,
                () -> service.save(1L, new RuleRequest("1234 5678", TransactionCategory.DINING, false)));
        assertThrows(IllegalArgumentException.class,
                () -> service.save(1L, new RuleRequest("x".repeat(61), TransactionCategory.DINING, false)));
        assertThrows(IllegalArgumentException.class,
                () -> service.save(1L, new RuleRequest(null, TransactionCategory.DINING, false)));
        assertThrows(IllegalArgumentException.class,
                () -> service.save(1L, new RuleRequest("walmart", null, false)));
        assertThrows(IllegalArgumentException.class, () -> service.save(1L, null));
        verify(rules, never()).save(any());
    }

    @Test
    void applyingToExistingFixesMatchesAndLeavesTheRestAlone() {
        Transaction wrong = tx("STARBUCKS #4521", TransactionCategory.OTHER);
        Transaction guessed = tx("Starbucks Reserve", TransactionCategory.DINING);
        guessed.setLowConfidence(true);
        Transaction already = tx("STARBUCKS #1", TransactionCategory.ENTERTAINMENT);
        Transaction unrelated = tx("SHELL OIL", TransactionCategory.TRANSPORTATION);
        Transaction splitLine = tx("STARBUCKS - Mug", TransactionCategory.SHOPPING);
        splitLine.markAsSplitPart("g", "STARBUCKS", new BigDecimal("30.00"));
        when(transactions.findByUserId(1L)).thenReturn(List.of(wrong, guessed, already, unrelated, splitLine));

        RuleResult result = service.save(1L, new RuleRequest("starbucks", TransactionCategory.ENTERTAINMENT, true));

        assertEquals(2, result.updated());
        assertEquals(TransactionCategory.ENTERTAINMENT, wrong.getCategory());
        assertEquals(TransactionCategory.ENTERTAINMENT, guessed.getCategory());
        assertFalse(guessed.isLowConfidence());
        assertEquals(TransactionCategory.TRANSPORTATION, unrelated.getCategory());
        assertEquals(TransactionCategory.SHOPPING, splitLine.getCategory());
        verify(transactions).saveAll(List.of(wrong, guessed));
    }

    @Test
    void theLongestMatchingPatternWins() {
        List<CategoryRule> all = List.of(
                new CategoryRule(1L, "whole foods", TransactionCategory.GROCERIES),
                new CategoryRule(1L, "whole foods cafe", TransactionCategory.DINING));

        assertEquals(Optional.of(TransactionCategory.DINING),
                CategoryRuleService.match(all, "WHOLE FOODS CAFE #12"));
        assertEquals(Optional.of(TransactionCategory.GROCERIES),
                CategoryRuleService.match(all, "WHOLE FOODS MARKET"));
    }

    @Test
    void noMatchGivesNothing() {
        List<CategoryRule> all = List.of(new CategoryRule(1L, "walmart", TransactionCategory.SHOPPING));

        assertTrue(CategoryRuleService.match(all, "TARGET").isEmpty());
        assertTrue(CategoryRuleService.match(all, null).isEmpty());
        assertTrue(CategoryRuleService.match(all, "  ").isEmpty());
        assertTrue(CategoryRuleService.match(null, "WALMART").isEmpty());
    }

    @Test
    void deletingARuleThatIsNotYoursIsNotFound() {
        when(rules.findByIdAndUserId(9L, 1L)).thenReturn(Optional.empty());

        assertThrows(NoSuchElementException.class, () -> service.delete(1L, 9L));
        verify(rules, never()).delete(any());
    }

    @Test
    void deletingYourRuleRemovesIt() {
        CategoryRule rule = new CategoryRule(1L, "walmart", TransactionCategory.SHOPPING);
        when(rules.findByIdAndUserId(9L, 1L)).thenReturn(Optional.of(rule));

        service.delete(1L, 9L);

        verify(rules).delete(rule);
    }
}

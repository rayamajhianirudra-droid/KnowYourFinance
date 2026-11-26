package com.kyf.knowyourfinance.service;

import com.kyf.knowyourfinance.dto.DataSummary;
import com.kyf.knowyourfinance.dto.ResetResult;
import com.kyf.knowyourfinance.repository.CategoryRuleRepository;
import com.kyf.knowyourfinance.repository.MonthlyBudgetRepository;
import com.kyf.knowyourfinance.repository.TransactionRepository;
import com.kyf.knowyourfinance.repository.UserProfileRepository;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class DataResetServiceTest {

    private final TransactionRepository transactions = mock(TransactionRepository.class);
    private final MonthlyBudgetRepository budgets = mock(MonthlyBudgetRepository.class);
    private final UserProfileRepository profiles = mock(UserProfileRepository.class);
    private final CategoryRuleRepository rules = mock(CategoryRuleRepository.class);
    private final DataResetService service = new DataResetService(transactions, budgets, profiles, rules);

    @Test
    void summaryReportsTheCountsForThatUser() {
        when(transactions.countByUserId(1L)).thenReturn(38L);
        when(budgets.countByUserId(1L)).thenReturn(3L);

        assertEquals(new DataSummary(38, 3), service.summary(1L));
    }

    @Test
    void resetRemovesTransactionsAndBudgetsAndKeepsTheNameByDefault() {
        when(transactions.deleteAllForUser(1L)).thenReturn(38);
        when(budgets.deleteAllForUser(1L)).thenReturn(3);

        ResetResult result = service.reset(1L, false);
        verify(rules).deleteAllForUser(1L);

        assertEquals(38, result.deletedTransactions());
        assertEquals(3, result.deletedBudgets());
        assertFalse(result.nameRemoved());
        verify(profiles, never()).deleteById(anyLong());
    }

    @Test
    void resetCanAlsoRemoveTheSavedName() {
        when(profiles.existsById(1L)).thenReturn(true);

        ResetResult result = service.reset(1L, true);

        assertTrue(result.nameRemoved());
        verify(profiles).deleteById(1L);
    }

    @Test
    void asksToRemoveTheNameButThereIsNoneSoNothingIsDeleted() {
        when(profiles.existsById(1L)).thenReturn(false);

        ResetResult result = service.reset(1L, true);

        assertFalse(result.nameRemoved());
        verify(profiles, never()).deleteById(anyLong());
    }

    @Test
    void resetOnlyTouchesTheRequestedUser() {
        service.reset(7L, false);

        verify(transactions).deleteAllForUser(7L);
        verify(budgets).deleteAllForUser(7L);
        verify(transactions, never()).deleteAllForUser(1L);
    }
}

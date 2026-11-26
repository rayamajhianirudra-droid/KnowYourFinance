package com.kyf.knowyourfinance.service;

import com.kyf.knowyourfinance.dto.SplitRequest;
import com.kyf.knowyourfinance.dto.SplitRequest.Part;
import com.kyf.knowyourfinance.model.Transaction;
import com.kyf.knowyourfinance.model.TransactionCategory;
import com.kyf.knowyourfinance.model.TransactionType;
import com.kyf.knowyourfinance.repository.TransactionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SplitServiceTest {

    private final TransactionRepository repository = mock(TransactionRepository.class);
    private final SplitService service = new SplitService(repository);
    private Transaction walmart;

    @BeforeEach
    void setUp() {
        walmart = new Transaction(LocalDate.of(2026, 9, 3), "WALMART SUPERCENTER",
                new BigDecimal("200.00"), TransactionType.EXPENSE, TransactionCategory.GROCERIES, 1L);
        ReflectionTestUtils.setField(walmart, "id", 5L);
        when(repository.findById(5L)).thenReturn(Optional.of(walmart));
        when(repository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));
        when(repository.save(any(Transaction.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private static SplitRequest twoLines() {
        return new SplitRequest(List.of(
                new Part(new BigDecimal("80.00"), TransactionCategory.GROCERIES, "Food"),
                new Part(new BigDecimal("120.00"), TransactionCategory.SHOPPING, "TV")));
    }

    @Test
    void splitsOneReceiptIntoLinesThatKeepTheTotal() {
        List<Transaction> parts = service.split(5L, twoLines());

        assertEquals(2, parts.size());
        assertEquals(new BigDecimal("80.00"), parts.get(0).getAmount());
        assertEquals(TransactionCategory.GROCERIES, parts.get(0).getCategory());
        assertEquals("WALMART SUPERCENTER - Food", parts.get(0).getDescription());
        assertEquals(new BigDecimal("120.00"), parts.get(1).getAmount());
        assertEquals(TransactionCategory.SHOPPING, parts.get(1).getCategory());
        assertEquals(LocalDate.of(2026, 9, 3), parts.get(1).getDate());
        assertEquals(TransactionType.EXPENSE, parts.get(1).getType());
        assertEquals(1L, parts.get(1).getUserId());
        assertEquals(parts.get(0).getSplitGroup(), parts.get(1).getSplitGroup());
        assertNotNull(parts.get(0).getSplitGroup());
        assertEquals("WALMART SUPERCENTER", parts.get(1).getSplitSourceDescription());
        assertEquals(new BigDecimal("200.00"), parts.get(1).getSplitSourceAmount());
    }

    @Test
    void aLineWithoutALabelKeepsTheOriginalDescription() {
        List<Transaction> parts = service.split(5L, new SplitRequest(List.of(
                new Part(new BigDecimal("80.00"), TransactionCategory.GROCERIES, null),
                new Part(new BigDecimal("120.00"), TransactionCategory.SHOPPING, "  "))));

        assertEquals("WALMART SUPERCENTER", parts.get(0).getDescription());
        assertEquals("WALMART SUPERCENTER", parts.get(1).getDescription());
    }

    @Test
    void refusesLinesThatDoNotAddUpToTheTotal() {
        SplitRequest off = new SplitRequest(List.of(
                new Part(new BigDecimal("80.00"), TransactionCategory.GROCERIES, "Food"),
                new Part(new BigDecimal("100.00"), TransactionCategory.SHOPPING, "TV")));

        IllegalArgumentException e = assertThrows(IllegalArgumentException.class, () -> service.split(5L, off));
        assertTrue(e.getMessage().contains("180"));
        assertTrue(e.getMessage().contains("200"));
        verify(repository, never()).saveAll(any());
    }

    @Test
    void anAmountWithDifferentTrailingZerosStillMatchesTheTotal() {
        List<Transaction> parts = service.split(5L, new SplitRequest(List.of(
                new Part(new BigDecimal("80"), TransactionCategory.GROCERIES, null),
                new Part(new BigDecimal("120.0000"), TransactionCategory.SHOPPING, null))));

        assertEquals(2, parts.size());
    }

    @Test
    void needsAtLeastTwoLines() {
        SplitRequest one = new SplitRequest(List.of(
                new Part(new BigDecimal("200.00"), TransactionCategory.GROCERIES, null)));

        assertThrows(IllegalArgumentException.class, () -> service.split(5L, one));
        assertThrows(IllegalArgumentException.class, () -> service.split(5L, new SplitRequest(null)));
        assertThrows(IllegalArgumentException.class, () -> service.split(5L, null));
    }

    @Test
    void refusesZeroNegativeOrMissingAmountsAndMissingCategories() {
        assertThrows(IllegalArgumentException.class, () -> service.split(5L, new SplitRequest(List.of(
                new Part(new BigDecimal("200.00"), TransactionCategory.GROCERIES, null),
                new Part(BigDecimal.ZERO, TransactionCategory.SHOPPING, null)))));
        assertThrows(IllegalArgumentException.class, () -> service.split(5L, new SplitRequest(List.of(
                new Part(new BigDecimal("300.00"), TransactionCategory.GROCERIES, null),
                new Part(new BigDecimal("-100.00"), TransactionCategory.SHOPPING, null)))));
        assertThrows(IllegalArgumentException.class, () -> service.split(5L, new SplitRequest(List.of(
                new Part(null, TransactionCategory.GROCERIES, null),
                new Part(new BigDecimal("200.00"), TransactionCategory.SHOPPING, null)))));
        assertThrows(IllegalArgumentException.class, () -> service.split(5L, new SplitRequest(List.of(
                new Part(new BigDecimal("80.00"), null, null),
                new Part(new BigDecimal("120.00"), TransactionCategory.SHOPPING, null)))));
    }

    @Test
    void refusesMoreLinesThanTheLimit() {
        List<Part> many = new ArrayList<>();
        for (int i = 0; i < SplitService.MAX_PARTS + 1; i++) {
            many.add(new Part(new BigDecimal("1.00"), TransactionCategory.OTHER, null));
        }
        walmart.setAmount(new BigDecimal(many.size()));

        assertThrows(IllegalArgumentException.class, () -> service.split(5L, new SplitRequest(many)));
    }

    @Test
    void anAlreadySplitReceiptHasToBeJoinedBeforeSplittingAgain() {
        service.split(5L, twoLines());

        assertThrows(IllegalArgumentException.class, () -> service.split(5L, twoLines()));
    }

    @Test
    void aMissingTransactionIsReportedAsNotFound() {
        when(repository.findById(404L)).thenReturn(Optional.empty());

        assertThrows(NoSuchElementException.class, () -> service.split(404L, twoLines()));
        assertThrows(NoSuchElementException.class, () -> service.join(404L));
    }

    @Test
    void joiningPutsTheOriginalChargeBackAndRemovesTheOtherLines() {
        List<Transaction> parts = service.split(5L, twoLines());
        when(repository.findByUserIdAndSplitGroup(1L, parts.get(0).getSplitGroup())).thenReturn(parts);

        Transaction joined = service.join(5L);

        assertEquals("WALMART SUPERCENTER", joined.getDescription());
        assertEquals(0, new BigDecimal("200.00").compareTo(joined.getAmount()));
        assertNull(joined.getSplitGroup());
        assertNull(joined.getSplitSourceAmount());
        // The biggest line (the TV) is the one that stays, the other is removed.
        assertEquals(TransactionCategory.SHOPPING, joined.getCategory());
        verify(repository).deleteAll(List.of(parts.get(0) == joined ? parts.get(1) : parts.get(0)));
    }

    @Test
    void joiningAnOrdinaryTransactionIsRefused() {
        assertThrows(IllegalArgumentException.class, () -> service.join(5L));
    }
}

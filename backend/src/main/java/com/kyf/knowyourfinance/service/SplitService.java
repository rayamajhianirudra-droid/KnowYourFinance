package com.kyf.knowyourfinance.service;

import com.kyf.knowyourfinance.dto.SplitRequest;
import com.kyf.knowyourfinance.model.Transaction;
import com.kyf.knowyourfinance.repository.TransactionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;

/**
 * Splits one bank charge into several category lines, and joins them back.
 *
 * Each part is an ordinary transaction row, so charts, budgets, the
 * calendar and the CSV export all keep working without knowing anything
 * about splits. The parts share a group id, and every part remembers the
 * original description and amount so that uploading the same statement
 * again does not bring the unsplit charge back as a new row.
 */
@Service
public class SplitService {

    static final int MAX_PARTS = 20;

    private final TransactionRepository repository;

    public SplitService(TransactionRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public List<Transaction> split(Long userId, Long id, SplitRequest request) {
        Transaction original = repository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new NoSuchElementException("Transaction not found."));
        if (original.getSplitGroup() != null) {
            throw new IllegalArgumentException("This receipt is already split. Join it back first.");
        }
        List<SplitRequest.Part> parts = request == null || request.parts() == null
                ? List.of() : request.parts();
        if (parts.size() < 2) {
            throw new IllegalArgumentException("Add at least two lines to split a receipt.");
        }
        if (parts.size() > MAX_PARTS) {
            throw new IllegalArgumentException("A receipt can have at most " + MAX_PARTS + " lines.");
        }
        BigDecimal sum = BigDecimal.ZERO;
        for (SplitRequest.Part part : parts) {
            if (part == null || part.amount() == null || part.amount().signum() <= 0) {
                throw new IllegalArgumentException("Every line needs an amount greater than zero.");
            }
            if (part.category() == null) {
                throw new IllegalArgumentException("Choose a category for every line.");
            }
            sum = sum.add(part.amount());
        }
        if (sum.compareTo(original.getAmount()) != 0) {
            throw new IllegalArgumentException("The lines add up to " + sum.stripTrailingZeros().toPlainString()
                    + " but the receipt total is " + original.getAmount().stripTrailingZeros().toPlainString() + ".");
        }

        String group = UUID.randomUUID().toString();
        String sourceDescription = original.getDescription();
        BigDecimal sourceAmount = original.getAmount();
        List<Transaction> result = new ArrayList<>();

        for (int i = 0; i < parts.size(); i++) {
            SplitRequest.Part part = parts.get(i);
            Transaction target = i == 0 ? original : new Transaction(original.getDate(), sourceDescription,
                    part.amount(), original.getType(), part.category(), original.getUserId());
            target.setDescription(describe(sourceDescription, part.label()));
            target.setAmount(part.amount());
            target.setCategory(part.category());
            target.setLowConfidence(false);
            target.markAsSplitPart(group, sourceDescription, sourceAmount);
            result.add(target);
        }
        return repository.saveAll(result);
    }

    /** Puts a split receipt back into one transaction. Returns the joined row. */
    @Transactional
    public Transaction join(Long userId, Long id) {
        Transaction any = repository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new NoSuchElementException("Transaction not found."));
        if (any.getSplitGroup() == null) {
            throw new IllegalArgumentException("This transaction is not split.");
        }
        List<Transaction> parts = repository.findByUserIdAndSplitGroup(any.getUserId(), any.getSplitGroup());
        Transaction keep = parts.stream()
                .max(Comparator.comparing(Transaction::getAmount))
                .orElse(any);
        BigDecimal total = parts.stream().map(Transaction::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        keep.setDescription(keep.getSplitSourceDescription());
        keep.setAmount(total);
        keep.clearSplit();

        List<Transaction> others = parts.stream().filter(t -> t != keep).toList();
        repository.deleteAll(others);
        return repository.save(keep);
    }

    private static String describe(String source, String label) {
        if (label == null || label.isBlank()) {
            return source;
        }
        return source + " - " + label.trim();
    }
}

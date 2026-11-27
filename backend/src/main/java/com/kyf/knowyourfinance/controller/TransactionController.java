package com.kyf.knowyourfinance.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import com.kyf.knowyourfinance.auth.AccountPrincipal;
import com.kyf.knowyourfinance.model.Transaction;
import com.kyf.knowyourfinance.repository.TransactionRepository;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/transactions")
public class TransactionController {

    private final TransactionRepository transactionRepository;

    public TransactionController(TransactionRepository transactionRepository) {
        this.transactionRepository = transactionRepository;
    }

    /**
     * POST /api/transactions - add a single transaction.
     * @Valid tells Spring to check the @NotNull/@NotBlank rules on
     * Transaction before this method body even runs - if the request body
     * is missing something required, the caller gets a 400 Bad Request
     * automatically, with no manual "if (x == null)" checks needed here.
     */
    @PostMapping
    public ResponseEntity<Transaction> create(@AuthenticationPrincipal AccountPrincipal account, @Valid @RequestBody TransactionInput input) {
        Transaction saved = transactionRepository.save(new Transaction(input.date(), input.description(),
                input.amount(), input.type(), input.category(), account.ownerId()));
        return ResponseEntity.ok(saved);
    }

    /**
     * GET /api/transactions?start=2026-01-01&end=2026-01-31
     * Lists a user's transactions, optionally narrowed to a date range.
     * `required = false` on start/end means both are optional - if
     * omitted, we just return everything for that user.
     */
    @GetMapping
    public List<Transaction> list(
            @AuthenticationPrincipal AccountPrincipal account,
            @RequestParam(required = false) LocalDate start,
            @RequestParam(required = false) LocalDate end) {
        if (start != null && end != null) {
            return transactionRepository.findByUserIdAndDateBetween(account.ownerId(), start, end);
        }
        // No range given: return everything for this user.
        return transactionRepository.findByUserId(account.ownerId());
    }

    /**
     * GET /api/transactions/{id} - a single transaction by its ID.
     * findById returns an Optional<Transaction> (it might not exist), so
     * we convert "found" into a 200 with the data, and "not found" into a
     * clean 404 instead of a null-pointer surprise.
     */
    @GetMapping("/{id}")
    public ResponseEntity<Transaction> getById(@AuthenticationPrincipal AccountPrincipal account, @PathVariable Long id) {
        return transactionRepository.findByIdAndUserId(id, account.ownerId())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * PUT /api/transactions/{id} - edit an existing transaction. The most
     * common real-world reason for this: AutoCategorizer's keyword
     * matching is good but not perfect (see build-log 02), so a user
     * needs a way to fix a miscategorized transaction - or correct an
     * amount/date they manually mistyped - without deleting and
     * re-creating it.
     *
     * We only overwrite the fields that make sense to edit, reusing the
     * existing Transaction object's `id` rather than trusting whatever
     * the request body sent - the URL path is the source of truth for
     * which row is being edited, not the body.
     *
     * Any edit here also clears lowConfidence (FR-306): once a human
     * has looked at a transaction and saved it, whatever category it
     * ends up with is a deliberate choice, not an AI guess, even if the
     * user left the category itself unchanged. It shouldn't keep
     * showing the "auto-guessed" marker after that.
     */
    @org.springframework.transaction.annotation.Transactional
    @PutMapping("/{id}")
    public ResponseEntity<Transaction> update(
            @AuthenticationPrincipal AccountPrincipal account, @PathVariable Long id, @Valid @RequestBody TransactionInput updates) {
        return transactionRepository.findByIdAndUserId(id, account.ownerId())
                .map(existing -> {
                    existing.setDate(updates.date());
                    existing.setDescription(updates.description());
                    existing.setAmount(updates.amount());
                    existing.setType(updates.type());
                    existing.setCategory(updates.category());
                    existing.setLowConfidence(false);
                    Transaction saved = transactionRepository.save(existing);
                    return ResponseEntity.ok(saved);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * DELETE /api/transactions/{id} - remove a transaction (e.g. the user
     * fixes a duplicate or a miscategorized import).
     */
    @org.springframework.transaction.annotation.Transactional
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal AccountPrincipal account, @PathVariable Long id) {
        if (transactionRepository.deleteOwned(id, account.ownerId()) == 0) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.noContent().build();
    }
}

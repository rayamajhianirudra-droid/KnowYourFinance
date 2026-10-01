package com.kyf.knowyourfinance.controller;

import com.kyf.knowyourfinance.model.Transaction;
import com.kyf.knowyourfinance.repository.TransactionRepository;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

/**
 * The basic CRUD (Create, Read, Update, Delete) endpoints for
 * transactions. Right now these are what a frontend would call directly
 * while we build it by hand; later, most transactions will arrive through
 * the statement-upload/parsing pipeline instead of this manual-entry API -
 * but we still need manual entry for things a bank statement wouldn't
 * capture (cash spending, manual corrections, etc.), and it's also the
 * simplest way to put test data in while the upload feature doesn't exist
 * yet.
 *
 * Every method takes a userId parameter for now instead of reading it
 * from a logged-in session, because there is no login yet (that's a
 * deliberate, explicit decision for this phase of the project - see the
 * comment on Transaction.userId). Once real auth exists, these methods
 * will stop taking userId as a parameter and will instead read "who is
 * making this request" from the authenticated session.
 */
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
    public ResponseEntity<Transaction> create(@Valid @RequestBody Transaction transaction) {
        Transaction saved = transactionRepository.save(transaction);
        return ResponseEntity.ok(saved);
    }

    /**
     * GET /api/transactions?userId=1&start=2026-01-01&end=2026-01-31
     * Lists a user's transactions, optionally narrowed to a date range.
     * `required = false` on start/end means both are optional - if
     * omitted, we just return everything for that user.
     */
    @GetMapping
    public List<Transaction> list(
            @RequestParam Long userId,
            @RequestParam(required = false) LocalDate start,
            @RequestParam(required = false) LocalDate end) {
        if (start != null && end != null) {
            return transactionRepository.findByUserIdAndDateBetween(userId, start, end);
        }
        // No range given: LocalDate.MIN/MAX acts as "from the beginning of time
        // to the end of time," reusing the same range query instead of writing
        // a second, near-identical repository method just for "no filter."
        return transactionRepository.findByUserIdAndDateBetween(userId, LocalDate.MIN, LocalDate.MAX);
    }

    /**
     * GET /api/transactions/{id} - a single transaction by its ID.
     * findById returns an Optional<Transaction> (it might not exist), so
     * we convert "found" into a 200 with the data, and "not found" into a
     * clean 404 instead of a null-pointer surprise.
     */
    @GetMapping("/{id}")
    public ResponseEntity<Transaction> getById(@PathVariable Long id) {
        return transactionRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * DELETE /api/transactions/{id} - remove a transaction (e.g. the user
     * fixes a duplicate or a miscategorized import).
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!transactionRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        transactionRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}

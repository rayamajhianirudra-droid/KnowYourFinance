# Build Log 06 — Editing Transactions

**Date:** Oct 1, 2026
**What exists after this entry:** `PUT /api/transactions/{id}` plus an inline category-editing dropdown in the frontend's transaction list.

## Why this was needed

`AutoCategorizer` (build-log 02) is a keyword-matching guesser, not a perfect classifier — an unusual merchant name lands in `OTHER`, or a keyword matches something it shouldn't. Without an edit path, the only fix would be deleting and re-adding a transaction by hand, losing the convenience statement upload was supposed to provide. This closes that gap: the single most common real-world correction (fixing a wrong category) is now a two-click fix.

## Backend

```java
@PutMapping("/{id}")
public ResponseEntity<Transaction> update(@PathVariable Long id, @Valid @RequestBody Transaction updates) {
    return transactionRepository.findById(id)
            .map(existing -> {
                existing.setDate(updates.getDate());
                existing.setDescription(updates.getDescription());
                existing.setAmount(updates.getAmount());
                existing.setType(updates.getType());
                existing.setCategory(updates.getCategory());
                return ResponseEntity.ok(transactionRepository.save(existing));
            })
            .orElse(ResponseEntity.notFound().build());
}
```

One deliberate detail: the row to edit is taken from the **URL path** (`{id}`), and the existing entity is fetched and mutated — the request body's fields overwrite the existing row's fields, but the `id` itself always comes from the path, never trusted from the body. This avoids a class of bug where a mismatched or missing `id` in the JSON body silently edits the wrong row (or none).

Two new `TransactionControllerTest` cases cover this end-to-end through `MockMvc`: a successful category fix, and a 404 when editing a transaction that doesn't exist.

## Frontend

`TransactionList.jsx`'s category column is now a `<select>` instead of plain text. Changing it calls `updateTransaction(id, {...transaction, category: newCategory})` immediately — no separate "save" button, since a dropdown selection already is the deliberate action. The local list state is updated with the server's response instead of a full re-fetch, which keeps editing fast.

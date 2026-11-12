package com.kyf.knowyourfinance.service;

import com.kyf.knowyourfinance.dto.StatementImportResponse;
import com.kyf.knowyourfinance.model.Transaction;
import com.kyf.knowyourfinance.model.TransactionType;
import com.kyf.knowyourfinance.repository.TransactionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * The orchestrator for the whole statement-upload feature. This is where
 * every piece built so far comes together into one pipeline:
 *
 *   uploaded file bytes
 *        -> CsvStatementParser   (turn CSV text into plain rows)
 *        -> RedactionUtil        (strip anything that looks like an
 *                                  account/routing number from each
 *                                  description, BEFORE anything else
 *                                  touches it)
 *        -> AutoCategorizer      (guess a spending category)
 *        -> TransactionRepository.save() (persist the now-safe,
 *                                  now-categorized Transaction)
 *
 * The ORDER of these steps is the entire security story of this
 * feature: redaction happens immediately after parsing and before
 * anything else - before categorization even looks at the text, before
 * a Transaction object is built, before anything is saved. There is no
 * path through this method where the original, unredacted description
 * reaches the database.
 */
@Service
public class StatementImportService {

    private final CsvStatementParser csvStatementParser;
    private final AutoCategorizer autoCategorizer;
    private final TransactionRepository transactionRepository;

    public StatementImportService(CsvStatementParser csvStatementParser,
                                   AutoCategorizer autoCategorizer,
                                   TransactionRepository transactionRepository) {
        this.csvStatementParser = csvStatementParser;
        this.autoCategorizer = autoCategorizer;
        this.transactionRepository = transactionRepository;
    }

    public StatementImportResponse importCsv(InputStream csvInputStream, Long userId) throws IOException {
        return importCsv(csvInputStream, userId, true);
    }

    /**
     * Same pipeline as above, but with persistence made optional
     * (`persist = false`). This is what powers the "preview before you
     * save" screen: the upload runs all the way through parsing,
     * redaction, and categorization - so the preview shows the user
     * EXACTLY what would be saved, not a rough guess - it just stops
     * short of the actual transactionRepository.save() call. The
     * duplicate check still runs during a preview (read-only, so it's
     * safe), so the preview's duplicate count is accurate too.
     */
    @Transactional
    public StatementImportResponse importCsv(InputStream csvInputStream, Long userId, boolean persist) throws IOException {
        CsvStatementParser.ParseResult parseResult = csvStatementParser.parse(csvInputStream);
        List<CsvStatementParser.ParsedRow> parsedRows = parseResult.getRows();

        // Work out which rows are already stored with ONE query for the
        // whole file's date span, instead of asking the database about
        // every row separately. A 500 row statement used to cost 500
        // lookups here; now it costs one.
        Set<String> knownKeys = loadExistingKeys(userId, parsedRows);

        List<Transaction> toSave = new ArrayList<>();
        int redactedCount = 0;
        int duplicateCount = 0;

        for (CsvStatementParser.ParsedRow row : parsedRows) {
            RedactionUtil.RedactionResult redactionResult = RedactionUtil.redact(row.getDescription());
            if (redactionResult.isRedacted()) {
                redactedCount++;
            }
            String safeDescription = redactionResult.getText();

            var categorization = autoCategorizer.categorizeWithConfidence(safeDescription);
            var category = categorization.getCategory();

            BigDecimal amount = row.getAmount();
            TransactionType type = amount.signum() < 0 ? TransactionType.EXPENSE : TransactionType.INCOME;
            BigDecimal positiveAmount = amount.abs();

            // Set.add returns false when the key was already there, which
            // covers both "already in the database" and "repeated earlier
            // in this same file".
            if (!knownKeys.add(duplicateKey(row.getDate(), safeDescription, positiveAmount, type))) {
                duplicateCount++;
                continue;
            }

            Transaction transaction = new Transaction(
                    row.getDate(), safeDescription, positiveAmount, type, category, userId);
            transaction.setLowConfidence(categorization.isLowConfidence());
            toSave.add(transaction);
        }

        // One saveAll inside one transaction: either the whole statement
        // lands or none of it does, instead of a half-imported file if
        // something fails in the middle.
        List<Transaction> saved = persist ? transactionRepository.saveAll(toSave) : toSave;

        return new StatementImportResponse(
                parsedRows.size(), saved.size(), redactedCount,
                parseResult.getSkippedRowCount(), duplicateCount, saved);
    }

    /** Keys of every stored transaction inside the date span of this file. */
    private Set<String> loadExistingKeys(Long userId, List<CsvStatementParser.ParsedRow> rows) {
        Set<String> keys = new HashSet<>();
        if (rows.isEmpty()) {
            return keys;
        }
        LocalDate first = rows.stream().map(CsvStatementParser.ParsedRow::getDate)
                .min(Comparator.naturalOrder()).orElseThrow();
        LocalDate last = rows.stream().map(CsvStatementParser.ParsedRow::getDate)
                .max(Comparator.naturalOrder()).orElseThrow();
        for (Transaction existing : transactionRepository.findByUserIdAndDateBetween(userId, first, last)) {
            keys.add(duplicateKey(existing.getDate(), existing.getDescription(),
                    existing.getAmount(), existing.getType()));
        }
        return keys;
    }

    /**
     * The five things that make two transactions "the same": date,
     * description, amount and type (the user is fixed per call). The
     * amount goes through stripTrailingZeros because the database hands
     * back 5.7500 while the CSV gives 5.75, and those must still match.
     */
    private static String duplicateKey(LocalDate date, String description,
                                       BigDecimal amount, TransactionType type) {
        return date + "|" + description + "|" + amount.stripTrailingZeros().toPlainString() + "|" + type;
    }
}

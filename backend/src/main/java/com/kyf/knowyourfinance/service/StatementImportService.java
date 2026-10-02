package com.kyf.knowyourfinance.service;

import com.kyf.knowyourfinance.dto.StatementImportResponse;
import com.kyf.knowyourfinance.model.Transaction;
import com.kyf.knowyourfinance.model.TransactionType;
import com.kyf.knowyourfinance.repository.TransactionRepository;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

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
        CsvStatementParser.ParseResult parseResult = csvStatementParser.parse(csvInputStream);
        List<CsvStatementParser.ParsedRow> parsedRows = parseResult.getRows();

        List<Transaction> saved = new ArrayList<>();
        int redactedCount = 0;
        int duplicateCount = 0;

        for (CsvStatementParser.ParsedRow row : parsedRows) {
            // Step 1 (security-critical): redact BEFORE this text is used
            // for anything else - not after categorization, not after
            // building the Transaction. Right here, first.
            RedactionUtil.RedactionResult redactionResult = RedactionUtil.redact(row.getDescription());
            if (redactionResult.isRedacted()) {
                redactedCount++;
            }
            String safeDescription = redactionResult.getText();

            // Step 2: now that the text is safe, figure out a category
            // AND how confident that guess is (FR-301, FR-302).
            var categorization = autoCategorizer.categorizeWithConfidence(safeDescription);
            var category = categorization.getCategory();

            // Step 3: positive amount = income, negative = expense (see
            // CsvStatementParser's class comment for the convention).
            // We store amount as always-positive and let `type` carry
            // the direction - this keeps "total income" / "total
            // expenses" sums in DashboardService simple additions
            // instead of every caller having to remember sign rules.
            BigDecimal amount = row.getAmount();
            TransactionType type = amount.signum() < 0 ? TransactionType.EXPENSE : TransactionType.INCOME;
            BigDecimal positiveAmount = amount.abs();

            // Step 4 (duplicate protection): if this exact transaction already
            // exists for this user, skip it instead of saving a second copy.
            // Re-uploading the same statement (easy to do by accident - the
            // file is just sitting in Downloads) should be harmless, not a
            // source of doubled totals on the dashboard.
            boolean alreadyExists = transactionRepository.existsByUserIdAndDateAndDescriptionAndAmountAndType(
                    userId, row.getDate(), safeDescription, positiveAmount, type);
            if (alreadyExists) {
                duplicateCount++;
                continue;
            }

            Transaction transaction = new Transaction(
                    row.getDate(), safeDescription, positiveAmount, type, category, userId);
            // FR-303: flag it when the category above was a low-confidence
            // guess rather than a real keyword match, so the frontend can
            // show the user which ones are worth a second look.
            transaction.setLowConfidence(categorization.isLowConfidence());
            saved.add(transactionRepository.save(transaction));
        }

        return new StatementImportResponse(
                parsedRows.size(), saved.size(), redactedCount,
                parseResult.getSkippedRowCount(), duplicateCount, saved);
    }
}

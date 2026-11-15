package com.kyf.knowyourfinance.service;

import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;

/**
 * Turns the raw bytes of an uploaded CSV bank statement into a list of
 * ParsedRow objects - plain (date, description, amount) triples with no
 * knowledge of Spring, the database, or categories. Keeping this class
 * "dumb" (it only knows CSV syntax, nothing about banking or our data
 * model) is deliberate: it's the easiest layer to unit-test, and if we
 * ever need to parse OFX or QFX files instead, we write a different
 * parser with the same ParsedRow output instead of touching this one.
 *
 * We hand-write this parser instead of pulling in a CSV library
 * (Apache Commons CSV, OpenCSV, etc.) for two reasons: (1) this sandbox
 * can't resolve new Maven dependencies anyway (see build-log 01), and
 * (2) bank statement CSVs are simple enough - three predictable columns,
 * no exotic quoting - that a ~40-line parser is easier to reason about
 * than pulling in an entire library for it. If statement formats get
 * messier later (quoted commas, multi-line fields), that's the moment to
 * reach for a real library instead of growing this by hand.
 *
 * Text formats are still read by hand. Excel (.xlsx) is a zipped XML format,
 * which is not sensible to parse by hand, so StatementTableReader uses Apache
 * POI for that one format only. Besides CSV this parser therefore reads TSV,
 * TXT and XLSX, and accepts several common date and amount styles.
 *
 * Expected layout (header row required):
 *   Date,Description,Amount
 *   2026-09-01,STARBUCKS #4521,-5.75
 *   2026-09-01,PAYROLL DEPOSIT,2450.00
 *
 * Convention: negative amount = money out (expense), positive = money
 * in (income). This matches how most banks actually export CSVs.
 */
@Component
public class CsvStatementParser {

    // The date layouts banks commonly use. They are tried in this order.
    private static final List<DateTimeFormatter> DATE_FORMATS = List.of(
            DateTimeFormatter.ISO_LOCAL_DATE,          // 2026-09-01
            DateTimeFormatter.ofPattern("M/d/yyyy"),   // 09/01/2026 or 9/1/2026
            DateTimeFormatter.ofPattern("M-d-yyyy"),   // 09-01-2026
            DateTimeFormatter.ofPattern("M/d/yy"));    // 9/1/26

    /** Reads a comma separated file. Kept for callers that have only a stream. */
    public ParseResult parse(InputStream csvInputStream) throws IOException {
        return parseTable(StatementTableReader.readDelimited(csvInputStream, ','));
    }

    /**
     * Reads a statement in any supported format (CSV, TSV, TXT, XLSX),
     * chosen by the file name's extension.
     */
    public ParseResult parse(InputStream input, String fileName) throws IOException {
        return parseTable(StatementTableReader.read(input, fileName));
    }

    /**
     * Turns table rows (header first, then Date, Description, Amount per
     * row) into parsed rows. A row that cannot be read is skipped and
     * counted, so one bad line never blocks the rest of the file (FR-103).
     */
    ParseResult parseTable(List<String[]> table) {
        List<ParsedRow> rows = new ArrayList<>();
        int skippedRowCount = 0;

        // The first row is the header. We do not check its wording, we
        // only assume the column order: Date, Description, Amount.
        for (int i = 1; i < table.size(); i++) {
            String[] columns = table.get(i);
            if (columns.length == 0 || isBlankRow(columns)) {
                continue; // blank lines are normal, not a parse failure
            }
            if (columns.length < 3) {
                skippedRowCount++;
                continue;
            }
            try {
                LocalDate date = parseDate(columns[0].trim());
                String description = columns[1].trim();
                BigDecimal amount = parseAmount(columns[2]);
                rows.add(new ParsedRow(date, description, amount));
            } catch (DateTimeParseException | NumberFormatException e) {
                skippedRowCount++;
            }
        }
        return new ParseResult(rows, skippedRowCount);
    }

    private static boolean isBlankRow(String[] columns) {
        for (String c : columns) {
            if (c != null && !c.isBlank()) {
                return false;
            }
        }
        return true;
    }

    private static LocalDate parseDate(String text) {
        DateTimeParseException last = null;
        for (DateTimeFormatter format : DATE_FORMATS) {
            try {
                return LocalDate.parse(text, format);
            } catch (DateTimeParseException e) {
                last = e;
            }
        }
        throw last;
    }

    /**
     * Understands the amount styles banks use: -5.75, $5.75, 1,234.50 and
     * (5.75), where brackets mean money out.
     */
    private static BigDecimal parseAmount(String text) {
        String t = text.trim();
        boolean bracketed = t.startsWith("(") && t.endsWith(")");
        if (bracketed) {
            t = t.substring(1, t.length() - 1);
        }
        t = t.replace("$", "").replace(",", "").replace(" ", "");
        BigDecimal value = new BigDecimal(t);
        return bracketed ? value.negate() : value;
    }

    /**
     * What parse() hands back: the rows that parsed successfully, plus
     * how many didn't (FR-104). Bundling both in one object instead of
     * just returning the row list means a caller can't accidentally
     * forget to report the skipped count - it's sitting right there
     * next to the rows.
     */
    public static class ParseResult {
        private final List<ParsedRow> rows;
        private final int skippedRowCount;

        public ParseResult(List<ParsedRow> rows, int skippedRowCount) {
            this.rows = rows;
            this.skippedRowCount = skippedRowCount;
        }

        public List<ParsedRow> getRows() {
            return rows;
        }

        public int getSkippedRowCount() {
            return skippedRowCount;
        }
    }

    /**
     * The plain, pre-redaction, pre-categorization output of parsing one
     * CSV row. Note this is NOT a Transaction yet - redaction and
     * categorization both still need to happen before this becomes
     * something we save.
     */
    public static class ParsedRow {
        private final LocalDate date;
        private final String description;
        private final BigDecimal amount;

        public ParsedRow(LocalDate date, String description, BigDecimal amount) {
            this.date = date;
            this.description = description;
            this.amount = amount;
        }

        public LocalDate getDate() {
            return date;
        }

        public String getDescription() {
            return description;
        }

        public BigDecimal getAmount() {
            return amount;
        }
    }
}

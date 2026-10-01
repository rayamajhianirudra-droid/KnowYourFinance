package com.kyf.knowyourfinance.service;

import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
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
 * Expected format (header row required):
 *   Date,Description,Amount
 *   2026-09-01,STARBUCKS #4521,-5.75
 *   2026-09-01,PAYROLL DEPOSIT,2450.00
 *
 * Convention: negative amount = money out (expense), positive = money
 * in (income). This matches how most banks actually export CSVs.
 */
@Component
public class CsvStatementParser {

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ISO_LOCAL_DATE; // yyyy-MM-dd

    public List<ParsedRow> parse(InputStream csvInputStream) throws IOException {
        List<ParsedRow> rows = new ArrayList<>();

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(csvInputStream, StandardCharsets.UTF_8))) {

            String line = reader.readLine(); // header row - we don't validate its exact
            // wording, we just assume column order: Date, Description, Amount

            int lineNumber = 1;
            while ((line = reader.readLine()) != null) {
                lineNumber++;
                if (line.isBlank()) {
                    continue; // skip blank lines some exports leave at the end
                }

                String[] columns = splitCsvLine(line);
                if (columns.length < 3) {
                    // Malformed row - we skip it rather than fail the whole
                    // upload. A statement with one bad line shouldn't block
                    // every other valid transaction from being imported.
                    continue;
                }

                try {
                    LocalDate date = LocalDate.parse(columns[0].trim(), DATE_FORMAT);
                    String description = columns[1].trim();
                    BigDecimal amount = new BigDecimal(columns[2].trim());
                    rows.add(new ParsedRow(date, description, amount));
                } catch (DateTimeParseException | NumberFormatException e) {
                    // Same reasoning as above: one bad row doesn't sink the
                    // whole import. In a later iteration we'd collect these
                    // as warnings to show the user ("line 14 skipped").
                }
            }
        }

        return rows;
    }

    /**
     * A minimal CSV line splitter that handles the one tricky case bank
     * exports actually use: a comma inside a quoted field (e.g. a
     * description like "SMITH, JOHN - TRANSFER"). It does NOT handle
     * escaped quotes inside quotes or multi-line quoted fields - if a
     * real statement needs that, that's the signal to switch to a real
     * CSV library instead of extending this by hand.
     */
    private String[] splitCsvLine(String line) {
        List<String> fields = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        boolean inQuotes = false;

        for (char c : line.toCharArray()) {
            if (c == '"') {
                inQuotes = !inQuotes;
            } else if (c == ',' && !inQuotes) {
                fields.add(current.toString());
                current.setLength(0);
            } else {
                current.append(c);
            }
        }
        fields.add(current.toString());
        return fields.toArray(new String[0]);
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

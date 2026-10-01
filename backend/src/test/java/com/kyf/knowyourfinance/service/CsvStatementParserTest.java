package com.kyf.knowyourfinance.service;

import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Tests the CSV-to-ParsedRow parsing logic in isolation, with no
 * database, no Spring context, no other classes involved - exactly the
 * "dumb, easy to test" layer it was designed to be (see its class
 * comment and build-log 02).
 */
class CsvStatementParserTest {

    private final CsvStatementParser parser = new CsvStatementParser();

    private List<CsvStatementParser.ParsedRow> parse(String csv) throws IOException {
        return parser.parse(new ByteArrayInputStream(csv.getBytes(StandardCharsets.UTF_8)));
    }

    @Test
    void parsesAStandardThreeColumnCsv() throws IOException {
        String csv = """
                Date,Description,Amount
                2026-09-01,PAYROLL DEPOSIT,2450.00
                2026-09-02,STARBUCKS #4521,-5.75
                """;

        List<CsvStatementParser.ParsedRow> rows = parse(csv);

        assertEquals(2, rows.size());
        assertEquals(LocalDate.of(2026, 9, 1), rows.get(0).getDate());
        assertEquals("PAYROLL DEPOSIT", rows.get(0).getDescription());
        assertEquals(new BigDecimal("2450.00"), rows.get(0).getAmount());
        assertEquals(new BigDecimal("-5.75"), rows.get(1).getAmount());
    }

    @Test
    void handlesACommaInsideAQuotedDescription() throws IOException {
        String csv = """
                Date,Description,Amount
                2026-09-03,"SMITH, JOHN - TRANSFER",-200.00
                """;

        List<CsvStatementParser.ParsedRow> rows = parse(csv);

        assertEquals(1, rows.size());
        assertEquals("SMITH, JOHN - TRANSFER", rows.get(0).getDescription());
    }

    @Test
    void skipsMalformedRowsWithoutFailingTheWholeImport() throws IOException {
        // Row 2 has a non-numeric amount, row 3 has a bad date - both
        // should be silently dropped, while the valid rows 1 and 4
        // still come through. This is the documented "one bad line
        // shouldn't sink a 200-row statement" behavior from build-log 02.
        String csv = """
                Date,Description,Amount
                2026-09-01,GOOD ROW ONE,10.00
                2026-09-02,BAD AMOUNT,not-a-number
                not-a-date,BAD DATE,5.00
                2026-09-04,GOOD ROW TWO,20.00
                """;

        List<CsvStatementParser.ParsedRow> rows = parse(csv);

        assertEquals(2, rows.size());
        assertEquals("GOOD ROW ONE", rows.get(0).getDescription());
        assertEquals("GOOD ROW TWO", rows.get(1).getDescription());
    }

    @Test
    void skipsBlankLines() throws IOException {
        String csv = """
                Date,Description,Amount
                2026-09-01,ROW ONE,10.00

                2026-09-02,ROW TWO,20.00
                """;

        List<CsvStatementParser.ParsedRow> rows = parse(csv);

        assertEquals(2, rows.size());
    }

    @Test
    void emptyStatementAfterHeaderProducesNoRows() throws IOException {
        String csv = "Date,Description,Amount\n";

        List<CsvStatementParser.ParsedRow> rows = parse(csv);

        assertEquals(0, rows.size());
    }
}

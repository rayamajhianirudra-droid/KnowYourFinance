package com.kyf.knowyourfinance.service;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * Tests the CSV-to-ParsedRow parsing logic in isolation, with no
 * database, no Spring context, no other classes involved - exactly the
 * "dumb, easy to test" layer it was designed to be (see its class
 * comment and build-log 02).
 */
class CsvStatementParserTest {

    private final CsvStatementParser parser = new CsvStatementParser();

    private CsvStatementParser.ParseResult parse(String csv) throws IOException {
        return parser.parse(new ByteArrayInputStream(csv.getBytes(StandardCharsets.UTF_8)));
    }

    @Test
    void parsesAStandardThreeColumnCsv() throws IOException {
        String csv = """
                Date,Description,Amount
                2026-09-01,PAYROLL DEPOSIT,2450.00
                2026-09-02,STARBUCKS #4521,-5.75
                """;

        List<CsvStatementParser.ParsedRow> rows = parse(csv).getRows();

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

        List<CsvStatementParser.ParsedRow> rows = parse(csv).getRows();

        assertEquals(1, rows.size());
        assertEquals("SMITH, JOHN - TRANSFER", rows.get(0).getDescription());
    }

    @Test
    void skipsMalformedRowsWithoutFailingTheWholeImportAndCountsThem() throws IOException {
        // Row 2 has a non-numeric amount, row 3 has a bad date - both
        // should be dropped (and counted as skipped, FR-104), while the
        // valid rows 1 and 4 still come through. This is the documented
        // "one bad line shouldn't sink a 200-row statement" behavior
        // from build-log 02.
        String csv = """
                Date,Description,Amount
                2026-09-01,GOOD ROW ONE,10.00
                2026-09-02,BAD AMOUNT,not-a-number
                not-a-date,BAD DATE,5.00
                2026-09-04,GOOD ROW TWO,20.00
                """;

        CsvStatementParser.ParseResult result = parse(csv);

        assertEquals(2, result.getRows().size());
        assertEquals("GOOD ROW ONE", result.getRows().get(0).getDescription());
        assertEquals("GOOD ROW TWO", result.getRows().get(1).getDescription());
        assertEquals(2, result.getSkippedRowCount());
    }

    @Test
    void skipsBlankLinesWithoutCountingThemAsSkippedRows() throws IOException {
        // A blank line at the end of an export is normal, not a parse
        // failure - it shouldn't inflate the skipped-row count the user
        // sees after an import.
        String csv = """
                Date,Description,Amount
                2026-09-01,ROW ONE,10.00

                2026-09-02,ROW TWO,20.00
                """;

        CsvStatementParser.ParseResult result = parse(csv);

        assertEquals(2, result.getRows().size());
        assertEquals(0, result.getSkippedRowCount());
    }

    @Test
    void aRowWithTooFewColumnsCountsAsSkipped() throws IOException {
        String csv = """
                Date,Description,Amount
                2026-09-01,MISSING AMOUNT COLUMN
                2026-09-02,ROW TWO,20.00
                """;

        CsvStatementParser.ParseResult result = parse(csv);

        assertEquals(1, result.getRows().size());
        assertEquals(1, result.getSkippedRowCount());
    }

    @Test
    void emptyStatementAfterHeaderProducesNoRowsAndNoSkips() throws IOException {
        String csv = "Date,Description,Amount\n";

        CsvStatementParser.ParseResult result = parse(csv);

        assertEquals(0, result.getRows().size());
        assertEquals(0, result.getSkippedRowCount());
    }

    // ----- more formats: TSV, TXT, XLSX, and common date and amount styles -----

    private CsvStatementParser.ParseResult parseFile(byte[] content, String fileName) throws IOException {
        return parser.parse(new ByteArrayInputStream(content), fileName);
    }

    private CsvStatementParser.ParseResult parseFile(String text, String fileName) throws IOException {
        return parseFile(text.getBytes(StandardCharsets.UTF_8), fileName);
    }

    @Test
    void readsATabSeparatedFile() throws IOException {
        String tsv = "Date\tDescription\tAmount\n2026-09-01\tPAYROLL, MAIN ST\t2450.00\n";

        List<CsvStatementParser.ParsedRow> rows = parseFile(tsv, "sept.tsv").getRows();

        assertEquals(1, rows.size());
        assertEquals("PAYROLL, MAIN ST", rows.get(0).getDescription());
    }

    @Test
    void aTxtFileUsesWhicheverSeparatorItsHeaderUses() throws IOException {
        assertEquals(1, parseFile("Date;Description;Amount\n2026-09-01;COFFEE;-4.50\n", "a.txt").getRows().size());
        assertEquals(1, parseFile("Date\tDescription\tAmount\n2026-09-01\tCOFFEE\t-4.50\n", "b.txt").getRows().size());
        assertEquals(1, parseFile("Date,Description,Amount\n2026-09-01,COFFEE,-4.50\n", "c.txt").getRows().size());
    }

    @Test
    void theFileTypeIsNotCaseSensitive() throws IOException {
        assertEquals(1, parseFile("Date,Description,Amount\n2026-09-01,COFFEE,-4.50\n", "JAN.CSV").getRows().size());
    }

    @Test
    void aByteOrderMarkAtTheStartOfTheFileIsIgnored() throws IOException {
        String csv = "\uFEFFDate,Description,Amount\n2026-09-01,COFFEE,-4.50\n";

        assertEquals(1, parseFile(csv, "x.csv").getRows().size());
    }

    @Test
    void unsupportedFileTypesAreRejectedWithAClearMessage() {
        UnsupportedFileTypeException e = assertThrows(UnsupportedFileTypeException.class,
                () -> parseFile("anything", "statement.pdf"));

        assertEquals("\"statement.pdf\" is not a supported file type. Use CSV, TSV, TXT or XLSX.", e.getMessage());
        assertThrows(UnsupportedFileTypeException.class, () -> parseFile("anything", "noextension"));
    }

    @Test
    void understandsUsStyleDates() throws IOException {
        String csv = "Date,Description,Amount\n09/01/2026,A,-1.00\n9/2/2026,B,-1.00\n09-03-2026,C,-1.00\n9/4/26,D,-1.00\n";

        List<CsvStatementParser.ParsedRow> rows = parseFile(csv, "us.csv").getRows();

        assertEquals(4, rows.size());
        assertEquals(LocalDate.of(2026, 9, 1), rows.get(0).getDate());
        assertEquals(LocalDate.of(2026, 9, 2), rows.get(1).getDate());
        assertEquals(LocalDate.of(2026, 9, 3), rows.get(2).getDate());
        assertEquals(LocalDate.of(2026, 9, 4), rows.get(3).getDate());
    }

    @Test
    void understandsDollarSignsThousandsSeparatorsAndBracketedNegatives() throws IOException {
        String csv = "Date,Description,Amount\n"
                + "2026-09-01,A,\"$1,234.50\"\n"
                + "2026-09-02,B,(5.75)\n"
                + "2026-09-03,C,-$20.00\n";

        List<CsvStatementParser.ParsedRow> rows = parseFile(csv, "amounts.csv").getRows();

        assertEquals(3, rows.size());
        assertEquals(new BigDecimal("1234.50"), rows.get(0).getAmount());
        assertEquals(new BigDecimal("-5.75"), rows.get(1).getAmount());
        assertEquals(new BigDecimal("-20.00"), rows.get(2).getAmount());
    }

    @Test
    void readsAnExcelWorkbookWithRealDateAndNumberCells() throws IOException {
        byte[] workbookBytes;
        try (XSSFWorkbook workbook = new XSSFWorkbook()) {
            Sheet sheet = workbook.createSheet("Statement");
            Row header = sheet.createRow(0);
            header.createCell(0).setCellValue("Date");
            header.createCell(1).setCellValue("Description");
            header.createCell(2).setCellValue("Amount");

            CellStyle dateStyle = workbook.createCellStyle();
            dateStyle.setDataFormat(workbook.getCreationHelper().createDataFormat().getFormat("yyyy-mm-dd"));

            Row one = sheet.createRow(1);
            Cell date = one.createCell(0);
            date.setCellValue(LocalDate.of(2026, 9, 1));
            date.setCellStyle(dateStyle);
            one.createCell(1).setCellValue("STARBUCKS #4521");
            one.createCell(2).setCellValue(-5.75);

            Row two = sheet.createRow(2);
            two.createCell(0).setCellValue("2026-09-02");   // a date typed as text
            two.createCell(1).setCellValue("PAYROLL");
            two.createCell(2).setCellValue(2450);            // a whole number

            sheet.createRow(3);                              // a blank row in the middle is ignored

            Row bad = sheet.createRow(4);
            bad.createCell(0).setCellValue("not a date");
            bad.createCell(1).setCellValue("BAD");
            bad.createCell(2).setCellValue(1);

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            workbook.write(out);
            workbookBytes = out.toByteArray();
        }

        CsvStatementParser.ParseResult result = parseFile(workbookBytes, "sept.xlsx");

        assertEquals(2, result.getRows().size());
        assertEquals(LocalDate.of(2026, 9, 1), result.getRows().get(0).getDate());
        assertEquals(new BigDecimal("-5.75"), result.getRows().get(0).getAmount());
        assertEquals(LocalDate.of(2026, 9, 2), result.getRows().get(1).getDate());
        assertEquals(new BigDecimal("2450"), result.getRows().get(1).getAmount());
        assertEquals(1, result.getSkippedRowCount());
    }

    @Test
    void aFileThatIsNotReallyAWorkbookFailsInsteadOfReturningGarbage() {
        assertThrows(IOException.class, () -> parseFile("this is plain text", "fake.xlsx"));
    }
}

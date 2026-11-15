package com.kyf.knowyourfinance.service;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.DateUtil;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Turns an uploaded statement file of any supported format into the same
 * plain shape: a list of rows, each row an array of text cells. After this
 * step the rest of the pipeline neither knows nor cares whether the file
 * was a CSV or an Excel workbook.
 *
 * Supported: .csv (comma), .tsv (tab), .txt (comma, tab or semicolon,
 * detected from the first line) and .xlsx (first sheet).
 *
 * The first row is the header in every format, and the columns are
 * expected in the order Date, Description, Amount.
 */
public final class StatementTableReader {

    private StatementTableReader() {
    }

    /** Reads the file by its extension. Throws UnsupportedFileTypeException for anything else. */
    public static List<String[]> read(InputStream in, String fileName) throws IOException {
        String name = fileName == null ? "" : fileName;
        String lower = name.toLowerCase(Locale.ROOT);
        if (lower.endsWith(".csv")) {
            return readDelimited(in, ',');
        }
        if (lower.endsWith(".tsv")) {
            return readDelimited(in, '\t');
        }
        if (lower.endsWith(".txt")) {
            return readDelimited(in, null);
        }
        if (lower.endsWith(".xlsx")) {
            return readXlsx(in);
        }
        throw new UnsupportedFileTypeException(name.isBlank() ? "(no name)" : name);
    }

    /**
     * Reads text lines split on a delimiter. Pass null to detect it from
     * the first line: a tab if there is one, otherwise whichever of
     * semicolon and comma appears more often.
     */
    public static List<String[]> readDelimited(InputStream in, Character delimiter) throws IOException {
        List<String[]> rows = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8))) {
            String line;
            Character chosen = delimiter;
            boolean first = true;
            while ((line = reader.readLine()) != null) {
                if (first) {
                    // A byte order mark at the start of the file (Excel adds
                    // one to some CSV exports) would otherwise stick to the
                    // first header cell.
                    if (line.startsWith("﻿")) {
                        line = line.substring(1);
                    }
                    if (chosen == null) {
                        chosen = detectDelimiter(line);
                    }
                    first = false;
                }
                if (line.isBlank()) {
                    rows.add(new String[0]); // keep the position, parser ignores blank rows
                    continue;
                }
                rows.add(split(line, chosen));
            }
        }
        return rows;
    }

    private static char detectDelimiter(String headerLine) {
        if (headerLine.indexOf('\t') >= 0) {
            return '\t';
        }
        long semicolons = headerLine.chars().filter(c -> c == ';').count();
        long commas = headerLine.chars().filter(c -> c == ',').count();
        return semicolons > commas ? ';' : ',';
    }

    /**
     * A minimal splitter that handles the one tricky case bank exports
     * actually use: a delimiter inside a quoted field (a description like
     * "SMITH, JOHN - TRANSFER"). It does not handle escaped quotes or
     * fields that span several lines.
     */
    static String[] split(String line, char delimiter) {
        List<String> fields = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        boolean inQuotes = false;
        for (char c : line.toCharArray()) {
            if (c == '"') {
                inQuotes = !inQuotes;
            } else if (c == delimiter && !inQuotes) {
                fields.add(current.toString());
                current.setLength(0);
            } else {
                current.append(c);
            }
        }
        fields.add(current.toString());
        return fields.toArray(new String[0]);
    }

    /** Reads the first sheet of an .xlsx workbook into text cells. */
    private static List<String[]> readXlsx(InputStream in) throws IOException {
        List<String[]> rows = new ArrayList<>();
        try (Workbook workbook = WorkbookFactory.create(in)) {
            if (workbook.getNumberOfSheets() == 0) {
                return rows;
            }
            Sheet sheet = workbook.getSheetAt(0);
            int lastRow = sheet.getLastRowNum();
            for (int r = 0; r <= lastRow; r++) {
                Row row = sheet.getRow(r);
                if (row == null || row.getLastCellNum() <= 0) {
                    rows.add(new String[0]);
                    continue;
                }
                int width = Math.max(3, row.getLastCellNum());
                String[] cells = new String[width];
                boolean anyContent = false;
                for (int c = 0; c < width; c++) {
                    cells[c] = cellText(row.getCell(c));
                    anyContent |= !cells[c].isBlank();
                }
                rows.add(anyContent ? cells : new String[0]);
            }
        }
        return rows;
    }

    /** One cell as text. Dates become yyyy-MM-dd, numbers lose a trailing ".0". */
    private static String cellText(Cell cell) {
        if (cell == null) {
            return "";
        }
        CellType type = cell.getCellType() == CellType.FORMULA
                ? cell.getCachedFormulaResultType() : cell.getCellType();
        switch (type) {
            case NUMERIC:
                if (DateUtil.isCellDateFormatted(cell)) {
                    return cell.getLocalDateTimeCellValue().toLocalDate().toString();
                }
                return BigDecimal.valueOf(cell.getNumericCellValue()).stripTrailingZeros().toPlainString();
            case STRING:
                return cell.getStringCellValue().trim();
            case BOOLEAN:
                return String.valueOf(cell.getBooleanCellValue());
            default:
                return "";
        }
    }
}

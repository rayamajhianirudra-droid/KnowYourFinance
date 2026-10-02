package com.kyf.knowyourfinance.controller;

import com.kyf.knowyourfinance.dto.StatementImportResponse;
import com.kyf.knowyourfinance.service.StatementImportService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

/**
 * The entry point for KYF's core differentiator: instead of linking a
 * bank account, the user uploads a statement file and we parse it
 * ourselves. This is the feature every security slide in the Milestone 1
 * deck was describing - this controller is where that plan becomes real
 * code.
 *
 * `MultipartFile` is Spring's abstraction for an uploaded file in an
 * HTTP request - we never save it to disk; we read it straight from
 * memory via getInputStream() and hand that stream to the parser.
 * Nothing about the raw uploaded file itself is ever written anywhere.
 */
@RestController
@RequestMapping("/api/statements")
public class StatementController {

    private final StatementImportService statementImportService;

    public StatementController(StatementImportService statementImportService) {
        this.statementImportService = statementImportService;
    }

    /**
     * POST /api/statements/upload?userId=1
     * Body: multipart/form-data with a "file" field containing the CSV.
     *
     * PDF statement support is a deliberate follow-up, not done here:
     * PDFs need text extraction before they can be parsed the same way,
     * which is a meaningfully different (and heavier) step. Shipping CSV
     * first gets the whole redact -> categorize -> save pipeline working
     * and testable; PDF becomes "add a PDF-to-text step in front of the
     * same pipeline" rather than a rewrite.
     */
    /**
     * `preview` (default false) runs the exact same pipeline - parse,
     * redact, categorize, duplicate-check - without saving anything, so
     * the frontend can show the user what an import WOULD do (row
     * count, date range, totals) and let them confirm before it's
     * final. The frontend calls this endpoint twice for one real
     * import: once with preview=true to show that confirmation screen,
     * then again with preview=false (or omitted) once the user
     * confirms.
     */
    @PostMapping("/upload")
    public ResponseEntity<StatementImportResponse> upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam Long userId,
            @RequestParam(defaultValue = "false") boolean preview) throws IOException {

        if (file.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        StatementImportResponse response =
                statementImportService.importCsv(file.getInputStream(), userId, !preview);
        return ResponseEntity.ok(response);
    }
}

package com.kyf.knowyourfinance.controller;

import com.kyf.knowyourfinance.dto.BatchImportResponse;
import com.kyf.knowyourfinance.dto.StatementImportResponse;
import com.kyf.knowyourfinance.service.StatementImportService;
import com.kyf.knowyourfinance.service.UnsupportedFileTypeException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

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

    /** The most statements one request may carry (for example a year of monthly statements). */
    public static final int MAX_FILES_PER_UPLOAD = 12;

    private final StatementImportService statementImportService;

    public StatementController(StatementImportService statementImportService) {
        this.statementImportService = statementImportService;
    }

    /**
     * POST /api/statements/upload?userId=1
     * Body: multipart/form-data with a "file" field (CSV, TSV, TXT or XLSX).
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
                statementImportService.importFile(
                        file.getInputStream(), file.getOriginalFilename(), userId, !preview);
        return ResponseEntity.ok(response);
    }

    /**
     * POST /api/statements/upload-batch?userId=1&preview=true
     * Body: multipart/form-data with up to 12 "files" fields.
     *
     * Each file runs through the same pipeline as a single upload, one
     * after another, each in its own database transaction. A file that
     * cannot be read (wrong type, empty, damaged) is reported as failed
     * and the rest still import. Because the files are saved in order,
     * a transaction that appears in two overlapping statements is saved
     * once and counted as a duplicate the second time. A preview saves
     * nothing, so it cannot see overlaps between files of the same batch.
     */
    @PostMapping("/upload-batch")
    public ResponseEntity<BatchImportResponse> uploadBatch(
            @RequestParam(value = "files", required = false) List<MultipartFile> files,
            @RequestParam Long userId,
            @RequestParam(defaultValue = "false") boolean preview) {

        if (files == null || files.isEmpty()) {
            throw new BadUploadException("Choose at least one file.");
        }
        if (files.size() > MAX_FILES_PER_UPLOAD) {
            throw new BadUploadException("You can upload at most " + MAX_FILES_PER_UPLOAD
                    + " files at a time. You chose " + files.size() + ".");
        }

        List<BatchImportResponse.FileResult> results = new ArrayList<>();
        for (MultipartFile file : files) {
            String name = file.getOriginalFilename() == null ? "(no name)" : file.getOriginalFilename();
            if (file.isEmpty()) {
                results.add(new BatchImportResponse.FileResult(name, false, "The file is empty.", null));
                continue;
            }
            try {
                StatementImportResponse response = statementImportService.importFile(
                        file.getInputStream(), name, userId, !preview);
                results.add(new BatchImportResponse.FileResult(name, true, null, response));
            } catch (UnsupportedFileTypeException e) {
                results.add(new BatchImportResponse.FileResult(name, false, e.getMessage(), null));
            } catch (Exception e) {
                // A damaged file or a workbook we cannot open. The details
                // stay out of the message; the user just needs to know this
                // one file did not work.
                results.add(new BatchImportResponse.FileResult(name, false,
                        "This file could not be read. Check that it is a valid statement export.", null));
            }
        }
        return ResponseEntity.ok(new BatchImportResponse(results));
    }
}

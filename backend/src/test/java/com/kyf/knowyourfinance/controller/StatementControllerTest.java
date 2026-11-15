package com.kyf.knowyourfinance.controller;

import com.kyf.knowyourfinance.dto.StatementImportResponse;
import com.kyf.knowyourfinance.service.UnsupportedFileTypeException;
import com.kyf.knowyourfinance.service.StatementImportService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import java.io.InputStream;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Covers the upload endpoint's edges: empty files, the preview switch,
 * and the error message for oversized files (FR-105 and NFR-06).
 */
@WebMvcTest(StatementController.class)
class StatementControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private StatementImportService statementImportService;

    private static final StatementImportResponse EMPTY_RESULT =
            new StatementImportResponse(0, 0, 0, 0, 0, List.of());

    private MockMultipartFile csvFile(byte[] content) {
        return new MockMultipartFile("file", "statement.csv", "text/csv", content);
    }

    @Test
    void anEmptyFileIsRejectedWithoutTouchingTheImportService() throws Exception {
        mockMvc.perform(multipart("/api/statements/upload")
                        .file(csvFile(new byte[0])).param("userId", "1"))
                .andExpect(status().isBadRequest());

        verify(statementImportService, never()).importFile(any(InputStream.class), any(), any(), eq(true));
    }

    @Test
    void aNormalUploadSavesTheTransactions() throws Exception {
        when(statementImportService.importFile(any(InputStream.class), any(), eq(1L), eq(true)))
                .thenReturn(EMPTY_RESULT);

        mockMvc.perform(multipart("/api/statements/upload")
                        .file(csvFile("Date,Description,Amount\n".getBytes())).param("userId", "1"))
                .andExpect(status().isOk());

        verify(statementImportService).importFile(any(InputStream.class), any(), eq(1L), eq(true));
    }

    @Test
    void previewModeAsksTheServiceNotToSave() throws Exception {
        when(statementImportService.importFile(any(InputStream.class), any(), eq(1L), eq(false)))
                .thenReturn(EMPTY_RESULT);

        mockMvc.perform(multipart("/api/statements/upload")
                        .file(csvFile("Date,Description,Amount\n".getBytes()))
                        .param("userId", "1").param("preview", "true"))
                .andExpect(status().isOk());

        verify(statementImportService).importFile(any(InputStream.class), any(), eq(1L), eq(false));
    }

    @Test
    void missingUserIdIsAClientErrorNotACrash() throws Exception {
        mockMvc.perform(multipart("/api/statements/upload")
                        .file(csvFile("Date,Description,Amount\n".getBytes())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Missing or invalid request parameter: userId"));
    }

    @Test
    void anOversizedUploadGetsAClearTenMegabyteMessage() {
        // Spring raises this exception before our controller runs when a
        // file passes the configured limit, so we exercise the handler
        // that turns it into the friendly message the page shows.
        ResponseEntity<Map<String, Object>> response = new GlobalExceptionHandler()
                .handleUploadTooLarge(new MaxUploadSizeExceededException(10L * 1024 * 1024));

        assertEquals(400, response.getStatusCode().value());
        assertEquals("Uploaded file is too large (10MB limit)", response.getBody().get("message"));
    }

    // ----- batch upload (up to 12 files in one request) -----

    private MockMultipartFile batchFile(String name, byte[] content) {
        return new MockMultipartFile("files", name, "text/csv", content);
    }

    @Test
    void aBatchOfTwoFilesReturnsOneResultPerFile() throws Exception {
        when(statementImportService.importFile(any(InputStream.class), eq("jan.csv"), eq(1L), eq(true)))
                .thenReturn(EMPTY_RESULT);
        when(statementImportService.importFile(any(InputStream.class), eq("feb.xlsx"), eq(1L), eq(true)))
                .thenReturn(EMPTY_RESULT);

        mockMvc.perform(multipart("/api/statements/upload-batch")
                        .file(batchFile("jan.csv", "Date,Description,Amount\n".getBytes()))
                        .file(batchFile("feb.xlsx", "x".getBytes()))
                        .param("userId", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.files.length()").value(2))
                .andExpect(jsonPath("$.files[0].fileName").value("jan.csv"))
                .andExpect(jsonPath("$.files[0].success").value(true))
                .andExpect(jsonPath("$.files[1].fileName").value("feb.xlsx"))
                .andExpect(jsonPath("$.filesSucceeded").value(2))
                .andExpect(jsonPath("$.filesFailed").value(0));
    }

    @Test
    void exactlyTwelveFilesAreAccepted() throws Exception {
        when(statementImportService.importFile(any(InputStream.class), any(), eq(1L), eq(true)))
                .thenReturn(EMPTY_RESULT);

        var request = multipart("/api/statements/upload-batch");
        for (int i = 1; i <= 12; i++) {
            request.file(batchFile("month" + i + ".csv", "Date,Description,Amount\n".getBytes()));
        }

        mockMvc.perform(request.param("userId", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.files.length()").value(12));
    }

    @Test
    void thirteenFilesAreRejectedWithAClearMessageAndNothingIsImported() throws Exception {
        var request = multipart("/api/statements/upload-batch");
        for (int i = 1; i <= 13; i++) {
            request.file(batchFile("month" + i + ".csv", "Date,Description,Amount\n".getBytes()));
        }

        mockMvc.perform(request.param("userId", "1"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(
                        "You can upload at most 12 files at a time. You chose 13."));

        verify(statementImportService, never()).importFile(any(InputStream.class), any(), any(), eq(true));
    }

    @Test
    void aBatchWithNoFilesIsRejected() throws Exception {
        mockMvc.perform(multipart("/api/statements/upload-batch").param("userId", "1"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Choose at least one file."));
    }

    @Test
    void oneUnsupportedFileFailsAloneAndTheOthersStillImport() throws Exception {
        when(statementImportService.importFile(any(InputStream.class), eq("good.csv"), eq(1L), eq(true)))
                .thenReturn(EMPTY_RESULT);
        when(statementImportService.importFile(any(InputStream.class), eq("notes.pdf"), eq(1L), eq(true)))
                .thenThrow(new UnsupportedFileTypeException("notes.pdf"));

        mockMvc.perform(multipart("/api/statements/upload-batch")
                        .file(batchFile("good.csv", "Date,Description,Amount\n".getBytes()))
                        .file(batchFile("notes.pdf", "pdf".getBytes()))
                        .param("userId", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.files[0].success").value(true))
                .andExpect(jsonPath("$.files[1].success").value(false))
                .andExpect(jsonPath("$.files[1].message").value(
                        "\"notes.pdf\" is not a supported file type. Use CSV, TSV, TXT or XLSX."))
                .andExpect(jsonPath("$.filesSucceeded").value(1))
                .andExpect(jsonPath("$.filesFailed").value(1));
    }

    @Test
    void anEmptyFileInABatchIsReportedWithoutCallingTheService() throws Exception {
        mockMvc.perform(multipart("/api/statements/upload-batch")
                        .file(batchFile("empty.csv", new byte[0]))
                        .param("userId", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.files[0].success").value(false))
                .andExpect(jsonPath("$.files[0].message").value("The file is empty."));

        verify(statementImportService, never()).importFile(any(InputStream.class), any(), any(), eq(true));
    }

    @Test
    void aFileThatCannotBeReadIsReportedAsFailedNotAsAServerError() throws Exception {
        when(statementImportService.importFile(any(InputStream.class), eq("broken.xlsx"), eq(1L), eq(true)))
                .thenThrow(new java.io.IOException("corrupt"));

        mockMvc.perform(multipart("/api/statements/upload-batch")
                        .file(batchFile("broken.xlsx", "not really a workbook".getBytes()))
                        .param("userId", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.files[0].success").value(false))
                .andExpect(jsonPath("$.files[0].message").value(
                        "This file could not be read. Check that it is a valid statement export."));
    }

    @Test
    void aPreviewBatchAsksTheServiceNotToSave() throws Exception {
        when(statementImportService.importFile(any(InputStream.class), eq("jan.csv"), eq(1L), eq(false)))
                .thenReturn(EMPTY_RESULT);

        mockMvc.perform(multipart("/api/statements/upload-batch")
                        .file(batchFile("jan.csv", "Date,Description,Amount\n".getBytes()))
                        .param("userId", "1").param("preview", "true"))
                .andExpect(status().isOk());

        verify(statementImportService).importFile(any(InputStream.class), eq("jan.csv"), eq(1L), eq(false));
    }
}

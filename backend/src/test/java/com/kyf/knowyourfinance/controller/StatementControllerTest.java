package com.kyf.knowyourfinance.controller;

import com.kyf.knowyourfinance.dto.StatementImportResponse;
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

        verify(statementImportService, never()).importCsv(any(InputStream.class), any(), eq(true));
    }

    @Test
    void aNormalUploadSavesTheTransactions() throws Exception {
        when(statementImportService.importCsv(any(InputStream.class), eq(1L), eq(true)))
                .thenReturn(EMPTY_RESULT);

        mockMvc.perform(multipart("/api/statements/upload")
                        .file(csvFile("Date,Description,Amount\n".getBytes())).param("userId", "1"))
                .andExpect(status().isOk());

        verify(statementImportService).importCsv(any(InputStream.class), eq(1L), eq(true));
    }

    @Test
    void previewModeAsksTheServiceNotToSave() throws Exception {
        when(statementImportService.importCsv(any(InputStream.class), eq(1L), eq(false)))
                .thenReturn(EMPTY_RESULT);

        mockMvc.perform(multipart("/api/statements/upload")
                        .file(csvFile("Date,Description,Amount\n".getBytes()))
                        .param("userId", "1").param("preview", "true"))
                .andExpect(status().isOk());

        verify(statementImportService).importCsv(any(InputStream.class), eq(1L), eq(false));
    }

    @Test
    void missingUserIdIsAClientErrorNotACrash() throws Exception {
        mockMvc.perform(multipart("/api/statements/upload")
                        .file(csvFile("Date,Description,Amount\n".getBytes())))
                .andExpect(status().is4xxClientError());
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
}

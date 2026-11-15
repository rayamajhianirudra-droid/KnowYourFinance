package com.kyf.knowyourfinance.dto;

import java.util.List;

/**
 * What the frontend gets back after uploading several statements at once.
 * One entry per file, in the order the files were sent, so a failure in
 * one file is visible next to the files that worked.
 */
public class BatchImportResponse {

    /** The outcome for one file of the batch. */
    public static class FileResult {
        private String fileName;
        private boolean success;
        private String message;
        private StatementImportResponse result;

        public FileResult() {
        }

        public FileResult(String fileName, boolean success, String message, StatementImportResponse result) {
            this.fileName = fileName;
            this.success = success;
            this.message = message;
            this.result = result;
        }

        public String getFileName() {
            return fileName;
        }

        public boolean isSuccess() {
            return success;
        }

        /** Null on success, a message the user can read on failure. */
        public String getMessage() {
            return message;
        }

        /** The import summary, or null when the file failed. */
        public StatementImportResponse getResult() {
            return result;
        }
    }

    private List<FileResult> files;
    private int filesSucceeded;
    private int filesFailed;

    public BatchImportResponse() {
    }

    public BatchImportResponse(List<FileResult> files) {
        this.files = files;
        this.filesSucceeded = (int) files.stream().filter(FileResult::isSuccess).count();
        this.filesFailed = files.size() - filesSucceeded;
    }

    public List<FileResult> getFiles() {
        return files;
    }

    public int getFilesSucceeded() {
        return filesSucceeded;
    }

    public int getFilesFailed() {
        return filesFailed;
    }
}

package com.kyf.knowyourfinance.controller;

/** The request itself was wrong (for example too many files). Becomes a 400 with this message. */
public class BadUploadException extends RuntimeException {
    public BadUploadException(String message) {
        super(message);
    }
}

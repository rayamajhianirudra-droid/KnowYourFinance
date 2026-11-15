package com.kyf.knowyourfinance.service;

/**
 * Thrown when an uploaded file is not one of the formats we can read.
 * The message is written for the person using the app, so it can be
 * shown to them as it is.
 */
public class UnsupportedFileTypeException extends IllegalArgumentException {

    public UnsupportedFileTypeException(String fileName) {
        super("\"" + fileName + "\" is not a supported file type. Use CSV, TSV, TXT or XLSX.");
    }
}

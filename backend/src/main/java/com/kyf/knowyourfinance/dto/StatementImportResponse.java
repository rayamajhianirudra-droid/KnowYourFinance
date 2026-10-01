package com.kyf.knowyourfinance.dto;

import com.kyf.knowyourfinance.model.Transaction;

import java.util.List;

/**
 * What the frontend gets back after uploading a statement. Deliberately
 * reports counts (how many rows came in, how many were saved, how many
 * had something redacted, how many were skipped as malformed) rather
 * than just dumping the saved transactions - a user who uploads a
 * 200-line statement wants to know at a glance "did this work," not just
 * silently get a list back.
 */
public class StatementImportResponse {

    private int rowsParsed;
    private int transactionsSaved;
    private int rowsRedacted;
    private int rowsSkipped;
    private int duplicatesSkipped;
    private List<Transaction> transactions;

    public StatementImportResponse() {
    }

    public StatementImportResponse(int rowsParsed, int transactionsSaved, int rowsRedacted,
                                    int rowsSkipped, int duplicatesSkipped, List<Transaction> transactions) {
        this.rowsParsed = rowsParsed;
        this.transactionsSaved = transactionsSaved;
        this.rowsRedacted = rowsRedacted;
        this.rowsSkipped = rowsSkipped;
        this.duplicatesSkipped = duplicatesSkipped;
        this.transactions = transactions;
    }

    public int getRowsParsed() {
        return rowsParsed;
    }

    public void setRowsParsed(int rowsParsed) {
        this.rowsParsed = rowsParsed;
    }

    public int getTransactionsSaved() {
        return transactionsSaved;
    }

    public void setTransactionsSaved(int transactionsSaved) {
        this.transactionsSaved = transactionsSaved;
    }

    public int getRowsRedacted() {
        return rowsRedacted;
    }

    public void setRowsRedacted(int rowsRedacted) {
        this.rowsRedacted = rowsRedacted;
    }

    public int getRowsSkipped() {
        return rowsSkipped;
    }

    public void setRowsSkipped(int rowsSkipped) {
        this.rowsSkipped = rowsSkipped;
    }

    public int getDuplicatesSkipped() {
        return duplicatesSkipped;
    }

    public void setDuplicatesSkipped(int duplicatesSkipped) {
        this.duplicatesSkipped = duplicatesSkipped;
    }

    public List<Transaction> getTransactions() {
        return transactions;
    }

    public void setTransactions(List<Transaction> transactions) {
        this.transactions = transactions;
    }
}

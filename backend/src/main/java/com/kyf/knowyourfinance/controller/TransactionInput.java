package com.kyf.knowyourfinance.controller;

import com.kyf.knowyourfinance.model.TransactionCategory;
import com.kyf.knowyourfinance.model.TransactionType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.math.BigDecimal;

record TransactionInput(
    @NotNull(message = "Choose a date.")
    LocalDate date,
    @NotBlank(message = "Describe what this was.")
    String description,
    @NotNull(message = "Enter an amount.")
    BigDecimal amount,
    @NotNull
    TransactionType type,
    TransactionCategory category
) {}

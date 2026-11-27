package com.kyf.knowyourfinance.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import com.kyf.knowyourfinance.auth.AccountPrincipal;
import com.kyf.knowyourfinance.dto.DataSummary;
import com.kyf.knowyourfinance.dto.ResetResult;
import com.kyf.knowyourfinance.service.DataResetService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * GET /api/data/summary says how much data a user has.
 * DELETE /api/data?confirm=DELETE removes it. The confirm word
 * is required so a stray request can never wipe anything by accident.
 * includeName=true also removes the saved name.
 */
@RestController
@RequestMapping("/api/data")
public class DataResetController {

    static final String CONFIRM_WORD = "DELETE";

    private final DataResetService service;

    public DataResetController(DataResetService service) {
        this.service = service;
    }

    @GetMapping("/summary")
    public DataSummary summary(@AuthenticationPrincipal AccountPrincipal account) {
        Long userId = account.ownerId();
        return service.summary(userId);
    }

    @DeleteMapping
    public ResetResult reset(@AuthenticationPrincipal AccountPrincipal account,
                             @RequestParam(required = false) String confirm,
                             @RequestParam(defaultValue = "false") boolean includeName) {
        Long userId = account.ownerId();
        if (!CONFIRM_WORD.equals(confirm)) {
            throw new IllegalArgumentException("Type DELETE to confirm that you want to remove all your data.");
        }
        return service.reset(userId, includeName);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> invalid(IllegalArgumentException error) {
        return ResponseEntity.badRequest().body(Map.of("message", error.getMessage()));
    }
}

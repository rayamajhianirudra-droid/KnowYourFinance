package com.kyf.knowyourfinance.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Without this class, an error anywhere in the app (a missing required
 * field, an oversized upload, an unexpected bug) would send the raw Java
 * exception and stack trace straight back to the frontend as the HTTP
 * response. That's unhelpful for the frontend (it gets Java internals
 * instead of a clean message to show the user) and, in a real
 * deployment, a security concern (stack traces can leak internal file
 * paths and structure).
 *
 * `@RestControllerAdvice` tells Spring: "watch every controller in the
 * app, and if one of these specific exception types gets thrown
 * anywhere, run this method instead of letting it crash through to a
 * raw error page." It's a single, central place for turning "something
 * went wrong" into a consistent, predictable JSON shape every time.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    /**
     * Fires when @Valid on a request body (e.g. TransactionController's
     * create()) finds a rule violation - a missing @NotNull field, a
     * blank @NotBlank field, etc. Instead of a generic 400 with no
     * detail, this collects exactly which field(s) failed and why, so
     * the frontend could eventually show "amount is required" right next
     * to the amount input instead of a vague "request failed."
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> fieldErrors = new LinkedHashMap<>();
        ex.getBindingResult().getFieldErrors().forEach(error ->
                fieldErrors.put(error.getField(), error.getDefaultMessage()));

        return ResponseEntity.badRequest().body(errorBody(
                "Validation failed", fieldErrors));
    }

    /**
     * Fires when an uploaded statement exceeds the 10MB limit set in
     * application.properties. Without this handler, that would surface
     * as a confusing low-level servlet error instead of a clear message.
     */
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, Object>> handleUploadTooLarge(MaxUploadSizeExceededException ex) {
        return ResponseEntity.badRequest().body(errorBody(
                "Uploaded file is too large (10MB limit)", null));
    }

    /**
     * The catch-all: anything not handled above still becomes a clean
     * JSON error with a 500 status, instead of a raw stack trace. This
     * is intentionally generic - in a real deployment we would also log
     * the full exception server-side (not shown to the user) so it's
     * still debuggable, just not exposed.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleUnexpected(Exception ex) {
        return ResponseEntity.internalServerError().body(errorBody(
                "Something went wrong processing the request", null));
    }

    private Map<String, Object> errorBody(String message, Map<String, String> fieldErrors) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", Instant.now().toString());
        body.put("message", message);
        if (fieldErrors != null && !fieldErrors.isEmpty()) {
            body.put("fieldErrors", fieldErrors);
        }
        return body;
    }
}

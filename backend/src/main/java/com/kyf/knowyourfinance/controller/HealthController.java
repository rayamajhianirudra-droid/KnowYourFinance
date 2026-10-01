package com.kyf.knowyourfinance.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

/**
 * The very first endpoint of any backend should be a "health check" -
 * a simple route that proves the server is up and responding, with no
 * database, no auth, no business logic involved. It's the "hello world"
 * of a REST API.
 *
 * @RestController tells Spring two things at once:
 *   1. This class handles incoming HTTP requests (it's a @Controller)
 *   2. Whatever each method returns should be converted straight to
 *      JSON and sent as the HTTP response body (that's the "Rest" part -
 *      without it, Spring would instead try to find an HTML page to render)
 */
@RestController
public class HealthController {

    /**
     * @GetMapping("/api/health") means: when an HTTP GET request arrives
     * at the path /api/health, run this method.
     *
     * We return a Map here - Spring automatically serializes it into a
     * JSON object in the response, e.g.:
     *   { "status": "ok", "service": "knowyourfinance", "timestamp": "..." }
     */
    @GetMapping("/api/health")
    public Map<String, Object> health() {
        return Map.of(
                "status", "ok",
                "service", "knowyourfinance",
                "timestamp", Instant.now().toString()
        );
    }
}

# Build Log 08 — CORS Configuration

**Date:** Oct 1, 2026
**What exists after this entry:** `WebConfig` — the backend now explicitly allows the local frontend's origin to call its API.

## The bug

Running the frontend for the first time against the real backend (both running locally — backend on port 8080, frontend on port 5173) produced "Failed to fetch" on every API call, even though the backend itself was healthy and reachable directly in a browser tab.

## Why it happened

Port 8080 and port 5173 count as two different *origins* to a browser, even on the same machine. Browsers block JavaScript on one origin from calling an API on a different origin unless that API explicitly allows it — this is CORS (Cross-Origin Resource Sharing), a browser security feature, not a backend bug. It only affects requests made *from a browser via JavaScript* — that's why `curl` or Postman hitting the same endpoint works fine while the React app's `fetch()` calls fail.

Until now, nothing in the Spring Boot app told it to allow any other origin, so every cross-origin request was silently blocked by the browser before the backend even got to respond.

## The fix

```java
@Configuration
public class WebConfig implements WebMvcConfigurer {
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins("http://localhost:5173")
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*");
    }
}
```

This tells the backend: "requests to any `/api/**` endpoint coming from `http://localhost:5173` are allowed." In a real deployment, `localhost:5173` would be swapped for the actual deployed frontend URL.

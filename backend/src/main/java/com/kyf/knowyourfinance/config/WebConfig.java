package com.kyf.knowyourfinance.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * The frontend (http://localhost:5173, started by Vite) and the backend
 * (http://localhost:8080, started by Spring Boot) are two different
 * "origins" as far as a browser is concerned - different port numbers
 * count as different origins, even on the same machine. Browsers block
 * JavaScript from one origin calling an API on another origin unless
 * that API explicitly says "requests from this other origin are
 * allowed" - this is called CORS (Cross-Origin Resource Sharing), and
 * it's a browser security feature, not a bug.
 *
 * Without this class, every fetch() call from the React app fails with
 * a generic "Failed to fetch" error in the browser, even though the
 * backend is running perfectly fine - Postman or curl hitting the same
 * endpoint would work, because CORS is a browser-only restriction.
 *
 * This allows the local Vite dev server origin to call every /api/**
 * endpoint, with every common HTTP method. In production this would be
 * narrowed to the actual deployed frontend URL instead of localhost.
 */
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

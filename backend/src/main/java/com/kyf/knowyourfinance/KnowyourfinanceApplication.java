package com.kyf.knowyourfinance;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * This is the entry point of the whole backend.
 *
 * When you run this file, Spring Boot:
 *   1. Scans this package (and sub-packages) for anything annotated
 *      with Spring's special annotations (@RestController, @Service, @Entity, etc.)
 *   2. Wires all of those pieces together automatically (this is called
 *      "dependency injection" - Spring builds and connects the objects
 *      your app needs so you don't do it by hand)
 *   3. Starts an embedded web server (Tomcat, bundled in) on port 8080
 *
 * @SpringBootApplication is shorthand for three annotations stacked together:
 *   - @Configuration: this class can define Spring configuration
 *   - @EnableAutoConfiguration: Spring should guess sensible defaults based on
 *     what's on the classpath (e.g. "H2 is on the classpath, so auto-configure
 *     a database connection to it")
 *   - @ComponentScan: look in this package and below for Spring components
 */
@SpringBootApplication
public class KnowyourfinanceApplication {

    public static void main(String[] args) {
        SpringApplication.run(KnowyourfinanceApplication.class, args);
    }

}

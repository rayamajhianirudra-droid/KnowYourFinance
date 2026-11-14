package com.kyf.knowyourfinance.performance;

import com.kyf.knowyourfinance.dto.StatementImportResponse;
import com.kyf.knowyourfinance.model.Transaction;
import com.kyf.knowyourfinance.model.TransactionCategory;
import com.kyf.knowyourfinance.model.TransactionType;
import com.kyf.knowyourfinance.repository.TransactionRepository;
import com.kyf.knowyourfinance.service.AutoCategorizer;
import com.kyf.knowyourfinance.service.CsvStatementParser;
import com.kyf.knowyourfinance.service.DashboardService;
import com.kyf.knowyourfinance.service.InsightsService;
import com.kyf.knowyourfinance.service.StatementImportService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Measures the two performance requirements from the Milestone 2 SRS:
 *
 *   NFR-01  a month report within 2.5 seconds for a user with up to 5,000 transactions
 *   NFR-02  a statement of up to 1,000 rows processed within 5 seconds
 *
 * Each measurement prints a line starting with "PERF" so the numbers can be
 * read from the CI log and copied into the test report.
 *
 * IMPORTANT LIMIT: the database here runs in a container on the same machine,
 * so a round trip to it costs almost nothing. The real system talks to
 * Supabase over the internet, where every round trip costs tens of
 * milliseconds. That is why each test also prints how many statements it sent
 * to the database. Time on the real system is roughly the time measured here
 * plus (statements sent x network round trip time).
 */
@DataJpaTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({StatementImportService.class, CsvStatementParser.class, AutoCategorizer.class,
        DashboardService.class, InsightsService.class})
@Testcontainers(disabledWithoutDocker = true)
class PerformanceTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "create-drop");
    }

    @Autowired private StatementImportService importService;
    @Autowired private DashboardService dashboardService;
    @Autowired private TransactionRepository repository;
    @Autowired private EntityManager entityManager;
    @Autowired private EntityManagerFactory entityManagerFactory;

    private Statistics statistics() {
        return entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
    }

    private static long millisSince(long startNanos) {
        return (System.nanoTime() - startNanos) / 1_000_000;
    }

    /** A statement with n rows: unique dates and amounts, some with long digit runs to redact. */
    private static String statementWithRows(int n) {
        String[] merchants = {"STARBUCKS #", "SHELL GAS STATION ", "WHOLE FOODS MKT ", "NETFLIX ",
                "ACH TRANSFER REF 4821753690", "RENT PAYMENT UNIT ", "UBER TRIP ", "PAYROLL DEPOSIT "};
        StringBuilder csv = new StringBuilder("Date,Description,Amount\n");
        LocalDate start = LocalDate.of(2026, 1, 1);
        for (int i = 0; i < n; i++) {
            LocalDate date = start.plusDays(i % 300);
            String description = merchants[i % merchants.length] + i;
            BigDecimal amount = new BigDecimal(5 + (i * 37 % 4000)).movePointLeft(0)
                    .add(new BigDecimal(i % 100).movePointLeft(2));
            if (i % 8 != 7) {
                amount = amount.negate();
            }
            csv.append(date).append(',').append(description).append(',').append(amount).append('\n');
        }
        return csv.toString();
    }

    @Test
    void importOfOneThousandRowsFinishesInUnderFiveSeconds() throws Exception {
        byte[] csv = statementWithRows(1000).getBytes(StandardCharsets.UTF_8);
        statistics().clear();

        long start = System.nanoTime();
        StatementImportResponse response = importService.importCsv(new ByteArrayInputStream(csv), 1L);
        entityManager.flush(); // make sure the inserts really reached the database
        long elapsed = millisSince(start);

        System.out.println("PERF NFR-02 import 1000 rows: " + elapsed + " ms, saved="
                + response.getTransactionsSaved() + ", statements prepared="
                + statistics().getPrepareStatementCount());

        assertEquals(1000, response.getRowsParsed());
        assertEquals(1000, response.getTransactionsSaved());
        assertTrue(elapsed < 5000, "NFR-02 requires under 5000 ms but took " + elapsed + " ms");
    }

    @Test
    void importingTheSameThousandRowsAgainIsAlsoFastAndSavesNothing() throws Exception {
        byte[] csv = statementWithRows(1000).getBytes(StandardCharsets.UTF_8);
        importService.importCsv(new ByteArrayInputStream(csv), 1L);
        entityManager.flush();
        statistics().clear();

        long start = System.nanoTime();
        StatementImportResponse again = importService.importCsv(new ByteArrayInputStream(csv), 1L);
        entityManager.flush();
        long elapsed = millisSince(start);

        System.out.println("PERF NFR-02 re-import 1000 duplicate rows: " + elapsed + " ms, statements prepared="
                + statistics().getPrepareStatementCount());

        assertEquals(0, again.getTransactionsSaved());
        assertEquals(1000, again.getDuplicatesSkipped());
        assertTrue(elapsed < 5000, "took " + elapsed + " ms");
    }

    @Test
    void reportsForAUserWithFiveThousandTransactionsFinishInUnderTwoAndAHalfSeconds() {
        List<Transaction> rows = new ArrayList<>();
        LocalDate start = LocalDate.of(2025, 1, 1);
        for (int i = 0; i < 5000; i++) {
            boolean income = i % 10 == 0;
            rows.add(new Transaction(start.plusDays(i % 700), "SEED " + i,
                    new BigDecimal(10 + i % 900), income ? TransactionType.INCOME : TransactionType.EXPENSE,
                    income ? TransactionCategory.INCOME : TransactionCategory.GROCERIES, 1L));
        }
        repository.saveAll(rows);
        entityManager.flush();
        entityManager.clear();
        assertEquals(5000, repository.findByUserId(1L).size());
        entityManager.clear();

        // The first call includes one-time warm up (query plans, class loading),
        // so it is the honest worst case. We time it, then a second call.
        statistics().clear();
        long firstStart = System.nanoTime();
        dashboardService.getMonthlyReport(1L, 2026, 3);
        long first = millisSince(firstStart);
        long firstStatements = statistics().getPrepareStatementCount();

        long secondStart = System.nanoTime();
        dashboardService.getMonthlyReport(1L, 2026, 3);
        long second = millisSince(secondStart);

        long rangeStart = System.nanoTime();
        dashboardService.getReportForRange(1L, LocalDate.of(2025, 1, 1), LocalDate.of(2026, 12, 31));
        long range = millisSince(rangeStart);

        long trendsStart = System.nanoTime();
        dashboardService.getTrends(1L, 2026, 6, 24);
        long trends = millisSince(trendsStart);

        System.out.println("PERF NFR-01 month report, 5000 rows: first call " + first + " ms, second call "
                + second + " ms, statements for one report=" + firstStatements);
        System.out.println("PERF NFR-01 custom range report over all 5000 rows: " + range + " ms");
        System.out.println("PERF NFR-01 24 month trends: " + trends + " ms");

        assertTrue(first < 2500, "NFR-01 requires under 2500 ms but first call took " + first + " ms");
        assertTrue(range < 2500, "range report took " + range + " ms");
        assertTrue(trends < 2500, "trends took " + trends + " ms");
    }
}

package com.kyf.knowyourfinance.repository;

import com.kyf.knowyourfinance.model.Transaction;
import com.kyf.knowyourfinance.model.TransactionCategory;
import com.kyf.knowyourfinance.model.TransactionType;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Runs the repository against a real PostgreSQL started in Docker.
 *
 * Every other test in this project mocks the repository, which proves
 * the services are wired correctly but says nothing about whether the
 * queries are valid SQL. This class closes that gap (it was gap number
 * three in the Milestone 3 test report). If Docker is not installed the
 * class is skipped instead of failing, so a teammate without Docker can
 * still run `mvn verify`.
 *
 * The name ends in Test so Maven runs it with the other tests.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers(disabledWithoutDocker = true)
class TransactionRepositoryIntegrationTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    // Points Spring at the throwaway database instead of Supabase, so a
    // test run can never touch real data.
    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "create-drop");
    }

    @Autowired
    private TransactionRepository repository;

    private Transaction tx(String date, String description, String amount,
                           TransactionType type, TransactionCategory category, long userId) {
        return new Transaction(LocalDate.parse(date), description, new BigDecimal(amount),
                type, category, userId);
    }

    @Test
    void savedTransactionsComeBackWithTheirAmountsIntact() {
        repository.save(tx("2026-09-02", "STARBUCKS", "5.75",
                TransactionType.EXPENSE, TransactionCategory.DINING, 1L));

        List<Transaction> found = repository.findByUserId(1L);

        assertEquals(1, found.size());
        assertEquals(0, new BigDecimal("5.75").compareTo(found.get(0).getAmount()));
    }

    @Test
    void dateRangeQueryIncludesBothEndsAndNothingOutside() {
        repository.save(tx("2026-08-31", "TOO EARLY", "1.00", TransactionType.EXPENSE, TransactionCategory.OTHER, 1L));
        repository.save(tx("2026-09-01", "FIRST DAY", "1.00", TransactionType.EXPENSE, TransactionCategory.OTHER, 1L));
        repository.save(tx("2026-09-30", "LAST DAY", "1.00", TransactionType.EXPENSE, TransactionCategory.OTHER, 1L));
        repository.save(tx("2026-10-01", "TOO LATE", "1.00", TransactionType.EXPENSE, TransactionCategory.OTHER, 1L));

        List<Transaction> found = repository.findByUserIdAndDateBetween(
                1L, LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 30));

        assertEquals(2, found.size());
    }

    @Test
    void oneUsersTransactionsAreNeverReturnedForAnotherUser() {
        repository.save(tx("2026-09-02", "MINE", "10.00", TransactionType.EXPENSE, TransactionCategory.OTHER, 1L));
        repository.save(tx("2026-09-02", "THEIRS", "99.00", TransactionType.EXPENSE, TransactionCategory.OTHER, 2L));

        assertEquals(1, repository.findByUserId(1L).size());
        assertEquals(0, repository.sumAmountByUserAndTypeAndDateRange(
                3L, TransactionType.EXPENSE, LocalDate.of(2026, 1, 1), LocalDate.of(2026, 12, 31)).signum());
    }

    @Test
    void sumQuerySeparatesIncomeFromExpenses() {
        repository.save(tx("2026-09-01", "PAY", "2000.00", TransactionType.INCOME, TransactionCategory.INCOME, 1L));
        repository.save(tx("2026-09-02", "RENT", "800.00", TransactionType.EXPENSE, TransactionCategory.RENT_MORTGAGE, 1L));
        repository.save(tx("2026-09-03", "FOOD", "50.25", TransactionType.EXPENSE, TransactionCategory.GROCERIES, 1L));

        LocalDate start = LocalDate.of(2026, 9, 1);
        LocalDate end = LocalDate.of(2026, 9, 30);

        assertEquals(0, new BigDecimal("2000.00").compareTo(
                repository.sumAmountByUserAndTypeAndDateRange(1L, TransactionType.INCOME, start, end)));
        assertEquals(0, new BigDecimal("850.25").compareTo(
                repository.sumAmountByUserAndTypeAndDateRange(1L, TransactionType.EXPENSE, start, end)));
    }

    @Test
    void categoryBreakdownCountsExpensesOnly() {
        repository.save(tx("2026-09-01", "PAY", "2000.00", TransactionType.INCOME, TransactionCategory.INCOME, 1L));
        repository.save(tx("2026-09-02", "A", "10.00", TransactionType.EXPENSE, TransactionCategory.GROCERIES, 1L));
        repository.save(tx("2026-09-03", "B", "15.00", TransactionType.EXPENSE, TransactionCategory.GROCERIES, 1L));

        var rows = repository.sumExpensesByCategory(1L, LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 30));

        assertEquals(1, rows.size());
        assertEquals(TransactionCategory.GROCERIES, rows.get(0).getCategory());
        assertEquals(0, new BigDecimal("25.00").compareTo(rows.get(0).getTotal()));
    }

    @Test
    void monthlyTrendQueryGroupsByMonthAndType() {
        repository.save(tx("2026-08-15", "PAY", "1000.00", TransactionType.INCOME, TransactionCategory.INCOME, 1L));
        repository.save(tx("2026-08-20", "FOOD", "40.00", TransactionType.EXPENSE, TransactionCategory.GROCERIES, 1L));
        repository.save(tx("2026-08-21", "FOOD", "10.00", TransactionType.EXPENSE, TransactionCategory.GROCERIES, 1L));
        repository.save(tx("2026-09-05", "FOOD", "7.00", TransactionType.EXPENSE, TransactionCategory.GROCERIES, 1L));
        repository.save(tx("2026-09-06", "OTHER USER", "500.00", TransactionType.EXPENSE, TransactionCategory.OTHER, 2L));

        var rows = repository.sumByMonthAndType(1L, LocalDate.of(2026, 8, 1), LocalDate.of(2026, 9, 30));

        assertEquals(3, rows.size());
        BigDecimal augustExpenses = rows.stream()
                .filter(r -> r.getYear() == 2026 && r.getMonth() == 8 && "EXPENSE".equals(r.getType()))
                .map(TransactionRepository.MonthlyTypeTotal::getTotal)
                .findFirst().orElseThrow();
        assertEquals(0, new BigDecimal("50.00").compareTo(augustExpenses));
        assertTrue(rows.stream().anyMatch(r -> r.getMonth() == 9 && "EXPENSE".equals(r.getType())));
    }
}

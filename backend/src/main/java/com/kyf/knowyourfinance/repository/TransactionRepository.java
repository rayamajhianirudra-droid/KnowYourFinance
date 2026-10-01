package com.kyf.knowyourfinance.repository;

import com.kyf.knowyourfinance.model.Transaction;
import com.kyf.knowyourfinance.model.TransactionType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * This interface is where Spring Data JPA does something that feels like
 * magic the first time you see it: we write ZERO implementation code here.
 * No SQL, no method body. We just declare what we want, following a naming
 * pattern Spring understands, and Spring Data JPA writes the actual SQL
 * query for us at startup.
 *
 * `extends JpaRepository<Transaction, Long>` already hands us the basics
 * for free: save(), findById(), findAll(), deleteById(), count() - a full
 * create/read/update/delete toolkit for the Transaction table, with no code
 * written by us at all.
 *
 * Everything below this line is a CUSTOM query - one Spring couldn't have
 * guessed, so we spell it out either through method-name conventions
 * ("derived queries") or, when the logic gets specific enough that a plain
 * name would get unreadable, an explicit @Query (JPQL - like SQL, but it
 * talks about Java objects/fields instead of raw table/column names).
 */
public interface TransactionRepository extends JpaRepository<Transaction, Long> {

    /**
     * Derived query: Spring Data JPA reads the method name itself -
     * "findBy" + "UserId" + "And" + "DateBetween" - and translates that
     * directly into a WHERE clause:
     *   WHERE user_id = ?1 AND date BETWEEN ?2 AND ?3
     * This is the single most important query in the whole app: it's the
     * one behind "show me my transactions for [chosen month/year range]" -
     * the custom reporting feature that's KYF's main differentiator.
     */
    List<Transaction> findByUserIdAndDateBetween(Long userId, LocalDate start, LocalDate end);

    /**
     * Same idea, but also filtering by INCOME vs EXPENSE. Useful for
     * "total income this month" vs "total expenses this month" separately,
     * rather than fetching everything and splitting it apart in Java.
     */
    List<Transaction> findByUserIdAndTypeAndDateBetween(
            Long userId, TransactionType type, LocalDate start, LocalDate end);

    /**
     * This one goes further than a derived query can: we don't want the
     * individual rows, we want the DATABASE to add up the amount column
     * for us and hand back a single number. Doing SUM() in SQL instead of
     * fetching every row and adding them in Java is both faster (the
     * database engine is built for this) and avoids pulling potentially
     * thousands of rows across the network just to add them up.
     *
     * COALESCE(SUM(...), 0) means: if there are no matching rows at all,
     * return 0 instead of NULL - so callers never have to null-check a
     * "total spent" number.
     */
    @Query("SELECT COALESCE(SUM(t.amount), 0) FROM Transaction t " +
            "WHERE t.userId = :userId AND t.type = :type " +
            "AND t.date BETWEEN :start AND :end")
    BigDecimal sumAmountByUserAndTypeAndDateRange(
            @Param("userId") Long userId,
            @Param("type") TransactionType type,
            @Param("start") LocalDate start,
            @Param("end") LocalDate end);

    /**
     * Powers the "spending by category" pie/bar chart on the dashboard.
     * GROUP BY t.category collapses every matching row into one row per
     * category, with SUM(t.amount) adding up all the amounts that landed
     * in that category.
     *
     * The return type - CategoryTotal, declared right below - is a
     * "projection": instead of Hibernate building full Transaction
     * objects (wasteful here, since we only want two values per group),
     * it builds lightweight objects that just carry the category and its
     * total. Spring Data matches the SELECT's two expressions to
     * CategoryTotal's two method names automatically.
     */
    @Query("SELECT t.category AS category, COALESCE(SUM(t.amount), 0) AS total " +
            "FROM Transaction t " +
            "WHERE t.userId = :userId AND t.type = com.kyf.knowyourfinance.model.TransactionType.EXPENSE " +
            "AND t.date BETWEEN :start AND :end " +
            "GROUP BY t.category")
    List<CategoryTotal> sumExpensesByCategory(
            @Param("userId") Long userId,
            @Param("start") LocalDate start,
            @Param("end") LocalDate end);

    /**
     * The projection interface mentioned above. Spring Data JPA generates
     * an implementation of this behind the scenes - we only declare the
     * shape we want back.
     */
    interface CategoryTotal {
        com.kyf.knowyourfinance.model.TransactionCategory getCategory();
        BigDecimal getTotal();
    }
}

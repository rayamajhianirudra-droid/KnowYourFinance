package com.kyf.knowyourfinance.controller;

import com.kyf.knowyourfinance.dto.MonthlyReportResponse;
import com.kyf.knowyourfinance.dto.MonthlySummary;
import com.kyf.knowyourfinance.service.DashboardService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * The dashboard-facing endpoints. This controller is intentionally thin -
 * it does no math itself. Its only job is: read the HTTP request, call
 * the service that actually knows how to build a report, and hand back
 * whatever it returns as JSON. Keeping controllers this "dumb" is a
 * pattern worth noticing early: it means the report-building logic in
 * DashboardService can be tested, reused, or changed without touching
 * any HTTP-specific code.
 */
@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    private final DashboardService dashboardService;

    public DashboardController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    /**
     * GET /api/dashboard/report?userId=1&year=2026&month=9
     *
     * This single endpoint IS the feature we've been building the whole
     * app's data layer toward: the user picks a month and year, and gets
     * back exactly what they made, what they spent, the difference, and
     * where the spending went by category.
     */
    @GetMapping("/report")
    public MonthlyReportResponse monthlyReport(
            @RequestParam Long userId,
            @RequestParam int year,
            @RequestParam int month) {
        return dashboardService.getMonthlyReport(userId, year, month);
    }

    /**
     * GET /api/dashboard/trends?userId=1&year=2026&month=10&monthsBack=6
     *
     * Returns one summary per month for a trailing window of months
     * (defaulting to the last 6), ending at the given year/month -
     * powers the "spending trends over time" chart, which shows several
     * months side by side instead of one at a time.
     */
    @GetMapping("/trends")
    public List<MonthlySummary> trends(
            @RequestParam Long userId,
            @RequestParam int year,
            @RequestParam int month,
            @RequestParam(defaultValue = "6") int monthsBack) {
        return dashboardService.getTrends(userId, year, month, monthsBack);
    }
}

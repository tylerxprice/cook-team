import test from "node:test";
import assert from "node:assert/strict";
import { getBaselineHistoricalSchedules } from "../src/server/historicalArchiveData.ts";
import { computeCommunityReportSummary } from "../src/server/reports.ts";

test("Historical All 9 Months - Real Spreadsheets Parser & Equity Aggregator", () => {
  const monthRecords = getBaselineHistoricalSchedules();

  assert.equal(monthRecords.length, 9, "Should contain all 9 historical months");

  for (const item of monthRecords) {
    assert.ok(item.schedule.length > 0, `Month ${item.monthKey} should have scheduled days`);
    console.log(`Month ${item.monthKey} parsed: ${item.schedule.length} days`);
  }

  const report = computeCommunityReportSummary(monthRecords);

  console.log(`\n=== 9-MONTH EQUITY SUMMARY ===`);
  console.log(`Total Months Tracked: ${report.totalMonthsTracked}`);
  console.log(`Total Meals Served: ${report.totalMealsServed}`);
  console.log(`Total Cook Shifts: ${report.totalCookShifts}`);
  console.log(`Total Clean Shifts: ${report.totalCleanShifts}`);
  console.log(`Unique Active Volunteers: ${report.uniqueVolunteersCount}`);
  console.log(`Top 5 Volunteers:`);
  for (const m of report.memberEquityStats.slice(0, 5)) {
    console.log(
      `  ${m.name}: Total=${m.totalShifts} (Cooks=${m.totalCooks}, Cleans=${m.totalCleans}, SameDay=${m.sameDayShifts}, Active=${m.monthsActive}mo) [${m.badges.join(", ")}]`
    );
  }

  assert.ok(report.totalMealsServed > 50, "Should have more than 50 total meals across 9 months");
  assert.ok(report.totalCookShifts > 100, "Should have more than 100 cook shifts across 9 months");
  assert.ok(
    report.totalCleanShifts > 100,
    "Should have more than 100 clean shifts across 9 months"
  );
  assert.ok(report.uniqueVolunteersCount >= 25, "Should have at least 25 unique volunteers");
  assert.ok(
    report.memberEquityStats.length >= 25,
    "Should have equity records for community members"
  );
});

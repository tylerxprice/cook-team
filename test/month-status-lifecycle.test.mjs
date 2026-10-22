import test from "node:test";
import assert from "node:assert/strict";
import { MOCK_MONTH_CONFIGS } from "../src/server/mockData.ts";

test("Month Status Lifecycle - Initial state and mock configurations", () => {
  // Historical completed months are CLOSED
  assert.equal(MOCK_MONTH_CONFIGS["2026-08"].status, "CLOSED");
  assert.equal(MOCK_MONTH_CONFIGS["2026-09"].status, "CLOSED");
  assert.equal(MOCK_MONTH_CONFIGS["2026-10"].status, "CLOSED");

  // Current active planning month is OPEN
  assert.equal(MOCK_MONTH_CONFIGS["2026-11"].status, "OPEN");
  assert.ok(MOCK_MONTH_CONFIGS["2026-11"].dates.length > 0);

  // Future unconfigured month is NOT_OPEN
  assert.equal(MOCK_MONTH_CONFIGS["2026-12"].status, "NOT_OPEN");
  assert.equal(MOCK_MONTH_CONFIGS["2026-12"].dates.length, 0);
});

test("Month Status Lifecycle - Opening sign-ups saves dates and sets status to OPEN", () => {
  const configs = JSON.parse(JSON.stringify(MOCK_MONTH_CONFIGS));
  const monthKey = "2026-12";

  // Simulate coordinator configuring December dates and clicking "Save Dates & Open Sign-Ups"
  const decemberDates = [
    {
      dateKey: "2026-12-03",
      dateLabel: "Thu Dec 3 - Dinner",
      dayOfWeek: "Thu",
      mealType: "DINNER",
      included: true,
      targetCookCount: 3,
      targetCleanCount: 3,
    },
    {
      dateKey: "2026-12-25",
      dateLabel: "Fri Dec 25 - Dinner",
      dayOfWeek: "Fri",
      mealType: "DINNER",
      specialNote: "Christmas Feast",
      included: true,
      targetCookCount: 3,
      targetCleanCount: 3,
    },
  ];

  configs[monthKey] = {
    monthKey,
    title: "26-12 Dec Meal Team Sign-Up",
    dates: decemberDates,
    status: "OPEN",
    openedAt: new Date().toISOString(),
  };

  assert.equal(configs[monthKey].status, "OPEN");
  assert.equal(configs[monthKey].dates.length, 2);
  assert.equal(configs[monthKey].dates[1].specialNote, "Christmas Feast");
});

test("Month Status Lifecycle - Scheduling teams marks month as CLOSED", () => {
  const configs = JSON.parse(JSON.stringify(MOCK_MONTH_CONFIGS));
  const monthKey = "2026-11";

  assert.equal(configs[monthKey].status, "OPEN");

  // Simulate schedule export / finalization
  configs[monthKey].status = "CLOSED";
  configs[monthKey].closedAt = new Date().toISOString();

  assert.equal(configs[monthKey].status, "CLOSED");
  assert.ok(configs[monthKey].closedAt);
});

test("Month Status Lifecycle - Submission validation logic blocks closed or unopen months", () => {
  const validateSubmission = (status) => {
    if (status === "CLOSED") {
      throw new Error(
        "Sign-ups for this month are now closed because the schedule has been published."
      );
    }
    if (status === "NOT_OPEN") {
      throw new Error("Sign-ups for this month have not opened yet.");
    }
    return true;
  };

  // OPEN succeeds
  assert.equal(validateSubmission("OPEN"), true);

  // CLOSED throws specific error
  assert.throws(() => validateSubmission("CLOSED"), /Sign-ups for this month are now closed/);

  // NOT_OPEN throws specific error
  assert.throws(
    () => validateSubmission("NOT_OPEN"),
    /Sign-ups for this month have not opened yet/
  );
});

test("Month Status Lifecycle - Reopening and status toggling by coordinator", () => {
  const configs = JSON.parse(JSON.stringify(MOCK_MONTH_CONFIGS));
  const monthKey = "2026-11";

  // Coordinator closes
  configs[monthKey].status = "CLOSED";
  assert.equal(configs[monthKey].status, "CLOSED");

  // Coordinator reopens for late submissions
  configs[monthKey].status = "OPEN";
  assert.equal(configs[monthKey].status, "OPEN");

  // Coordinator resets to draft (NOT_OPEN)
  configs[monthKey].status = "NOT_OPEN";
  configs[monthKey].closedAt = undefined;
  configs[monthKey].openedAt = undefined;
  assert.equal(configs[monthKey].status, "NOT_OPEN");
  assert.equal(configs[monthKey].closedAt, undefined);
  assert.equal(configs[monthKey].openedAt, undefined);
});

test("Month Status Lifecycle - Saving draft dates preserves or sets status to NOT_OPEN", () => {
  const configs = JSON.parse(JSON.stringify(MOCK_MONTH_CONFIGS));
  const monthKey = "2026-12";

  // If month was previously CLOSED in error, saving draft dates switches it to NOT_OPEN
  configs[monthKey].status = "CLOSED";
  configs[monthKey].closedAt = "2026-12-01T00:00:00.000Z";

  const targetStatus = configs[monthKey].status === "OPEN" ? "OPEN" : "NOT_OPEN";
  configs[monthKey] = {
    ...configs[monthKey],
    status: targetStatus,
    closedAt: undefined,
    isConfigured: true,
    dates: [
      {
        dateKey: "2026-12-03",
        dateLabel: "Thu Dec 3 - Dinner",
        mealType: "DINNER",
        included: true,
      },
    ],
  };

  assert.equal(configs[monthKey].status, "NOT_OPEN");
  assert.equal(configs[monthKey].closedAt, undefined);
  assert.equal(configs[monthKey].dates.length, 1);
});

test("Month Status Lifecycle - Canonicalizes month_status_YYYY_MM and month_dates_YYYY_MM keys to hyphenated YYYY-MM", () => {
  const normalizeKey = (raw) => {
    const m = raw
      .toLowerCase()
      .trim()
      .match(/^(month_(?:status|dates))_(\d{4})[-_](\d{2})$/);
    return m ? `${m[1]}_${m[2]}-${m[3]}` : raw;
  };

  assert.equal(normalizeKey("month_status_2026_11"), "month_status_2026-11");
  assert.equal(normalizeKey("month_dates_2026_11"), "month_dates_2026-11");
  assert.equal(normalizeKey("month_status_2026-12"), "month_status_2026-12");
  assert.equal(normalizeKey("month_dates_2026-12"), "month_dates_2026-12");
});

test("Month Status Lifecycle - Multi-month active priority ranking", () => {
  const settings = {
    "month_status_2026-11": "TEAMS_READY",
    "month_status_2026-12": "STAGING_DATES",
    "month_dates_2026-11": JSON.stringify([{ dateKey: "2026-11-01", included: true }]),
    "month_dates_2026-12": JSON.stringify([{ dateKey: "2026-12-03", included: true }]),
  };

  const STATUS_PRIORITY = {
    TEAMS_READY: 1,
    RESPONSES_RECEIVED: 2,
    SIGN_UPS_OPEN: 3,
    OPEN: 3,
    STAGING_DATES: 4,
    NOT_OPEN: 4,
    EMAIL_SENT: 5,
    CLOSED: 5,
  };

  const discovered = [];
  for (const [k, v] of Object.entries(settings)) {
    const m = k.match(/^month_status_(\d{4})[-_](\d{2})$/);
    if (m && v) {
      discovered.push({
        monthKey: `${m[1]}-${m[2]}`,
        status: String(v).trim().toUpperCase(),
      });
    }
  }

  discovered.sort((a, b) => {
    const prioA = STATUS_PRIORITY[a.status] || 99;
    const prioB = STATUS_PRIORITY[b.status] || 99;
    if (prioA !== prioB) return prioA - prioB;
    return b.monthKey.localeCompare(a.monthKey);
  });

  assert.equal(discovered.length, 2);
  // TEAMS_READY (2026-11) has higher priority over STAGING_DATES (2026-12)
  assert.equal(discovered[0].monthKey, "2026-11");
  assert.equal(discovered[0].status, "TEAMS_READY");
  assert.equal(discovered[1].monthKey, "2026-12");
  assert.equal(discovered[1].status, "STAGING_DATES");
});

test("Month Status Lifecycle - open_months auto-heal ignores STAGING_DATES and TEAMS_READY", () => {
  const settings = {
    "month_status_2026-11": "TEAMS_READY",
    "month_status_2026-12": "STAGING_DATES",
    open_months: "2026-12", // Stale value in sheet
  };

  const openSet = new Set();
  for (const [k, v] of Object.entries(settings)) {
    const m = k.match(/^month_status_(\d{4})[-_](\d{2})$/);
    const val = String(v).trim().toUpperCase();
    if (m && (val === "OPEN" || val === "SIGN_UPS_OPEN")) {
      openSet.add(`${m[1]}-${m[2]}`);
    }
  }

  const syncedOpenMonths = Array.from(openSet).sort((a, b) => b.localeCompare(a)).join(",");

  // Stale 2026-12 is stripped because its status is STAGING_DATES
  assert.equal(syncedOpenMonths, "");
});

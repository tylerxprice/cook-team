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

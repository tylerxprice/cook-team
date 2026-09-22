import test from "node:test";
import assert from "node:assert/strict";
import { parseSurveySheetData, normalizeAvailability } from "../src/server/parser.ts";

test("Manual Survey Response - Parse simulated appended response in sheet grid", () => {
  const masterMembers = [
    { name: "Brenda", google_email: "brenda@example.com", active: true },
    { name: "Tyler", google_email: "tyler@example.com", active: true },
    { name: "Robin Banks", google_email: "robin@example.com", active: true },
  ];

  // Survey grid with header and standard columns
  const grid = [
    [
      "Timestamp",
      "Email Address",
      "What is your name?",
      "Cook Team Size Preference",
      "Can you cook and clean on the same day?",
      "How many meals can you cook this month?",
      "How many meals can you clean this month?",
      "Select your available dates [Oct 1 (Thur)]",
      "Select your available dates [Oct 4 (Sun, Brunch)]",
      "Special instructions / dietary preferences / notes",
    ],
    // Existing response
    [
      "9/20/2026 12:00:00",
      "brenda@example.com",
      "Brenda",
      "Dinner = 3, Brunch = 2",
      "No",
      "1",
      "1",
      "Available",
      "Available",
      "None",
    ],
    // Manually entered response by coordinator on behalf of Robin
    [
      "9/22/2026 14:30:00",
      "robin@example.com",
      "Robin Banks",
      "2 for either",
      "Prefer same day",
      "2",
      "1",
      "Cook only",
      "Clean only",
      "Vegetarian cook only on Thursdays",
    ],
  ];

  const parsed = parseSurveySheetData(grid, masterMembers, "2026-10 Cook Team Survey");

  assert.equal(parsed.responses.length, 2);
  assert.equal(parsed.mealDates.length, 2);

  const robinResp = parsed.responses.find((r) => r.name === "Robin Banks");
  assert.ok(robinResp);
  assert.equal(robinResp.email, "robin@example.com");
  assert.equal(robinResp.cookQuota, 2);
  assert.equal(robinResp.cleanQuota, 1);
  assert.equal(robinResp.cookTeamSizePref, "2 for either");
  assert.equal(robinResp.canCookCleanSameDay, true);
  assert.equal(robinResp.sameDayPref, "PREFERRED");
  assert.equal(robinResp.availability["Oct 1 (Thur)"], "COOK_ONLY");
  assert.equal(robinResp.availability["Oct 4 (Sun, Brunch)"], "CLEAN_ONLY");
  assert.equal(robinResp.specialInstructions, "Vegetarian cook only on Thursdays");

  // Verify completeness audit
  assert.equal(parsed.audit.respondentCount, 2);
  assert.equal(parsed.audit.missingMembers.length, 1);
  assert.equal(parsed.audit.missingMembers[0].name, "Tyler");
});

test("Manual Survey Response - Parse Maximum Total Shifts column", () => {
  const masterMembers = [
    { name: "Alice", google_email: "alice@example.com", active: true },
    { name: "Bob", google_email: "bob@example.com", active: true },
  ];

  const grid = [
    [
      "Timestamp",
      "Email Address",
      "Name",
      "Cook Team Size",
      "Same Day",
      "How many meals can you cook this month?",
      "How many meals can you clean this month?",
      "Maximum total shifts (cooking + cleaning combined) this month",
      "Select your available dates [Oct 1 (Thur)]",
      "Notes",
    ],
    [
      "9/20/2026 12:00:00",
      "alice@example.com",
      "Alice",
      "Dinner = 3, Brunch = 2",
      "No",
      "3",
      "3",
      "3",
      "Available",
      "",
    ],
    [
      "9/20/2026 12:05:00",
      "bob@example.com",
      "Bob",
      "Dinner = 3, Brunch = 2",
      "No",
      "2",
      "1",
      "No set limit (sum of cooks and cleans above)",
      "Available",
      "",
    ],
  ];

  const parsed = parseSurveySheetData(grid, masterMembers, "2026-10 Cook Team Survey");
  const alice = parsed.responses.find((r) => r.name === "Alice");
  assert.ok(alice);
  assert.equal(alice.cookQuota, 3);
  assert.equal(alice.cleanQuota, 3);
  assert.equal(alice.maxTotalShifts, 3); // parsed from column

  const bob = parsed.responses.find((r) => r.name === "Bob");
  assert.ok(bob);
  assert.equal(bob.cookQuota, 2);
  assert.equal(bob.cleanQuota, 1);
  assert.equal(bob.maxTotalShifts, 3); // parsed from 'No set limit' -> cookQuota + cleanQuota (2+1=3)
});

test("Matchmaker Solver - Enforces maxTotalShifts combined cap", async () => {
  const { solveCookAndCleanSchedule } = await import("../src/server/matchmaker.ts");

  const mealDates = [
    {
      id: "MEAL-1",
      dateKey: "2026-10-01",
      dateLabel: "Oct 1 (Thur)",
      dayOfWeek: "Thursday",
      mealType: "DINNER",
      targetCookCount: 3,
      targetCleanCount: 3,
    },
    {
      id: "MEAL-2",
      dateKey: "2026-10-04",
      dateLabel: "Oct 4 (Sun, Brunch)",
      dayOfWeek: "Sunday",
      mealType: "BRUNCH",
      targetCookCount: 2,
      targetCleanCount: 2,
    },
    {
      id: "MEAL-3",
      dateKey: "2026-10-05",
      dateLabel: "Oct 5 (Mon)",
      dayOfWeek: "Monday",
      mealType: "DINNER",
      targetCookCount: 3,
      targetCleanCount: 3,
    },
    {
      id: "MEAL-4",
      dateKey: "2026-10-08",
      dateLabel: "Oct 8 (Thur)",
      dayOfWeek: "Thursday",
      mealType: "DINNER",
      targetCookCount: 3,
      targetCleanCount: 3,
    },
  ];

  // Alice is available on all 4 dates, cookQuota=3, cleanQuota=3, BUT maxTotalShifts=3
  const responses = [
    {
      timestamp: "2026-09-20",
      email: "alice@example.com",
      name: "Alice",
      cookTeamSizePref: "Dinner = 3, Brunch = 2",
      canCookCleanSameDay: false,
      cookQuota: 3,
      cleanQuota: 3,
      maxTotalShifts: 3,
      specialInstructions: "",
      availability: {
        "Oct 1 (Thur)": "AVAILABLE",
        "Oct 4 (Sun, Brunch)": "AVAILABLE",
        "Oct 5 (Mon)": "AVAILABLE",
        "Oct 8 (Thur)": "AVAILABLE",
      },
    },
  ];

  const result = solveCookAndCleanSchedule(mealDates, responses, [], {
    cookPolicy: "ADAPTIVE_3_OR_2",
    autoCancelDeficitDates: false,
  });

  const aliceStat = result.memberStats["Alice"];
  assert.ok(aliceStat);
  assert.ok(
    aliceStat.totalAssigned <= 3,
    `Alice was assigned ${aliceStat.totalAssigned} shifts, which exceeds maxTotalShifts=3!`
  );
  assert.equal(aliceStat.requestedMaxTotalShifts, 3);
});

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

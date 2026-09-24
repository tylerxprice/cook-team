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

test("Matchmaker Solver - Survey sameDay answer is authoritative over static PREF_SAME_DAY rule", async () => {
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
  ];

  // Bob explicitly answered "No" to same-day shifts
  const responses = [
    {
      timestamp: "2026-09-20",
      email: "bob@example.com",
      name: "Bob",
      cookTeamSizePref: "Dinner = 3, Brunch = 2",
      canCookCleanSameDay: false,
      sameDayPref: "NO",
      cookQuota: 1,
      cleanQuota: 1,
      maxTotalShifts: 2,
      specialInstructions: "",
      availability: {
        "Oct 1 (Thur)": "AVAILABLE",
      },
    },
  ];

  // Old legacy exception rule in Master Sheet
  const exceptions = [
    {
      id: "RULE-LEGACY",
      person_a: "Bob",
      rule_type: "PREF_SAME_DAY",
      is_hard_rule: true,
    },
  ];

  const result = solveCookAndCleanSchedule(mealDates, responses, exceptions, {
    cookPolicy: "ADAPTIVE_3_OR_2",
    autoCancelDeficitDates: false,
  });

  const day1 = result.schedule[0];
  // Bob should NOT be assigned to BOTH cook and clean on the same day because he answered "NO"
  const isCooking = day1.cooks.includes("Bob");
  const isCleaning = day1.cleaners.includes("Bob");
  assert.ok(
    !(isCooking && isCleaning),
    "Bob was assigned to BOTH cook and clean on Oct 1 despite answering 'NO' in survey!"
  );
});

test("Matchmaker Solver - Fair Share Round-Robin: Gives each volunteer 1 shift before giving 2nd/3rd to higher-quota volunteers", async () => {
  const { solveCookAndCleanSchedule } = await import("../src/server/matchmaker.ts");

  // 2 meals, each needing 1 cook (simulated via 2 meals with limited slots)
  const mealDates = [
    {
      id: "MEAL-1",
      dateKey: "2026-10-01",
      dateLabel: "Oct 1 (Thur)",
      dayOfWeek: "Thursday",
      mealType: "BRUNCH",
      targetCookCount: 2,
      targetCleanCount: 0,
    },
    {
      id: "MEAL-2",
      dateKey: "2026-10-04",
      dateLabel: "Oct 4 (Sun, Brunch)",
      dayOfWeek: "Sunday",
      mealType: "BRUNCH",
      targetCookCount: 2,
      targetCleanCount: 0,
    },
  ];

  // Person A wants 3 cooks, Person B wants 1 cook, Person C wants 1 cook, Person D wants 1 cook
  // 4 slots total across 2 brunch meals (2 cooks per meal)
  // If Person A were greedily assigned all 3 shifts, one of B, C, or D would be left with 0 shifts.
  // With Fair Share Round-Robin: A gets 1, B gets 1, C gets 1, D gets 1 (everyone gets their 1st shift).
  const responses = [
    {
      timestamp: "2026-09-20",
      email: "a@example.com",
      name: "Person A",
      cookTeamSizePref: "2 for either",
      canCookCleanSameDay: false,
      cookQuota: 3,
      cleanQuota: 0,
      maxTotalShifts: 3,
      specialInstructions: "",
      availability: {
        "Oct 1 (Thur)": "AVAILABLE",
        "Oct 4 (Sun, Brunch)": "AVAILABLE",
      },
    },
    {
      timestamp: "2026-09-20",
      email: "b@example.com",
      name: "Person B",
      cookTeamSizePref: "2 for either",
      canCookCleanSameDay: false,
      cookQuota: 1,
      cleanQuota: 0,
      maxTotalShifts: 1,
      specialInstructions: "",
      availability: {
        "Oct 1 (Thur)": "AVAILABLE",
        "Oct 4 (Sun, Brunch)": "AVAILABLE",
      },
    },
    {
      timestamp: "2026-09-20",
      email: "c@example.com",
      name: "Person C",
      cookTeamSizePref: "2 for either",
      canCookCleanSameDay: false,
      cookQuota: 1,
      cleanQuota: 0,
      maxTotalShifts: 1,
      specialInstructions: "",
      availability: {
        "Oct 1 (Thur)": "AVAILABLE",
        "Oct 4 (Sun, Brunch)": "AVAILABLE",
      },
    },
    {
      timestamp: "2026-09-20",
      email: "d@example.com",
      name: "Person D",
      cookTeamSizePref: "2 for either",
      canCookCleanSameDay: false,
      cookQuota: 1,
      cleanQuota: 0,
      maxTotalShifts: 1,
      specialInstructions: "",
      availability: {
        "Oct 1 (Thur)": "AVAILABLE",
        "Oct 4 (Sun, Brunch)": "AVAILABLE",
      },
    },
  ];

  const result = solveCookAndCleanSchedule(mealDates, responses, [], {
    cookPolicy: "DINNER_3_BRUNCH_2",
    autoCancelDeficitDates: false,
  });

  // Verify that Person B, C, and D each received their 1 requested shift (100% fair share satisfaction)
  const statA = result.memberStats["Person A"];
  const statB = result.memberStats["Person B"];
  const statC = result.memberStats["Person C"];
  const statD = result.memberStats["Person D"];

  assert.equal(statB.assignedCooks, 1, "Person B should get 1 cook shift");
  assert.equal(statC.assignedCooks, 1, "Person C should get 1 cook shift");
  assert.equal(statD.assignedCooks, 1, "Person D should get 1 cook shift");
  assert.equal(statA.assignedCooks, 1, "Person A should get 1 shift before getting a 2nd shift");
});

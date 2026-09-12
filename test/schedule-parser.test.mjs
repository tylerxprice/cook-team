import test from "node:test";
import assert from "node:assert/strict";
import {
  formatScheduleDateLabel,
  getMemberAvailabilityForDate,
  isWillingTwoPersonDinner,
  parseDateFromLabelOrKey,
  parseScheduleGridData,
} from "../src/server/scheduleParser.ts";
import { computeCommunityReportSummary } from "../src/server/reports.ts";

test("Schedule Parser - Multi-Column Layout (Cook 1..4, Clean 1..4)", () => {
  const grid = [
    [
      "Date",
      "Meal Type",
      "Cook 1",
      "Cook 2",
      "Cook 3",
      "Cook 4",
      "Clean 1",
      "Clean 2",
      "Clean 3",
      "Clean 4",
      "Notes",
    ],
    [
      "Sep 6 (Sun, Dinner)",
      "DINNER",
      "Alexandra",
      "Christian",
      "Lorne",
      "",
      "Christian",
      "Ian",
      "Tyler",
      "",
      "Handcrafted Team",
    ],
    [
      "Sep 28 (Mon)",
      "DINNER",
      "Alysha",
      "Beth",
      "Daya",
      "Vesanto",
      "Alysha",
      "Vesanto",
      "Wei",
      "Rose",
      "Big Dinner with 4 cooks & 4 cleaners",
    ],
    [
      "Sep 13 (Sun, Brunch)",
      "BRUNCH",
      "Stacey",
      "Tyler",
      "",
      "",
      "Ben",
      "Kitty",
      "",
      "",
      "Brunch Team",
    ],
  ];

  const result = parseScheduleGridData(grid);

  assert.equal(result.success, true);
  assert.equal(result.schedule.length, 3);

  // Day 1: 3 cooks, 3 cleaners
  const day1 = result.schedule[0];
  assert.equal(day1.dateLabel, "Sep 6 (Sun, Dinner)");
  assert.equal(day1.mealType, "DINNER");
  assert.deepEqual(day1.cooks, ["Alexandra", "Christian", "Lorne"]);
  assert.deepEqual(day1.cleaners, ["Christian", "Ian", "Tyler"]);

  // Day 2: 4 cooks, 4 cleaners (Big Dinner)
  const day2 = result.schedule[1];
  assert.equal(day2.dateLabel, "Sep 28 (Mon)");
  assert.equal(day2.mealType, "DINNER");
  assert.deepEqual(day2.cooks, ["Alysha", "Beth", "Daya", "Vesanto"]);
  assert.deepEqual(day2.cleaners, ["Alysha", "Vesanto", "Wei", "Rose"]);

  // Day 3: 2 cooks, 2 cleaners (Brunch)
  const day3 = result.schedule[2];
  assert.equal(day3.dateLabel, "Sep 13 (Sun, Brunch)");
  assert.equal(day3.mealType, "BRUNCH");
  assert.deepEqual(day3.cooks, ["Stacey", "Tyler"]);
  assert.deepEqual(day3.cleaners, ["Ben", "Kitty"]);

  // Member stats quota check
  assert.equal(result.memberStats["Alysha"].assignedCooks, 1);
  assert.equal(result.memberStats["Alysha"].assignedCleans, 1);
  assert.equal(result.memberStats["Vesanto"].assignedCooks, 1);
  assert.equal(result.memberStats["Vesanto"].assignedCleans, 1);
});

test("Schedule Parser - Legacy Comma-Separated Layout (Cook Team, Clean Team)", () => {
  const grid = [
    ["Date", "Meal Type", "Special Note", "Cook Team", "Clean Team", "Status / Notes"],
    ["Oct 1 (Thu)", "DINNER", "", "Brenda, Alex, Michael", "Cyrena, Lisa, Tyler", "✅ Complete"],
    ["Oct 4 (Sun, Brunch)", "BRUNCH", "", "Brenda, Sam", "Alex, Rose", "✅ Complete"],
    [
      "Oct 8 (Thu)",
      "DINNER",
      "",
      "(Need Cooks)",
      "(Need Cleaners)",
      "⚠️ Missing: 3 cook(s) 3 cleaner(s)",
    ],
  ];

  const result = parseScheduleGridData(grid);

  assert.equal(result.success, true);
  assert.equal(result.schedule.length, 3);

  const day1 = result.schedule[0];
  assert.deepEqual(day1.cooks, ["Brenda", "Alex", "Michael"]);
  assert.deepEqual(day1.cleaners, ["Cyrena", "Lisa", "Tyler"]);

  const day2 = result.schedule[1];
  assert.deepEqual(day2.cooks, ["Brenda", "Sam"]);
  assert.deepEqual(day2.cleaners, ["Alex", "Rose"]);

  const day3 = result.schedule[2];
  assert.deepEqual(day3.cooks, []);
  assert.deepEqual(day3.cleaners, []);
});

test("Schedule Parser - Edge Cases (Unordered Columns, Mixed Case, Need Cleaners)", () => {
  const grid = [
    ["COOK 2", "CLEAN 1", "DATE", "COOK 1", "MEAL TYPE", "CLEAN 2", "COOK 3"],
    ["David", "Eve", "Nov 5 (Thu)", "Charlie", "DINNER", "Frank", "Alice"],
  ];

  const result = parseScheduleGridData(grid);

  assert.equal(result.success, true);
  const day = result.schedule[0];
  assert.equal(day.dateLabel, "Nov 5 (Thu)");
  assert.deepEqual(day.cooks, ["David", "Charlie", "Alice"]);
  assert.deepEqual(day.cleaners, ["Eve", "Frank"]);
});

test("Schedule Parser - Computes Real Availability and Quotas from Survey Responses", () => {
  const grid = [
    [
      "Date",
      "Meal Type",
      "Special Note",
      "Cook 1",
      "Cook 2",
      "Cook 3",
      "Clean 1",
      "Clean 2",
      "Clean 3",
      "Status / Notes",
    ],
    [
      "Oct 1 (Thu)",
      "DINNER",
      "",
      "Tyler",
      "Brenda",
      "Michael",
      "Cyrena",
      "Lisa",
      "Sam",
      "✅ Complete",
    ],
    ["Oct 4 (Sun, Brunch)", "BRUNCH", "", "Brenda", "Sam", "", "Alex", "Rose", "", "✅ Complete"],
  ];

  const responses = [
    {
      name: "Tyler",
      cookQuota: 2,
      cleanQuota: 1,
      availability: {
        "Oct 1 (Thu)": "AVAILABLE",
        "Oct 4 (Sun, Brunch)": "AVAILABLE",
        "Oct 8 (Thu)": "AVAILABLE",
        "Oct 11 (Sun, Brunch)": "AVAILABLE",
      },
    },
    {
      name: "Brenda",
      cookQuota: 3,
      cleanQuota: 0,
      availability: {
        "Oct 1 (Thu)": "AVAILABLE",
        "Oct 4 (Sun, Brunch)": "AVAILABLE",
        "Oct 8 (Thu)": "COOK_ONLY",
      },
    },
  ];

  const result = parseScheduleGridData(grid, responses);

  assert.equal(result.memberStats["Tyler"].requestedCookQuota, 2);
  assert.equal(result.memberStats["Tyler"].requestedCleanQuota, 1);
  assert.equal(result.memberStats["Tyler"].availableCookDays, 4);
  assert.equal(result.memberStats["Tyler"].availableCleanDays, 4);
  assert.equal(result.memberStats["Tyler"].assignedCooks, 1);
  assert.equal(result.memberStats["Tyler"].assignedCleans, 0);

  assert.equal(result.memberStats["Brenda"].requestedCookQuota, 3);
  assert.equal(result.memberStats["Brenda"].requestedCleanQuota, 0);
  assert.equal(result.memberStats["Brenda"].availableCookDays, 3);
  assert.equal(result.memberStats["Brenda"].availableCleanDays, 2);
  assert.equal(result.memberStats["Brenda"].assignedCooks, 2);
});

test("Schedule Parser - 2-Person Dinner Team with Willing Cooks", () => {
  const grid = [
    [
      "Date",
      "Meal Type",
      "Special Note",
      "Cook 1",
      "Cook 2",
      "Cook 3",
      "Clean 1",
      "Clean 2",
      "Clean 3",
      "Status / Notes",
    ],
    [
      "Sep 14 (Mon)",
      "DINNER",
      "",
      "Ben",
      "Fabrice",
      "",
      "Darren",
      "Miriam",
      "Nancy",
      "Handcrafted Team",
    ],
  ];

  const responses = [
    {
      name: "Ben",
      cookQuota: 1,
      cleanQuota: 1,
      cookTeamSizePref: "2 for either",
      availability: { "Sep 14 (Mon)": "AVAILABLE" },
    },
    {
      name: "Fabrice",
      cookQuota: 1,
      cleanQuota: 1,
      cookTeamSizePref: "2 for either",
      availability: { "Sep 14 (Mon)": "AVAILABLE" },
    },
  ];

  const result = parseScheduleGridData(grid, responses);

  assert.equal(result.schedule[0].unfilledCooks, 0);
  assert.equal(result.schedule[0].isTwoPersonDinnerWilling, true);
  assert.equal(result.schedule[0].targetCookCount, 2);
});

test("Schedule Parser - NO COMMUNITY MEAL Days with 0 Target Slots", () => {
  const grid = [
    [
      "Date",
      "Meal Type",
      "Special Note",
      "Cook 1",
      "Cook 2",
      "Cook 3",
      "Clean 1",
      "Clean 2",
      "Clean 3",
      "Status / Notes",
    ],
    ["Thur Sept 3", "DINNER", "NO COMMUNITY MEAL", "", "", "", "", "", "", "No Meal"],
    [
      "Sun Sept 6 - Dinner",
      "DINNER",
      "",
      "Alexandra",
      "Christian",
      "Lorne",
      "Christian",
      "Ian",
      "Tyler",
      "Handcrafted Team",
    ],
  ];

  const result = parseScheduleGridData(grid);

  assert.equal(result.success, true);
  assert.equal(result.schedule.length, 2);

  // Day 1: No Community Meal
  const day1 = result.schedule[0];
  assert.equal(day1.dateLabel, "Sep 3 (Thu)");
  assert.equal(day1.specialNote, "NO COMMUNITY MEAL");
  assert.equal(day1.targetCookCount, 0);
  assert.equal(day1.targetCleanCount, 0);
  assert.equal(day1.unfilledCooks, 0);
  assert.equal(day1.unfilledCleaners, 0);
  assert.deepEqual(day1.cooks, []);
  assert.deepEqual(day1.cleaners, []);

  // Day 2: Regular Dinner
  const day2 = result.schedule[1];
  assert.equal(day2.targetCookCount, 3);
  assert.equal(day2.targetCleanCount, 3);
  assert.equal(day2.unfilledCooks, 0);
  assert.equal(day2.unfilledCleaners, 0);
});

test("Schedule Parser - Robust Date Matching (getMemberAvailabilityForDate)", () => {
  const resp = {
    name: "Fabrice",
    cookQuota: 1,
    cleanQuota: 1,
    availability: {
      "Sep 3 (Thu)": "UNAVAILABLE",
      "Sep 6 (Sun, Dinner)": "AVAILABLE",
      "Sep 10 (Thu)": "AVAILABLE",
      "Sep 14 (Mon)": "AVAILABLE",
      "Sep 17 (Thu)": "COOK_ONLY",
      "Sep 20 (Sun, Brunch)": "CLEAN_ONLY",
    },
  };

  // Test various schedule date label formats against survey headers
  assert.equal(getMemberAvailabilityForDate(resp, "Thu Sept 10"), "AVAILABLE");
  assert.equal(getMemberAvailabilityForDate(resp, "Sept 10 (Thu)"), "AVAILABLE");
  assert.equal(getMemberAvailabilityForDate(resp, "Thur, Sept 10"), "AVAILABLE");
  assert.equal(getMemberAvailabilityForDate(resp, "Thursday, September 10"), "AVAILABLE");
  assert.equal(getMemberAvailabilityForDate(resp, "2026-09-10"), "AVAILABLE");
  assert.equal(getMemberAvailabilityForDate(resp, "9/10/2026"), "AVAILABLE");

  assert.equal(getMemberAvailabilityForDate(resp, "Thu Sept 3"), "UNAVAILABLE");
  assert.equal(getMemberAvailabilityForDate(resp, "Thu Sept 17"), "COOK_ONLY");
  assert.equal(getMemberAvailabilityForDate(resp, "Sun Sept 20 - Brunch"), "CLEAN_ONLY");
  assert.equal(getMemberAvailabilityForDate(resp, "Oct 1 (Thu)"), "UNAVAILABLE");
});

import { solveCookAndCleanSchedule } from "../src/server/matchmaker.ts";

test("Matchmaker Solver - Ignores Cancelled Dates with 0 Target Slots", () => {
  const mealDates = [
    {
      id: "MEAL-1",
      dateKey: "2026-10-01",
      dateLabel: "Oct 1 (Thu)",
      dayOfWeek: "Thursday",
      mealType: "DINNER",
      targetCookCount: 0,
      targetCleanCount: 0,
      specialNote: "NO COMMUNITY MEAL",
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
  ];

  const responses = [
    {
      name: "Alice",
      cookQuota: 1,
      cleanQuota: 1,
      availability: { "Oct 1 (Thu)": "AVAILABLE", "Oct 4 (Sun, Brunch)": "AVAILABLE" },
    },
    {
      name: "Bob",
      cookQuota: 1,
      cleanQuota: 1,
      availability: { "Oct 1 (Thu)": "AVAILABLE", "Oct 4 (Sun, Brunch)": "AVAILABLE" },
    },
    {
      name: "Charlie",
      cookQuota: 1,
      cleanQuota: 1,
      availability: { "Oct 1 (Thu)": "AVAILABLE", "Oct 4 (Sun, Brunch)": "AVAILABLE" },
    },
    {
      name: "David",
      cookQuota: 1,
      cleanQuota: 1,
      availability: { "Oct 1 (Thu)": "AVAILABLE", "Oct 4 (Sun, Brunch)": "AVAILABLE" },
    },
  ];

  const result = solveCookAndCleanSchedule(mealDates, responses, [], {
    cookPolicy: "ADAPTIVE_3_OR_2",
  });

  assert.equal(result.success, true);
  assert.equal(result.schedule.length, 2);

  // Oct 1 (Cancelled)
  const oct1 = result.schedule[0];
  assert.equal(oct1.targetCookCount, 0);
  assert.equal(oct1.targetCleanCount, 0);
  assert.equal(oct1.cooks.length, 0);
  assert.equal(oct1.cleaners.length, 0);
  assert.equal(oct1.unfilledCooks, 0);
  assert.equal(oct1.unfilledCleaners, 0);

  // Oct 4 (Active Brunch)
  const oct4 = result.schedule[1];
  assert.equal(oct4.targetCookCount, 2);
  assert.equal(oct4.targetCleanCount, 2);
  assert.equal(oct4.cooks.length, 2);
  assert.equal(oct4.cleaners.length, 2);
});

test("Schedule Parser - isWillingTwoPersonDinner Correctness", () => {
  // Standard 3-person dinner answers should NOT be willing
  assert.equal(isWillingTwoPersonDinner("Dinner = 3, Brunch = 2"), false);
  assert.equal(isWillingTwoPersonDinner("3 on dinners, 2 on brunches"), false);
  assert.equal(isWillingTwoPersonDinner("3 on dinner"), false);
  assert.equal(isWillingTwoPersonDinner("3-person dinner"), false);
  assert.equal(isWillingTwoPersonDinner(""), false);
  assert.equal(isWillingTwoPersonDinner(undefined), false);

  // Explicit 2-person dinner answers SHOULD be willing
  assert.equal(isWillingTwoPersonDinner("2 regardless of meal type"), true);
  assert.equal(isWillingTwoPersonDinner("2 for either"), true);
  assert.equal(isWillingTwoPersonDinner("2 for cooking"), true);
  assert.equal(isWillingTwoPersonDinner("2 on dinners"), true);
  assert.equal(isWillingTwoPersonDinner("2-person team on dinners"), true);
  assert.equal(isWillingTwoPersonDinner("yes"), true);
});

import { parseSurveySheetData } from "../src/server/parser.ts";

test("Survey Parser & Schedule - Ben & Fabrice 2-Person Willing Dinner Team", () => {
  const surveyGrid = [
    [
      "Timestamp",
      "Email Address",
      "Name",
      "Would you be open to a 2-person cook team on dinners if needed?",
      "Can you cook and clean on the same day?",
      "How many meals can you cook this month?",
      "How many meals can you clean this month?",
      "Special instructions or notes",
      "Select your available dates [Sep 14 (Mon)]",
    ],
    ["8/29/2026", "ben@example.com", "Ben", "2 for either", "No", "1", "1", "", "Available"],
    [
      "8/29/2026",
      "fabrice@example.com",
      "Fabrice",
      "",
      "No",
      "1",
      "1",
      "2 for Cooking",
      "Available",
    ],
    [
      "8/29/2026",
      "wei@example.com",
      "Wei",
      "Dinner = 3, Brunch = 2",
      "No",
      "1",
      "1",
      "",
      "Available",
    ],
  ];

  const intake = parseSurveySheetData(surveyGrid, []);
  assert.equal(intake.responses.length, 3);

  const ben = intake.responses.find((r) => r.name === "Ben");
  const fabrice = intake.responses.find((r) => r.name === "Fabrice");
  const wei = intake.responses.find((r) => r.name === "Wei");

  assert.equal(isWillingTwoPersonDinner(ben.cookTeamSizePref), true);
  assert.equal(isWillingTwoPersonDinner(fabrice.cookTeamSizePref), true);
  assert.equal(isWillingTwoPersonDinner(wei.cookTeamSizePref), false);

  // Test schedule tab evaluation
  const schedGrid = [
    ["Date", "Meal Type", "Cook 1", "Cook 2", "Cook 3", "Clean 1", "Clean 2", "Clean 3", "Notes"],
    ["Sep 14 (Mon)", "DINNER", "Ben", "Fabrice", "", "Clean1", "Clean2", "Clean3", ""],
  ];

  const schedResult = parseScheduleGridData(schedGrid, intake.responses);
  assert.equal(schedResult.schedule[0].isTwoPersonDinnerWilling, true);
  assert.equal(schedResult.schedule[0].targetCookCount, 2);
  assert.equal(schedResult.schedule[0].unfilledCooks, 0);
});

test("Schedule Parser - Clean Date Formatting & Parsing (formatScheduleDateLabel & parseDateFromLabelOrKey)", () => {
  // Test messy GMT string from Sheets Date cell
  const messyGmt = "Mon Aug 03 2026 00:00:00 GMT-0400 (Eastern Daylight Time)";
  assert.equal(formatScheduleDateLabel(messyGmt), "Aug 3 (Mon)");

  // Test ISO string
  const isoStr = "2026-09-10";
  assert.equal(formatScheduleDateLabel(isoStr), "Sep 10 (Thu)");

  // Test Brunch label with Date object
  const jsDateBrunch = new Date(2026, 8, 13); // Sep 13
  assert.equal(formatScheduleDateLabel(jsDateBrunch, "BRUNCH"), "Sep 13 (Sun, Brunch)");

  // Test parseDateFromLabelOrKey
  const d1 = parseDateFromLabelOrKey("Sep 10 (Thu)", "2026-09-10");
  assert.equal(d1?.getFullYear(), 2026);
  assert.equal(d1?.getMonth(), 8); // 0-indexed September
  assert.equal(d1?.getDate(), 10);

  // Test parsing grid data with real Date cells / messy GMT strings
  const grid = [
    ["Date", "Meal Type", "Cook 1", "Clean 1"],
    [new Date(2026, 7, 3), "DINNER", "Alice", "Bob"],
    ["Mon Aug 03 2026 00:00:00 GMT-0400 (Eastern Daylight Time)", "DINNER", "Charlie", "David"],
  ];

  const result = parseScheduleGridData(grid);
  assert.equal(result.schedule[0].dateLabel, "Aug 3 (Mon)");
  assert.equal(result.schedule[0].dateKey, "2026-08-03");
  assert.equal(result.schedule[1].dateLabel, "Aug 3 (Mon)");
  assert.equal(result.schedule[1].dateKey, "2026-08-03");
});

test("Matchmaker Solver - Complete Meal Maximizer (Auto-Drop Deficit Dates)", () => {
  // 3 meal dates where Oct 1 and Oct 4 have plenty of volunteers, but Oct 8 only has 1 volunteer
  const mealDates = [
    {
      id: "MEAL-1",
      dateKey: "2026-10-01",
      dateLabel: "Oct 1 (Thu)",
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
      dateKey: "2026-10-08",
      dateLabel: "Oct 8 (Thu)",
      dayOfWeek: "Thursday",
      mealType: "DINNER",
      targetCookCount: 3,
      targetCleanCount: 3,
    },
  ];

  const responses = [];
  for (let i = 1; i <= 10; i++) {
    responses.push({
      name: `Member ${i}`,
      cookQuota: 1,
      cleanQuota: 1,
      availability: { "Oct 1 (Thu)": "AVAILABLE", "Oct 4 (Sun, Brunch)": "AVAILABLE" },
    });
  }
  responses.push({
    name: "Isolated Member",
    cookQuota: 1,
    cleanQuota: 1,
    availability: { "Oct 8 (Thu)": "AVAILABLE" },
  });

  // With Complete Meal Maximization (autoCancelDeficitDates: true)
  const result = solveCookAndCleanSchedule(mealDates, responses, [], {
    cookPolicy: "ADAPTIVE_3_OR_2",
    autoCancelDeficitDates: true,
  });

  const active = result.schedule.filter((d) => d.targetCookCount > 0);
  const cancelled = result.schedule.filter((d) => d.targetCookCount === 0);

  // Oct 1 and Oct 4 should be 100% complete
  assert.equal(active.length, 2);
  assert.equal(
    active.every((d) => d.unfilledCooks === 0 && d.unfilledCleaners === 0),
    true
  );

  // Oct 8 (deficit date) should be cleanly auto-cancelled
  assert.equal(cancelled.length, 1);
  assert.equal(cancelled[0].dateLabel, "Oct 8 (Thu)");
  assert.equal(cancelled[0].specialNote?.includes("NO COMMUNITY MEAL"), true);
});

test("Survey Parser - sameDayPref Parsing (Preferred, Yes, No, and Known Members)", () => {
  const surveyGrid = [
    [
      "Timestamp",
      "Email Address",
      "Name",
      "Would you be open to a 2-person cook team on dinners if needed?",
      "Can you cook and clean on the same day?",
      "How many meals can you cook this month?",
      "How many meals can you clean this month?",
      "Special instructions or notes",
      "Select your available dates [Sep 14 (Mon)]",
    ],
    ["8/29/2026", "stacey@example.com", "Stacey", "", "Preferred", "1", "1", "", "Available"],
    ["8/29/2026", "laurel@example.com", "Laurel", "", "Yes", "1", "1", "", "Available"],
    [
      "8/29/2026",
      "vesanto@example.com",
      "Vesanto",
      "",
      "",
      "1",
      "1",
      "I can do both on same day",
      "Available",
    ],
    ["8/29/2026", "other@example.com", "Other", "", "No", "1", "1", "", "Available"],
  ];

  const intake = parseSurveySheetData(surveyGrid, []);
  assert.equal(intake.responses.length, 4);

  const stacey = intake.responses.find((r) => r.name === "Stacey");
  const laurel = intake.responses.find((r) => r.name === "Laurel");
  const vesanto = intake.responses.find((r) => r.name === "Vesanto");
  const other = intake.responses.find((r) => r.name === "Other");

  assert.equal(stacey?.sameDayPref, "PREFERRED");
  assert.equal(stacey?.canCookCleanSameDay, true);

  assert.equal(laurel?.sameDayPref, "YES");
  assert.equal(laurel?.canCookCleanSameDay, true);

  assert.equal(vesanto?.canCookCleanSameDay, true);
  assert.equal(other?.sameDayPref, "NO");
  assert.equal(other?.canCookCleanSameDay, false);
});

test("Matchmaker Solver - Near-Complete Meal Opportunities", () => {
  const mealDates = [
    {
      id: "MEAL-1",
      dateKey: "2026-10-01",
      dateLabel: "Oct 1 (Thu)",
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
      dateKey: "2026-10-08",
      dateLabel: "Oct 8 (Thu)",
      dayOfWeek: "Thursday",
      mealType: "DINNER",
      targetCookCount: 3,
      targetCleanCount: 3,
    },
  ];

  const responses = [];
  for (let i = 1; i <= 10; i++) {
    responses.push({
      name: `Member ${i}`,
      cookQuota: 1,
      cleanQuota: 1,
      availability: { "Oct 1 (Thu)": "AVAILABLE", "Oct 4 (Sun, Brunch)": "AVAILABLE" },
    });
  }
  // 2 volunteers available on Oct 8 (short only 1 cook & 1 cleaner to complete)
  responses.push({
    name: "Helper A",
    cookQuota: 1,
    cleanQuota: 1,
    availability: { "Oct 8 (Thu)": "AVAILABLE" },
  });
  responses.push({
    name: "Helper B",
    cookQuota: 1,
    cleanQuota: 1,
    availability: { "Oct 8 (Thu)": "AVAILABLE" },
  });

  const result = solveCookAndCleanSchedule(mealDates, responses, [], {
    cookPolicy: "ADAPTIVE_3_OR_2",
    autoCancelDeficitDates: true,
  });

  assert.ok(result.nearCompleteOpportunities);
  assert.equal(result.nearCompleteOpportunities.length, 1);

  const opp = result.nearCompleteOpportunities[0];
  assert.equal(opp.dateLabel, "Oct 8 (Thu)");
  assert.deepEqual(opp.availableCooks, ["Helper A", "Helper B"]);
  assert.deepEqual(opp.availableCleaners, ["Helper A", "Helper B"]);
  assert.ok(opp.suggestedOutreachText.includes("Oct 8 (Thu)"));
  assert.ok(opp.candidateVolunteersToAsk.length >= 2);
});

test("Community Reports - Multi-Month Equity & Stats Aggregator", () => {
  const monthRecords = [
    {
      monthKey: "2026-08",
      schedule: [
        {
          dateKey: "2026-08-10",
          dateLabel: "Aug 10",
          mealType: "DINNER",
          targetCookCount: 3,
          targetCleanCount: 3,
          cooks: ["Alex", "Mark L", "Jaela"],
          cleaners: ["Olive", "Rachel", "Saje"],
          unfilledCooks: 0,
          unfilledCleaners: 0,
        },
        {
          dateKey: "2026-08-13",
          dateLabel: "Aug 13",
          mealType: "DINNER",
          targetCookCount: 3,
          targetCleanCount: 3,
          cooks: ["Ben", "Jeanie", "Saje"],
          cleaners: ["Ben", "Mark L", "Marko"],
          unfilledCooks: 0,
          unfilledCleaners: 0,
        },
      ],
    },
    {
      monthKey: "2026-09",
      schedule: [
        {
          dateKey: "2026-09-07",
          dateLabel: "Sep 7",
          mealType: "DINNER",
          targetCookCount: 3,
          targetCleanCount: 3,
          cooks: ["Alex", "Ben", "Olive"],
          cleaners: ["Rachel", "Jaela", "Mark L"],
          unfilledCooks: 0,
          unfilledCleaners: 0,
        },
      ],
    },
  ];

  const report = computeCommunityReportSummary(monthRecords);

  assert.equal(report.totalMonthsTracked, 2);
  assert.equal(report.totalMealsServed, 3);
  assert.equal(report.totalCookShifts, 9);
  assert.equal(report.totalCleanShifts, 9);
  assert.ok(report.uniqueVolunteersCount >= 7);

  const ben = report.memberEquityStats.find((m) => m.name === "Ben");
  assert.ok(ben);
  assert.equal(ben?.totalCooks, 2);
  assert.equal(ben?.totalCleans, 1);
  assert.equal(ben?.sameDayShifts, 1); // Ben cooked and cleaned on Aug 13
  assert.equal(ben?.monthsActive, 2);

  const markL = report.memberEquityStats.find((m) => m.name === "Mark L");
  assert.ok(markL);
  assert.equal(markL?.totalCooks, 1);
  assert.equal(markL?.totalCleans, 2);
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  generateMonthlySurveyDates,
  deriveFormTitle,
  buildFormGridRowLabel,
  matchesSurveySheetForMonth,
} from "../src/server/surveyFormGenerator.ts";

test("Survey Form Generator - Form Title Derivation", () => {
  assert.equal(deriveFormTitle("2026-10"), "26-10 Oct Meal Team Sign-Up");
  assert.equal(deriveFormTitle("2026-11"), "26-11 Nov Meal Team Sign-Up");
  assert.equal(deriveFormTitle("2026-12"), "26-12 Dec Meal Team Sign-Up");
  assert.equal(deriveFormTitle("2027-01"), "27-01 Jan Meal Team Sign-Up");
});

test("Survey Form Generator - Auto-generates standard November 2026 dates", () => {
  const dates = generateMonthlySurveyDates("2026-11");
  // Nov 2026:
  // Sundays: Nov 1, Nov 8, Nov 15, Nov 22, Nov 29 (5 Sundays)
  // Mondays: Nov 2, Nov 9, Nov 16, Nov 23, Nov 30 (5 Mondays)
  // Thursdays: Nov 5, Nov 12, Nov 19, Nov 26 (4 Thursdays)
  // Total = 14 meal dates
  assert.equal(dates.length, 14);

  // Sunday 1: Brunch
  assert.equal(dates[0].dateKey, "2026-11-01");
  assert.equal(dates[0].mealType, "BRUNCH");
  assert.equal(dates[0].dateLabel, "Nov 1 (Sun, Brunch)");

  // Monday 1: Dinner
  assert.equal(dates[1].dateKey, "2026-11-02");
  assert.equal(dates[1].mealType, "DINNER");
  assert.equal(dates[1].dateLabel, "Nov 2 (Mon)");

  // Thursday 1: Dinner
  assert.equal(dates[2].dateKey, "2026-11-05");
  assert.equal(dates[2].mealType, "DINNER");
  assert.equal(dates[2].dateLabel, "Nov 5 (Thur)");

  // Sunday 2: Dinner (Alternating)
  assert.equal(dates[3].dateKey, "2026-11-08");
  assert.equal(dates[3].mealType, "DINNER");
  assert.equal(dates[3].dateLabel, "Nov 8 (Sun, Dinner)");

  // Sunday 3: Brunch (Alternating)
  assert.equal(dates[6].dateKey, "2026-11-15");
  assert.equal(dates[6].mealType, "BRUNCH");
  assert.equal(dates[6].dateLabel, "Nov 15 (Sun, Brunch)");
});

test("Survey Form Generator - Form Grid Row Label formatting", () => {
  const standardDate = {
    dateKey: "2026-11-01",
    dateLabel: "Nov 1 (Sun, Brunch)",
    dayOfWeek: "Sunday",
    mealType: "BRUNCH",
    included: true,
  };
  assert.equal(buildFormGridRowLabel(standardDate), "Nov 1 (Sun, Brunch)");

  const annotatedDate = {
    dateKey: "2026-11-26",
    dateLabel: "Nov 26 (Thur)",
    dayOfWeek: "Thursday",
    mealType: "DINNER",
    specialNote: "Thanksgiving Meal",
    included: true,
  };
  assert.equal(buildFormGridRowLabel(annotatedDate), "Nov 26 (Thur) - Thanksgiving Meal");
});

test("Survey Form Generator - Not Available Grid Columns & Prefill Defaults", () => {
  const dates = generateMonthlySurveyDates("2026-11");
  const gridRows = dates.map((d) => buildFormGridRowLabel(d));
  const gridColumns = ["Available", "Cook only", "Clean only", "Not Available"];

  assert.equal(gridColumns.length, 4);
  assert.equal(gridColumns[3], "Not Available");

  // Verify prefilled default array matches gridRows count and fills with 'Not Available'
  const prefillValues = gridRows.map(() => "Not Available");
  assert.equal(prefillValues.length, 14);
  assert.ok(prefillValues.every((v) => v === "Not Available"));
});

test("Survey Form Generator - Continuous Sunday Alternating Pattern (Nov Brunch -> Dec Dinner)", () => {
  // November 2026: 5 Sundays, ending on Nov 29 with Brunch
  const novDates = generateMonthlySurveyDates("2026-11");
  const novSundays = novDates.filter((d) => d.dayOfWeek === "Sunday");
  assert.equal(novSundays.length, 5);
  assert.equal(novSundays[0].dateKey, "2026-11-01");
  assert.equal(novSundays[0].mealType, "BRUNCH");
  assert.equal(novSundays[4].dateKey, "2026-11-29");
  assert.equal(novSundays[4].mealType, "BRUNCH");

  // December 2026: Since Nov 29 was Brunch, Dec 6 MUST BE DINNER
  const decDates = generateMonthlySurveyDates("2026-12");
  const decSundays = decDates.filter((d) => d.dayOfWeek === "Sunday");
  assert.equal(decSundays[0].dateKey, "2026-12-06");
  assert.equal(decSundays[0].mealType, "DINNER");
  assert.equal(decSundays[0].dateLabel, "Dec 6 (Sun, Dinner)");
  assert.equal(decSundays[1].dateKey, "2026-12-13");
  assert.equal(decSundays[1].mealType, "BRUNCH");
  assert.equal(decSundays[2].dateKey, "2026-12-20");
  assert.equal(decSundays[2].mealType, "DINNER");
  assert.equal(decSundays[3].dateKey, "2026-12-27");
  assert.equal(decSundays[3].mealType, "BRUNCH");

  // January 2027: Since Dec 27 was Brunch, Jan 3 MUST BE DINNER
  const janDates = generateMonthlySurveyDates("2027-01");
  const janSundays = janDates.filter((d) => d.dayOfWeek === "Sunday");
  assert.equal(janSundays[0].dateKey, "2027-01-03");
  assert.equal(janSundays[0].mealType, "DINNER");
  assert.equal(janSundays[0].dateLabel, "Jan 3 (Sun, Dinner)");
});

test("Survey Form Generator - matchesSurveySheetForMonth strictly matches target month and rejects false positives", () => {
  const janSheet = "26-01 JAN Cook Team Survey (Responses)";
  const novSheet = "26-11 Nov Meal Team Sign-Up (Responses)";
  const decSheet = "26-12 Dec Meal Team Sign-Up (Responses)";
  const masterSheet = "Master Community Registry (Vancouver Cohousing)";

  // December 2026 MUST NOT match January sheet (the bug that caused the false block)
  assert.equal(matchesSurveySheetForMonth(janSheet, "2026-12"), false);
  assert.equal(matchesSurveySheetForMonth(novSheet, "2026-12"), false);
  assert.equal(matchesSurveySheetForMonth(decSheet, "2026-12"), true);

  // January 2026 matches January sheet
  assert.equal(matchesSurveySheetForMonth(janSheet, "2026-01"), true);
  assert.equal(matchesSurveySheetForMonth(decSheet, "2026-01"), false);

  // November 2026 matches November sheet
  assert.equal(matchesSurveySheetForMonth(novSheet, "2026-11"), true);
  assert.equal(matchesSurveySheetForMonth(janSheet, "2026-11"), false);

  // Empty, null, undefined, or invalid month keys MUST NEVER match any sheet
  assert.equal(matchesSurveySheetForMonth(janSheet, ""), false);
  assert.equal(matchesSurveySheetForMonth(janSheet, "   "), false);
  assert.equal(matchesSurveySheetForMonth(janSheet, null), false);
  assert.equal(matchesSurveySheetForMonth(janSheet, undefined), false);
  assert.equal(matchesSurveySheetForMonth(janSheet, "invalid-month"), false);
  assert.equal(matchesSurveySheetForMonth(janSheet, "2026"), false);
  assert.equal(matchesSurveySheetForMonth(decSheet, ""), false);

  // Non-survey sheets must never match
  assert.equal(matchesSurveySheetForMonth(masterSheet, "2026-12"), false);
  assert.equal(matchesSurveySheetForMonth(masterSheet, "2026-01"), false);
});

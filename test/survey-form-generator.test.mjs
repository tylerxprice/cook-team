import test from "node:test";
import assert from "node:assert/strict";
import {
  generateMonthlySurveyDates,
  deriveFormTitle,
  buildFormGridRowLabel,
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

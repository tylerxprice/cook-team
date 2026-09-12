import test from "node:test";
import assert from "node:assert/strict";
import {
  getDefaultSignupDeadline,
  formatShortMonthDay,
  formatHeaderDayLabel,
  generateMealSignupPreviewColumns,
  deriveMonthTabName,
  getTabChronologicalKey,
} from "../src/server/signupWorkbook.ts";

test("Meal Sign-Up - Default Sign-Up Deadlines", () => {
  // Sunday Brunch / Dinner
  const sunday = new Date("2026-10-04T18:00:00Z");
  assert.equal(getDefaultSignupDeadline(sunday, "BRUNCH"), "Saturday 9:00 AM");
  assert.equal(getDefaultSignupDeadline(sunday, "DINNER"), "Saturday 9:00 AM");

  // Monday Dinner
  const monday = new Date("2026-10-05T18:00:00Z");
  assert.equal(getDefaultSignupDeadline(monday, "DINNER"), "Sunday 9:00 AM");

  // Thursday Dinner
  const thursday = new Date("2026-10-08T18:00:00Z");
  assert.equal(getDefaultSignupDeadline(thursday, "DINNER"), "Wednesday 9:00 AM");
});

test("Meal Sign-Up - Short Date Formatting & Header Day Labels", () => {
  const sunBrunch = new Date("2026-10-11T11:00:00Z");
  assert.equal(formatShortMonthDay(sunBrunch), "Oct 11");
  assert.equal(formatHeaderDayLabel(sunBrunch, "BRUNCH"), "SUN - Brunch");

  const sunDinner = new Date("2026-10-18T18:00:00Z");
  assert.equal(formatShortMonthDay(sunDinner), "Oct 18");
  assert.equal(formatHeaderDayLabel(sunDinner, "DINNER"), "SUN - Dinner");

  const mon = new Date("2026-10-19T18:00:00Z");
  assert.equal(formatShortMonthDay(mon), "Oct 19");
  assert.equal(formatHeaderDayLabel(mon, "DINNER"), "MON");

  const thu = new Date("2026-10-22T18:00:00Z");
  assert.equal(formatShortMonthDay(thu), "Oct 22");
  assert.equal(formatHeaderDayLabel(thu, "DINNER"), "THUR");
});

test("Meal Sign-Up - Preview Columns Generation & Column Index Math", () => {
  const sampleSchedule = [
    {
      dateKey: "2026-10-01",
      dateLabel: "Oct 1 (Thur)",
      mealType: "DINNER",
      cooks: ["Ben", "Jeanie", "Saje"],
      cleaners: ["Ben", "Mark L", "Marko"],
      targetCookCount: 3,
      targetCleanCount: 3,
      unfilledCooks: 0,
      unfilledCleaners: 0,
    },
    {
      dateKey: "2026-10-04",
      dateLabel: "Oct 4 (Sun, Brunch)",
      mealType: "BRUNCH",
      cooks: ["Tyler", "Laurel"],
      cleaners: ["Laurel", "Al"],
      targetCookCount: 2,
      targetCleanCount: 2,
      unfilledCooks: 0,
      unfilledCleaners: 0,
    },
    {
      dateKey: "2026-10-12",
      dateLabel: "Oct 12 (Mon)",
      mealType: "DINNER",
      specialNote: "NO COMMUNITY MEAL",
      cooks: [],
      cleaners: [],
      targetCookCount: 0,
      targetCleanCount: 0,
      unfilledCooks: 0,
      unfilledCleaners: 0,
    },
  ];

  const columns = generateMealSignupPreviewColumns(sampleSchedule, {
    "2026-10-01": "Custom Tuesday 5pm",
  });

  assert.equal(columns.length, 3);

  // Column 1 (Col B = 2)
  assert.equal(columns[0].colIndex, 2);
  assert.equal(columns[0].dateShort, "Oct 1");
  assert.equal(columns[0].dayLabel, "THUR");
  assert.equal(columns[0].cooks, "Ben, Jeanie, Saje");
  assert.equal(columns[0].cleaners, "Ben, Mark L, Marko");
  assert.equal(columns[0].deadline, "Custom Tuesday 5pm");
  assert.equal(columns[0].isNoMeal, false);

  // Column 2 (Col E = 5)
  assert.equal(columns[1].colIndex, 5);
  assert.equal(columns[1].dateShort, "Oct 4");
  assert.equal(columns[1].dayLabel, "SUN - Brunch");
  assert.equal(columns[1].cooks, "Tyler, Laurel");
  assert.equal(columns[1].cleaners, "Laurel, Al");
  assert.equal(columns[1].deadline, "Saturday 9:00 AM");
  assert.equal(columns[1].isNoMeal, false);

  // Column 3 (Col H = 8, No Community Meal)
  assert.equal(columns[2].colIndex, 8);
  assert.equal(columns[2].isNoMeal, true);
  assert.equal(columns[2].cooks, "No Community Meal");
  assert.equal(columns[2].cleaners, "");
  assert.equal(columns[2].deadline, "");
});

test("Meal Sign-Up - Custom Day Labels (e.g. MON - T&R Day, SUN Community Meeting)", () => {
  const sampleSchedule = [
    {
      dateKey: "2026-10-05",
      dateLabel: "Oct 5 (Mon)",
      mealType: "DINNER",
      cooks: ["Tyler", "Laurel"],
      cleaners: ["Ben"],
      targetCookCount: 2,
      targetCleanCount: 1,
      unfilledCooks: 0,
      unfilledCleaners: 0,
    },
    {
      dateKey: "2026-10-11",
      dateLabel: "Oct 11 (Sun, Dinner)",
      mealType: "DINNER",
      cooks: ["Cy", "Olive"],
      cleaners: ["Rose"],
      targetCookCount: 2,
      targetCleanCount: 1,
      unfilledCooks: 0,
      unfilledCleaners: 0,
    },
  ];

  const columns = generateMealSignupPreviewColumns(
    sampleSchedule,
    {},
    {
      "2026-10-05": "MON - T&R Day",
      "2026-10-11": "SUN Community Meeting",
    }
  );

  assert.equal(columns.length, 2);
  assert.equal(columns[0].dayLabel, "MON - T&R Day");
  assert.equal(columns[1].dayLabel, "SUN Community Meeting");
});

test("Meal Sign-Up - Derive Month Tab Name & Chronological Sorting", () => {
  assert.equal(deriveMonthTabName("2026-10"), "OCT 2026");
  assert.equal(deriveMonthTabName("Schedule_2026-09"), "SEP 2026");
  assert.equal(deriveMonthTabName("2026-01"), "JAN 2026");

  // Chronological keys
  assert.equal(getTabChronologicalKey("JAN 2026"), "2026-01");
  assert.equal(getTabChronologicalKey("MAY 2026"), "2026-05");
  assert.equal(getTabChronologicalKey("SEP 2026"), "2026-09");
  assert.equal(getTabChronologicalKey("OCT 2026"), "2026-10");
  assert.equal(getTabChronologicalKey("DEC 2026"), "2026-12");

  const tabs = ["OCT 2026", "JAN 2026", "Template", "AUG 2026", "SEP 2026"];
  tabs.sort((a, b) => {
    if (a.toLowerCase() === "template") return 1;
    if (b.toLowerCase() === "template") return -1;
    return getTabChronologicalKey(a).localeCompare(getTabChronologicalKey(b));
  });

  assert.deepEqual(tabs, ["JAN 2026", "AUG 2026", "SEP 2026", "OCT 2026", "Template"]);
});

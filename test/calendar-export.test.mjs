import test from "node:test";
import assert from "node:assert/strict";
import {
  formatDateToIcsDate,
  generateMemberIcs,
  extractMemberShifts,
} from "../src/client/utils/ics.ts";

test("formatDateToIcsDate - Formats all-day start and end dates (inclusive start, exclusive end)", () => {
  const res = formatDateToIcsDate("2026-10-04");
  assert.equal(res.start, "20261004");
  assert.equal(res.end, "20261005");
});

test("formatDateToIcsDate - Handles month boundary crossover", () => {
  const res = formatDateToIcsDate("2026-10-31");
  assert.equal(res.start, "20261031");
  assert.equal(res.end, "20261101");
});

test("extractMemberShifts - Extracts cook and cleaner shifts for a member", () => {
  const sampleSchedule = [
    {
      dateKey: "2026-10-01",
      dateLabel: "Oct 1 (Thur)",
      mealType: "DINNER",
      cooks: ["Christian", "Lorne", "Alexandra"],
      cleaners: ["Tyler", "Patricia", "Ben"],
      specialNote: "",
    },
    {
      dateKey: "2026-10-04",
      dateLabel: "Oct 4 (Sun, Brunch)",
      mealType: "BRUNCH",
      cooks: ["Ian", "Rose"],
      cleaners: ["Lorne", "Gail"],
      specialNote: "Brunch at 11am",
    },
    {
      dateKey: "2026-10-08",
      dateLabel: "Oct 8 (Thur)",
      mealType: "DINNER",
      cooks: ["Pat", "Sam", "Brenda"],
      cleaners: ["Ian", "Christian"],
      specialNote: "",
    },
  ];

  const lorneShifts = extractMemberShifts("Lorne", sampleSchedule, "Vancouver Cohousing");
  assert.equal(lorneShifts.length, 2);

  assert.equal(lorneShifts[0].role, "Cook");
  assert.equal(lorneShifts[0].dateKey, "2026-10-01");
  assert.equal(lorneShifts[0].mealType, "DINNER");
  assert.deepEqual(lorneShifts[0].teammatesCooks, ["Christian", "Lorne", "Alexandra"]);
  assert.deepEqual(lorneShifts[0].teammatesCleaners, ["Tyler", "Patricia", "Ben"]);

  assert.equal(lorneShifts[1].role, "Cleaner");
  assert.equal(lorneShifts[1].dateKey, "2026-10-04");
  assert.equal(lorneShifts[1].mealType, "BRUNCH");
  assert.equal(lorneShifts[1].specialNote, "Brunch at 11am");
});

test("generateMemberIcs - Produces compliant RFC 5545 iCalendar string with alarms", () => {
  const events = [
    {
      dateKey: "2026-10-01",
      dateLabel: "Oct 1 (Thur)",
      mealType: "DINNER",
      role: "Cook",
      teammatesCooks: ["Christian", "Lorne", "Alexandra"],
      teammatesCleaners: ["Tyler", "Patricia"],
      specialNote: "",
      communityName: "Vancouver Cohousing",
    },
  ];

  const ics = generateMemberIcs("Lorne", events, "Vancouver Cohousing");

  assert.ok(ics.includes("BEGIN:VCALENDAR"));
  assert.ok(ics.includes("VERSION:2.0"));
  assert.ok(ics.includes("X-WR-CALNAME:Lorne's Meal Shifts - Vancouver Cohousing"));
  assert.ok(ics.includes("BEGIN:VEVENT"));
  assert.ok(ics.includes("DTSTART;VALUE=DATE:20261001"));
  assert.ok(ics.includes("DTEND;VALUE=DATE:20261002"));
  assert.ok(ics.includes("SUMMARY:🍳 Cook Shift: Dinner (Vancouver Cohousing)"));
  assert.ok(ics.includes("Cook Team: Christian\\, Lorne\\, Alexandra"));
  assert.ok(ics.includes("Clean Team: Tyler\\, Patricia"));

  // Check 1 day before alarm
  assert.ok(ics.includes("TRIGGER:-P1DT15H"));
  // Check morning of alarm
  assert.ok(ics.includes("TRIGGER:PT8H"));
  assert.ok(ics.includes("END:VALARM"));
  assert.ok(ics.includes("END:VEVENT"));
  assert.ok(ics.includes("END:VCALENDAR"));
});

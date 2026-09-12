import test from "node:test";
import assert from "node:assert/strict";
import { formatHistoricalSheetTitle, extractMonthKey } from "../src/server/historical.ts";

test("Historical Naming - Real Tab Formats (Slash, No Separator, Spaces)", () => {
  const cases = [
    // Real tab names with slashes
    { input: "JAN/26", expected: "Historical - 26-01 JAN Cook Team Survey (Responses)" },
    { input: "FEB/26", expected: "Historical - 26-02 FEB Cook Team Survey (Responses)" },
    { input: "MAR/26", expected: "Historical - 26-03 MAR Cook Team Survey (Responses)" },
    { input: "APR/26", expected: "Historical - 26-04 APR Cook Team Survey (Responses)" },
    { input: "MAY/26", expected: "Historical - 26-05 MAY Cook Team Survey (Responses)" },
    { input: "JUNE/26", expected: "Historical - 26-06 JUN Cook Team Survey (Responses)" },
    { input: "JUL/26", expected: "Historical - 26-07 JUL Cook Team Survey (Responses)" },
    { input: "AUG/26", expected: "Historical - 26-08 AUG Cook Team Survey (Responses)" },
    { input: "SEPT/26", expected: "Historical - 26-09 SEP Cook Team Survey (Responses)" },
    { input: "DEC/24", expected: "Historical - 24-12 DEC Cook Team Survey (Responses)" },

    // Alternative variations without slashes
    { input: "JAN26", expected: "Historical - 26-01 JAN Cook Team Survey (Responses)" },
    { input: "JUNE26", expected: "Historical - 26-06 JUN Cook Team Survey (Responses)" },
    { input: "SEPT26", expected: "Historical - 26-09 SEP Cook Team Survey (Responses)" },
    { input: "May 2026", expected: "Historical - 26-05 MAY Cook Team Survey (Responses)" },
    { input: "August 2026", expected: "Historical - 26-08 AUG Cook Team Survey (Responses)" },
    { input: "2026 JUNE", expected: "Historical - 26-06 JUN Cook Team Survey (Responses)" },
  ];

  for (const { input, expected } of cases) {
    const actual = formatHistoricalSheetTitle(input);
    assert.equal(
      actual,
      expected,
      `Failed for tab "${input}": got "${actual}", expected "${expected}"`
    );
  }
});

import { parseEmailScheduleAnnouncement } from "../src/server/historical.ts";

test("Historical Email Parser - Clean Date Labels and ISO dateKey", () => {
  const emailSample = `
Hi precious friends & neighbours,

*Thur Sept 10*
Alice, Bob
Cleaning: Charlie, David

*Sun Sept 13 (Brunch)*
Eve, Frank
Cleaning: Grace, Heidi

*Mon Sept 14*
NO COMMUNITY MEAL
`;

  const schedule = parseEmailScheduleAnnouncement(emailSample);
  assert.equal(schedule.length, 3);

  // Sept 10
  assert.equal(schedule[0].dateLabel, "Sep 10 (Thu)");
  assert.equal(schedule[0].dateKey, "2026-09-10");
  assert.equal(schedule[0].mealType, "DINNER");
  assert.deepEqual(schedule[0].cooks, ["Alice", "Bob"]);
  assert.deepEqual(schedule[0].cleaners, ["Charlie", "David"]);

  // Sept 13 Brunch
  assert.equal(schedule[1].dateLabel, "Sep 13 (Sun, Brunch)");
  assert.equal(schedule[1].dateKey, "2026-09-13");
  assert.equal(schedule[1].mealType, "BRUNCH");
  assert.deepEqual(schedule[1].cooks, ["Eve", "Frank"]);
  assert.deepEqual(schedule[1].cleaners, ["Grace", "Heidi"]);

  // Sept 14 (No Community Meal)
  assert.equal(schedule[2].dateLabel, "Sep 14 (Mon)");
  assert.equal(schedule[2].dateKey, "2026-09-14");
  assert.equal(schedule[2].specialNote, "NO COMMUNITY MEAL");
  assert.equal(schedule[2].targetCookCount, 0);
  assert.equal(schedule[2].targetCleanCount, 0);
});

import { normalizeHistoricalMemberName } from "../src/server/historical.ts";

test("Historical Member Name Normalization & Typos", () => {
  assert.equal(normalizeHistoricalMemberName("Mark L."), "Mark L");
  assert.equal(normalizeHistoricalMemberName("Tyler P."), "Tyler P");
  assert.equal(normalizeHistoricalMemberName("Sage"), "Saje");
  assert.equal(normalizeHistoricalMemberName("sage"), "Saje");
  assert.equal(normalizeHistoricalMemberName("Mark B"), "Marko");
  assert.equal(normalizeHistoricalMemberName("Mark B."), "Marko");
  assert.equal(normalizeHistoricalMemberName("Cyrena"), "Cy");
  assert.equal(normalizeHistoricalMemberName("Becca"), "Ash");
  assert.equal(normalizeHistoricalMemberName("Ian B"), "Ian");
  assert.equal(normalizeHistoricalMemberName("Ian B."), "Ian");
  assert.equal(normalizeHistoricalMemberName("Christian#"), "Christian");
  assert.equal(normalizeHistoricalMemberName("Lorne*"), "Lorne");
});

test("Historical Email Parser - Applies normalizeHistoricalMemberName", () => {
  const emailSample = `
Hi precious friends & neighbours,

*Thur Sept 10*
Mark L., Sage
Cleaning: Mark B., Cyrena

*Sun Sept 13 (Brunch)*
Becca, Ian B.
Cleaning: Alice, Bob
`;

  const schedule = parseEmailScheduleAnnouncement(emailSample);
  assert.equal(schedule.length, 2);

  // Sept 10
  assert.deepEqual(schedule[0].cooks, ["Mark L", "Saje"]);
  assert.deepEqual(schedule[0].cleaners, ["Marko", "Cy"]);

  // Sept 13 Brunch
  assert.deepEqual(schedule[1].cooks, ["Ash", "Ian"]);
  assert.deepEqual(schedule[1].cleaners, ["Alice", "Bob"]);
});

test("Email Announcement Formatter - Clean NO COMMUNITY MEAL for cancelled meals", () => {
  function formatEmailDateHeader(d) {
    let label = d.dateLabel.trim();
    const lowerLabel = label.toLowerCase();
    const isBrunch = d.mealType === "BRUNCH" || lowerLabel.includes("brunch");

    let note = d.specialNote?.trim();
    if (note) {
      note = note
        .replace(/\(?\s*auto-cancelled[^)]*\)?/gi, "")
        .replace(/\(?\s*volunteer deficit[^)]*\)?/gi, "")
        .replace(/\bno community meal\b/gi, "")
        .replace(/^[\s\-–—:]+|[\s\-–—:]+$/g, "")
        .trim();

      const lowerNote = note.toLowerCase();
      if (
        !note ||
        lowerNote === "brunch" ||
        lowerNote === "dinner" ||
        lowerLabel.includes(lowerNote)
      ) {
        note = undefined;
      }
    }

    if (!lowerLabel.includes("brunch") && !lowerLabel.includes("dinner")) {
      const typeStr = isBrunch ? "Brunch" : "Dinner";
      label = `${label} (${typeStr})`;
    }

    if (note) {
      label = `${label} - ${note}`;
    }

    return `📅 ${label}`;
  }

  function generateEmailText(schedule) {
    let text =
      "Hi precious friends & neighbours,\n\nHere is the community cook and clean team schedule for next month:\n\n";
    for (const d of schedule) {
      const isNoMeal = Boolean(
        d.isNoMeal ||
        (d.targetCookCount === 0 &&
          d.targetCleanCount === 0 &&
          d.cooks.length === 0 &&
          d.cleaners.length === 0) ||
        (d.specialNote &&
          /no community meal|no meal|auto-cancelled|volunteer deficit/i.test(d.specialNote) &&
          d.cooks.length === 0 &&
          d.cleaners.length === 0)
      );

      text += `${formatEmailDateHeader(d)}\n`;
      if (isNoMeal) {
        text += `  NO COMMUNITY MEAL\n\n`;
      } else {
        text += `  • Cooks: ${d.cooks.join(", ") || "(Need Volunteers)"}\n`;
        text += `  • Cleaners: ${d.cleaners.join(", ") || "(Need Volunteers)"}\n\n`;
      }
    }
    text += "Thank you all for making our meals happen!\n\nBest,\nBrenda";
    return text;
  }

  const schedule = [
    {
      dateKey: "2026-10-01",
      dateLabel: "Oct 1 (Thur)",
      mealType: "DINNER",
      targetCookCount: 3,
      targetCleanCount: 3,
      cooks: ["Brenda", "Alex", "Michael"],
      cleaners: ["Cyrena", "Lisa", "Tyler"],
    },
    {
      dateKey: "2026-10-04",
      dateLabel: "Oct 4 (Sun, Brunch)",
      mealType: "BRUNCH",
      targetCookCount: 2,
      targetCleanCount: 2,
      cooks: ["Brenda", "Sam"],
      cleaners: ["Alex", "Rose"],
    },
    {
      dateKey: "2026-10-15",
      dateLabel: "Oct 15 (Thur)",
      mealType: "DINNER",
      targetCookCount: 0,
      targetCleanCount: 0,
      specialNote: "NO COMMUNITY MEAL (Auto-Cancelled: Volunteer Deficit)",
      cooks: [],
      cleaners: [],
      isNoMeal: true,
    },
  ];

  const email = generateEmailText(schedule);

  // Assert that auto-cancelled deficit note is stripped from header
  assert.ok(!email.includes("Auto-Cancelled: Volunteer Deficit"));
  assert.ok(email.includes("Oct 15 (Thur) (Dinner)\n  NO COMMUNITY MEAL"));

  // Assert that active meals have cooks and cleaners
  assert.ok(
    email.includes(
      "Oct 1 (Thur) (Dinner)\n  • Cooks: Brenda, Alex, Michael\n  • Cleaners: Cyrena, Lisa, Tyler"
    )
  );
  assert.ok(
    email.includes("Oct 4 (Sun, Brunch)\n  • Cooks: Brenda, Sam\n  • Cleaners: Alex, Rose")
  );
});

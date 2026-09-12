/**
 * Standalone offline test suite for legacy signup parsing,
 * email announcement extraction, and solver comparison.
 */

import { solveCookAndCleanSchedule } from "../src/server/matchmaker.ts";

// 1. Synthetic Legacy Sheet Data (representing the real historical sheet format)
const SAMPLE_LEGACY_ROWS = [
  // Header row 0
  ["Vancouver Cohousing", "Special Instructions", "Oct 1 (Thur)", "Oct 4 (Sun, Brunch)", "Oct 5 (Mon)", "Oct 8 (Thur)", "Oct 11 (Sun, Dinner)", "Oct 12 (Mon) - Thanksgiving", "Oct 15 (Thurs)", "Oct 18 (Sun, Brunch)", "Total Available"],
  // Member rows
  ["Tyler", "No special instructions", "Y", "Y", "n", "n", "n", "clean", "n", "n", "3"],
  ["Brenda", "Love cooking brunch! 2 cooks fine for dinner", "Y", "cook", "Y", "Y", "clean", "Y", "Y", "cook", "8"],
  ["Cyrena", "Happy to cook & clean same day to get it all done at once! Can do 2 cleans", "Y", "Y", "Y", "Y", "Y", "n", "Y", "Y", "7"],
  ["Rose", "Please no shifts on same day as Tyler (childcare)", "clean", "Y", "Y", "Y", "cook", "n", "Y", "Y", "6"],
  ["Sam", "Roommates with Alex - different team please. Can cook twice.", "Y", "Y", "cook", "Y", "Y", "Y", "Y", "Y", "8"],
  ["Alex", "Prefer Thursday dinners. Roommate with Sam.", "cook", "clean", "n", "cook", "Y", "Y", "cook", "Y", "6"],
  ["David", "", "Y", "Y", "Y", "Y", "cook", "Y", "Y", "Y", "7"],
  ["Sarah", "Can only clean on Mondays. Cook 2 meals.", "cook", "Y", "clean", "cook", "Y", "clean", "cook", "Y", "7"],
  ["Michael", "2-person dinner ok", "Y", "Y", "Y", "Y", "Y", "Y", "Y", "Y", "8"],
  ["Emily", "Would love to cook with David!", "Y", "Y", "Y", "Y", "cook", "Y", "Y", "Y", "7"],
  ["Lisa", "Clean only please! 2 cleans", "clean", "Y", "Y", "clean", "Y", "Y", "clean", "Y", "7"],
  ["Jessica", "Clean only", "clean", "clean", "clean", "clean", "clean", "clean", "clean", "clean", "8"],
  // Total / Summary rows at bottom
  ["Total Cooks Available", "", "4", "5", "4", "4", "4", "4", "4", "5", "34"],
  ["Total Cleaners Available", "", "5", "5", "5", "5", "5", "5", "5", "5", "40"],
];

// 2. Synthetic Email Announcement (representing Brenda's email format)
const SAMPLE_EMAIL_ANNOUNCEMENT = `
Hi precious friends & neighbours,

Here are the meal teams for October!

📅 Oct 1 (Thur) - DINNER
Cooks: Brenda, Alex, Michael
Cleaners: Cyrena, Lisa, Tyler

📅 Oct 4 (Sun, Brunch) - BRUNCH
Cooks: Brenda, Sam
Cleaners: Alex, Rose

📅 Oct 5 (Mon) - DINNER
Cooks: Sam, David, Emily
Cleaners: Cyrena, Sarah, Lisa

📅 Oct 8 (Thur) - DINNER
Cooks: Alex, Sarah, Michael
Cleaners: Brenda, Cyrena, Lisa

📅 Oct 11 (Sun, Dinner) - DINNER
Cooks: David, Emily, Rose
Cleaners: Brenda, Cyrena, Jessica

📅 Oct 12 (Mon) - Thanksgiving - DINNER
Cooks: Brenda, Sam, Michael
Cleaners: Tyler, Sarah, Jessica

📅 Oct 15 (Thurs) - DINNER
Cooks: Alex, Sarah, David
Cleaners: Brenda, Cyrena, Lisa

📅 Oct 18 (Sun, Brunch) - BRUNCH
Cooks: Brenda, Sam
Cleaners: Cyrena, Michael

Thank you everyone for contributing!
`;

console.log("=== 1. TESTING LEGACY SIGNUP PARSER ===");

function parseLegacyGrid(grid, year = 2026) {
  const headerRow = grid[0];
  const dateColumns = [];

  for (let c = 2; c < headerRow.length; c++) {
    const cell = String(headerRow[c] || "").trim();
    if (!cell || /total|sum|count|note/i.test(cell)) continue;

    const isBrunch = /brunch/i.test(cell);
    const dayOfWeek = /mon/i.test(cell)
      ? "Monday"
      : /tue/i.test(cell)
      ? "Tuesday"
      : /wed/i.test(cell)
      ? "Wednesday"
      : /thu/i.test(cell)
      ? "Thursday"
      : /fri/i.test(cell)
      ? "Friday"
      : /sat/i.test(cell)
      ? "Saturday"
      : /sun/i.test(cell)
      ? "Sunday"
      : "Other";

    let specialNote = undefined;
    if (cell.includes("-")) {
      specialNote = cell.split("-").slice(1).join("-").trim();
    }

    dateColumns.push({
      colIdx: c,
      mealDate: {
        id: `MEAL-${dateColumns.length + 1}`,
        dateKey: `${year}-10-${String(dateColumns.length + 1).padStart(2, "0")}`,
        dateLabel: cell,
        dayOfWeek,
        mealType: isBrunch ? "BRUNCH" : "DINNER",
        specialNote,
        targetCookCount: isBrunch ? 2 : 3,
        targetCleanCount: isBrunch ? 2 : 3,
      },
    });
  }

  const responses = [];
  for (let r = 1; r < grid.length; r++) {
    const row = grid[r];
    const rawName = String(row[0] || "").trim();
    if (!rawName || /total|sum|count|average|notes|legend/i.test(rawName)) continue;

    const specialInstructions = String(row[1] || "").trim();
    const lowerNotes = specialInstructions.toLowerCase();

    const canCookCleanSameDay =
      lowerNotes.includes("same day") ||
      lowerNotes.includes("cook & clean") ||
      lowerNotes.includes("cook and clean");

    const willing2PersonDinner =
      lowerNotes.includes("2 person") ||
      lowerNotes.includes("2-person") ||
      lowerNotes.includes("2 cooks") ||
      lowerNotes.includes("two cooks") ||
      lowerNotes.includes("2 regardless");

    let cookQuota = 1;
    let cleanQuota = 1;
    if (lowerNotes.includes("2 cook") || lowerNotes.includes("cook 2") || lowerNotes.includes("cook twice")) {
      cookQuota = 2;
    } else if (lowerNotes.includes("0 cook") || lowerNotes.includes("no cook") || lowerNotes.includes("clean only")) {
      cookQuota = 0;
    }

    if (lowerNotes.includes("2 clean") || lowerNotes.includes("clean 2") || lowerNotes.includes("clean twice")) {
      cleanQuota = 2;
    } else if (lowerNotes.includes("0 clean") || lowerNotes.includes("no clean") || lowerNotes.includes("cook only")) {
      cleanQuota = 0;
    }

    const availability = {};
    for (const dc of dateColumns) {
      const cellVal = String(row[dc.colIdx] || "").trim().toLowerCase();
      if (cellVal === "y" || cellVal === "yes" || cellVal === "available" || cellVal === "both" || cellVal === "1") {
        availability[dc.mealDate.dateLabel] = "AVAILABLE";
      } else if (cellVal.includes("cook")) {
        availability[dc.mealDate.dateLabel] = "COOK_ONLY";
      } else if (cellVal.includes("clean")) {
        availability[dc.mealDate.dateLabel] = "CLEAN_ONLY";
      } else {
        availability[dc.mealDate.dateLabel] = "UNAVAILABLE";
      }
    }

    responses.push({
      timestamp: new Date().toISOString(),
      email: `${rawName.toLowerCase()}@example.com`,
      name: rawName,
      availability,
      cookTeamSizePref: willing2PersonDinner ? "2 regardless of meal type" : "Dinner = 3, Brunch = 2",
      canCookCleanSameDay,
      cookQuota,
      cleanQuota,
      specialInstructions,
    });
  }

  return {
    mealDates: dateColumns.map((dc) => dc.mealDate),
    responses,
  };
}

const parsed = parseLegacyGrid(SAMPLE_LEGACY_ROWS);
console.log(`✓ Parsed ${parsed.mealDates.length} meal dates:`, parsed.mealDates.map((d) => `${d.dateLabel} (${d.mealType})`));
console.log(`✓ Parsed ${parsed.responses.length} member responses:`);
parsed.responses.forEach((r) => {
  console.log(`  - ${r.name.padEnd(10)} | Cook Quota: ${r.cookQuota} | Clean Quota: ${r.cleanQuota} | Same Day: ${r.canCookCleanSameDay} | 2-Person Willing: ${r.cookTeamSizePref.includes("2 regardless")} | Notes: "${r.specialInstructions}"`);
});

console.log("\n=== 2. TESTING EMAIL ANNOUNCEMENT PARSER ===");

function parseEmail(emailText) {
  const lines = emailText.split(/\r?\n/).map((l) => l.trim());
  const schedule = [];
  let currentDay = null;

  for (const line of lines) {
    if (!line) continue;

    if (line.startsWith("📅") || line.match(/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\d{1,2}\/\d{1,2})/i)) {
      if (currentDay && currentDay.dateLabel && (currentDay.cooks?.length > 0 || currentDay.cleaners?.length > 0)) {
        schedule.push(currentDay);
      }
      const cleanLabel = line.replace(/^[📅\s*#*-]+/, "").trim();
      const isBrunch = /brunch/i.test(cleanLabel);
      currentDay = {
        dateLabel: cleanLabel,
        mealType: isBrunch ? "BRUNCH" : "DINNER",
        cooks: [],
        cleaners: [],
      };
      continue;
    }

    if (currentDay && /^Cooks?:\s*/i.test(line)) {
      const namesStr = line.replace(/^Cooks?:\s*/i, "").trim();
      currentDay.cooks = namesStr.split(/[,;&+]/).map((n) => n.trim().replace(/^and\s+/i, "")).filter(Boolean);
      continue;
    }

    if (currentDay && /^Cleaners?:\s*/i.test(line)) {
      const namesStr = line.replace(/^Cleaners?:\s*/i, "").trim();
      currentDay.cleaners = namesStr.split(/[,;&+]/).map((n) => n.trim().replace(/^and\s+/i, "")).filter(Boolean);
      continue;
    }
  }

  if (currentDay && currentDay.dateLabel && (currentDay.cooks?.length > 0 || currentDay.cleaners?.length > 0)) {
    schedule.push(currentDay);
  }

  return schedule;
}

const groundTruthSchedule = parseEmail(SAMPLE_EMAIL_ANNOUNCEMENT);
console.log(`✓ Parsed ${groundTruthSchedule.length} ground-truth days from email:`);
groundTruthSchedule.forEach((d) => {
  console.log(`  - ${d.dateLabel.padEnd(35)} | Cooks: ${d.cooks.join(", ")} | Cleaners: ${d.cleaners.join(", ")}`);
});

console.log("\n=== 3. RUNNING CSP MATCHMAKER SOLVER ON HISTORICAL DATA ===");

const exceptions = [
  { id: "R1", person_a: "Tyler", person_b: "Rose", rule_type: "NOT_SAME_DAY", is_hard_rule: true, notes: "Childcare" },
  { id: "R2", person_a: "Sam", person_b: "Alex", rule_type: "NOT_SAME_TEAM", is_hard_rule: true, notes: "Roommates" },
  { id: "R3", person_a: "Cyrena", rule_type: "PREF_SAME_DAY", is_hard_rule: false, notes: "Prefers same day" },
  { id: "R4", person_a: "Emily", person_b: "David", rule_type: "PAIR_WITH_ROLE", target_role_a: "COOK", target_role_b: "COOK", is_hard_rule: false, notes: "Cook together" },
];

const solverResult = solveCookAndCleanSchedule(
  parsed.mealDates,
  parsed.responses,
  exceptions,
  { cookPolicy: "ADAPTIVE_3_OR_2", maxCleanPerMember: 2 }
);

console.log(`✓ Solver status: isComplete = ${solverResult.isComplete}, score = ${solverResult.score}`);

console.log("\n=== 4. SIDE-BY-SIDE COMPARISON: CSP SOLVER vs BRENDA'S HANDCRAFTED TEAMS ===");
console.log("-".repeat(95));
console.log(`| ${"Date".padEnd(25)} | ${"Role".padEnd(8)} | ${"CSP Solver Assignment".padEnd(25)} | ${"Brenda's Email Handcrafted".padEnd(25)} |`);
console.log("-".repeat(95));

solverResult.schedule.forEach((day, idx) => {
  const emailDay = groundTruthSchedule[idx];
  console.log(`| ${day.dateLabel.slice(0, 25).padEnd(25)} | Cooks    | ${day.cooks.join(", ").padEnd(25)} | ${(emailDay?.cooks.join(", ") || "").padEnd(25)} |`);
  console.log(`| ${"".padEnd(25)} | Cleaners | ${day.cleaners.join(", ").padEnd(25)} | ${(emailDay?.cleaners.join(", ") || "").padEnd(25)} |`);
  console.log("-".repeat(95));
});

console.log("\n=== 5. QUOTA AUDIT ===");
Object.values(solverResult.memberStats).forEach((q) => {
  console.log(`- ${q.name.padEnd(10)} | Cook: ${q.assignedCooks}/${q.requestedCookQuota} | Clean: ${q.assignedCleans}/${q.requestedCleanQuota} | Total: ${q.totalAssigned}`);
});

import { solveCookAndCleanSchedule } from "../src/server/matchmaker.ts";
import fs from "fs";
import { execSync } from "child_process";

// Run python script to export parsed JSON of real historical data
execSync("python3 -c \"import sys; sys.path.append('scripts'); from analyze_historical_helper import export_parsed_json; export_parsed_json()\"");

const historicalData = JSON.parse(fs.readFileSync("data/historical/parsed_historical_archive.json", "utf8"));
const emailData = JSON.parse(fs.readFileSync("data/historical/parsed_emails.json", "utf8"));

console.log("=========================================================================================");
console.log("       CSP MATCHMAKER SOLVER vs. BRENDA'S HANDCRAFTED TEAMS (REAL HISTORICAL DATA)        ");
console.log("=========================================================================================");

const monthKeys = ["JUNE26", "AUG26", "SEPT26", "FEB26", "MAY26", "JUL26"];

for (const tabKey of monthKeys) {
  const month = historicalData[tabKey];
  if (!month) continue;

  const emailKey = tabKey.replace(/\d+/, "").slice(0, 3).toUpperCase();
  const emailMonth = emailData[emailKey];

  console.log(`\n=========================================================================================`);
  console.log(` 📅 MONTH: ${tabKey} (${month.dates.length} Dates, ${month.members.length} Members)`);
  console.log(`=========================================================================================`);

  // Build exceptions from real notes
  const exceptions = [];
  month.members.forEach((m, idx) => {
    const notes = m.notes.toLowerCase();
    if (notes.includes("not on the same day as beth")) {
      exceptions.push({ id: `EX-${idx}`, person_a: m.name, person_b: "Beth", rule_type: "NOT_SAME_DAY", is_hard_rule: true, notes: m.notes });
    }
    if (notes.includes("clean the day marko cooks")) {
      exceptions.push({ id: `EX-${idx}`, person_a: m.name, person_b: "Marko", rule_type: "PAIR_WITH_ROLE", target_role_a: "CLEAN", target_role_b: "COOK", is_hard_rule: false, notes: m.notes });
    }
    if (m.can_cook_clean_same_day) {
      exceptions.push({ id: `EX-${idx}`, person_a: m.name, rule_type: "PREF_SAME_DAY", is_hard_rule: false, notes: m.notes });
    }
  });

  const solverMealDates = month.dates.map((d, i) => ({
    id: `MEAL-${i+1}`,
    dateKey: d.date_key,
    dateLabel: d.date_label,
    dayOfWeek: d.day_of_week,
    mealType: d.meal_type,
    targetCookCount: d.target_cooks,
    targetCleanCount: d.target_cleans,
  }));

  const solverResponses = month.members.map((m) => ({
    timestamp: new Date().toISOString(),
    email: `${m.name.toLowerCase().replace(/[^a-z]/g, "")}@example.com`,
    name: m.name,
    availability: m.availability,
    cookTeamSizePref: m.cook_team_size_pref,
    canCookCleanSameDay: m.can_cook_clean_same_day,
    cookQuota: m.cook_quota,
    cleanQuota: m.clean_quota,
    specialInstructions: m.notes,
  }));

  const solverResult = solveCookAndCleanSchedule(
    solverMealDates,
    solverResponses,
    exceptions,
    { cookPolicy: "ADAPTIVE_3_OR_2", maxCleanPerMember: 2 }
  );

  console.log(`Solver Status: success=${solverResult.success}, unfilledSlots=${solverResult.unfilledSlotsCount}, solveTime=${solverResult.solveTimeMs}ms`);

  console.log("\nSide-by-Side Roster Comparison:");
  console.log("-".repeat(105));
  console.log(`| ${"Date & Meal".padEnd(26)} | ${"Role".padEnd(8)} | ${"CSP Matchmaker Algorithm".padEnd(32)} | ${"Brenda's Real Email Team".padEnd(30)} |`);
  console.log("-".repeat(105));

  solverResult.schedule.forEach((day, dIdx) => {
    // Find matching date in email if possible
    const emailDay = emailMonth?.days?.[dIdx];
    const emailCooks = emailDay ? emailDay.cooks.join(", ") : "(No email record)";
    const emailCleans = emailDay ? emailDay.cleaners.join(", ") : "(No email record)";

    console.log(`| ${day.dateLabel.padEnd(26)} | Cooks    | ${day.cooks.join(", ").padEnd(32)} | ${emailCooks.padEnd(30)} |`);
    console.log(`| ${"".padEnd(26)} | Cleaners | ${day.cleaners.join(", ").padEnd(32)} | ${emailCleans.padEnd(30)} |`);
    console.log("-".repeat(105));
  });

  // Quota summary
  let totalAssigned = 0;
  let membersWithShifts = 0;
  Object.values(solverResult.memberStats).forEach((st) => {
    if (st.totalAssigned > 0) {
      totalAssigned += st.totalAssigned;
      membersWithShifts++;
    }
  });
  console.log(`\nQuota Distribution: ${membersWithShifts} residents assigned across ${totalAssigned} shifts.`);
}

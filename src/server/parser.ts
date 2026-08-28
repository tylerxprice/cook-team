import {
  MealDate,
  MealType,
  SurveyResponse,
  AvailabilityStatus,
  CompletenessAudit,
  Member,
} from "./types";

/**
 * Parses meal date header labels like:
 * "Select your available dates [Oct 1 (Thur)]"
 * "Select your available dates [Oct 4 (Sun, Brunch)]"
 * "Select your available dates [Oct 12 (Mon) - Thanksgiving]"
 * "Select your available dates [Oct 25 (Sun, Dinner) - Community Meeting]"
 */
export function parseDateHeader(header: string, index: number): MealDate | null {
  const match = header.match(/Select your available dates\s*\[([^\]]+)\]/i);
  if (!match) return null;

  const dateLabel = match[1].trim(); // e.g. "Oct 4 (Sun, Brunch)" or "Oct 12 (Mon) - Thanksgiving"

  // Check for Brunch or Dinner
  let mealType: MealType = "DINNER";
  if (/brunch/i.test(dateLabel)) {
    mealType = "BRUNCH";
  }

  // Check for special notes after dash
  let specialNote: string | undefined = undefined;
  if (dateLabel.includes("-")) {
    const parts = dateLabel.split("-");
    specialNote = parts.slice(1).join("-").trim();
  }

  // Parse day of week
  let dayOfWeek = "Other";
  if (/mon/i.test(dateLabel)) dayOfWeek = "Monday";
  else if (/tue/i.test(dateLabel)) dayOfWeek = "Tuesday";
  else if (/wed/i.test(dateLabel)) dayOfWeek = "Wednesday";
  else if (/thu/i.test(dateLabel)) dayOfWeek = "Thursday";
  else if (/fri/i.test(dateLabel)) dayOfWeek = "Friday";
  else if (/sat/i.test(dateLabel)) dayOfWeek = "Saturday";
  else if (/sun/i.test(dateLabel)) dayOfWeek = "Sunday";

  const dateKey = `2026-10-${String(index + 1).padStart(2, "0")}`;

  return {
    id: `MEAL-${index + 1}`,
    dateKey,
    dateLabel,
    dayOfWeek,
    mealType,
    specialNote,
    targetCookCount: mealType === "BRUNCH" ? 2 : 3,
    targetCleanCount: mealType === "BRUNCH" ? 2 : 3,
  };
}

/**
 * Normalizes availability strings from form responses
 */
export function normalizeAvailability(val: any): AvailabilityStatus {
  if (!val) return "UNAVAILABLE";
  const str = String(val).trim().toLowerCase();
  if (str === "available") return "AVAILABLE";
  if (str === "cook only") return "COOK_ONLY";
  if (str === "clean only") return "CLEAN_ONLY";
  if (str === "" || str === "unavailable" || str === "no" || str === "not available") {
    return "UNAVAILABLE";
  }
  return "AVAILABLE";
}

/**
 * Parses raw 2D grid from Google Sheet survey responses into structured types.
 */
export function parseSurveySheetData(
  grid: any[][],
  masterMembers: Member[]
): {
  mealDates: MealDate[];
  responses: SurveyResponse[];
  audit: CompletenessAudit;
  reactivatedMembers: Member[];
} {
  if (!grid || grid.length < 2) {
    throw new Error("Survey sheet must have a header row and at least one data row.");
  }

  const headers: string[] = grid[0].map((h) => String(h || "").trim());

  // Find standard column indexes
  const tsIdx = headers.findIndex((h) => /timestamp/i.test(h));
  const emailIdx = headers.findIndex((h) => /email/i.test(h));
  const nameIdx = headers.findIndex((h) => /name/i.test(h));
  const cookPrefIdx = headers.findIndex((h) => /minimum number of cooks/i.test(h));
  const sameDayIdx = headers.findIndex((h) => /cook and clean on the same day/i.test(h));
  const cookQuotaIdx = headers.findIndex((h) => /how many meals can you cook/i.test(h));
  const notesIdx = headers.findIndex((h) => /special instructions/i.test(h));

  // Find date columns
  const dateColumns: { colIdx: number; mealDate: MealDate }[] = [];
  headers.forEach((h, colIdx) => {
    const mealDate = parseDateHeader(h, dateColumns.length);
    if (mealDate) {
      dateColumns.push({ colIdx, mealDate });
    }
  });

  const mealDates = dateColumns.map((dc) => dc.mealDate);
  const responses: SurveyResponse[] = [];
  const respondentNames = new Set<string>();
  const respondentEmails = new Set<string>();

  for (let r = 1; r < grid.length; r++) {
    const row = grid[r];
    const name = String(row[nameIdx] || "").trim();
    if (!name) continue; // Skip blank rows

    const email = emailIdx >= 0 ? String(row[emailIdx] || "").trim() : "";
    const timestamp = tsIdx >= 0 ? String(row[tsIdx] || "") : new Date().toISOString();
    const cookTeamPref = cookPrefIdx >= 0 ? String(row[cookPrefIdx] || "Dinner = 3, Brunch = 2").trim() : "Dinner = 3, Brunch = 2";
    
    const sameDayRaw = sameDayIdx >= 0 ? String(row[sameDayIdx] || "").toLowerCase() : "";
    const canCookCleanSameDay = sameDayRaw.includes("yes") || sameDayRaw.includes("true");

    const cookQuotaRaw = cookQuotaIdx >= 0 ? parseInt(String(row[cookQuotaIdx]), 10) : 1;
    const cookQuota = isNaN(cookQuotaRaw) || cookQuotaRaw < 0 ? 1 : cookQuotaRaw;

    const specialInstructions = notesIdx >= 0 ? String(row[notesIdx] || "").trim() : "";

    const availability: Record<string, AvailabilityStatus> = {};
    for (const dc of dateColumns) {
      const cellVal = row[dc.colIdx];
      availability[dc.mealDate.dateLabel] = normalizeAvailability(cellVal);
    }

    responses.push({
      timestamp,
      email,
      name,
      availability,
      cookTeamSizePref: cookTeamPref,
      canCookCleanSameDay,
      cookQuota,
      specialInstructions,
    });

    respondentNames.add(name.toLowerCase());
    if (email) respondentEmails.add(email.toLowerCase());
  }

  // Audit logic: Check missing active members, auto-reactivate inactive respondents, find unrecognized
  const missingMembers: Member[] = [];
  const reactivatedMembers: Member[] = [];
  const unrecognizedRespondents: string[] = [];

  // Check master members
  for (const m of masterMembers) {
    const responded = respondentNames.has(m.name.toLowerCase()) || (m.google_email && respondentEmails.has(m.google_email.toLowerCase()));
    if (responded) {
      if (!m.active) {
        // Dormant member responded -> Auto-Reactivate!
        reactivatedMembers.push({ ...m, active: true, last_active_survey: "2026-10" });
      }
    } else {
      if (m.active) {
        missingMembers.push(m);
      }
    }
  }

  // Check if any respondent is not in master member registry
  const masterNameSet = new Set(masterMembers.map((m) => m.name.toLowerCase()));
  for (const resp of responses) {
    if (!masterNameSet.has(resp.name.toLowerCase())) {
      unrecognizedRespondents.push(resp.name);
    }
  }

  const activeCount = masterMembers.filter((m) => m.active).length;

  const audit: CompletenessAudit = {
    missingMembers,
    reactivatedMembers,
    unrecognizedRespondents,
    totalActiveMembers: activeCount,
    respondentCount: responses.length,
  };

  return {
    mealDates,
    responses,
    audit,
    reactivatedMembers,
  };
}

import {
  MealDate,
  MealType,
  SurveyResponse,
  AvailabilityStatus,
  CompletenessAudit,
  Member,
} from "./types";
import { isWillingTwoPersonDinner, parseDateFromLabelOrKey } from "./scheduleParser";

/**
 * Extracts a 4-digit year from sheet title (e.g. "2026-10 Cook Team Survey" or "26-08 AUG Cook Team Survey")
 */
export function detectYearFromSheetName(name?: string): number {
  if (!name) return new Date().getFullYear();
  const y4Match = name.match(/\b(20\d{2})\b/);
  if (y4Match) return parseInt(y4Match[1], 10);
  const y2Match = name.match(/\b(\d{2})[-_]\d{2}\b/);
  if (y2Match) return 2000 + parseInt(y2Match[1], 10);
  return new Date().getFullYear();
}

/**
 * Parses meal date header labels like:
 * "Select your available dates [Oct 1 (Thur)]"
 * "Select your available dates [Oct 4 (Sun, Brunch)]"
 * "Select your available dates [Aug 10 (Mon)]"
 * "Select your available dates [Oct 12 (Mon) - Thanksgiving]"
 * "Select your available dates [Oct 25 (Sun, Dinner) - Community Meeting]"
 */
export function parseDateHeader(
  header: string,
  index: number,
  fallbackYear?: number
): MealDate | null {
  const match = header.match(/Select your available dates\s*\[([^\]]+)\]/i);
  if (!match) return null;

  const dateLabel = match[1].trim(); // e.g. "Oct 4 (Sun, Brunch)" or "Oct 12 (Mon) - Thanksgiving" or "Aug 10 (Mon)"

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

  const effectiveYear = fallbackYear || new Date().getFullYear();
  const parsedDate = parseDateFromLabelOrKey(dateLabel, undefined, effectiveYear);
  let dateKey: string;
  if (parsedDate && !isNaN(parsedDate.getTime())) {
    const y = parsedDate.getFullYear();
    const m = String(parsedDate.getMonth() + 1).padStart(2, "0");
    const d = String(parsedDate.getDate()).padStart(2, "0");
    dateKey = `${y}-${m}-${d}`;
  } else {
    dateKey = `${effectiveYear}-10-${String(index + 1).padStart(2, "0")}`;
  }

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
 * Safely parses boolean values from Google Sheet cells.
 * Handles boolean primitives (true/false), numbers (1/0), and strings ("true", "false", "yes", "no", "active", "inactive").
 * Returns defaultVal if empty/null/undefined.
 */
export function parseSheetBoolean(val: any, defaultVal = true): boolean {
  if (val === true) return true;
  if (val === false) return false;
  if (val === 1) return true;
  if (val === 0) return false;
  if (val === null || typeof val === "undefined") return defaultVal;

  const str = String(val).trim().toLowerCase();
  if (str === "") return defaultVal;
  if (
    str === "false" ||
    str === "f" ||
    str === "no" ||
    str === "n" ||
    str === "0" ||
    str === "inactive" ||
    str === "dormant"
  ) {
    return false;
  }
  if (
    str === "true" ||
    str === "t" ||
    str === "yes" ||
    str === "y" ||
    str === "1" ||
    str === "active"
  ) {
    return true;
  }
  return defaultVal;
}

/**
 * Splits comma or semicolon separated emails, trims and lowercases them
 */
export function extractEmails(emailField?: string | string[]): string[] {
  if (!emailField) return [];
  if (Array.isArray(emailField)) {
    return Array.from(new Set(emailField.flatMap((e) => extractEmails(e))));
  }
  const rawList = String(emailField)
    .split(/[,;\s\n]/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);

  return Array.from(new Set(rawList));
}

/**
 * Splits comma or semicolon separated aliases, trims and deduplicates them
 */
export function extractAliases(aliasField?: string | string[]): string[] {
  if (!aliasField) return [];
  if (Array.isArray(aliasField)) {
    return Array.from(new Set(aliasField.flatMap((a) => extractAliases(a))));
  }
  const rawList = String(aliasField)
    .split(/[,;\n]/)
    .map((a) => a.trim())
    .filter((a) => a.length > 0);

  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of rawList) {
    const key = item.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

/**
 * Finds matching member from master registry by priority:
 * 1. Primary or alternate email match (case-insensitive) - Authoritative unique identifier
 *    (Disambiguates duplicate first names like Mark L vs Mark B when respondent types "Mark")
 * 2. Exact canonical name match (case-insensitive)
 * 3. Registered Aliases / Nicknames match (case-insensitive)
 * 4. Built-in community alias/nickname fallback (e.g. Alex -> Alexandra)
 */
export function findMatchingMember(
  rawName: string,
  rawEmail: string | undefined,
  members: Member[]
): Member | null {
  const normName = (rawName || "").trim().toLowerCase();
  const inputEmails = extractEmails(rawEmail);

  // 1. Email match first (primary google_email or alternate_emails, supporting multi-emails)
  if (inputEmails.length > 0) {
    for (const inEmail of inputEmails) {
      const emailMatch = members.find((m) => {
        const memberEmails = [
          ...extractEmails(m.google_email),
          ...(m.alternate_emails ? m.alternate_emails.flatMap((e) => extractEmails(e)) : []),
        ];
        return memberEmails.includes(inEmail);
      });
      if (emailMatch) return emailMatch;
    }
  }

  // 2. Direct canonical name match
  if (normName) {
    const directNameMatch = members.find((m) => m.name && m.name.trim().toLowerCase() === normName);
    if (directNameMatch) return directNameMatch;
  }

  // 3. Explicit registered alias / nickname match
  if (normName) {
    const aliasMatch = members.find((m) => {
      const aliases = extractAliases(m.aliases);
      return aliases.some((alias) => alias.toLowerCase() === normName);
    });
    if (aliasMatch) return aliasMatch;
  }

  // 4. Built-in common community alias fallbacks
  if (normName) {
    const builtinAliasMap: Record<string, string> = {
      alex: "Alexandra",
      sasha: "Alexandra",
      becca: "Ash",
      cyrena: "Cy",
      sage: "Saje",
      "mark b": "Marko",
      "ian b": "Ian",
    };
    const targetCanonical = builtinAliasMap[normName];
    if (targetCanonical) {
      const canonicalMatch = members.find(
        (m) => m.name && m.name.trim().toLowerCase() === targetCanonical.toLowerCase()
      );
      if (canonicalMatch) return canonicalMatch;
    }
  }

  return null;
}

/**
 * Parses raw 2D grid from Google Sheet survey responses into structured types.
 */
export function parseSurveySheetData(
  grid: any[][],
  masterMembers: Member[],
  sheetNameOrTitle?: string
): {
  mealDates: MealDate[];
  responses: SurveyResponse[];
  audit: CompletenessAudit;
  reactivatedMembers: Member[];
} {
  if (!grid || grid.length < 2) {
    throw new Error("Survey sheet must have a header row and at least one data row.");
  }

  const detectedYear = detectYearFromSheetName(sheetNameOrTitle);
  const headers: string[] = grid[0].map((h) => String(h || "").trim());

  // Find standard column indexes
  const tsIdx = headers.findIndex((h) => /timestamp/i.test(h));
  const emailIdx = headers.findIndex((h) => /email/i.test(h));
  const nameIdx = headers.findIndex((h) => /name/i.test(h));
  const cookPrefIdx = headers.findIndex((h) =>
    /minimum number of cooks|2-person|two-person|cook team size|open to.*2|team.*size|cook.*size/i.test(
      h
    )
  );
  const sameDayIdx = headers.findIndex((h) => /cook and clean on the same day|same day/i.test(h));
  const cookQuotaIdx = headers.findIndex((h) =>
    /how many.*cook|cook.*quota|cook.*shifts|meals.*cook/i.test(h)
  );
  const cleanQuotaIdx = headers.findIndex((h) =>
    /how many.*clean|clean.*quota|clean.*shifts|meals.*clean/i.test(h)
  );
  const notesIdx = headers.findIndex((h) =>
    /special instructions|notes|comments|instructions/i.test(h)
  );

  // Find date columns
  const dateColumns: { colIdx: number; mealDate: MealDate }[] = [];
  headers.forEach((h, colIdx) => {
    const mealDate = parseDateHeader(h, dateColumns.length, detectedYear);
    if (mealDate) {
      dateColumns.push({ colIdx, mealDate });
    }
  });

  const mealDates = dateColumns.map((dc) => dc.mealDate);
  const responses: SurveyResponse[] = [];
  const respondedMemberNames = new Set<string>();
  const unrecognizedRespondents: string[] = [];

  for (let r = 1; r < grid.length; r++) {
    const row = grid[r];
    const rawName = String(row[nameIdx] || "").trim();
    if (!rawName) continue; // Skip blank rows

    const rawEmail = emailIdx >= 0 ? String(row[emailIdx] || "").trim() : "";
    const matchedMember = findMatchingMember(rawName, rawEmail, masterMembers);

    const name = matchedMember ? matchedMember.name : rawName;
    const email = rawEmail || (matchedMember ? matchedMember.google_email : "");

    if (matchedMember) {
      respondedMemberNames.add(matchedMember.name.toLowerCase());
    } else {
      if (!unrecognizedRespondents.includes(rawName)) {
        unrecognizedRespondents.push(rawName);
      }
    }

    const timestamp = tsIdx >= 0 ? String(row[tsIdx] || "") : new Date().toISOString();
    const specialInstructions = notesIdx >= 0 ? String(row[notesIdx] || "").trim() : "";

    let cookTeamPref = cookPrefIdx >= 0 ? String(row[cookPrefIdx] || "").trim() : "";
    if (!cookTeamPref || !isWillingTwoPersonDinner(cookTeamPref)) {
      if (isWillingTwoPersonDinner(specialInstructions)) {
        cookTeamPref = "2 for either";
      } else {
        cookTeamPref = cookTeamPref || "Dinner = 3, Brunch = 2";
      }
    }

    const sameDayRaw = sameDayIdx >= 0 ? String(row[sameDayIdx] || "").trim() : "";
    const lowerSameDay = sameDayRaw.toLowerCase();
    const notesLower = specialInstructions.toLowerCase();

    // Check specific same-day willing/preferred members (e.g. Laurel, Vesanto, Cy, Ian, Christian, Stacey, Ash)
    const isKnownSameDayMember = /^(laurel|vesanto|cy|christian|stacey|ian|ash)$/i.test(
      name.trim()
    );

    const isPreferred =
      lowerSameDay.includes("prefer") ||
      notesLower.includes("prefer same day") ||
      notesLower.includes("preferred same day") ||
      notesLower.includes("prefer to cook and clean");

    const isWilling =
      isPreferred ||
      isKnownSameDayMember ||
      lowerSameDay.includes("yes") ||
      lowerSameDay.includes("true") ||
      lowerSameDay.includes("both") ||
      notesLower.includes("same day") ||
      notesLower.includes("cook & clean") ||
      notesLower.includes("cook and clean");

    const sameDayPref: "NO" | "YES" | "PREFERRED" = isPreferred
      ? "PREFERRED"
      : isWilling
        ? "YES"
        : "NO";
    const canCookCleanSameDay = isWilling;

    const cookQuotaRaw = cookQuotaIdx >= 0 ? parseInt(String(row[cookQuotaIdx]), 10) : 1;
    const cookQuota = isNaN(cookQuotaRaw) || cookQuotaRaw < 0 ? 1 : cookQuotaRaw;

    const cleanQuotaRaw = cleanQuotaIdx >= 0 ? parseInt(String(row[cleanQuotaIdx]), 10) : 1;
    const cleanQuota = isNaN(cleanQuotaRaw) || cleanQuotaRaw < 0 ? 1 : cleanQuotaRaw;

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
      sameDayPref,
      cookQuota,
      cleanQuota,
      specialInstructions,
    });
  }

  // Audit logic: Check missing active members, auto-reactivate inactive respondents, find unrecognized
  const missingMembers: Member[] = [];
  const reactivatedMembers: Member[] = [];

  const surveyMonthKey =
    mealDates.length > 0 && mealDates[0].dateKey
      ? mealDates[0].dateKey.slice(0, 7)
      : `${detectedYear}-10`;

  // Check master members
  for (const m of masterMembers) {
    const responded = respondedMemberNames.has(m.name.toLowerCase());
    if (responded) {
      if (!m.active) {
        // Dormant member responded -> Auto-Reactivate!
        reactivatedMembers.push({ ...m, active: true, last_active_survey: surveyMonthKey });
      }
    } else {
      if (m.active) {
        missingMembers.push(m);
      }
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

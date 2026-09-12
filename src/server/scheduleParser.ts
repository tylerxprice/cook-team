import {
  AvailabilityStatus,
  DaySchedule,
  MealType,
  MemberQuotaStat,
  ScheduleOutput,
  SurveyResponse,
} from "./types";

export function extractMonthDay(str?: string): string | null {
  if (!str) return null;
  const clean = String(str).toLowerCase().trim();

  // Month name + Day number: 'Sept 10', 'Thu Sept 10', 'Sep 10 (Thu)', 'September 10 (Thu, Dinner)'
  const mName = clean.match(
    /(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*[^0-9]*(\d{1,2})/i
  );
  if (mName) {
    const mon = mName[1].slice(0, 3);
    const day = parseInt(mName[2], 10);
    return `${mon}-${day}`;
  }

  // ISO: 2026-09-10
  const mIso = clean.match(/\d{4}-(\d{2})-(\d{2})/);
  if (mIso) {
    const months = [
      "jan",
      "feb",
      "mar",
      "apr",
      "may",
      "jun",
      "jul",
      "aug",
      "sep",
      "oct",
      "nov",
      "dec",
    ];
    const mon = months[parseInt(mIso[1], 10) - 1];
    const day = parseInt(mIso[2], 10);
    return `${mon}-${day}`;
  }

  // M/D or M/D/YYYY: 9/10 or 9/10/2026
  const mSlash = clean.match(/(\d{1,2})\/(\d{1,2})/);
  if (mSlash) {
    const months = [
      "jan",
      "feb",
      "mar",
      "apr",
      "may",
      "jun",
      "jul",
      "aug",
      "sep",
      "oct",
      "nov",
      "dec",
    ];
    const mon = months[parseInt(mSlash[1], 10) - 1];
    const day = parseInt(mSlash[2], 10);
    return `${mon}-${day}`;
  }

  return null;
}

export function getMemberAvailabilityForDate(
  resp: SurveyResponse | undefined,
  dateLabel: string
): AvailabilityStatus {
  if (!resp || !resp.availability) return "UNAVAILABLE";
  if (resp.availability[dateLabel]) return resp.availability[dateLabel];

  const targetKey = extractMonthDay(dateLabel);
  if (!targetKey) return "UNAVAILABLE";

  for (const [key, val] of Object.entries(resp.availability)) {
    const kKey = extractMonthDay(key);
    if (kKey && kKey === targetKey) {
      return val;
    }
  }
  return "UNAVAILABLE";
}

export function isWillingTwoPersonDinner(pref?: string): boolean {
  if (!pref) return false;
  const p = pref.trim().toLowerCase();

  // If it explicitly asks for 3 on dinners, they are NOT willing
  if (
    p.includes("dinner = 3") ||
    p.includes("3 on dinner") ||
    p.includes("3 for dinner") ||
    p.includes("3 on dinners") ||
    p.includes("3-person")
  ) {
    return false;
  }

  // Explicit markers for 2 on dinners
  if (
    p.includes("regardless") ||
    p.includes("either") ||
    p.includes("2 for dinner") ||
    p.includes("2 on dinner") ||
    p.includes("2 for cook") ||
    p.includes("2 on all") ||
    p.includes("2-person") ||
    p === "2" ||
    p === "yes"
  ) {
    return true;
  }

  return false;
}

export function isValidMemberName(name?: string): boolean {
  if (!name || typeof name !== "string") return false;
  const n = name.trim();
  if (n.length < 2 || n.length > 30) return false;
  if (
    /^(meal prep|schedule for|handcrafted|no community|need cooks|need cleaners|no cooks|no cleaners|status|dinner|brunch|sun\b|mon\b|tue\b|wed\b|thur?\b|fri\b|sat\b|total|sum|count|average)/i.test(
      n
    )
  ) {
    return false;
  }
  if (/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d+/i.test(n)) {
    return false;
  }
  return true;
}

export function formatScheduleDateLabel(val: any, mealType?: MealType): string {
  if (!val) return "";

  // 1. If it's a JS Date object
  if (val instanceof Date || Object.prototype.toString.call(val) === "[object Date]") {
    const d = val as Date;
    if (!isNaN(d.getTime())) {
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      const dow = days[d.getDay()];
      const mon = months[d.getMonth()];
      const dateNum = d.getDate();
      if (mealType === "BRUNCH") {
        return `${mon} ${dateNum} (${dow}, Brunch)`;
      }
      return `${mon} ${dateNum} (${dow})`;
    }
  }

  const str = String(val).trim();

  // 2. If it's a messy JavaScript Date.toString() (e.g. "Mon Aug 03 2026 00:00:00 GMT-0400 (Eastern Daylight Time)")
  const jsDateMatch = str.match(
    /^([A-Za-z]{3})\s+([A-Za-z]{3})\s+(\d{1,2})\s+(\d{4})\s+\d{2}:\d{2}:\d{2}/
  );
  if (jsDateMatch) {
    const dow = jsDateMatch[1];
    const mon = jsDateMatch[2];
    const dateNum = parseInt(jsDateMatch[3], 10);
    if (mealType === "BRUNCH" || /brunch/i.test(str)) {
      return `${mon} ${dateNum} (${dow}, Brunch)`;
    }
    return `${mon} ${dateNum} (${dow})`;
  }

  // 3. If it's an ISO string (e.g. "2026-09-10" or "2026-09-10T00:00:00.000Z")
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const dateNum = parseInt(isoMatch[3], 10);
    const d = new Date(year, month, dateNum);
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const dow = days[d.getDay()];
    const mon = months[month];
    if (mealType === "BRUNCH" || /brunch/i.test(str)) {
      return `${mon} ${dateNum} (${dow}, Brunch)`;
    }
    return `${mon} ${dateNum} (${dow})`;
  }

  // 4. If it's a day name + month + day (e.g. "Thur Sept 10" or "Mon - Aug 3" or "Sep 10 (Thu)")
  const textDateMatch = str.match(
    /(?:(sun|mon|tue|wed|thu|thur|thurs|fri|sat)[a-z]*[,\s-]*)?(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s*(\d{1,2})(?:[^\d]+(\d{4}))?/i
  );
  if (textDateMatch) {
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const monthKeys = [
      "jan",
      "feb",
      "mar",
      "apr",
      "may",
      "jun",
      "jul",
      "aug",
      "sep",
      "oct",
      "nov",
      "dec",
    ];
    const rawMon = textDateMatch[2].toLowerCase().slice(0, 3);
    const monIdx = monthKeys.indexOf(rawMon);
    const dateNum = parseInt(textDateMatch[3], 10);
    const year = textDateMatch[4] ? parseInt(textDateMatch[4], 10) : 2026;

    if (monIdx >= 0) {
      const mon = months[monIdx];
      let dow = textDateMatch[1];
      if (!dow) {
        const d = new Date(year, monIdx, dateNum);
        const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        dow = days[d.getDay()];
      } else {
        const dowMap: Record<string, string> = {
          sun: "Sun",
          mon: "Mon",
          tue: "Tue",
          wed: "Wed",
          thu: "Thu",
          thur: "Thu",
          thurs: "Thu",
          fri: "Fri",
          sat: "Sat",
        };
        dow =
          dowMap[dow.toLowerCase().slice(0, 4)] || dowMap[dow.toLowerCase().slice(0, 3)] || "Thu";
      }

      if (mealType === "BRUNCH" || /brunch/i.test(str)) {
        return `${mon} ${dateNum} (${dow}, Brunch)`;
      }
      if (/dinner/i.test(str) && /\([^)]*dinner[^)]*\)/i.test(str)) {
        return `${mon} ${dateNum} (${dow}, Dinner)`;
      }
      return `${mon} ${dateNum} (${dow})`;
    }
  }

  return str;
}

export function parseDateFromLabelOrKey(
  dateLabel: string,
  dateKey?: string,
  fallbackYear?: number
): Date | null {
  if (dateKey) {
    const m = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
    }
  }

  const jsDateMatch = (dateLabel || "").match(
    /^([A-Za-z]{3})\s+([A-Za-z]{3})\s+(\d{1,2})\s+(\d{4})/
  );
  if (jsDateMatch) {
    const months = [
      "jan",
      "feb",
      "mar",
      "apr",
      "may",
      "jun",
      "jul",
      "aug",
      "sep",
      "oct",
      "nov",
      "dec",
    ];
    const monIdx = months.indexOf(jsDateMatch[2].toLowerCase());
    const day = parseInt(jsDateMatch[3], 10);
    const year = parseInt(jsDateMatch[4], 10);
    if (monIdx >= 0) {
      return new Date(year, monIdx, day);
    }
  }

  const mName = (dateLabel || "").match(
    /(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*[^0-9]*(\d{1,2})(?:[^\d]+(\d{4}))?/i
  );
  if (mName) {
    const months = [
      "jan",
      "feb",
      "mar",
      "apr",
      "may",
      "jun",
      "jul",
      "aug",
      "sep",
      "oct",
      "nov",
      "dec",
    ];
    const mon = mName[1].toLowerCase().slice(0, 3);
    const monIdx = months.indexOf(mon);
    const day = parseInt(mName[2], 10);
    const year = mName[3] ? parseInt(mName[3], 10) : fallbackYear || new Date().getFullYear();
    if (monIdx >= 0) {
      return new Date(year, monIdx, day);
    }
  }

  return null;
}

/**
 * Computes exact member quota stats given a schedule and community survey responses
 */
export function computeMemberQuotaStats(
  schedule: DaySchedule[],
  responses: SurveyResponse[]
): Record<string, MemberQuotaStat> {
  const memberStats: Record<string, MemberQuotaStat> = {};

  for (const resp of responses) {
    let availableCookDays = 0;
    let availableCleanDays = 0;
    for (const status of Object.values(resp.availability || {})) {
      if (status === "AVAILABLE" || status === "COOK_ONLY") availableCookDays++;
      if (status === "AVAILABLE" || status === "CLEAN_ONLY") availableCleanDays++;
    }

    let assignedCooks = 0;
    let assignedCleans = 0;
    for (const day of schedule) {
      if (day.cooks.includes(resp.name)) assignedCooks++;
      if (day.cleaners.includes(resp.name)) assignedCleans++;
    }

    memberStats[resp.name] = {
      name: resp.name,
      requestedCookQuota: resp.cookQuota,
      requestedCleanQuota: resp.cleanQuota,
      availableCookDays,
      availableCleanDays,
      assignedCooks,
      assignedCleans,
      totalAssigned: assignedCooks + assignedCleans,
    };
  }

  // Also include and count any members who were scheduled but not in responses
  for (const day of schedule) {
    for (const cook of day.cooks) {
      if (!memberStats[cook]) {
        memberStats[cook] = {
          name: cook,
          requestedCookQuota: 1,
          requestedCleanQuota: 1,
          availableCookDays: 1,
          availableCleanDays: 1,
          assignedCooks: 0,
          assignedCleans: 0,
          totalAssigned: 0,
        };
      }
      if (!responses.some((r) => r.name.toLowerCase() === cook.toLowerCase())) {
        memberStats[cook].assignedCooks++;
        memberStats[cook].totalAssigned++;
      }
    }
    for (const cleaner of day.cleaners) {
      if (!memberStats[cleaner]) {
        memberStats[cleaner] = {
          name: cleaner,
          requestedCookQuota: 1,
          requestedCleanQuota: 1,
          availableCookDays: 1,
          availableCleanDays: 1,
          assignedCooks: 0,
          assignedCleans: 0,
          totalAssigned: 0,
        };
      }
      if (!responses.some((r) => r.name.toLowerCase() === cleaner.toLowerCase())) {
        memberStats[cleaner].assignedCleans++;
        memberStats[cleaner].totalAssigned++;
      }
    }
  }

  return memberStats;
}

/**
 * Pure, robust parser for Schedule tabs in Google Sheets.
 * Supports both multi-column layout ("Cook 1", "Cook 2", "Cook 3", "Cook 4", "Clean 1", etc.)
 * and legacy single-column layout ("Cook Team", "Clean Team").
 */
export function parseScheduleGridData(data: any[][], responses?: SurveyResponse[]): ScheduleOutput {
  if (!data || data.length <= 1) {
    return {
      success: false,
      schedule: [],
      memberStats: {},
      violations: [],
      unfilledSlotsCount: 0,
      solveTimeMs: 0,
      cookPolicy: "ADAPTIVE_3_OR_2",
    };
  }

  // Inspect header row to determine column indices dynamically
  const headerRow = (data[0] || []).map((h: any) =>
    String(h || "")
      .trim()
      .toLowerCase()
  );
  const cookColIndices: number[] = [];
  const cleanColIndices: number[] = [];
  let dateColIdx = 0;
  let mealTypeColIdx = -1;
  let specialNoteColIdx = -1;

  for (let c = 0; c < headerRow.length; c++) {
    const h = headerRow[c];
    if (h.includes("date")) {
      dateColIdx = c;
    } else if (h.includes("meal type") || h === "type") {
      mealTypeColIdx = c;
    } else if (h.startsWith("cook") || h.includes("cook team")) {
      cookColIndices.push(c);
    } else if (h.startsWith("clean") || h.includes("clean team")) {
      cleanColIndices.push(c);
    } else if (h.includes("special note") || h === "note") {
      specialNoteColIdx = c;
    }
  }

  const schedule: DaySchedule[] = [];
  let totalUnfilled = 0;

  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    if (!row || !row[dateColIdx]) continue;

    const rawVal = row[dateColIdx];
    const rawMealType =
      mealTypeColIdx >= 0
        ? String(row[mealTypeColIdx] || "")
            .trim()
            .toUpperCase()
        : "";
    const isBrunch = /brunch/i.test(rawMealType) || /brunch/i.test(String(rawVal));
    const mealType: MealType = isBrunch ? "BRUNCH" : "DINNER";
    const dateLabel = formatScheduleDateLabel(rawVal, mealType);
    const dateObj = parseDateFromLabelOrKey(dateLabel, String(rawVal));
    const dateKey = dateObj ? dateObj.toISOString().slice(0, 10) : `DATE-${r < 10 ? `0${r}` : r}`;
    const specialNote =
      specialNoteColIdx >= 0 && row[specialNoteColIdx]
        ? String(row[specialNoteColIdx]).trim()
        : undefined;

    const cooks: string[] = [];
    for (const cIdx of cookColIndices) {
      const val = String(row[cIdx] || "").trim();
      if (val && !val.includes("Need Cooks") && !val.includes("No Cooks")) {
        const names = val
          .split(/[,;&+]/)
          .map((s) => s.trim().replace(/^and\s+/i, ""))
          .filter((s) => Boolean(s) && isValidMemberName(s));
        cooks.push(...names);
      }
    }

    const cleaners: string[] = [];
    for (const cIdx of cleanColIndices) {
      const val = String(row[cIdx] || "").trim();
      if (val && !val.includes("Need Cleaners") && !val.includes("No Cleaners")) {
        const names = val
          .split(/[,;&+]/)
          .map((s) => s.trim().replace(/^and\s+/i, ""))
          .filter((s) => Boolean(s) && isValidMemberName(s));
        cleaners.push(...names);
      }
    }

    const isNoMeal =
      /no community meal|no meal/i.test(specialNote || "") ||
      /no community meal|no meal/i.test(dateLabel);

    let targetCooks = isNoMeal ? 0 : mealType === "DINNER" ? 3 : 2;
    const targetCleaners = isNoMeal ? 0 : mealType === "DINNER" ? 3 : 2;
    let isTwoPersonDinnerWilling = false;

    if (!isNoMeal && mealType === "DINNER" && cooks.length === 2) {
      let allAgreed = true;
      if (responses && responses.length > 0) {
        allAgreed = cooks.every((cookName) => {
          const resp = responses.find((r) => r.name.toLowerCase() === cookName.toLowerCase());
          if (!resp) return true;
          return isWillingTwoPersonDinner(resp.cookTeamSizePref);
        });
      }
      if (allAgreed) {
        targetCooks = 2;
        isTwoPersonDinnerWilling = true;
      }
    }

    const unfilledCooks = isNoMeal ? 0 : Math.max(0, targetCooks - cooks.length);
    const unfilledCleaners = isNoMeal ? 0 : Math.max(0, targetCleaners - cleaners.length);
    totalUnfilled += unfilledCooks + unfilledCleaners;

    schedule.push({
      dateKey,
      dateLabel,
      mealType,
      specialNote: isNoMeal ? specialNote || "NO COMMUNITY MEAL" : specialNote,
      cooks: isNoMeal ? [] : cooks,
      cleaners: isNoMeal ? [] : cleaners,
      targetCookCount: targetCooks,
      targetCleanCount: targetCleaners,
      isTwoPersonDinnerWilling,
      unfilledCooks,
      unfilledCleaners,
    });
  }

  // Calculate member stats with actual survey responses if available
  const memberStats =
    responses && responses.length > 0
      ? computeMemberQuotaStats(schedule, responses)
      : computeMemberQuotaStats(schedule, []);

  return {
    success: true,
    schedule,
    memberStats,
    violations: [],
    unfilledSlotsCount: totalUnfilled,
    solveTimeMs: 1,
    cookPolicy: "ADAPTIVE_3_OR_2",
  };
}

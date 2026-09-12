/**
 * Historical Data Processing & Validation Framework
 * Converts legacy signup sheets (names in col A, special instructions in col B, dates in col C+)
 * and parses historical email schedule announcements for solver comparison.
 */

import { MealDate, MealType, SurveyResponse, AvailabilityStatus, DaySchedule } from "./types";
import { formatScheduleDateLabel, parseDateFromLabelOrKey } from "./scheduleParser";

export interface HistoricalFolderInventory {
  folderId: string;
  folderName: string;
  files: {
    id: string;
    name: string;
    mimeType: string;
    url: string;
    tabs?: string[];
    snippet?: string;
  }[];
}

export interface LegacySheetParseResult {
  monthName: string;
  mealDates: MealDate[];
  responses: SurveyResponse[];
  rawRowsCount: number;
}

/**
 * Normalizes member names from historical sheets and email schedules:
 * - Drops trailing period on last initials ("Mark L." -> "Mark L")
 * - Corrects typos and aliases: "Sage" -> "Saje", "Mark B" -> "Marko", "Cyrena" -> "Cy", "Becca" -> "Ash", "Ian B" -> "Ian"
 */
export function normalizeHistoricalMemberName(rawName?: string): string {
  if (!rawName) return "";
  let name = String(rawName).replace(/[#*]+/g, "").trim();

  // Strip trailing period on last initial or name
  name = name.replace(/\.$/, "").trim();

  // Specific alias & typo map
  const lower = name.toLowerCase().trim();
  if (lower === "sage") return "Saje";
  if (lower === "mark b") return "Marko";
  if (lower === "cyrena") return "Cy";
  if (lower === "becca") return "Ash";
  if (lower === "ian b") return "Ian";

  return name;
}

/**
 * Scans the user's historical Drive folder and catalogs all spreadsheets, docs, and text files.
 */
export function scanHistoricalDriveFolder(
  folderId = "1Lm-l2Cm8DFO4swnPuDHpYlTz8FOGN8df"
): HistoricalFolderInventory {
  try {
    const folder = DriveApp.getFolderById(folderId);
    const files = folder.getFiles();
    const inventory: HistoricalFolderInventory = {
      folderId,
      folderName: folder.getName(),
      files: [],
    };

    while (files.hasNext()) {
      const f = files.next();
      const mime = f.getMimeType();
      const item: any = {
        id: f.getId(),
        name: f.getName(),
        mimeType: mime,
        url: f.getUrl(),
      };

      if (mime === MimeType.GOOGLE_SHEETS) {
        try {
          const ss = SpreadsheetApp.openById(f.getId());
          item.tabs = ss.getSheets().map((s) => s.getName());
        } catch (e: any) {
          item.snippet = `Error reading tabs: ${e.message}`;
        }
      } else if (mime === MimeType.GOOGLE_DOCS) {
        try {
          const doc = DocumentApp.openById(f.getId());
          const text = doc.getBody().getText();
          item.snippet = text.slice(0, 300) + (text.length > 300 ? "..." : "");
        } catch (e: any) {
          item.snippet = `Error reading doc: ${e.message}`;
        }
      } else if (
        mime === MimeType.PLAIN_TEXT ||
        f.getName().endsWith(".txt") ||
        f.getName().endsWith(".eml")
      ) {
        try {
          const content = f.getBlob().getDataAsString();
          item.snippet = content.slice(0, 300) + (content.length > 300 ? "..." : "");
        } catch (e: any) {
          item.snippet = `Error reading text: ${e.message}`;
        }
      }

      inventory.files.push(item);
    }

    return inventory;
  } catch (err: any) {
    console.error("Error scanning historical folder:", err);
    throw new Error(`Failed to scan historical folder: ${err.message}`);
  }
}

/**
 * Parses a legacy signup sheet tab where:
 * - Col A: Resident Name
 * - Col B: Special Instructions (freeform rules, childcare, 2-person dinner willing, etc.)
 * - Col C+: Meal Dates with values: 'Y' (both), 'cook', 'clean', 'n' / blank (unavailable)
 * - Row 1: Date headers (e.g. "Oct 1 (Thur)", "Oct 4 (Sun, Brunch)")
 */
export function parseLegacyMonthlySignupTab(
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
  _year = 2026
): LegacySheetParseResult {
  const data = sheet.getDataRange().getValues();
  if (data.length < 4) {
    throw new Error(`Tab "${sheet.getName()}" does not have enough rows.`);
  }

  // Row 0: Day of week (Monday, Thursday, Sunday)
  // Row 1: Meal type / Note (Dinner, Brunch, Holiday)
  // Row 2: Date (Date object or serial date number or string)
  const row0 = data[0] || [];
  const row1 = data[1] || [];
  const row2 = data[2] || [];

  const dateColumns: { colIdx: number; mealDate: MealDate }[] = [];

  for (let c = 2; c < row2.length; c++) {
    const dayName = String(row0[c] || "").trim();
    const typeOrNote = String(row1[c] || "").trim();
    const dateVal = row2[c];

    if (dateVal === null || dateVal === undefined || dateVal === "") continue;

    let dateIso = "";
    let dateShort = "";

    if (dateVal instanceof Date) {
      const yr = dateVal.getFullYear();
      const mo = String(dateVal.getMonth() + 1).padStart(2, "0");
      const da = String(dateVal.getDate()).padStart(2, "0");
      dateIso = `${yr}-${mo}-${da}`;
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
      dateShort = `${months[dateVal.getMonth()]} ${dateVal.getDate()}`;
    } else if (typeof dateVal === "number" || !isNaN(Number(dateVal))) {
      // Excel serial date
      const num = Number(dateVal);
      if (num > 30000 && num < 60000) {
        const d = new Date(Math.round((num - 25569) * 86400 * 1000));
        const yr = d.getUTCFullYear();
        const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
        const da = String(d.getUTCDate()).padStart(2, "0");
        dateIso = `${yr}-${mo}-${da}`;
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
        dateShort = `${months[d.getUTCMonth()]} ${d.getUTCDate()}`;
      }
    }

    if (!dateIso) continue;

    const isBrunch = /brunch/i.test(typeOrNote) || /brunch/i.test(dayName);
    const mealType: MealType = isBrunch ? "BRUNCH" : "DINNER";
    const cleanDayName = dayName ? dayName.slice(0, 3) : "Day";
    const dateLabel = `${dateShort} (${cleanDayName}${isBrunch ? ", Brunch" : ""})`;
    const specialNote = typeOrNote && !/dinner|brunch/i.test(typeOrNote) ? typeOrNote : undefined;

    dateColumns.push({
      colIdx: c,
      mealDate: {
        id: `MEAL-${dateColumns.length + 1}`,
        dateKey: dateIso,
        dateLabel,
        dayOfWeek: dayName || "Other",
        mealType,
        specialNote,
        targetCookCount: isBrunch ? 2 : 3,
        targetCleanCount: isBrunch ? 2 : 3,
      },
    });
  }

  const responses: SurveyResponse[] = [];

  // Parse respondent rows starting from Row 3 (Row 4 in 1-based index)
  for (let r = 3; r < data.length; r++) {
    const row = data[r];
    const rawName = String(row[0] || "").trim();
    if (!rawName || /total|sum|count|average|notes|legend/i.test(rawName)) {
      continue;
    }

    // Clean name: normalize typos, drop trailing periods on last initials, strip # and * suffixes
    const cleanName = normalizeHistoricalMemberName(rawName);
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
      lowerNotes.includes("2 regardless") ||
      lowerNotes.includes("2 for cooking") ||
      lowerNotes.includes("2 for cook") ||
      lowerNotes.includes("2 for either") ||
      lowerNotes.includes("2 for dinners") ||
      lowerNotes.includes("2 on dinners") ||
      lowerNotes.includes("2 either");

    let cookQuota = 1;
    let cleanQuota = 1;
    if (
      lowerNotes.includes("unable to participate") ||
      lowerNotes.includes("out of town") ||
      lowerNotes.includes("away") ||
      lowerNotes.includes("busy month") ||
      lowerNotes.includes("no meals")
    ) {
      cookQuota = 0;
      cleanQuota = 0;
    }
    if (
      lowerNotes.includes("cook twice") ||
      lowerNotes.includes("cook 2 meals") ||
      lowerNotes.includes("cook 2x") ||
      lowerNotes.includes("2 cooking shifts") ||
      lowerNotes.includes("two cooking shifts")
    ) {
      cookQuota = 2;
    }
    if (
      lowerNotes.includes("cook 3x") ||
      lowerNotes.includes("cook 3 meals") ||
      lowerNotes.includes("3 cooking shifts")
    ) {
      cookQuota = 3;
    }
    if (
      lowerNotes.includes("clean only") ||
      lowerNotes.includes("0 cook") ||
      lowerNotes.includes("no cook")
    ) {
      cookQuota = 0;
    }
    if (
      lowerNotes.includes("clean twice") ||
      lowerNotes.includes("clean 2 meals") ||
      lowerNotes.includes("clean 2x") ||
      lowerNotes.includes("2 cleaning shifts") ||
      lowerNotes.includes("two cleaning shifts")
    ) {
      cleanQuota = 2;
    }
    if (
      lowerNotes.includes("cook only") ||
      lowerNotes.includes("0 clean") ||
      lowerNotes.includes("no clean")
    ) {
      cleanQuota = 0;
    }

    const availability: Record<string, AvailabilityStatus> = {};
    for (const dc of dateColumns) {
      const cellVal = String(row[dc.colIdx] || "")
        .trim()
        .toLowerCase();
      if (
        cellVal === "y" ||
        cellVal === "yes" ||
        cellVal === "available" ||
        cellVal === "both" ||
        cellVal === "1"
      ) {
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
      email: `${cleanName.toLowerCase().replace(/[^a-z0-9]/g, "")}@example.com`,
      name: cleanName,
      availability,
      cookTeamSizePref: willing2PersonDinner ? "2 for either" : "Dinner = 3, Brunch = 2",
      canCookCleanSameDay,
      cookQuota,
      cleanQuota,
      specialInstructions,
    });
  }

  return {
    monthName: sheet.getName(),
    mealDates: dateColumns.map((dc) => dc.mealDate),
    responses,
    rawRowsCount: data.length,
  };
}

export function cleanEmailText(raw: string): string {
  let text = raw;
  // Strip soft line breaks and decode quoted-printable
  text = text.replace(/=\r?\n/g, "");
  text = text.replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  // If HTML, convert breaks and strip tags
  if (text.includes("<") && text.includes(">")) {
    text = text
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<\/div>/gi, "\n");
    text = text.replace(/<[^>]+>/g, "");
  }
  return text;
}

export function extractMonthKey(str: string): string | null {
  const s = str.toLowerCase();
  if (s.includes("jan")) return "01";
  if (s.includes("feb")) return "02";
  if (s.includes("mar")) return "03";
  if (s.includes("apr")) return "04";
  if (s.includes("may")) return "05";
  if (s.includes("jun")) return "06";
  if (s.includes("jul")) return "07";
  if (s.includes("aug")) return "08";
  if (s.includes("sep")) return "09";
  if (s.includes("oct")) return "10";
  if (s.includes("nov")) return "11";
  if (s.includes("dec")) return "12";
  return null;
}

export function formatHistoricalSheetTitle(tabName: string): string {
  const clean = tabName.trim().toUpperCase();
  // Match month name and year with any separator (slash, space, dash, underscore, or none)
  // e.g. "MAY/26", "JUNE 2026", "AUG26", "SEPT-26", "DEC/24", "2026 JUNE"
  const m = clean.match(/([A-Z]{3,})[^0-9A-Z]*(\d{2,4})/);
  if (m) {
    const monthStr = m[1];
    const yearStr = m[2];
    const monthKey = extractMonthKey(monthStr) || "01";
    const month3 = monthStr.slice(0, 3);
    const yr2 = yearStr.length === 4 ? yearStr.slice(2) : yearStr;
    return `${yr2}-${monthKey} ${month3} Cook Team Survey (Responses)`;
  }

  const mRev = clean.match(/(\d{2,4})[^0-9A-Z]*([A-Z]{3,})/);
  if (mRev) {
    const yearStr = mRev[1];
    const monthStr = mRev[2];
    const monthKey = extractMonthKey(monthStr) || "01";
    const month3 = monthStr.slice(0, 3);
    const yr2 = yearStr.length === 4 ? yearStr.slice(2) : yearStr;
    return `${yr2}-${monthKey} ${month3} Cook Team Survey (Responses)`;
  }

  return `${tabName} Cook Team Survey (Responses)`;
}

/**
 * Parses Brenda's email schedule announcement into a ground-truth DaySchedule[]
 */
export function parseEmailScheduleAnnouncement(rawEmailText: string): DaySchedule[] {
  let emailText = cleanEmailText(rawEmailText);
  // Strip email signature and footers
  emailText = emailText.replace(/--\s*\n[\s\S]*/g, "");
  // Unquote reply lines if whole email was a thread reply
  emailText = emailText.replace(/^>\s?/gm, "");

  const lines = emailText.split(/\r?\n/).map((l) => l.trim());
  const schedule: DaySchedule[] = [];

  let currentDay: {
    dateLabel: string;
    mealType: MealType;
    cooks: string[];
    cleaners: string[];
    isNoMeal: boolean;
  } | null = null;

  let collectingRole: "COOKS" | "CLEANERS" | null = null;

  const dateRegex =
    /^(?:\*\s*)?(?:Mon|Tue|Wed|Thu|Thur|Thurs|Fri|Sat|Sun)(?:\s*-\s*|\s+)(?:Jan|Feb|Mar|Apr|May|Jun|June|Jul|July|Aug|August|Sep|Sept|September|Oct|Nov|Dec)\s+\d+.*/i;

  const pushDay = (dayObj: {
    dateLabel: string;
    mealType: MealType;
    cooks: string[];
    cleaners: string[];
    isNoMeal: boolean;
  }) => {
    const isNoMeal = dayObj.isNoMeal || /no community meal|no meal/i.test(dayObj.dateLabel);
    const targetCooks = isNoMeal ? 0 : dayObj.mealType === "BRUNCH" ? 2 : 3;
    const targetCleaners = isNoMeal ? 0 : dayObj.mealType === "BRUNCH" ? 2 : 3;
    const cooks = isNoMeal ? [] : dayObj.cooks;
    const cleaners = isNoMeal ? [] : dayObj.cleaners;
    const cleanLabel = formatScheduleDateLabel(dayObj.dateLabel, dayObj.mealType);
    const dateObj = parseDateFromLabelOrKey(cleanLabel, dayObj.dateLabel);
    const dateKey = dateObj ? dateObj.toISOString().slice(0, 10) : `DATE-${schedule.length + 1}`;

    schedule.push({
      dateKey,
      dateLabel: cleanLabel,
      mealType: dayObj.mealType,
      specialNote: isNoMeal ? "NO COMMUNITY MEAL" : undefined,
      cooks,
      cleaners,
      targetCookCount: targetCooks,
      targetCleanCount: targetCleaners,
      unfilledCooks: isNoMeal ? 0 : Math.max(0, targetCooks - cooks.length),
      unfilledCleaners: isNoMeal ? 0 : Math.max(0, targetCleaners - cleaners.length),
    });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // Clean markdown asterisks/underscores
    const clean = line.replace(/[*#_]+/g, "").trim();
    if (!clean) continue;

    // Check if line is a date header
    if (dateRegex.test(clean) && !clean.toLowerCase().startsWith("meal prep")) {
      if (currentDay) {
        pushDay(currentDay);
      }

      const isBrunch = /brunch/i.test(clean);
      currentDay = {
        dateLabel: clean,
        mealType: isBrunch ? "BRUNCH" : "DINNER",
        cooks: [],
        cleaners: [],
        isNoMeal: false,
      };
      collectingRole = "COOKS";
      continue;
    }

    if (!currentDay) continue;

    if (/no community meal/i.test(clean)) {
      currentDay.isNoMeal = true;
      collectingRole = null;
      continue;
    }

    if (/^Cleaning:\s*/i.test(clean)) {
      collectingRole = "CLEANERS";
      const namesPart = clean.replace(/^Cleaning:\s*/i, "").trim();
      if (namesPart) {
        const names = namesPart
          .split(/[,;&+]/)
          .map((n) => normalizeHistoricalMemberName(n.trim().replace(/^and\s+/i, "")))
          .filter(Boolean);
        currentDay.cleaners.push(...names);
      }
      continue;
    }

    if (collectingRole === "COOKS") {
      if (
        clean.toLowerCase().startsWith("hi ") ||
        clean.toLowerCase().includes("schedule for") ||
        clean.toLowerCase().startsWith("on ")
      ) {
        continue;
      }
      const names = clean
        .split(/[,;&+]/)
        .map((n) => normalizeHistoricalMemberName(n.trim().replace(/^and\s+/i, "")))
        .filter((n) => n && !/^(?:http|>|for critical|you received)/i.test(n));
      currentDay.cooks.push(...names);
      continue;
    }

    if (collectingRole === "CLEANERS") {
      const names = clean
        .split(/[,;&+]/)
        .map((n) => normalizeHistoricalMemberName(n.trim().replace(/^and\s+/i, "")))
        .filter((n) => n && !/^(?:http|>|for critical|you received)/i.test(n));
      currentDay.cleaners.push(...names);
      continue;
    }
  }

  // Push final day
  if (currentDay) {
    pushDay(currentDay);
  }

  return schedule;
}

/**
 * Automatically converts historical legacy monthly signup sheets into standardized
 * Google Form responses spreadsheets and pairs them with Brenda's handcrafted email schedules.
 * Supports targeting 01_Live_Production/Monthly_Surveys (Prod) or 02_Dev_and_Testing (Dev).
 */
export function importHistoricalMonthsToEnvironment(
  sourceHistoricalFolderId = "1Lm-l2Cm8DFO4swnPuDHpYlTz8FOGN8df",
  targetEnv: "prod" | "dev" = "prod",
  targetRootFolderId = "1U0cJqnxCgWn-5k0RCj2BjCUj9nc1dMGl"
) {
  const sourceFolder = DriveApp.getFolderById(sourceHistoricalFolderId);
  const rootFolder = DriveApp.getFolderById(targetRootFolderId);

  // Locate destination folder
  let destinationFolder: GoogleAppsScript.Drive.Folder;
  if (targetEnv === "prod") {
    const prodFolders = rootFolder.getFoldersByName("01_Live_Production");
    const baseProd = prodFolders.hasNext() ? prodFolders.next() : rootFolder;
    const monthlyFolders = baseProd.getFoldersByName("Monthly_Surveys");
    destinationFolder = monthlyFolders.hasNext() ? monthlyFolders.next() : baseProd;
  } else {
    const devFolders = rootFolder.getFoldersByName("02_Dev_and_Testing");
    const baseDev = devFolders.hasNext() ? devFolders.next() : rootFolder;
    const histFolders = baseDev.getFoldersByName("03_Historical_Validation");
    destinationFolder = histFolders.hasNext()
      ? histFolders.next()
      : baseDev.createFolder("03_Historical_Validation");
  }

  // 1. Scan email announcement files
  const emailAnnouncements: { name: string; text: string; schedule: DaySchedule[] }[] = [];
  const files = sourceFolder.getFiles();
  let legacySpreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet | null = null;

  while (files.hasNext()) {
    const f = files.next();
    const mime = f.getMimeType();
    if (mime === MimeType.GOOGLE_SHEETS) {
      legacySpreadsheet = SpreadsheetApp.openById(f.getId());
    } else if (mime === MimeType.GOOGLE_DOCS) {
      const doc = DocumentApp.openById(f.getId());
      const text = doc.getBody().getText();
      const sched = parseEmailScheduleAnnouncement(text);
      emailAnnouncements.push({ name: f.getName(), text, schedule: sched });
    } else if (
      mime === MimeType.PLAIN_TEXT ||
      f.getName().endsWith(".txt") ||
      f.getName().endsWith(".eml")
    ) {
      const text = f.getBlob().getDataAsString();
      const sched = parseEmailScheduleAnnouncement(text);
      emailAnnouncements.push({ name: f.getName(), text, schedule: sched });
    }
  }

  if (!legacySpreadsheet) {
    throw new Error("No Google Spreadsheet found in historical folder.");
  }

  // 2. Process each monthly tab in legacy spreadsheet
  const sheets = legacySpreadsheet.getSheets();
  const createdSheets: { monthName: string; title: string; id: string; url: string }[] = [];

  for (const tab of sheets) {
    const tabName = tab.getName();
    // Skip template, summary, or legend tabs
    if (/template|summary|legend|notes|master|guide/i.test(tabName)) continue;

    try {
      let year = 2026;
      const yrMatch = tabName.match(/20\d\d/);
      if (yrMatch) {
        year = parseInt(yrMatch[0], 10);
      }

      const parsed = parseLegacyMonthlySignupTab(tab, year);
      if (parsed.responses.length === 0 || parsed.mealDates.length === 0) continue;

      const title = formatHistoricalSheetTitle(tabName);

      // Automatically rename any old format files (including "Historical - " prefix) to the new alphabetical title
      const oldTitles = [
        `Historical - ${title}`,
        `Historical - ${tabName} Cook Team Survey (Responses)`,
        `Historical - ${tabName.replace(/[^A-Za-z0-9]/g, "")} Cook Team Survey (Responses)`,
      ];
      for (const ot of oldTitles) {
        if (ot !== title) {
          const oldFiles = destinationFolder.getFilesByName(ot);
          while (oldFiles.hasNext()) {
            oldFiles.next().setName(title);
          }
        }
      }

      // Check if existing file in destination folder
      const existing = destinationFolder.getFilesByName(title);
      let newSS: GoogleAppsScript.Spreadsheet.Spreadsheet;
      if (existing.hasNext()) {
        newSS = SpreadsheetApp.openById(existing.next().getId());
      } else {
        newSS = SpreadsheetApp.create(title);
        const f = DriveApp.getFileById(newSS.getId());
        f.moveTo(destinationFolder);
      }

      // Match corresponding email announcement if any
      const tabMonthKey = extractMonthKey(tabName);
      const matchingEmail = emailAnnouncements.find((ea) => {
        const eaMonthKey = extractMonthKey(ea.name);
        if (tabMonthKey && eaMonthKey && tabMonthKey === eaMonthKey) return true;
        return (
          ea.name.toLowerCase().includes(tabName.toLowerCase()) ||
          tabName.toLowerCase().includes(ea.name.toLowerCase().replace(/[^a-z0-9]/g, ""))
        );
      });

      // Post-process historical survey sign-ups based on Brenda's actual handcrafted schedule
      if (matchingEmail && matchingEmail.schedule.length > 0) {
        const scheduledCookCounts = new Map<string, number>();
        const scheduledCleanCounts = new Map<string, number>();

        for (const day of matchingEmail.schedule) {
          for (const cook of day.cooks) {
            const norm = normalizeHistoricalMemberName(cook);
            if (norm) {
              scheduledCookCounts.set(norm, (scheduledCookCounts.get(norm) || 0) + 1);
            }
          }
          for (const cleaner of day.cleaners) {
            const norm = normalizeHistoricalMemberName(cleaner);
            if (norm) {
              scheduledCleanCounts.set(norm, (scheduledCleanCounts.get(norm) || 0) + 1);
            }
          }
        }

        // 1. If Brenda scheduled a 2-person dinner cook team, mark those cooks as willing 2-person dinner
        for (const day of matchingEmail.schedule) {
          const isNoMeal =
            /no community meal|no meal/i.test(day.specialNote || "") ||
            /no community meal|no meal/i.test(day.dateLabel);
          if (!isNoMeal && day.mealType === "DINNER" && day.cooks.length === 2) {
            for (const cook of day.cooks) {
              const norm = normalizeHistoricalMemberName(cook);
              const resp = parsed.responses.find(
                (r) => normalizeHistoricalMemberName(r.name).toLowerCase() === norm.toLowerCase()
              );
              if (resp) {
                resp.cookTeamSizePref = "2 for either";
              }
            }
          }
        }

        // 2. If they are scheduled for multiple meals (or more than initial sign-up), update sign-up quotas
        for (const resp of parsed.responses) {
          const norm = normalizeHistoricalMemberName(resp.name);
          const actualCooks = scheduledCookCounts.get(norm) || 0;
          const actualCleans = scheduledCleanCounts.get(norm) || 0;
          if (actualCooks > 0) {
            resp.cookQuota = Math.max(resp.cookQuota, actualCooks);
          }
          if (actualCleans > 0) {
            resp.cleanQuota = Math.max(resp.cleanQuota, actualCleans);
          }
        }

        // 3. For any volunteer scheduled in email who wasn't in legacy signup sheet, add them
        for (const [name, cookCount] of scheduledCookCounts.entries()) {
          const exists = parsed.responses.some(
            (r) => normalizeHistoricalMemberName(r.name).toLowerCase() === name.toLowerCase()
          );
          if (!exists && name) {
            const cleanCount = scheduledCleanCounts.get(name) || 0;
            const avail: Record<string, AvailabilityStatus> = {};
            for (const d of parsed.mealDates) {
              avail[d.dateLabel] = "AVAILABLE";
            }
            parsed.responses.push({
              timestamp: new Date().toISOString(),
              email: `${name.toLowerCase().replace(/[^a-z0-9]/g, "")}@example.com`,
              name,
              cookQuota: cookCount,
              cleanQuota: cleanCount || 1,
              availability: avail,
              cookTeamSizePref: "Dinner = 3, Brunch = 2",
              canCookCleanSameDay: true,
              specialInstructions: "Added from handcrafted schedule",
            });
          }
        }
      }

      // Write 'Form Responses 1'
      let formTab = newSS.getSheetByName("Form Responses 1");
      if (!formTab) formTab = newSS.insertSheet("Form Responses 1", 0);
      formTab.clear();

      const headers = [
        "Timestamp",
        "Your Name:",
        "How many meals can you cook this month?",
        "How many meals can you clean this month?",
      ];

      for (const d of parsed.mealDates) {
        headers.push(`Select your available dates [${d.dateLabel} (${d.mealType})]`);
      }
      headers.push("Would you be open to a 2-person cook team on dinners if needed?");
      headers.push("Can you cook and clean on the same day?");
      headers.push("Any special instructions, childcare constraints, or kitchen preferences?");

      const rows: any[][] = [headers];
      for (const r of parsed.responses) {
        const row: any[] = [r.timestamp, r.name, r.cookQuota, r.cleanQuota];
        for (const d of parsed.mealDates) {
          const avail = r.availability[d.dateLabel] || "Unavailable";
          row.push(
            avail === "AVAILABLE"
              ? "Available"
              : avail === "COOK_ONLY"
                ? "Cook Only"
                : avail === "CLEAN_ONLY"
                  ? "Clean Only"
                  : "Unavailable"
          );
        }
        row.push(r.cookTeamSizePref || "Dinner = 3, Brunch = 2");
        row.push(r.canCookCleanSameDay ? "Yes" : "No");
        row.push(r.specialInstructions || "");
        rows.push(row);
      }

      formTab.getRange(1, 1, rows.length, rows[0].length).setValues(rows);

      // Determine canonical Schedule_YYYY-MM tab name matching the app
      let monthSuffix = "";
      if (matchingEmail && matchingEmail.schedule.length > 0 && matchingEmail.schedule[0].dateKey) {
        monthSuffix = matchingEmail.schedule[0].dateKey.slice(0, 7);
      } else {
        const m =
          tabName.match(/([A-Z]{3,})[^0-9A-Z]*(\d{2,4})/i) ||
          tabName.match(/(\d{2,4})[^0-9A-Z]*([A-Z]{3,})/i);
        if (m) {
          const mStr = isNaN(Number(m[1])) ? m[1] : m[2];
          const yStr = isNaN(Number(m[1])) ? m[2] : m[1];
          const mKey = extractMonthKey(mStr) || "01";
          const yFull = yStr.length === 2 ? `20${yStr}` : yStr;
          monthSuffix = `${yFull}-${mKey}`;
        }
      }
      if (!monthSuffix) {
        monthSuffix = tabName.replace(/[/\s]+/g, "-");
      }

      if (matchingEmail && matchingEmail.schedule.length > 0) {
        const schedTabName = `Schedule_${monthSuffix}`;
        let schedTab = newSS.getSheetByName(schedTabName);
        if (!schedTab) schedTab = newSS.insertSheet(schedTabName);
        schedTab.clear();

        // Calculate max cooks and cleaners for this month (minimum 3 each)
        let maxCooks = 3;
        let maxCleans = 3;
        for (const day of matchingEmail.schedule) {
          if (day.cooks.length > maxCooks) maxCooks = day.cooks.length;
          if (day.cleaners.length > maxCleans) maxCleans = day.cleaners.length;
        }

        const headers = ["Date", "Meal Type", "Special Note"];
        for (let i = 1; i <= maxCooks; i++) headers.push(`Cook ${i}`);
        for (let i = 1; i <= maxCleans; i++) headers.push(`Clean ${i}`);
        headers.push("Status / Notes");

        const schedRows: any[][] = [headers];

        for (const day of matchingEmail.schedule) {
          const dateObj = parseDateFromLabelOrKey(day.dateLabel, day.dateKey);
          const dateVal = dateObj || day.dateLabel;
          const row: any[] = [dateVal, day.mealType, day.specialNote || ""];
          for (let i = 0; i < maxCooks; i++) {
            row.push(day.cooks[i] || "");
          }
          for (let i = 0; i < maxCleans; i++) {
            row.push(day.cleaners[i] || "");
          }
          row.push("Handcrafted Team by Brenda");
          schedRows.push(row);
        }
        schedTab.getRange(1, 1, schedRows.length, schedRows[0].length).setValues(schedRows);

        // Format Date column with real Google Sheets Date format
        if (schedRows.length > 1) {
          schedTab.getRange(2, 1, schedRows.length - 1, 1).setNumberFormat("ddd, mmm d, yyyy");
        }
      }

      // Add Email_Dispatch_Log tab indicating email announcement has already been sent
      let logTab = newSS.getSheetByName("Email_Dispatch_Log");
      if (!logTab) {
        logTab = newSS.insertSheet("Email_Dispatch_Log");
      }
      logTab.clear();
      logTab
        .getRange(1, 1, 1, 7)
        .setValues([
          ["Timestamp", "Month", "Recipient (To)", "Subject", "Sent By", "Status", "Mode"],
        ]);
      logTab.getRange(1, 1, 1, 7).setFontWeight("bold").setBackground("#f3f4f6");
      logTab.setFrozenRows(1);

      let emailSubject = `[vancoho-residents] MEAL SCHEDULE - ${monthSuffix} - Please Note Your Dates`;
      let emailTimestamp = new Date().toISOString();
      if (matchingEmail) {
        const cleanName = matchingEmail.name.replace(/\.eml$|\.txt$/i, "").trim();
        if (cleanName.includes("MEAL SCHEDULE")) {
          emailSubject = cleanName;
        }
      }
      if (monthSuffix) {
        const parts = monthSuffix.split("-");
        if (parts.length === 2) {
          const y = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10);
          if (!isNaN(y) && !isNaN(m)) {
            emailTimestamp = new Date(Date.UTC(y, m - 1, 1, 16, 0, 0)).toISOString();
          }
        }
      }

      logTab.appendRow([
        emailTimestamp,
        monthSuffix || "",
        "Vancouver Cohousing Residents <vancoho-residents@googlegroups.com>",
        emailSubject,
        "Brenda (Meal Coordinator)",
        "SENT",
        "Historical Announcement",
      ]);

      createdSheets.push({
        monthName: tabName,
        title,
        id: newSS.getId(),
        url: newSS.getUrl(),
      });
    } catch (tabErr) {
      console.warn(`Error converting tab "${tabName}":`, tabErr);
    }
  }

  // Save full raw dump JSON in rootFolder so local scripts can download it
  try {
    const rawDump: any = {
      spreadsheetTitle: legacySpreadsheet.getName(),
      tabs: legacySpreadsheet.getSheets().map((s) => ({
        name: s.getName(),
        values: s.getDataRange().getValues(),
      })),
      emails: emailAnnouncements,
    };
    const dumpContent = JSON.stringify(rawDump, null, 2);
    const existingDump = rootFolder.getFilesByName("historical_raw_dump.json");
    if (existingDump.hasNext()) {
      existingDump.next().setContent(dumpContent);
    } else {
      rootFolder.createFile("historical_raw_dump.json", dumpContent, MimeType.PLAIN_TEXT);
    }
  } catch (dumpErr) {
    console.warn("Could not write historical_raw_dump.json:", dumpErr);
  }

  return {
    success: true,
    createdSheets,
    emailsFound: emailAnnouncements.length,
    message: `Converted ${createdSheets.length} historical months into standardized survey sheets with handcrafted schedule comparison tabs!`,
  };
}

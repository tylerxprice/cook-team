/**
 * Historical Data Processing & Validation Framework
 * Converts legacy signup sheets (names in col A, special instructions in col B, dates in col C+)
 * and parses historical email schedule announcements for solver comparison.
 */

import { MealDate, MealType, SurveyResponse, AvailabilityStatus, DaySchedule, ScheduleOutput } from "./types";

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
      } else if (mime === MimeType.PLAIN_TEXT || f.getName().endsWith(".txt") || f.getName().endsWith(".eml")) {
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
  year = 2026
): LegacySheetParseResult {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    throw new Error(`Tab "${sheet.getName()}" does not have enough rows.`);
  }

  // Row 0 or 1 contains date headers
  let headerRowIdx = 0;
  for (let r = 0; r < Math.min(5, data.length); r++) {
    const row = data[r];
    const nonBlankCount = row.filter((c: any) => String(c || "").trim() !== "").length;
    // If multiple columns have date-like strings
    if (nonBlankCount >= 3 && (String(row[2] || "").match(/\d|mon|tue|wed|thu|fri|sat|sun|dinner|brunch/i))) {
      headerRowIdx = r;
      break;
    }
  }

  const headerRow = data[headerRowIdx];
  const dateColumns: { colIdx: number; mealDate: MealDate }[] = [];

  // Parse date headers starting from column index 2 (Col C)
  for (let c = 2; c < headerRow.length; c++) {
    const cell = String(headerRow[c] || "").trim();
    if (!cell || /total|sum|count|note/i.test(cell)) {
      continue;
    }

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

    let specialNote: string | undefined = undefined;
    if (cell.includes("-")) {
      specialNote = cell.split("-").slice(1).join("-").trim();
    }

    const dateKey = `${year}-${String(dateColumns.length + 1).padStart(2, "0")}`;

    dateColumns.push({
      colIdx: c,
      mealDate: {
        id: `MEAL-${dateColumns.length + 1}`,
        dateKey,
        dateLabel: cell,
        dayOfWeek,
        mealType: isBrunch ? "BRUNCH" : "DINNER",
        specialNote,
        targetCookCount: isBrunch ? 2 : 3,
        targetCleanCount: isBrunch ? 2 : 3,
      },
    });
  }

  const responses: SurveyResponse[] = [];

  // Parse respondent rows
  for (let r = headerRowIdx + 1; r < data.length; r++) {
    const row = data[r];
    const rawName = String(row[0] || "").trim();
    if (!rawName || /total|sum|count|average|notes|legend/i.test(rawName)) {
      continue;
    }

    const specialInstructions = String(row[1] || "").trim();

    // Check special instructions for preferences
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

    // Check for explicit cook quota in notes
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

    const availability: Record<string, AvailabilityStatus> = {};
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
      email: "",
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
    monthName: sheet.getName(),
    mealDates: dateColumns.map((dc) => dc.mealDate),
    responses,
    rawRowsCount: data.length,
  };
}

/**
 * Parses Brenda's email schedule announcement into a ground-truth DaySchedule[]
 */
export function parseEmailScheduleAnnouncement(emailText: string): DaySchedule[] {
  const lines = emailText.split(/\r?\n/).map((l) => l.trim());
  const schedule: DaySchedule[] = [];

  let currentDay: Partial<DaySchedule> | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // Detect date header line (e.g. "📅 Oct 1 (Thur)" or "Oct 1 (Thur) - DINNER" or "Thursday, Oct 1")
    if (
      line.startsWith("📅") ||
      line.match(/^(?:📅\s*)?(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\d{1,2}\/\d{1,2})/i)
    ) {
      if (currentDay && currentDay.dateLabel && currentDay.cooks && currentDay.cleaners) {
        schedule.push({
          dateKey: currentDay.dateKey || `DATE-${schedule.length + 1}`,
          dateLabel: currentDay.dateLabel,
          mealType: currentDay.mealType || "DINNER",
          cooks: currentDay.cooks,
          cleaners: currentDay.cleaners,
          targetCookCount: currentDay.mealType === "BRUNCH" ? 2 : 3,
          targetCleanCount: currentDay.mealType === "BRUNCH" ? 2 : 3,
          unfilledCooks: Math.max(0, (currentDay.mealType === "BRUNCH" ? 2 : 3) - currentDay.cooks.length),
          unfilledCleaners: Math.max(0, (currentDay.mealType === "BRUNCH" ? 2 : 3) - currentDay.cleaners.length),
        });
      }

      const cleanLabel = line.replace(/^[📅\s*#*-]+/, "").trim();
      const isBrunch = /brunch/i.test(cleanLabel);
      currentDay = {
        dateKey: `DATE-${schedule.length + 1}`,
        dateLabel: cleanLabel,
        mealType: isBrunch ? "BRUNCH" : "DINNER",
        cooks: [],
        cleaners: [],
      };
      continue;
    }

    // Detect Cooks line
    if (currentDay && /^Cooks?:\s*/i.test(line)) {
      const namesStr = line.replace(/^Cooks?:\s*/i, "").trim();
      const names = namesStr
        .split(/[,;&+]/)
        .map((n) => n.trim().replace(/^and\s+/i, ""))
        .filter(Boolean);
      currentDay.cooks = names;
      continue;
    }

    // Detect Cleaners line
    if (currentDay && /^Cleaners?:\s*/i.test(line)) {
      const namesStr = line.replace(/^Cleaners?:\s*/i, "").trim();
      const names = namesStr
        .split(/[,;&+]/)
        .map((n) => n.trim().replace(/^and\s+/i, ""))
        .filter(Boolean);
      currentDay.cleaners = names;
      continue;
    }
  }

  // Push final day
  if (currentDay && currentDay.dateLabel && currentDay.cooks && currentDay.cleaners) {
    schedule.push({
      dateKey: currentDay.dateKey || `DATE-${schedule.length + 1}`,
      dateLabel: currentDay.dateLabel,
      mealType: currentDay.mealType || "DINNER",
      cooks: currentDay.cooks,
      cleaners: currentDay.cleaners,
      targetCookCount: currentDay.mealType === "BRUNCH" ? 2 : 3,
      targetCleanCount: currentDay.mealType === "BRUNCH" ? 2 : 3,
      unfilledCooks: Math.max(0, (currentDay.mealType === "BRUNCH" ? 2 : 3) - currentDay.cooks.length),
      unfilledCleaners: Math.max(0, (currentDay.mealType === "BRUNCH" ? 2 : 3) - currentDay.cleaners.length),
    });
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
    destinationFolder = histFolders.hasNext() ? histFolders.next() : baseDev.createFolder("03_Historical_Validation");
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
    } else if (mime === MimeType.PLAIN_TEXT || f.getName().endsWith(".txt") || f.getName().endsWith(".eml")) {
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

      const title = `Historical - ${tabName} Cook Team Survey (Responses)`;

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
        const row: any[] = [
          r.timestamp,
          r.name,
          r.cookQuota,
          r.cleanQuota,
        ];
        for (const d of parsed.mealDates) {
          const avail = r.availability[d.dateLabel] || "Unavailable";
          row.push(avail === "AVAILABLE" ? "Available" : avail === "COOK_ONLY" ? "Cook Only" : avail === "CLEAN_ONLY" ? "Clean Only" : "Unavailable");
        }
        row.push(r.cookTeamSizePref || "Dinner = 3, Brunch = 2");
        row.push(r.canCookCleanSameDay ? "Yes" : "No");
        row.push(r.specialInstructions || "");
        rows.push(row);
      }

      formTab.getRange(1, 1, rows.length, rows[0].length).setValues(rows);

      // Match corresponding email announcement if any
      const matchingEmail = emailAnnouncements.find((ea) =>
        ea.name.toLowerCase().includes(tabName.toLowerCase()) ||
        tabName.toLowerCase().includes(ea.name.toLowerCase().replace(/[^a-z0-9]/g, ""))
      );

      if (matchingEmail && matchingEmail.schedule.length > 0) {
        const schedTabName = `Schedule_${tabName.replace(/\s+/g, "_")}`;
        let schedTab = newSS.getSheetByName(schedTabName);
        if (!schedTab) schedTab = newSS.insertSheet(schedTabName);
        schedTab.clear();

        const schedRows: any[][] = [
          ["Meal Date", "Meal Type", "Cook 1", "Cook 2", "Cook 3", "Clean 1", "Clean 2", "Clean 3", "Notes"]
        ];

        for (const day of matchingEmail.schedule) {
          schedRows.push([
            day.dateLabel,
            day.mealType,
            day.cooks[0] || "",
            day.cooks[1] || "",
            day.cooks[2] || "",
            day.cleaners[0] || "",
            day.cleaners[1] || "",
            day.cleaners[2] || "",
            "Handcrafted Team by Brenda",
          ]);
        }
        schedTab.getRange(1, 1, schedRows.length, schedRows[0].length).setValues(schedRows);
      }

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

  return {
    success: true,
    createdSheets,
    emailsFound: emailAnnouncements.length,
    message: `Converted ${createdSheets.length} historical months into standardized survey sheets with handcrafted schedule comparison tabs!`,
  };
}

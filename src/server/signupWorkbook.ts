/**
 * Common Meal Sign-Up Workbook Generator (Rose's Workflow)
 * Duplicates the 'Template' sheet in the community's high-traffic Common Meal Sign-Up Workbook,
 * injects dates, meal makers, cleaners, and sign-up deadlines, sorts tabs chronologically,
 * auto-hides historical tabs, and creates timestamped backups when overwriting.
 */

import type {
  DaySchedule,
  MealType,
  MealSignupColumnPreview,
  MealSignupExportOptions,
  MealSignupExportResult,
  MealSignupWorkbookInfo,
} from "./types";
import { parseDateFromLabelOrKey } from "./scheduleParser";

export type {
  MealSignupColumnPreview,
  MealSignupExportOptions,
  MealSignupExportResult,
  MealSignupWorkbookInfo,
};

/**
 * Calculates standard default sign-up deadline for a meal date:
 * - Sunday meals -> "Saturday 9:00 AM"
 * - Monday meals -> "Sunday 9:00 AM"
 * - Thursday meals -> "Wednesday 9:00 AM"
 * - General default -> Day before at 9:00 AM
 */
export function getDefaultSignupDeadline(dateObj?: Date | null, _mealType?: MealType): string {
  if (!dateObj || isNaN(dateObj.getTime())) {
    return "Day before at 9:00 AM";
  }

  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayOfWeek = dateObj.getDay(); // 0 = Sun, 1 = Mon, 4 = Thu
  const prevDayIndex = (dayOfWeek + 6) % 7;
  return `${days[prevDayIndex]} 9:00 AM`;
}

/**
 * Formats a short date label like "Oct 4", "Oct 11", "Aug 9" from dateObj or dateLabel
 */
export function formatShortMonthDay(dateObj?: Date | null, rawDateLabel?: string): string {
  if (dateObj && !isNaN(dateObj.getTime())) {
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
    return `${months[dateObj.getMonth()]} ${dateObj.getDate()}`;
  }

  if (rawDateLabel) {
    const m = rawDateLabel.match(/([A-Za-z]{3})\s+(\d{1,2})/);
    if (m) return `${m[1]} ${m[2]}`;
  }
  return rawDateLabel || "";
}

/**
 * Formats standard header day string: "SUN - Brunch", "SUN - Dinner", "MON", "THUR"
 */
export function formatHeaderDayLabel(
  dateObj?: Date | null,
  mealType?: MealType,
  rawLabel?: string
): string {
  if (dateObj && !isNaN(dateObj.getTime())) {
    const days = ["SUN", "MON", "TUE", "WED", "THUR", "FRI", "SAT"];
    const dow = days[dateObj.getDay()];
    if (dow === "SUN") {
      return mealType === "BRUNCH" ? "SUN - Brunch" : "SUN - Dinner";
    }
    return dow;
  }

  if (rawLabel) {
    if (/brunch/i.test(rawLabel)) return "SUN - Brunch";
    if (/sun/i.test(rawLabel)) return "SUN - Dinner";
    if (/mon/i.test(rawLabel)) return "MON";
    if (/thu/i.test(rawLabel)) return "THUR";
  }

  return mealType === "BRUNCH" ? "SUN - Brunch" : "DINNER";
}

/**
 * Prepares preview columns for the Common Meal Sign-Up sheet from a DaySchedule[] roster.
 */
export function generateMealSignupPreviewColumns(
  schedule: DaySchedule[],
  customDeadlines?: Record<string, string>,
  customDayLabels?: Record<string, string>
): MealSignupColumnPreview[] {
  const columns: MealSignupColumnPreview[] = [];

  schedule.forEach((day, index) => {
    const colIndex = 2 + index * 3; // Col B is 2, Col E is 5, Col H is 8, etc.
    const dateObj = parseDateFromLabelOrKey(day.dateLabel, day.dateKey);
    const dateShort = formatShortMonthDay(dateObj, day.dateLabel);
    const defaultDayLabel = formatHeaderDayLabel(dateObj, day.mealType, day.dateLabel);
    const dayLabel = customDayLabels?.[day.dateKey] || defaultDayLabel;
    const isNoMeal =
      (day.targetCookCount === 0 && day.targetCleanCount === 0) ||
      /no community meal|no meal/i.test(day.specialNote || "") ||
      /no community meal|no meal/i.test(day.dateLabel);

    const cooks = isNoMeal ? "No Community Meal" : (day.cooks || []).join(", ");
    const cleaners = isNoMeal ? "" : (day.cleaners || []).join(", ");
    const defaultDeadline = isNoMeal ? "" : getDefaultSignupDeadline(dateObj, day.mealType);
    const deadline = isNoMeal ? "" : customDeadlines?.[day.dateKey] || defaultDeadline;

    columns.push({
      colIndex,
      dateKey: day.dateKey,
      dateLabel: day.dateLabel,
      dayLabel,
      dateShort,
      mealType: day.mealType,
      isNoMeal,
      cooks,
      cleaners,
      deadline,
      mealName: "",
    });
  });

  return columns;
}

/**
 * Derives month tab name like "OCT 2026" from a list of days or a month key "2026-10"
 */
export function deriveMonthTabName(monthKeyOrDays?: string | DaySchedule[]): string {
  if (typeof monthKeyOrDays === "string" && monthKeyOrDays) {
    const mMatch = monthKeyOrDays.match(/(?:20)?(\d{2})[-_](\d{2})/);
    if (mMatch) {
      const year = `20${mMatch[1]}`;
      const monthNum = parseInt(mMatch[2], 10);
      const months = [
        "JAN",
        "FEB",
        "MAR",
        "APR",
        "MAY",
        "JUN",
        "JUL",
        "AUG",
        "SEP",
        "OCT",
        "NOV",
        "DEC",
      ];
      if (monthNum >= 1 && monthNum <= 12) {
        return `${months[monthNum - 1]} ${year}`;
      }
    }
  }

  if (Array.isArray(monthKeyOrDays) && monthKeyOrDays.length > 0) {
    const firstDay = monthKeyOrDays[0];
    const dateObj = parseDateFromLabelOrKey(firstDay.dateLabel, firstDay.dateKey);
    if (dateObj && !isNaN(dateObj.getTime())) {
      const months = [
        "JAN",
        "FEB",
        "MAR",
        "APR",
        "MAY",
        "JUN",
        "JUL",
        "AUG",
        "SEP",
        "OCT",
        "NOV",
        "DEC",
      ];
      return `${months[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
    }
  }

  // Fallback to current/next month
  const now = new Date();
  const months = [
    "JAN",
    "FEB",
    "MAR",
    "APR",
    "MAY",
    "JUN",
    "JUL",
    "AUG",
    "SEP",
    "OCT",
    "NOV",
    "DEC",
  ];
  return `${months[now.getMonth()]} ${now.getFullYear()}`;
}

/**
 * Chronological tab sorter key (e.g. "JAN 2026" -> "2026-01", "OCT 2026" -> "2026-10")
 */
export function getTabChronologicalKey(tabName: string): string {
  const m = tabName.trim().match(/^([A-Za-z]{3,4})\s*[/'_-]?\s*(\d{2,4})$/);
  if (!m) return "9999-99";

  const monthStr = m[1].toUpperCase();
  let year = parseInt(m[2], 10);
  if (year < 100) year += 2000;

  const monthMap: Record<string, string> = {
    JAN: "01",
    FEB: "02",
    MAR: "03",
    APR: "04",
    MAY: "05",
    JUN: "06",
    JUNE: "06",
    JUL: "07",
    JULY: "07",
    AUG: "08",
    SEP: "09",
    SEPT: "09",
    OCT: "10",
    NOV: "11",
    DEC: "12",
  };

  const monthNum = monthMap[monthStr] || "01";
  return `${year}-${monthNum}`;
}

/**
 * Google Apps Script function to inspect the target Common Meal Sign-Up Workbook
 */
export function inspectMealSignupWorkbook(
  targetSpreadsheetIdOrUrl?: string,
  suggestedMonthTab = "OCT 2026"
): MealSignupWorkbookInfo {
  try {
    let ss: GoogleAppsScript.Spreadsheet.Spreadsheet;
    const clean = (targetSpreadsheetIdOrUrl || "").trim();
    if (clean.startsWith("http")) {
      ss = SpreadsheetApp.openByUrl(clean);
    } else if (clean) {
      ss = SpreadsheetApp.openById(clean);
    } else {
      // Look up from Script Properties
      const propId = PropertiesService.getScriptProperties().getProperty(
        "COMMON_MEAL_SIGNUP_SHEET_ID"
      );
      if (propId) {
        ss = SpreadsheetApp.openById(propId);
      } else {
        throw new Error(
          "No Common Meal Sign-Up Workbook configured in Settings or provided as URL/ID."
        );
      }
    }

    // Persist verified ID in Script Properties
    try {
      PropertiesService.getScriptProperties().setProperty(
        "COMMON_MEAL_SIGNUP_SHEET_ID",
        ss.getId()
      );
    } catch (pErr) {
      console.warn("Could not persist COMMON_MEAL_SIGNUP_SHEET_ID:", pErr);
    }

    const sheets = ss.getSheets();
    const sheetNames = sheets.map((s) => s.getName());
    const hasTemplate = sheetNames.some((n) => n.toLowerCase() === "template");
    const isTargetTabExisting = sheetNames.includes(suggestedMonthTab);

    return {
      spreadsheetId: ss.getId(),
      spreadsheetName: ss.getName(),
      spreadsheetUrl: ss.getUrl(),
      hasTemplate,
      existingTabs: sheetNames,
      suggestedMonthTab,
      isTargetTabExisting,
    };
  } catch (err: any) {
    console.error("inspectMealSignupWorkbook error:", err);
    throw new Error(`Could not access Common Meal Sign-Up Workbook: ${err.message}`);
  }
}

/**
 * Google Apps Script function to duplicate 'Template', inject meal columns,
 * sort tabs, hide older sheets, and create backup when overwriting.
 */
export function executeCreateMealSignupTab(
  targetSpreadsheetIdOrUrl: string,
  schedule: DaySchedule[],
  options: MealSignupExportOptions = {}
): MealSignupExportResult {
  try {
    let ss: GoogleAppsScript.Spreadsheet.Spreadsheet;
    const clean = (targetSpreadsheetIdOrUrl || "").trim();
    if (clean.startsWith("http")) {
      ss = SpreadsheetApp.openByUrl(clean);
    } else if (clean) {
      ss = SpreadsheetApp.openById(clean);
    } else {
      const propId = PropertiesService.getScriptProperties().getProperty(
        "COMMON_MEAL_SIGNUP_SHEET_ID"
      );
      if (propId) {
        ss = SpreadsheetApp.openById(propId);
      } else {
        throw new Error("No Common Meal Sign-Up Workbook configured.");
      }
    }

    // Persist this ID as the default Common Meal Sign-Up Workbook
    try {
      PropertiesService.getScriptProperties().setProperty(
        "COMMON_MEAL_SIGNUP_SHEET_ID",
        ss.getId()
      );
    } catch (pErr) {
      console.warn("Could not set script property COMMON_MEAL_SIGNUP_SHEET_ID:", pErr);
    }

    const monthTabName = options.monthTabName || deriveMonthTabName(schedule);
    const backupExisting = options.backupExisting !== false;
    const hideOlderMonths = options.hideOlderMonths !== false;
    const keepTemplateHidden = options.keepTemplateHidden !== false;

    // 1. Locate Template sheet
    const templateSheet =
      ss.getSheetByName("Template") ||
      ss.getSheets().find((s) => s.getName().toLowerCase() === "template");
    if (!templateSheet) {
      throw new Error("Target workbook must have a 'Template' sheet to duplicate.");
    }

    // 2. Check if month tab already exists
    let isBackupCreated = false;
    let backupTabName: string | undefined = undefined;
    const existingTab = ss.getSheetByName(monthTabName);

    if (existingTab) {
      if (backupExisting) {
        const todayStr = new Date().toISOString().slice(0, 10);
        backupTabName = `${monthTabName} (Backup - ${todayStr})`;

        // If a backup with this exact name already exists, add timestamp suffix
        let finalBackupName = backupTabName;
        let suffix = 1;
        while (ss.getSheetByName(finalBackupName)) {
          finalBackupName = `${monthTabName} (Backup - ${todayStr} #${suffix++})`;
        }

        existingTab.setName(finalBackupName);
        existingTab.hideSheet();
        isBackupCreated = true;
        backupTabName = finalBackupName;
      } else {
        // Overwrite without backup
        ss.deleteSheet(existingTab);
      }
    }

    // 3. Duplicate Template sheet
    const newSheet = templateSheet.copyTo(ss).setName(monthTabName);
    newSheet.showSheet();

    // 4. Invert columns preview & inject into the sheet
    const previewCols = generateMealSignupPreviewColumns(
      schedule,
      options.customDeadlines,
      options.customDayLabels
    );

    const requiredMaxCol = 1 + previewCols.length * 3; // e.g. 11 meals -> 1 + 33 = 34 columns
    const currentMaxCols = newSheet.getMaxColumns();

    // A. If month has MORE meals than Template, dynamically insert columns and clone formulas/formatting
    if (currentMaxCols < requiredMaxCol) {
      const neededCols = requiredMaxCol - currentMaxCols;
      newSheet.insertColumnsAfter(currentMaxCols, neededCols);

      if (currentMaxCols >= 4) {
        const lastTemplateBlock = newSheet.getRange(
          1,
          currentMaxCols - 2,
          newSheet.getMaxRows(),
          3
        );
        for (let c = currentMaxCols + 1; c <= requiredMaxCol; c += 3) {
          const targetRange = newSheet.getRange(1, c, newSheet.getMaxRows(), 3);
          lastTemplateBlock.copyTo(targetRange);
          try {
            newSheet.setColumnWidth(c, newSheet.getColumnWidth(currentMaxCols - 2));
            newSheet.setColumnWidth(c + 1, newSheet.getColumnWidth(currentMaxCols - 1));
            newSheet.setColumnWidth(c + 2, newSheet.getColumnWidth(currentMaxCols));
          } catch {}
        }
      }
    }

    // B. Inject meal data into 3-column blocks
    for (const col of previewCols) {
      // Row 4: DAY
      newSheet.getRange(4, col.colIndex).setValue(col.dayLabel);
      // Row 5: DATE & TIME
      newSheet.getRange(5, col.colIndex).setValue(col.dateShort);
      // Row 6: MEAL MAKERS
      newSheet.getRange(6, col.colIndex).setValue(col.cooks);
      // Row 7: Cleaners
      newSheet.getRange(7, col.colIndex).setValue(col.cleaners);
      // Row 8: SIGN UP DEADLINE
      newSheet.getRange(8, col.colIndex).setValue(col.deadline || "");
      // Row 9: MEAL NAME (Leave blank or clear)
      newSheet.getRange(9, col.colIndex).setValue(col.mealName || "");
    }

    // C. If month has FEWER meals than Template, clear leftover header rows in trailing blocks
    if (currentMaxCols > requiredMaxCol) {
      const leftoverColCount = currentMaxCols - requiredMaxCol;
      try {
        newSheet.getRange(4, requiredMaxCol + 1, 6, leftoverColCount).clearContent();
      } catch (cErr) {
        console.warn("Could not clear leftover template columns:", cErr);
      }
    }

    // 5. Sort tabs chronologically
    const allSheets = ss.getSheets();
    const sortedSheets = [...allSheets].sort((a, b) => {
      const nameA = a.getName();
      const nameB = b.getName();
      if (nameA.toLowerCase() === "template") return 1;
      if (nameB.toLowerCase() === "template") return -1;
      return getTabChronologicalKey(nameA).localeCompare(getTabChronologicalKey(nameB));
    });

    sortedSheets.forEach((s, idx) => {
      try {
        ss.setActiveSheet(s);
        ss.moveActiveSheet(idx + 1);
      } catch (mErr) {
        console.warn(`Could not move sheet ${s.getName()}:`, mErr);
      }
    });

    // 6. Tab Visibility Rules:
    // - Keep newly created sheet visible and active
    // - Keep Template hidden so residents don't accidentally edit it
    // - Auto-hide sheets older than current/target month if requested
    const targetKey = getTabChronologicalKey(monthTabName);

    if (keepTemplateHidden) {
      try {
        templateSheet.hideSheet();
      } catch (tErr) {
        console.warn("Could not hide Template sheet:", tErr);
      }
    }

    if (hideOlderMonths) {
      for (const s of ss.getSheets()) {
        const sName = s.getName();
        if (sName.toLowerCase() === "template") continue;
        if (sName === monthTabName) continue;
        if (sName.includes("Backup")) {
          try {
            s.hideSheet();
          } catch {}
          continue;
        }

        const sKey = getTabChronologicalKey(sName);
        // If sheet is older than target month minus 1 month (keep current & target visible)
        if (sKey < targetKey && sKey !== "9999-99") {
          // Check if it's strictly older than 1 month before targetKey
          const [tYear, tMon] = targetKey.split("-").map(Number);
          let prevMonth = tMon - 1;
          let prevYear = tYear;
          if (prevMonth === 0) {
            prevMonth = 12;
            prevYear--;
          }
          const prevKey = `${prevYear}-${prevMonth < 10 ? `0${prevMonth}` : prevMonth}`;

          if (sKey < prevKey) {
            try {
              s.hideSheet();
            } catch (hErr) {
              console.warn(`Could not hide older sheet ${sName}:`, hErr);
            }
          }
        }
      }
    }

    ss.setActiveSheet(newSheet);
    const tabUrl = `${ss.getUrl()}#gid=${newSheet.getSheetId()}`;

    return {
      success: true,
      spreadsheetId: ss.getId(),
      spreadsheetUrl: ss.getUrl(),
      tabName: monthTabName,
      tabUrl,
      isBackupCreated,
      backupTabName,
      totalMealColumns: previewCols.length,
      message: `Successfully created and published '${monthTabName}' with ${previewCols.length} meal dates!`,
    };
  } catch (err: any) {
    console.error("executeCreateMealSignupTab error:", err);
    throw new Error(`Failed to generate Common Meal Sign-Up tab: ${err.message}`);
  }
}

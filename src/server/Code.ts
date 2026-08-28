/**
 * Google Apps Script Backend (V8 Runtime)
 * Handles Web App requests (doGet), Container-bound hooks (onOpen),
 * and client-callable RPC functions for CookTeamTool.
 */

import {
  Member,
  ExceptionRule,
  MealDate,
  SurveyResponse,
  SolverOptions,
  ScheduleOutput,
  IntakePayload,
} from "./types";
import { parseSurveySheetData } from "./parser";
import { solveCookAndCleanSchedule } from "./matchmaker";
import {
  MOCK_INTAKE_PAYLOAD,
  MOCK_MEMBERS,
  MOCK_EXCEPTIONS,
} from "./mockData";

/**
 * Web App entry point: Serves the single-file React + Tailwind UI.
 */
function doGet(e?: GoogleAppsScript.Events.DoGet): GoogleAppsScript.HTML.HtmlOutput {
  const template = HtmlService.createTemplateFromFile("index");
  return template
    .evaluate()
    .setTitle("Community Meal Team Scheduler (CookTeamTool)")
    .addMetaTag("viewport", "width=device-width, initial-scale=1.0, maximum-scale=1.0")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Optional Add-on / Sheets menu hook
 */
function onOpen(e?: GoogleAppsScript.Events.AppsScriptEvent): void {
  try {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu("🍳 Cook Team Tool")
      .addItem("Open Scheduler", "openSidebar")
      .addItem("Open Fullscreen", "openModal")
      .addToUi();
  } catch (err) {
    console.log("Not running in container-bound spreadsheet context.");
  }
}

function openSidebar(): void {
  const html = HtmlService.createTemplateFromFile("index")
    .evaluate()
    .setTitle("CookTeamTool");
  SpreadsheetApp.getUi().showSidebar(html);
}

function openModal(): void {
  const html = HtmlService.createTemplateFromFile("index")
    .evaluate()
    .setWidth(1000)
    .setHeight(750);
  SpreadsheetApp.getUi().showModalDialog(html, "Cook & Clean Team Scheduler");
}

// -------------------------------------------------------------
// Client-Callable RPC Functions (google.script.run)
// -------------------------------------------------------------

function getUserInfo(): {
  email: string;
  authMode: string;
  timezone: string;
  timestamp: string;
} {
  try {
    const user = Session.getActiveUser();
    return {
      email: user.getEmail() || "brenda.coordinator@community.local",
      authMode: "V8 Runtime (Google Apps Script)",
      timezone: Session.getScriptTimeZone(),
      timestamp: new Date().toISOString(),
    };
  } catch {
    return {
      email: "brenda.coordinator@community.local",
      authMode: "V8 Runtime",
      timezone: "America/Los_Angeles",
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Parses intake data from a Google Sheet (or returns initialized mock payload).
 */
function getIntakeData(spreadsheetUrlOrId?: string): IntakePayload {
  if (!spreadsheetUrlOrId || spreadsheetUrlOrId.trim() === "") {
    return MOCK_INTAKE_PAYLOAD;
  }

  try {
    let sheet: GoogleAppsScript.Spreadsheet.Spreadsheet;
    const cleanIdOrUrl = spreadsheetUrlOrId.trim();
    if (cleanIdOrUrl.startsWith("http")) {
      sheet = SpreadsheetApp.openByUrl(cleanIdOrUrl);
    } else {
      sheet = SpreadsheetApp.openById(cleanIdOrUrl);
    }

    const firstSheet = sheet.getSheets()[0];
    const data = firstSheet.getDataRange().getValues();

    // Ingest master members and exceptions if tabs exist
    let members = MOCK_MEMBERS;
    const membersTab = sheet.getSheetByName("Members");
    if (membersTab) {
      const mData = membersTab.getDataRange().getValues();
      if (mData.length > 1) {
        members = [];
        for (let i = 1; i < mData.length; i++) {
          const row = mData[i];
          if (row[0]) {
            members.push({
              name: String(row[0]).trim(),
              google_email: String(row[1] || "").trim(),
              active: row[2] === true || String(row[2]).toLowerCase() === "true",
              last_active_survey: row[3] ? String(row[3]).trim() : undefined,
            });
          }
        }
      }
    }

    let exceptions = MOCK_EXCEPTIONS;
    const exceptionsTab = sheet.getSheetByName("Exceptions");
    if (exceptionsTab) {
      const eData = exceptionsTab.getDataRange().getValues();
      if (eData.length > 1) {
        exceptions = [];
        for (let i = 1; i < eData.length; i++) {
          const row = eData[i];
          if (row[0]) {
            exceptions.push({
              id: `RULE-${i}`,
              person_a: String(row[0]).trim(),
              person_b: row[1] ? String(row[1]).trim() : undefined,
              rule_type: String(row[2]).trim() as any,
              target_role_a: row[3] ? (String(row[3]).trim() as any) : undefined,
              target_role_b: row[4] ? (String(row[4]).trim() as any) : undefined,
              is_hard_rule: row[5] === true || String(row[5]).toLowerCase() === "true",
              notes: row[6] ? String(row[6]).trim() : undefined,
            });
          }
        }
      }
    }

    const parsed = parseSurveySheetData(data, members);

    return {
      sheetId: sheet.getId(),
      mealDates: parsed.mealDates,
      responses: parsed.responses,
      audit: parsed.audit,
      exceptions,
      members,
    };
  } catch (err: any) {
    console.error("Error reading spreadsheet:", err);
    throw new Error(`Failed to parse Google Sheet: ${err.message}`);
  }
}

/**
 * Runs the Matchmaker constraint solver
 */
function solveSchedule(
  mealDates: MealDate[],
  responses: SurveyResponse[],
  exceptions: ExceptionRule[],
  options: SolverOptions
): ScheduleOutput {
  return solveCookAndCleanSchedule(mealDates, responses, exceptions, options);
}

/**
 * Updates a member's active status in the database/sheet
 */
function setMemberActiveStatus(name: string, active: boolean): Member[] {
  console.log(`Setting member "${name}" active status to: ${active}`);
  return MOCK_MEMBERS.map((m) =>
    m.name.toLowerCase() === name.toLowerCase() ? { ...m, active } : m
  );
}

/**
 * Saves or updates an exception rule
 */
function saveExceptionRule(rule: ExceptionRule): ExceptionRule[] {
  const existingIdx = MOCK_EXCEPTIONS.findIndex((r) => r.id === rule.id);
  if (existingIdx >= 0) {
    MOCK_EXCEPTIONS[existingIdx] = rule;
  } else {
    MOCK_EXCEPTIONS.push({
      ...rule,
      id: rule.id || `RULE-${Date.now().toString().slice(-4)}`,
    });
  }
  return MOCK_EXCEPTIONS;
}

/**
 * Exports final schedule tab to Google Sheet
 */
function exportScheduleToSheet(
  spreadsheetId: string,
  scheduleOutput: ScheduleOutput
): { success: boolean; sheetName: string; message: string } {
  try {
    const sheet = SpreadsheetApp.openById(spreadsheetId);
    const tabName = `Schedule_${new Date().toISOString().slice(0, 7)}`;
    let outputTab = sheet.getSheetByName(tabName);
    if (!outputTab) {
      outputTab = sheet.insertSheet(tabName);
    } else {
      outputTab.clear();
    }

    // Write header
    const rows: any[][] = [
      ["Date", "Meal Type", "Special Note", "Cook Team", "Clean Team", "Unfilled Slots"],
    ];

    for (const d of scheduleOutput.schedule) {
      rows.push([
        d.dateLabel,
        d.mealType,
        d.specialNote || "",
        d.cooks.join(", "),
        d.cleaners.join(", "),
        d.unfilledCooks + d.unfilledCleaners > 0
          ? `${d.unfilledCooks} cooks, ${d.unfilledCleaners} cleaners`
          : "Full",
      ]);
    }

    outputTab.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
    return {
      success: true,
      sheetName: tabName,
      message: `Successfully published schedule to sheet tab "${tabName}"!`,
    };
  } catch (err: any) {
    console.error("Export error:", err);
    return {
      success: false,
      sheetName: "",
      message: `Export failed: ${err.message}`,
    };
  }
}

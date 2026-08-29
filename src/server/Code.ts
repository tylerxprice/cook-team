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
import { setupCommunityDriveWorkspace, ProvisionResult } from "./setupDrive";

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
// Helper: Resolve Master Registry Spreadsheet
// -------------------------------------------------------------

function getMasterRegistrySpreadsheet(
  customMasterIdOrUrl?: string
): GoogleAppsScript.Spreadsheet.Spreadsheet | null {
  try {
    if (customMasterIdOrUrl && customMasterIdOrUrl.trim() !== "") {
      const clean = customMasterIdOrUrl.trim();
      return clean.startsWith("http")
        ? SpreadsheetApp.openByUrl(clean)
        : SpreadsheetApp.openById(clean);
    }

    const scriptPropId = PropertiesService.getScriptProperties().getProperty(
      "MASTER_REGISTRY_SHEET_ID"
    );
    if (scriptPropId) {
      return SpreadsheetApp.openById(scriptPropId);
    }
  } catch (err) {
    console.warn("Master registry sheet not found or inaccessible:", err);
  }
  return null;
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
 * Provisions Google Drive workspace with Live Master Registry, Dev Master Registry,
 * and 5 synthetic test scenario response sheets.
 */
function setupDriveWorkspace(parentFolderId?: string): ProvisionResult {
  return setupCommunityDriveWorkspace(parentFolderId);
}

/**
 * Parses intake data from a Google Sheet (or returns initialized mock payload).
 */
function getIntakeData(
  spreadsheetUrlOrId?: string,
  masterRegistryUrlOrId?: string
): IntakePayload {
  if (!spreadsheetUrlOrId || spreadsheetUrlOrId.trim() === "") {
    return MOCK_INTAKE_PAYLOAD;
  }

  try {
    let surveySpreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet;
    const cleanSurveyId = spreadsheetUrlOrId.trim();
    if (cleanSurveyId.startsWith("http")) {
      surveySpreadsheet = SpreadsheetApp.openByUrl(cleanSurveyId);
    } else {
      surveySpreadsheet = SpreadsheetApp.openById(cleanSurveyId);
    }

    const firstSheet = surveySpreadsheet.getSheets()[0];
    const surveyData = firstSheet.getDataRange().getValues();

    // 1. Resolve Master Community Registry (either from designated sheet or tabs in survey sheet)
    const masterSpreadsheet =
      getMasterRegistrySpreadsheet(masterRegistryUrlOrId) || surveySpreadsheet;

    let members: Member[] = MOCK_MEMBERS;
    const membersTab = masterSpreadsheet.getSheetByName("Members");
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

    let exceptions: ExceptionRule[] = MOCK_EXCEPTIONS;
    const exceptionsTab = masterSpreadsheet.getSheetByName("Exceptions");
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

    const parsed = parseSurveySheetData(surveyData, members);

    return {
      sheetId: surveySpreadsheet.getId(),
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
function setMemberActiveStatus(
  name: string,
  active: boolean,
  masterSheetId?: string
): Member[] {
  console.log(`Setting member "${name}" active status to: ${active}`);

  try {
    const master = getMasterRegistrySpreadsheet(masterSheetId);
    if (master) {
      const membersSheet = master.getSheetByName("Members");
      if (membersSheet) {
        const data = membersSheet.getDataRange().getValues();
        for (let i = 1; i < data.length; i++) {
          if (String(data[i][0]).trim().toLowerCase() === name.trim().toLowerCase()) {
            membersSheet.getRange(i + 1, 3).setValue(active);
            break;
          }
        }
      }
    }
  } catch (err) {
    console.error("Failed to persist member status to Master Sheet:", err);
  }

  return MOCK_MEMBERS.map((m) =>
    m.name.toLowerCase() === name.toLowerCase() ? { ...m, active } : m
  );
}

/**
 * Adds a new member to the Community Master Registry
 */
function addCommunityMember(member: Member, masterSheetId?: string): Member[] {
  try {
    const master = getMasterRegistrySpreadsheet(masterSheetId);
    if (master) {
      const membersSheet = master.getSheetByName("Members");
      if (membersSheet) {
        membersSheet.appendRow([
          member.name,
          member.google_email || "",
          member.active ?? true,
          member.last_active_survey || new Date().toISOString().slice(0, 7),
        ]);
      }
    }
  } catch (err) {
    console.error("Failed to append member to Master Sheet:", err);
  }

  MOCK_MEMBERS.push(member);
  return MOCK_MEMBERS;
}

/**
 * Saves or updates an exception rule
 */
function saveExceptionRule(
  rule: ExceptionRule,
  masterSheetId?: string
): ExceptionRule[] {
  try {
    const master = getMasterRegistrySpreadsheet(masterSheetId);
    if (master) {
      let exceptionsSheet = master.getSheetByName("Exceptions");
      if (!exceptionsSheet) {
        exceptionsSheet = master.insertSheet("Exceptions");
        exceptionsSheet.appendRow([
          "Person A",
          "Person B",
          "Rule Type",
          "Target Role A",
          "Target Role B",
          "Is Hard Rule",
          "Notes",
        ]);
      }

      const data = exceptionsSheet.getDataRange().getValues();
      let foundRow = -1;
      for (let i = 1; i < data.length; i++) {
        if (
          String(data[i][0]).trim().toLowerCase() === rule.person_a.trim().toLowerCase() &&
          String(data[i][1] || "").trim().toLowerCase() === (rule.person_b || "").trim().toLowerCase()
        ) {
          foundRow = i + 1;
          break;
        }
      }

      const rowValues = [
        rule.person_a,
        rule.person_b || "",
        rule.rule_type,
        rule.target_role_a || "",
        rule.target_role_b || "",
        rule.is_hard_rule,
        rule.notes || "",
      ];

      if (foundRow > 0) {
        exceptionsSheet.getRange(foundRow, 1, 1, rowValues.length).setValues([rowValues]);
      } else {
        exceptionsSheet.appendRow(rowValues);
      }
    }
  } catch (err) {
    console.error("Failed to persist exception rule to Master Sheet:", err);
  }

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

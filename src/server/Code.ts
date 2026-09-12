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
  DaySchedule,
  EmailPayload,
  EmailResult,
  EmailDispatchInfo,
  CommunityReportSummary,
} from "./types";
import { parseSurveySheetData, extractEmails, extractAliases, parseSheetBoolean } from "./parser";
import { solveCookAndCleanSchedule } from "./matchmaker";
import { computeCommunityReportSummary, MonthScheduleRecord } from "./reports";
import { MOCK_INTAKE_PAYLOAD, MOCK_MEMBERS, MOCK_EXCEPTIONS } from "./mockData";
import {
  setupCommunityDriveWorkspace,
  createDriveWebAppLinkLaunchers,
  listDriveSpreadsheets,
  updateUserGuideDoc,
  ProvisionResult,
  DriveSheetItem,
} from "./setupDrive";
import { scanHistoricalDriveFolder, importHistoricalMonthsToEnvironment } from "./historical";
import { getBaselineHistoricalSchedules } from "./historicalArchiveData";
import { parseScheduleGridData, parseDateFromLabelOrKey } from "./scheduleParser";
import {
  inspectMealSignupWorkbook,
  executeCreateMealSignupTab,
  MealSignupExportOptions,
  MealSignupExportResult,
  MealSignupWorkbookInfo,
} from "./signupWorkbook";
import {
  generateMonthlySurveyDates,
  deriveFormTitle,
  executeCreateSurveyForm,
} from "./surveyFormGenerator";
import { SurveyFormDateConfig, CreateSurveyFormPayload, CreateSurveyFormResult } from "./types";

/**
 * Generates server-side bootstrap payload for zero-RPC instant client hydration on load.
 */
function getInitialBootstrapData(): {
  userInfo: ReturnType<typeof getUserInfo>;
  registry: { members: Member[]; exceptions: ExceptionRule[] };
  driveSheets: DriveSheetItem[];
} {
  try {
    const userInfo = getUserInfo();
    const registry = getMasterRegistryData(userInfo.isDevMode);
    let driveSheets: DriveSheetItem[] = [];
    try {
      driveSheets = listAvailableDriveSheets();
    } catch (e) {
      console.warn("Could not list drive sheets in bootstrap:", e);
    }
    return {
      userInfo,
      registry,
      driveSheets,
    };
  } catch (err) {
    console.warn("Bootstrap data generation failed:", err);
    return {
      userInfo: getUserInfo(),
      registry: { members: [], exceptions: [] },
      driveSheets: [],
    };
  }
}

/**
 * Web App entry point: Serves the single-file React + Tailwind UI.
 */
function doGet(e?: any): any {
  if (e?.parameter?.action === "runHistoricalImport") {
    try {
      const res = importHistoricalMonthsToEnvironment(
        e.parameter.folderId || "1Lm-l2Cm8DFO4swnPuDHpYlTz8FOGN8df",
        e.parameter.targetEnv || "prod",
        e.parameter.rootFolderId || "1U0cJqnxCgWn-5k0RCj2BjCUj9nc1dMGl"
      );
      return ContentService.createTextOutput(JSON.stringify(res, null, 2)).setMimeType(
        ContentService.MimeType.JSON
      );
    } catch (err: any) {
      return ContentService.createTextOutput(
        JSON.stringify({ success: false, error: err.message, stack: err.stack }, null, 2)
      ).setMimeType(ContentService.MimeType.JSON);
    }
  }

  if (e?.parameter?.action === "scanHistorical") {
    try {
      const res = scanHistoricalDriveFolder(
        e.parameter.folderId || "1Lm-l2Cm8DFO4swnPuDHpYlTz8FOGN8df"
      );
      return ContentService.createTextOutput(JSON.stringify(res, null, 2)).setMimeType(
        ContentService.MimeType.JSON
      );
    } catch (err: any) {
      return ContentService.createTextOutput(
        JSON.stringify({ success: false, error: err.message, stack: err.stack }, null, 2)
      ).setMimeType(ContentService.MimeType.JSON);
    }
  }

  const template = HtmlService.createTemplateFromFile("index");
  (template as any).bootstrapData = getInitialBootstrapData();
  return template
    .evaluate()
    .setTitle("Community Cook Team App")
    .addMetaTag("viewport", "width=device-width, initial-scale=1.0, maximum-scale=1.0")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Optional Add-on / Sheets menu hook
 */
function onOpen(_e?: GoogleAppsScript.Events.AppsScriptEvent): void {
  try {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu("🍳 Cook Team Tool")
      .addItem("Open Scheduler", "openSidebar")
      .addItem("Open Fullscreen", "openModal")
      .addToUi();
  } catch {
    console.log("Not running in container-bound spreadsheet context.");
  }
}

function openSidebar(): void {
  const template = HtmlService.createTemplateFromFile("index");
  (template as any).bootstrapData = getInitialBootstrapData();
  const html = template.evaluate().setTitle("CookTeamTool");
  SpreadsheetApp.getUi().showSidebar(html);
}

function openModal(): void {
  const template = HtmlService.createTemplateFromFile("index");
  (template as any).bootstrapData = getInitialBootstrapData();
  const html = template.evaluate().setWidth(1000).setHeight(750);
  SpreadsheetApp.getUi().showModalDialog(html, "Cook & Clean Team Scheduler");
}

// -------------------------------------------------------------
// Helper: Resolve Master Registry Spreadsheet
// -------------------------------------------------------------

function getMasterRegistrySpreadsheet(
  customMasterIdOrUrl?: string,
  isDevMode?: boolean
): GoogleAppsScript.Spreadsheet.Spreadsheet | null {
  try {
    if (customMasterIdOrUrl && customMasterIdOrUrl.trim() !== "") {
      const clean = customMasterIdOrUrl.trim();
      return clean.startsWith("http")
        ? SpreadsheetApp.openByUrl(clean)
        : SpreadsheetApp.openById(clean);
    }

    let dev = isDevMode;
    if (typeof dev === "undefined") {
      try {
        const url = ScriptApp.getService().getUrl() || "";
        dev = url.endsWith("/dev");
      } catch {
        dev = false;
      }
    }

    const propKey = dev ? "DEV_MASTER_REGISTRY_SHEET_ID" : "MASTER_REGISTRY_SHEET_ID";
    const scriptPropId = PropertiesService.getScriptProperties().getProperty(propKey);
    if (scriptPropId) {
      try {
        return SpreadsheetApp.openById(scriptPropId);
      } catch (e) {
        console.warn(`Could not open master by property ID (${propKey}):`, e);
      }
    }

    // Locate Master Registry in the appropriate folder: 01_Live_Production vs 02_Dev_and_Testing
    try {
      const rootFolder = DriveApp.getFolderById("1U0cJqnxCgWn-5k0RCj2BjCUj9nc1dMGl");
      const targetFolderName = dev ? "02_Dev_and_Testing" : "01_Live_Production";
      const targetFolders = rootFolder.getFoldersByName(targetFolderName);
      if (targetFolders.hasNext()) {
        const targetFolder = targetFolders.next();
        const files = targetFolder.getFilesByType(MimeType.GOOGLE_SHEETS);
        while (files.hasNext()) {
          const f = files.next();
          if (f.getName().includes("Master") || f.getName().includes("Registry")) {
            PropertiesService.getScriptProperties().setProperty(propKey, f.getId());
            return SpreadsheetApp.openById(f.getId());
          }
        }
      }
    } catch (driveErr) {
      console.warn("Drive search for Master Registry error:", driveErr);
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
  isDevMode: boolean;
} {
  let isDevMode = false;
  try {
    const url = ScriptApp.getService().getUrl() || "";
    isDevMode = url.endsWith("/dev");
  } catch {
    isDevMode = false;
  }

  try {
    const user = Session.getActiveUser();
    return {
      email: user.getEmail() || "coordinator@community.local",
      authMode: "V8 Runtime (Google Apps Script)",
      timezone: Session.getScriptTimeZone(),
      timestamp: new Date().toISOString(),
      isDevMode,
    };
  } catch {
    return {
      email: "coordinator@community.local",
      authMode: "V8 Runtime",
      timezone: "America/Los_Angeles",
      timestamp: new Date().toISOString(),
      isDevMode: false,
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
 * Creates web app launch shortcut files (Google Docs and HTML) in Google Drive
 */
function createWebAppLinkLaunchers(parentFolderId?: string) {
  return createDriveWebAppLinkLaunchers(parentFolderId);
}

/**
 * Lists all available Google Sheets in the community Drive workspace
 */
function listAvailableDriveSheets(parentFolderId?: string): DriveSheetItem[] {
  return listDriveSpreadsheets(parentFolderId);
}

/**
 * Fetches the Master Community Registry data (members and rules) on demand.
 */
function getMasterRegistryData(
  masterRegistryUrlOrIdOrDev?: string | boolean,
  isDevMode?: boolean
): { members: Member[]; exceptions: ExceptionRule[] } {
  let masterUrlOrId: string | undefined = undefined;
  let dev: boolean | undefined = undefined;

  if (typeof masterRegistryUrlOrIdOrDev === "boolean") {
    dev = masterRegistryUrlOrIdOrDev;
  } else if (typeof masterRegistryUrlOrIdOrDev === "string") {
    masterUrlOrId = masterRegistryUrlOrIdOrDev;
    dev = isDevMode;
  } else {
    dev = isDevMode;
  }

  if (typeof dev === "undefined") {
    try {
      const url = ScriptApp.getService().getUrl() || "";
      dev = url.endsWith("/dev");
    } catch {
      dev = false;
    }
  }

  const masterSpreadsheet = getMasterRegistrySpreadsheet(masterUrlOrId, dev);
  let members: Member[] = [];
  let exceptions: ExceptionRule[] = [];

  if (masterSpreadsheet) {
    const membersTab = masterSpreadsheet.getSheetByName("Members");
    if (membersTab) {
      const mData = membersTab.getDataRange().getValues();
      for (let i = 1; i < mData.length; i++) {
        const row = mData[i];
        if (row[0] && String(row[0]).trim() !== "") {
          const isActive = parseSheetBoolean(row[2], true);

          const rawEmail = String(row[1] || "").trim();
          const emails = extractEmails(rawEmail);
          const rawAliases = row[4] ? String(row[4]).trim() : "";
          const aliases = extractAliases(rawAliases);

          members.push({
            name: String(row[0]).trim(),
            google_email: rawEmail,
            active: isActive,
            last_active_survey: row[3] ? String(row[3]).trim() : undefined,
            aliases: aliases.length > 0 ? aliases : undefined,
            alternate_emails: emails.length > 1 ? emails.slice(1) : undefined,
          });
        }
      }
    }

    const exceptionsTab = masterSpreadsheet.getSheetByName("Exceptions");
    if (exceptionsTab) {
      const eData = exceptionsTab.getDataRange().getValues();
      for (let i = 1; i < eData.length; i++) {
        const row = eData[i];
        if (row[0] && String(row[0]).trim() !== "") {
          const isHard = parseSheetBoolean(row[5], true);

          exceptions.push({
            id: `RULE-${i}`,
            person_a: String(row[0]).trim(),
            person_b: row[1] ? String(row[1]).trim() : undefined,
            rule_type: String(row[2]).trim() as any,
            target_role_a: row[3] ? (String(row[3]).trim() as any) : undefined,
            target_role_b: row[4] ? (String(row[4]).trim() as any) : undefined,
            is_hard_rule: isHard,
            notes: row[6] ? String(row[6]).trim() : undefined,
          });
        }
      }
    }
  }

  if (members.length === 0 && dev) {
    members = MOCK_MEMBERS;
    exceptions = MOCK_EXCEPTIONS;
  }

  members.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  return { members, exceptions };
}

/**
 * Parses intake data from a Google Sheet (or returns initialized mock payload).
 * Accepts optional cached members and exceptions to skip re-reading the master registry workbook.
 */
function getIntakeData(
  spreadsheetUrlOrId?: string,
  masterRegistryUrlOrId?: string,
  providedMembers?: Member[],
  providedExceptions?: ExceptionRule[]
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

    // Determine dev mode from URL or survey file location
    let isDevMode = false;
    try {
      const url = ScriptApp.getService().getUrl() || "";
      isDevMode = url.endsWith("/dev");
    } catch {}

    let members: Member[] = [];
    let exceptions: ExceptionRule[] = [];

    // Optimization: If caller provided pre-loaded members, bypass opening master registry workbook
    if (Array.isArray(providedMembers) && providedMembers.length > 0) {
      members = providedMembers;
      exceptions = Array.isArray(providedExceptions) ? providedExceptions : [];
    } else {
      try {
        const file = DriveApp.getFileById(surveySpreadsheet.getId());
        const parents = file.getParents();
        while (parents.hasNext()) {
          const p = parents.next();
          if (p.getName().includes("Dev")) {
            isDevMode = true;
            break;
          }
        }
      } catch {}

      // 1. Resolve Master Community Registry from appropriate environment folder
      const masterSpreadsheet =
        getMasterRegistrySpreadsheet(masterRegistryUrlOrId, isDevMode) || surveySpreadsheet;

      if (masterSpreadsheet) {
        const membersTab = masterSpreadsheet.getSheetByName("Members");
        if (membersTab) {
          const mData = membersTab.getDataRange().getValues();
          if (mData.length > 1) {
            for (let i = 1; i < mData.length; i++) {
              const row = mData[i];
              if (row[0] && String(row[0]).trim() !== "") {
                const isActive = parseSheetBoolean(row[2], true);

                const rawEmail = String(row[1] || "").trim();
                const emails = extractEmails(rawEmail);
                const rawAliases = row[4] ? String(row[4]).trim() : "";
                const aliases = extractAliases(rawAliases);

                members.push({
                  name: String(row[0]).trim(),
                  google_email: rawEmail,
                  active: isActive,
                  last_active_survey: row[3] ? String(row[3]).trim() : undefined,
                  aliases: aliases.length > 0 ? aliases : undefined,
                  alternate_emails: emails.length > 1 ? emails.slice(1) : undefined,
                });
              }
            }
          }
        }

        const exceptionsTab = masterSpreadsheet.getSheetByName("Exceptions");
        if (exceptionsTab) {
          const eData = exceptionsTab.getDataRange().getValues();
          if (eData.length > 1) {
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
                  is_hard_rule: parseSheetBoolean(row[5], true),
                  notes: row[6] ? String(row[6]).trim() : undefined,
                });
              }
            }
          }
        }
      }

      // Fallback: If no members tab found in registry, extract from survey responses or mock
      if (members.length === 0) {
        if (isDevMode) {
          members = MOCK_MEMBERS;
          exceptions = MOCK_EXCEPTIONS;
        } else {
          const respondentsFromSurvey: Member[] = [];
          for (let r = 1; r < surveyData.length; r++) {
            const row = surveyData[r];
            const email = String(row[1] || "").trim();
            const name = String(row[2] || "").trim();
            if (
              name &&
              !respondentsFromSurvey.some((m) => m.name.toLowerCase() === name.toLowerCase())
            ) {
              respondentsFromSurvey.push({
                name,
                google_email: email,
                active: true,
                last_active_survey: "2026-10",
              });
            }
          }
          members = respondentsFromSurvey.length > 0 ? respondentsFromSurvey : MOCK_MEMBERS;
        }
      }
    }

    const parsed = parseSurveySheetData(surveyData, members, surveySpreadsheet.getName());

    // Detect if a Schedule tab already exists in this spreadsheet
    let existingScheduleTab:
      { name: string; url?: string; exists: boolean; dateMonth?: string } | undefined = undefined;
    const allSheets = surveySpreadsheet.getSheets();
    const schedSheet = allSheets.find((s) => s.getName().startsWith("Schedule_"));
    if (schedSheet) {
      const tabName = schedSheet.getName();
      existingScheduleTab = {
        name: tabName,
        url: `${surveySpreadsheet.getUrl()}#gid=${schedSheet.getSheetId()}`,
        exists: true,
        dateMonth: tabName.replace("Schedule_", ""),
      };
    }

    // Detect if an announcement email was already sent for this month
    const surveyMonthKey =
      parsed.mealDates.length > 0 && parsed.mealDates[0].dateKey
        ? parsed.mealDates[0].dateKey.slice(0, 7)
        : undefined;
    const emailDispatchInfo =
      getEmailDispatchMetadata(surveySpreadsheet, surveyMonthKey) || undefined;

    return {
      sheetId: surveySpreadsheet.getId(),
      mealDates: parsed.mealDates,
      responses: parsed.responses,
      audit: parsed.audit,
      exceptions,
      members,
      existingScheduleTab,
      emailDispatchInfo,
    };
  } catch (err: any) {
    console.error("Error reading spreadsheet:", err);
    throw new Error(`Failed to parse Google Sheet: ${err.message}`);
  }
}

/**
 * Loads a previously saved schedule from an existing "Schedule_YYYY-MM" tab in Google Sheets.
 */
function loadExistingScheduleFromSheet(
  spreadsheetUrlOrId: string,
  tabName?: string
): ScheduleOutput {
  try {
    let surveySpreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet;
    const cleanId = (spreadsheetUrlOrId || "").trim();
    if (cleanId.startsWith("http")) {
      surveySpreadsheet = SpreadsheetApp.openByUrl(cleanId);
    } else {
      surveySpreadsheet = SpreadsheetApp.openById(cleanId);
    }

    let targetTab: GoogleAppsScript.Spreadsheet.Sheet | null = null;
    if (tabName) {
      targetTab = surveySpreadsheet.getSheetByName(tabName);
    }
    if (!targetTab) {
      const allSheets = surveySpreadsheet.getSheets();
      targetTab = allSheets.find((s) => s.getName().startsWith("Schedule_")) || null;
    }

    if (!targetTab) {
      throw new Error(`Schedule tab not found in spreadsheet.`);
    }

    const data = targetTab.getDataRange().getValues();
    if (data.length <= 1) {
      throw new Error(`Schedule tab is empty.`);
    }

    const formTab =
      surveySpreadsheet.getSheetByName("Form Responses 1") || surveySpreadsheet.getSheets()[0];
    let responses: SurveyResponse[] | undefined = undefined;
    if (formTab) {
      try {
        const formData = formTab.getDataRange().getValues();
        const parsedSurvey = parseSurveySheetData(formData, []);
        responses = parsedSurvey.responses;
      } catch (e) {
        console.warn("Could not parse survey responses for memberStats:", e);
      }
    }

    return parseScheduleGridData(data, responses);
  } catch (err: any) {
    console.error("Failed to load existing schedule:", err);
    throw new Error(`Failed to load schedule from sheet: ${err.message}`);
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
  masterSheetId?: string,
  isDevMode?: boolean
): Member[] {
  console.log(`Setting member "${name}" active status to: ${active}`);

  let dev = isDevMode;
  if (typeof dev === "undefined") {
    try {
      const url = ScriptApp.getService().getUrl() || "";
      dev = url.endsWith("/dev");
    } catch {
      dev = false;
    }
  }

  try {
    const master = getMasterRegistrySpreadsheet(masterSheetId, dev);
    if (master) {
      let membersSheet = master.getSheetByName("Members");
      if (!membersSheet) {
        membersSheet = master.insertSheet("Members", 0);
        membersSheet.appendRow(["Name", "Google Email", "Active", "Last Active Survey"]);
      }

      const data = membersSheet.getDataRange().getValues();
      let found = false;
      const target = name.trim().toLowerCase();

      // 1. Exact match pass
      for (let i = 1; i < data.length; i++) {
        const rowName = String(data[i][0] || "")
          .trim()
          .toLowerCase();
        if (rowName === target) {
          membersSheet.getRange(i + 1, 3).setValue(active);
          found = true;
          break;
        }
      }

      // 2. Fuzzy / prefix match pass if not found
      if (!found) {
        for (let i = 1; i < data.length; i++) {
          const rowName = String(data[i][0] || "")
            .trim()
            .toLowerCase();
          if (rowName && (rowName.startsWith(target) || target.startsWith(rowName))) {
            membersSheet.getRange(i + 1, 3).setValue(active);
            found = true;
            break;
          }
        }
      }

      // 3. If still not in the sheet, append a new row so the status is recorded!
      if (!found) {
        membersSheet.appendRow([name.trim(), "", active, new Date().toISOString().slice(0, 7)]);
      }

      SpreadsheetApp.flush();
    }
  } catch (err) {
    console.error("Failed to persist member status to Master Sheet:", err);
  }

  const refreshed = getMasterRegistryData(masterSheetId, dev).members;
  return refreshed.length > 0
    ? refreshed
    : MOCK_MEMBERS.map((m) => (m.name.toLowerCase() === name.toLowerCase() ? { ...m, active } : m));
}

/**
 * Adds a new member to the Community Master Registry
 */
function addCommunityMember(member: Member, masterSheetId?: string, isDevMode?: boolean): Member[] {
  let dev = isDevMode;
  if (typeof dev === "undefined") {
    try {
      const url = ScriptApp.getService().getUrl() || "";
      dev = url.endsWith("/dev");
    } catch {
      dev = false;
    }
  }

  try {
    const master = getMasterRegistrySpreadsheet(masterSheetId, dev);
    if (master) {
      let membersSheet = master.getSheetByName("Members");
      if (!membersSheet) {
        membersSheet = master.insertSheet("Members", 0);
        membersSheet.appendRow(["Name", "Google Email", "Active", "Last Active Survey", "Aliases"]);
      }
      membersSheet.appendRow([
        member.name,
        member.google_email || "",
        member.active ?? true,
        member.last_active_survey || new Date().toISOString().slice(0, 7),
        (member.aliases || []).join(", "),
      ]);
      SpreadsheetApp.flush();
    }
  } catch (err) {
    console.error("Failed to append member to Master Sheet:", err);
  }

  const refreshed = getMasterRegistryData(masterSheetId, dev).members;
  if (refreshed.length > 0) return refreshed;

  MOCK_MEMBERS.push(member);
  return MOCK_MEMBERS;
}

/**
 * Bulk saves or replaces members in the Master Community Registry
 */
function bulkSaveCommunityMembers(
  newMembers: Member[],
  masterSheetId?: string,
  isDevMode?: boolean
): Member[] {
  try {
    const master = getMasterRegistrySpreadsheet(masterSheetId, isDevMode);
    if (master) {
      let membersSheet = master.getSheetByName("Members");
      if (!membersSheet) {
        membersSheet = master.insertSheet("Members", 0);
      }
      membersSheet.clear();

      const rows: any[][] = [["Name", "Google Email", "Active", "Last Active Survey", "Aliases"]];

      for (const m of newMembers) {
        rows.push([
          m.name,
          m.google_email || "",
          m.active !== false,
          m.last_active_survey || new Date().toISOString().slice(0, 7),
          (m.aliases || []).join(", "),
        ]);
      }

      membersSheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
      const headerRange = membersSheet.getRange(1, 1, 1, 5);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#e0f2fe");
      headerRange.setFontColor("#1e293b");
      membersSheet.setFrozenRows(1);
      SpreadsheetApp.flush();
    }
  } catch (err) {
    console.error("Failed to bulk save members to Master Sheet:", err);
  }

  const refreshed = getMasterRegistryData(isDevMode).members;
  return refreshed.length > 0 ? refreshed : newMembers;
}

/**
 * Links an alias name and/or alternate email to an existing canonical member in the Master Registry
 */
function linkMemberAlias(
  canonicalName: string,
  aliasName: string,
  aliasEmail?: string,
  masterSheetId?: string,
  isDevMode?: boolean
): Member[] {
  let dev = isDevMode;
  if (typeof dev === "undefined") {
    try {
      const url = ScriptApp.getService().getUrl() || "";
      dev = url.endsWith("/dev");
    } catch {
      dev = false;
    }
  }

  try {
    const master = getMasterRegistrySpreadsheet(masterSheetId, dev);
    if (master) {
      let membersSheet = master.getSheetByName("Members");
      if (!membersSheet) {
        membersSheet = master.insertSheet("Members", 0);
        membersSheet.appendRow(["Name", "Google Email", "Active", "Last Active Survey", "Aliases"]);
      }

      const data = membersSheet.getDataRange().getValues();
      let foundRow = -1;
      const target = canonicalName.trim().toLowerCase();

      for (let i = 1; i < data.length; i++) {
        const rowName = String(data[i][0] || "")
          .trim()
          .toLowerCase();
        if (rowName === target) {
          foundRow = i + 1;
          break;
        }
      }

      if (foundRow > 0) {
        // Update Emails
        const existingEmails = extractEmails(String(data[foundRow - 1][1] || ""));
        if (aliasEmail && aliasEmail.trim()) {
          const cleanEmail = aliasEmail.trim().toLowerCase();
          if (!existingEmails.includes(cleanEmail)) {
            existingEmails.push(cleanEmail);
            membersSheet.getRange(foundRow, 2).setValue(existingEmails.join(", "));
          }
        }

        // Update Aliases (column 5)
        try {
          if (!membersSheet.getRange(1, 5).getValue()) {
            membersSheet.getRange(1, 5).setValue("Aliases");
            membersSheet.getRange(1, 5).setFontWeight("bold");
          }
        } catch {}

        const existingAliases = extractAliases(String(data[foundRow - 1][4] || ""));
        if (aliasName && aliasName.trim()) {
          const cleanAlias = aliasName.trim();
          if (!existingAliases.some((a) => a.toLowerCase() === cleanAlias.toLowerCase())) {
            existingAliases.push(cleanAlias);
            membersSheet.getRange(foundRow, 5).setValue(existingAliases.join(", "));
          }
        }
      } else {
        // Canonical member not yet found in sheet, append a new row
        membersSheet.appendRow([
          canonicalName.trim(),
          aliasEmail ? aliasEmail.trim() : "",
          true,
          new Date().toISOString().slice(0, 7),
          aliasName.trim(),
        ]);
      }
      SpreadsheetApp.flush();
    }
  } catch (err) {
    console.error("Failed to link member alias in Master Sheet:", err);
  }

  const refreshed = getMasterRegistryData(masterSheetId, dev).members;
  if (refreshed.length > 0) return refreshed;

  // Dev / Mock fallback
  const mem = MOCK_MEMBERS.find((m) => m.name.toLowerCase() === canonicalName.toLowerCase());
  if (mem) {
    if (aliasName && !mem.aliases?.some((a) => a.toLowerCase() === aliasName.toLowerCase())) {
      mem.aliases = [...(mem.aliases || []), aliasName.trim()];
    }
    if (aliasEmail && aliasEmail.trim()) {
      const ems = extractEmails(mem.google_email);
      if (!ems.includes(aliasEmail.trim().toLowerCase())) {
        ems.push(aliasEmail.trim().toLowerCase());
        mem.google_email = ems.join(", ");
      }
    }
  }
  return MOCK_MEMBERS;
}

/**
 * Updates a member's name, emails, active status, and aliases in the Master Registry
 */
function updateCommunityMember(
  originalName: string,
  updatedMember: Member,
  masterSheetId?: string,
  isDevMode?: boolean
): Member[] {
  let dev = isDevMode;
  if (typeof dev === "undefined") {
    try {
      const url = ScriptApp.getService().getUrl() || "";
      dev = url.endsWith("/dev");
    } catch {
      dev = false;
    }
  }

  try {
    const master = getMasterRegistrySpreadsheet(masterSheetId, dev);
    if (master) {
      let membersSheet = master.getSheetByName("Members");
      if (!membersSheet) {
        membersSheet = master.insertSheet("Members", 0);
        membersSheet.appendRow(["Name", "Google Email", "Active", "Last Active Survey", "Aliases"]);
      }

      const data = membersSheet.getDataRange().getValues();
      let foundRow = -1;
      const target = originalName.trim().toLowerCase();

      for (let i = 1; i < data.length; i++) {
        const rowName = String(data[i][0] || "")
          .trim()
          .toLowerCase();
        if (rowName === target) {
          foundRow = i + 1;
          break;
        }
      }

      const emailVal = extractEmails(updatedMember.google_email).join(", ");
      const aliasVal = extractAliases(updatedMember.aliases).join(", ");

      // Ensure Column E header exists
      try {
        if (!membersSheet.getRange(1, 5).getValue()) {
          membersSheet.getRange(1, 5).setValue("Aliases");
          membersSheet.getRange(1, 5).setFontWeight("bold");
        }
      } catch {
        // Non-fatal header check
      }

      if (foundRow > 0) {
        membersSheet.getRange(foundRow, 1).setValue(updatedMember.name.trim());
        membersSheet.getRange(foundRow, 2).setValue(emailVal);
        membersSheet.getRange(foundRow, 3).setValue(updatedMember.active);
        if (updatedMember.last_active_survey) {
          membersSheet.getRange(foundRow, 4).setValue(updatedMember.last_active_survey);
        }
        membersSheet.getRange(foundRow, 5).setValue(aliasVal);
      } else {
        membersSheet.appendRow([
          updatedMember.name.trim(),
          emailVal,
          updatedMember.active,
          updatedMember.last_active_survey || new Date().toISOString().slice(0, 7),
          aliasVal,
        ]);
      }
      SpreadsheetApp.flush();
    }
  } catch (err) {
    console.error("Failed to update member in Master Sheet:", err);
  }

  const refreshed = getMasterRegistryData(masterSheetId, dev).members;
  if (refreshed.length > 0) return refreshed;

  // Dev / Mock fallback
  const idx = MOCK_MEMBERS.findIndex((m) => m.name.toLowerCase() === originalName.toLowerCase());
  if (idx >= 0) {
    MOCK_MEMBERS[idx] = { ...updatedMember };
  } else {
    MOCK_MEMBERS.push({ ...updatedMember });
  }
  return MOCK_MEMBERS;
}

/**
 * Reads all exception rules from the Master Spreadsheet Exceptions tab
 */
function getCommunityExceptionRules(masterSheetId?: string, isDevMode?: boolean): ExceptionRule[] {
  try {
    const master = getMasterRegistrySpreadsheet(masterSheetId, isDevMode);
    if (!master) return MOCK_EXCEPTIONS;
    const exceptionsTab = master.getSheetByName("Exceptions");
    if (!exceptionsTab) return [];
    const eData = exceptionsTab.getDataRange().getValues();
    const list: ExceptionRule[] = [];
    for (let i = 1; i < eData.length; i++) {
      const row = eData[i];
      if (row[0]) {
        list.push({
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
    return list;
  } catch (err) {
    console.error("Failed to read exception rules from Master Sheet:", err);
    return MOCK_EXCEPTIONS;
  }
}

/**
 * Saves or updates an exception rule in the Master Sheet
 */
function saveExceptionRule(
  rule: ExceptionRule,
  masterSheetId?: string,
  isDevMode?: boolean
): ExceptionRule[] {
  let dev = isDevMode;
  if (typeof dev === "undefined") {
    try {
      const url = ScriptApp.getService().getUrl() || "";
      dev = url.endsWith("/dev");
    } catch {
      dev = false;
    }
  }

  try {
    const master = getMasterRegistrySpreadsheet(masterSheetId, dev);
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
      // If rule has an existing ID like RULE-3, extract row index 4
      if (rule.id && rule.id.startsWith("RULE-")) {
        const parsedIdx = parseInt(rule.id.replace("RULE-", ""), 10);
        if (!isNaN(parsedIdx) && parsedIdx >= 1 && parsedIdx < data.length) {
          foundRow = parsedIdx + 1;
        }
      }

      if (foundRow < 0) {
        for (let i = 1; i < data.length; i++) {
          if (
            String(data[i][0]).trim().toLowerCase() === rule.person_a.trim().toLowerCase() &&
            String(data[i][1] || "")
              .trim()
              .toLowerCase() === (rule.person_b || "").trim().toLowerCase() &&
            String(data[i][2] || "")
              .trim()
              .toUpperCase() === rule.rule_type.toUpperCase()
          ) {
            foundRow = i + 1;
            break;
          }
        }
      }

      const rowValues = [
        rule.person_a,
        rule.person_b || "",
        rule.rule_type,
        rule.target_role_a || "",
        rule.target_role_b || "",
        rule.is_hard_rule ?? true,
        rule.notes || "",
      ];

      if (foundRow > 0) {
        exceptionsSheet.getRange(foundRow, 1, 1, rowValues.length).setValues([rowValues]);
      } else {
        exceptionsSheet.appendRow(rowValues);
      }

      SpreadsheetApp.flush();
      return getCommunityExceptionRules(masterSheetId, dev);
    }
  } catch (err) {
    console.error("Failed to persist exception rule to Master Sheet:", err);
  }

  // Fallback in-memory
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
 * Deletes an exception rule from the Master Sheet
 */
function deleteExceptionRule(
  ruleIdOrIndex: string,
  masterSheetId?: string,
  isDevMode?: boolean
): ExceptionRule[] {
  let dev = isDevMode;
  if (typeof dev === "undefined") {
    try {
      const url = ScriptApp.getService().getUrl() || "";
      dev = url.endsWith("/dev");
    } catch {
      dev = false;
    }
  }

  try {
    const master = getMasterRegistrySpreadsheet(masterSheetId, dev);
    if (master) {
      const exceptionsSheet = master.getSheetByName("Exceptions");
      if (exceptionsSheet) {
        const data = exceptionsSheet.getDataRange().getValues();
        let targetRow = -1;
        if (ruleIdOrIndex.startsWith("RULE-")) {
          const parsed = parseInt(ruleIdOrIndex.replace("RULE-", ""), 10);
          if (!isNaN(parsed) && parsed >= 1 && parsed < data.length) {
            targetRow = parsed + 1;
          }
        }

        if (targetRow > 0) {
          exceptionsSheet.deleteRow(targetRow);
        }
        SpreadsheetApp.flush();
        return getCommunityExceptionRules(masterSheetId, dev);
      }
    }
  } catch (err) {
    console.error("Failed to delete exception rule from Master Sheet:", err);
  }

  const idx = MOCK_EXCEPTIONS.findIndex((r) => r.id === ruleIdOrIndex);
  if (idx >= 0) {
    MOCK_EXCEPTIONS.splice(idx, 1);
  }
  return MOCK_EXCEPTIONS;
}

/**
 * Exports final schedule tab to Google Sheet
 */
function exportScheduleToSheet(
  spreadsheetIdOrUrl: string,
  scheduleOutput: ScheduleOutput
): { success: boolean; sheetName: string; url?: string; message: string } {
  try {
    let sheet: GoogleAppsScript.Spreadsheet.Spreadsheet;
    const clean = (spreadsheetIdOrUrl || "").trim();
    if (clean.startsWith("http")) {
      sheet = SpreadsheetApp.openByUrl(clean);
    } else {
      sheet = SpreadsheetApp.openById(clean);
    }

    // Determine month string from schedule if available (e.g. 2026-08 or 2026-10)
    let monthSuffix = "";
    if (scheduleOutput?.schedule?.length > 0) {
      for (const d of scheduleOutput.schedule) {
        if (d.dateKey && /^\d{4}-\d{2}/.test(d.dateKey)) {
          monthSuffix = d.dateKey.slice(0, 7);
          break;
        }
        const parsed = parseDateFromLabelOrKey(d.dateLabel, d.dateKey);
        if (parsed && !isNaN(parsed.getTime())) {
          const yr = parsed.getFullYear();
          const mo = String(parsed.getMonth() + 1).padStart(2, "0");
          monthSuffix = `${yr}-${mo}`;
          break;
        }
      }
    }
    if (!monthSuffix) {
      monthSuffix = new Date().toISOString().slice(0, 7);
    }
    const tabName = `Schedule_${monthSuffix}`;

    let outputTab = sheet.getSheetByName(tabName);
    if (!outputTab) {
      outputTab = sheet.insertSheet(tabName);
    } else {
      outputTab.clear();
    }

    // Calculate max cooks and cleaners (minimum 3 each)
    let maxCooks = 3;
    let maxCleans = 3;
    for (const d of scheduleOutput.schedule) {
      if (d.cooks.length > maxCooks) maxCooks = d.cooks.length;
      if (d.cleaners.length > maxCleans) maxCleans = d.cleaners.length;
    }

    // Header
    const headers = ["Date", "Meal Type", "Special Note"];
    for (let i = 1; i <= maxCooks; i++) headers.push(`Cook ${i}`);
    for (let i = 1; i <= maxCleans; i++) headers.push(`Clean ${i}`);
    headers.push("Status / Notes");

    const rows: any[][] = [headers];

    for (const d of scheduleOutput.schedule) {
      const dateObj = parseDateFromLabelOrKey(d.dateLabel, d.dateKey);
      const dateVal = dateObj || d.dateLabel;
      const row: any[] = [dateVal, d.mealType, d.specialNote || ""];
      for (let i = 0; i < maxCooks; i++) {
        row.push(d.cooks[i] || "");
      }
      for (let i = 0; i < maxCleans; i++) {
        row.push(d.cleaners[i] || "");
      }
      row.push(
        d.unfilledCooks + d.unfilledCleaners > 0
          ? `⚠️ Missing: ${d.unfilledCooks > 0 ? `${d.unfilledCooks} cook(s) ` : ""}${d.unfilledCleaners > 0 ? `${d.unfilledCleaners} cleaner(s)` : ""}`
          : "✅ Complete"
      );
      rows.push(row);
    }

    const range = outputTab.getRange(1, 1, rows.length, rows[0].length);
    range.setValues(rows);

    // Format Date column with real Google Sheets Date format
    if (rows.length > 1) {
      const dateColRange = outputTab.getRange(2, 1, rows.length - 1, 1);
      dateColRange.setNumberFormat("ddd, mmm d, yyyy");
    }

    // Format header
    const headerRange = outputTab.getRange(1, 1, 1, rows[0].length);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#f1f5f9");
    headerRange.setFontColor("#0f172a");
    outputTab.setFrozenRows(1);

    // Auto-resize columns
    for (let c = 1; c <= rows[0].length; c++) {
      outputTab.autoResizeColumn(c);
    }

    const tabUrl = `${sheet.getUrl()}#gid=${outputTab.getSheetId()}`;

    return {
      success: true,
      sheetName: tabName,
      url: tabUrl,
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

/**
 * Reads email dispatch metadata for a specific month from the spreadsheet's Email_Dispatch_Log tab.
 */
function getEmailDispatchMetadata(
  spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet,
  monthKey?: string
): EmailDispatchInfo | null {
  try {
    const logTab =
      spreadsheet.getSheetByName("Email_Dispatch_Log") ||
      spreadsheet.getSheetByName("_App_Metadata");
    if (logTab) {
      const data = logTab.getDataRange().getValues();
      if (data.length > 1) {
        // Search in reverse order to find the latest sent email
        for (let r = data.length - 1; r >= 1; r--) {
          const row = data[r];
          const rowSentAt = row[0] ? new Date(row[0]).toISOString() : undefined;
          const rowMonth = String(row[1] || "").trim();
          const rowTo = String(row[2] || "").trim();
          const rowSubject = String(row[3] || "").trim();
          const rowSentBy = String(row[4] || "").trim();
          const rowStatus = String(row[5] || "")
            .trim()
            .toUpperCase();

          if (rowStatus === "SENT" || rowStatus === "SUCCESS") {
            if (!monthKey || !rowMonth || rowMonth === monthKey) {
              return {
                alreadySent: true,
                sentAt: rowSentAt || new Date().toISOString(),
                to: rowTo,
                subject: rowSubject,
                sentBy: rowSentBy,
                monthKey: rowMonth || monthKey,
              };
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn("Could not read Email_Dispatch_Log tab:", err);
  }

  // Fallback to DocumentProperties
  try {
    const docProps = PropertiesService.getDocumentProperties();
    if (docProps) {
      const propKey = monthKey ? `EMAIL_SENT_${monthKey}` : "EMAIL_SENT_LATEST";
      const raw = docProps.getProperty(propKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          alreadySent: true,
          sentAt: parsed.sentAt,
          to: parsed.to,
          subject: parsed.subject,
          sentBy: parsed.sentBy,
          monthKey: parsed.monthKey || monthKey,
        };
      }
    }
  } catch {
    // Ignore property errors
  }

  return null;
}

/**
 * Records email dispatch metadata to the Email_Dispatch_Log tab in the spreadsheet.
 */
function recordEmailDispatchMetadata(spreadsheetIdOrUrl?: string, info?: EmailDispatchInfo): void {
  if (!info) return;
  try {
    let sheet: GoogleAppsScript.Spreadsheet.Spreadsheet | null = null;
    const clean = (spreadsheetIdOrUrl || "").trim();
    if (clean.startsWith("http")) {
      sheet = SpreadsheetApp.openByUrl(clean);
    } else if (clean) {
      sheet = SpreadsheetApp.openById(clean);
    } else {
      sheet = SpreadsheetApp.getActiveSpreadsheet();
    }

    if (sheet) {
      const tabName = "Email_Dispatch_Log";
      let logTab = sheet.getSheetByName(tabName);
      if (!logTab) {
        logTab = sheet.insertSheet(tabName);
        logTab
          .getRange(1, 1, 1, 7)
          .setValues([
            ["Timestamp", "Month", "Recipient (To)", "Subject", "Sent By", "Status", "Mode"],
          ]);
        logTab.getRange(1, 1, 1, 7).setFontWeight("bold").setBackground("#f3f4f6");
        logTab.setFrozenRows(1);
      }

      const timestamp = info.sentAt || new Date().toISOString();
      logTab.appendRow([
        timestamp,
        info.monthKey || "",
        info.to || "",
        info.subject || "",
        info.sentBy || "",
        "SENT",
        "Direct Gmail",
      ]);
    }
  } catch (err) {
    console.warn("Could not write to Email_Dispatch_Log tab:", err);
  }

  // Also save in DocumentProperties as backup
  try {
    const docProps = PropertiesService.getDocumentProperties();
    if (docProps && info.monthKey) {
      docProps.setProperty(`EMAIL_SENT_${info.monthKey}`, JSON.stringify(info));
      docProps.setProperty("EMAIL_SENT_LATEST", JSON.stringify(info));
    }
  } catch {
    // Ignore property errors
  }
}

/**
 * Converts plain text email body with bullets and date headings to clean, formatted HTML email
 */
function textToHtmlEmailBody(plainText: string): string {
  const escaped = String(plainText || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const lines = escaped.split("\n");
  let html = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1e293b;">`;

  for (const line of lines) {
    if (!line.trim()) {
      html += `<div style="height: 10px;"></div>`;
    } else if (line.startsWith("  • ") || line.startsWith("• ")) {
      html += `<div style="padding-left: 18px; margin: 3px 0;">${line.trim()}</div>`;
    } else if (line.startsWith("  NO COMMUNITY MEAL") || line.trim() === "NO COMMUNITY MEAL") {
      html += `<div style="padding-left: 18px; margin: 3px 0; font-weight: bold; color: #64748b;">NO COMMUNITY MEAL</div>`;
    } else if (
      line.includes("(") &&
      (line.includes("Dinner") ||
        line.includes("Brunch") ||
        line.includes("Mon") ||
        line.includes("Tue") ||
        line.includes("Wed") ||
        line.includes("Thu") ||
        line.includes("Fri") ||
        line.includes("Sat") ||
        line.includes("Sun"))
    ) {
      html += `<div style="font-weight: bold; margin-top: 12px; margin-bottom: 2px; color: #0f172a;">${line}</div>`;
    } else {
      html += `<div>${line}</div>`;
    }
  }

  html += `</div>`;
  return html;
}

/**
 * Sends or drafts a schedule announcement email directly via Gmail.
 */
function sendScheduleEmail(payload: EmailPayload): EmailResult {
  try {
    const { to, subject, body, cc, bcc, mode } = payload;
    if (!to || to.trim() === "") {
      throw new Error("Recipient email address cannot be empty.");
    }
    if (!subject || subject.trim() === "") {
      throw new Error("Email subject cannot be empty.");
    }

    const options: GoogleAppsScript.Gmail.GmailAdvancedOptions = {
      htmlBody: textToHtmlEmailBody(body),
    };
    if (cc && cc.trim()) options.cc = cc.trim();
    if (bcc && bcc.trim()) options.bcc = bcc.trim();

    if (mode === "draft") {
      GmailApp.createDraft(to.trim(), subject.trim(), body, options);
      return {
        success: true,
        mode: "draft",
        message: `Draft created in your Gmail account! You can review and send it anytime from Gmail.`,
        recipientCount: 1,
      };
    } else {
      GmailApp.sendEmail(to.trim(), subject.trim(), body, options);

      let senderEmail = "";
      try {
        senderEmail = Session.getActiveUser().getEmail();
      } catch {
        // Fallback
      }

      const dispatchInfo: EmailDispatchInfo = {
        alreadySent: true,
        sentAt: new Date().toISOString(),
        to: to.trim(),
        subject: subject.trim(),
        sentBy: senderEmail || "Coordinator",
        monthKey: payload.monthKey,
      };

      recordEmailDispatchMetadata(payload.spreadsheetId, dispatchInfo);

      return {
        success: true,
        mode: "send",
        message: `Announcement email successfully sent via Gmail to ${to}!`,
        recipientCount: 1,
        emailDispatchInfo: dispatchInfo,
      };
    }
  } catch (err: any) {
    console.error("Email sending error:", err);
    throw new Error(
      `Failed to ${payload.mode === "draft" ? "create draft" : "send email"}: ${err.message}`
    );
  }
}

/**
 * Scans the historical reference folder
 */
function scanHistoricalFolder(folderId?: string) {
  return scanHistoricalDriveFolder(folderId);
}

/**
 * Converts legacy signup spreadsheet tabs and email announcements into validation survey sheets
 */
function importHistoricalMonths(
  sourceHistoricalFolderId?: string,
  targetEnv: "prod" | "dev" = "prod",
  targetRootFolderId?: string
) {
  return importHistoricalMonthsToEnvironment(
    sourceHistoricalFolderId,
    targetEnv,
    targetRootFolderId
  );
}

/**
 * Scans all historical and current schedule tabs in the active Google Spreadsheet
 * (e.g. tabs named Schedule_YYYY-MM or Schedule_...) and aggregates community volunteer
 * shift equity metrics and stats.
 */
function getHistoricalCommunityReports(
  spreadsheetIdOrUrl?: string | any,
  selectedMonths?: string[]
): CommunityReportSummary {
  try {
    if (Array.isArray(spreadsheetIdOrUrl)) {
      if (spreadsheetIdOrUrl.length > 1 && !selectedMonths) {
        selectedMonths = spreadsheetIdOrUrl[1];
      }
      spreadsheetIdOrUrl = spreadsheetIdOrUrl[0];
    }

    const monthRecords: MonthScheduleRecord[] = [];
    const loadedMonthKeys = new Set<string>();

    let activeSS: GoogleAppsScript.Spreadsheet.Spreadsheet | null = null;
    const clean = (typeof spreadsheetIdOrUrl === "string" ? spreadsheetIdOrUrl : "").trim();
    if (clean.startsWith("http")) {
      try {
        activeSS = SpreadsheetApp.openByUrl(clean);
      } catch (e) {
        console.warn("Could not openByUrl:", e);
      }
    } else if (clean) {
      try {
        activeSS = SpreadsheetApp.openById(clean);
      } catch (e) {
        console.warn("Could not openById:", e);
      }
    } else {
      try {
        activeSS = SpreadsheetApp.getActiveSpreadsheet();
      } catch (e) {
        console.warn("No active spreadsheet in standalone web app:", e);
      }
    }

    // 1. Scan active spreadsheet tabs
    if (activeSS) {
      for (const sh of activeSS.getSheets()) {
        const tabName = sh.getName();
        if (/^Schedule[_\s-]/i.test(tabName)) {
          const monthKey = tabName.replace(/^Schedule[_\s-]+/i, "");
          if (selectedMonths && selectedMonths.length > 0 && !selectedMonths.includes(monthKey)) {
            continue;
          }

          const grid = sh.getDataRange().getValues();
          if (grid.length < 2) continue;

          const parsed = parseScheduleGridData(grid);
          if (parsed.success && parsed.schedule.length > 0) {
            monthRecords.push({
              monthKey,
              monthLabel: monthKey,
              schedule: parsed.schedule,
            });
            loadedMonthKeys.add(monthKey);
          }
        }
      }
    }

    // 2. Scan any matching monthly spreadsheets in Drive workspace
    try {
      const driveItems = listDriveSpreadsheets();
      for (const item of driveItems) {
        const mMatch = item.name.match(/(?:20)?(\d{2})[-_](\d{2})/);
        const monthKey = mMatch ? `20${mMatch[1]}-${mMatch[2]}` : item.name;

        if (loadedMonthKeys.has(monthKey)) continue;
        if (selectedMonths && selectedMonths.length > 0 && !selectedMonths.includes(monthKey))
          continue;

        try {
          const ss = SpreadsheetApp.openById(item.id);
          let foundSchedule = false;

          for (const sh of ss.getSheets()) {
            if (/^Schedule[_\s-]/i.test(sh.getName())) {
              const grid = sh.getDataRange().getValues();
              if (grid.length < 2) continue;
              const parsed = parseScheduleGridData(grid);
              if (parsed.success && parsed.schedule.length > 0) {
                monthRecords.push({
                  monthKey,
                  monthLabel: item.name,
                  schedule: parsed.schedule,
                });
                loadedMonthKeys.add(monthKey);
                foundSchedule = true;
                break;
              }
            }
          }

          // If no Schedule_ tab was found, try calculating schedule from Form Responses
          if (!foundSchedule) {
            const formTab = ss.getSheetByName("Form Responses 1") || ss.getSheets()[0];
            if (formTab) {
              const grid = formTab.getDataRange().getValues();
              if (grid.length >= 2) {
                const parsedSurvey = parseSurveySheetData(grid, []);
                if (parsedSurvey.mealDates.length > 0 && parsedSurvey.responses.length > 0) {
                  const solved = solveCookAndCleanSchedule(
                    parsedSurvey.mealDates,
                    parsedSurvey.responses,
                    [],
                    { cookPolicy: "ADAPTIVE_3_OR_2" }
                  );
                  if (solved.schedule.length > 0) {
                    monthRecords.push({
                      monthKey,
                      monthLabel: item.name,
                      schedule: solved.schedule,
                    });
                    loadedMonthKeys.add(monthKey);
                  }
                }
              }
            }
          }
        } catch (ssErr) {
          console.warn(`Could not read drive sheet ${item.name}:`, ssErr);
        }
      }
    } catch (driveErr) {
      console.warn("Drive scan error in getHistoricalCommunityReports:", driveErr);
    }

    // 3. Fallback to baseline historical schedules for any months not yet loaded
    try {
      const baseline = getBaselineHistoricalSchedules();
      for (const baseRec of baseline) {
        if (!loadedMonthKeys.has(baseRec.monthKey)) {
          if (
            selectedMonths &&
            selectedMonths.length > 0 &&
            !selectedMonths.includes(baseRec.monthKey)
          ) {
            continue;
          }
          monthRecords.push(baseRec);
          loadedMonthKeys.add(baseRec.monthKey);
        }
      }
    } catch (baseErr) {
      console.warn("Baseline historical load error:", baseErr);
    }

    return computeCommunityReportSummary(monthRecords);
  } catch (err: any) {
    console.error("getHistoricalCommunityReports error:", err);
    return computeCommunityReportSummary([]);
  }
}

/**
 * Pure raw snapshot dumper - reads real spreadsheet tabs and emails with 0 assumptions
 * and writes a JSON snapshot into parent Drive folder.
 */
function dumpHistoricalRawDataOnly() {
  const sourceFolder = DriveApp.getFolderById("1Lm-l2Cm8DFO4swnPuDHpYlTz8FOGN8df");
  const rootFolder = DriveApp.getFolderById("1U0cJqnxCgWn-5k0RCj2BjCUj9nc1dMGl");

  const files = sourceFolder.getFiles();
  const rawDump: any = {
    spreadsheets: [],
    emails: [],
  };

  while (files.hasNext()) {
    const f = files.next();
    const mime = f.getMimeType();
    if (mime === MimeType.GOOGLE_SHEETS) {
      const ss = SpreadsheetApp.openById(f.getId());
      rawDump.spreadsheets.push({
        id: f.getId(),
        name: f.getName(),
        sheets: ss.getSheets().map((s) => ({
          name: s.getName(),
          values: s.getDataRange().getValues(),
        })),
      });
    } else if (f.getName().endsWith(".eml") || mime === MimeType.PLAIN_TEXT) {
      rawDump.emails.push({
        id: f.getId(),
        name: f.getName(),
        content: f.getBlob().getDataAsString(),
      });
    }
  }

  const dumpContent = JSON.stringify(rawDump, null, 2);
  const existing = rootFolder.getFilesByName("historical_raw_dump.json");
  let dumpFile: GoogleAppsScript.Drive.File;
  if (existing.hasNext()) {
    dumpFile = existing.next();
    dumpFile.setContent(dumpContent);
  } else {
    dumpFile = rootFolder.createFile("historical_raw_dump.json", dumpContent, MimeType.PLAIN_TEXT);
  }

  Logger.log("Created dump: " + dumpFile.getUrl());
  return {
    success: true,
    url: dumpFile.getUrl(),
    tabsCount: rawDump.spreadsheets[0]?.sheets?.length || 0,
    emailsCount: rawDump.emails.length,
  };
}

/**
 * One-off helper to convert historical spreadsheet into live survey sheets
 */
function runHistoricalImportOnce() {
  const res = importHistoricalMonthsToEnvironment(
    "1Lm-l2Cm8DFO4swnPuDHpYlTz8FOGN8df",
    "prod",
    "1U0cJqnxCgWn-5k0RCj2BjCUj9nc1dMGl"
  );
  Logger.log(JSON.stringify(res, null, 2));
  return res;
}

/**
 * Returns the list of month keys corresponding to Schedule_ tabs in the active spreadsheet
 */
function getAvailableScheduleTabs(spreadsheetIdOrUrl?: string | any): string[] {
  const discovered = new Set<string>();

  if (Array.isArray(spreadsheetIdOrUrl)) {
    spreadsheetIdOrUrl = spreadsheetIdOrUrl[0];
  }

  try {
    let sheet: GoogleAppsScript.Spreadsheet.Spreadsheet | null = null;
    const clean = (typeof spreadsheetIdOrUrl === "string" ? spreadsheetIdOrUrl : "").trim();
    if (clean.startsWith("http")) {
      sheet = SpreadsheetApp.openByUrl(clean);
    } else if (clean) {
      sheet = SpreadsheetApp.openById(clean);
    } else {
      sheet = SpreadsheetApp.getActiveSpreadsheet();
    }

    if (sheet) {
      for (const s of sheet.getSheets()) {
        const name = s.getName();
        if (/^Schedule[_\s-]/i.test(name)) {
          discovered.add(name.replace(/^Schedule[_\s-]+/i, ""));
        }
      }
    }
  } catch (err: any) {
    console.warn("getAvailableScheduleTabs active sheet error:", err);
  }

  try {
    const driveItems = listDriveSpreadsheets();
    for (const item of driveItems) {
      const mMatch = item.name.match(/(?:20)?(\d{2})[-_](\d{2})/);
      if (mMatch) {
        discovered.add(`20${mMatch[1]}-${mMatch[2]}`);
      }
    }
  } catch (err: any) {
    console.warn("getAvailableScheduleTabs drive scan error:", err);
  }

  try {
    const baseline = getBaselineHistoricalSchedules();
    for (const b of baseline) {
      discovered.add(b.monthKey);
    }
  } catch (err: any) {
    console.warn("getAvailableScheduleTabs baseline error:", err);
  }

  const list = Array.from(discovered);
  list.sort((a, b) => b.localeCompare(a));
  return list.length > 0
    ? list
    : [
        "2026-10",
        "2026-09",
        "2026-08",
        "2026-07",
        "2026-06",
        "2026-05",
        "2026-04",
        "2026-03",
        "2026-02",
        "2026-01",
      ];
}

/**
 * Retrieves metadata for Common Meal Sign-Up Workbook
 */
function getMealSignupWorkbookInfo(
  targetSpreadsheetId?: string,
  defaultMonthTab?: string
): MealSignupWorkbookInfo {
  return inspectMealSignupWorkbook(targetSpreadsheetId, defaultMonthTab);
}

/**
 * Creates/overwrites the monthly tab in the Common Meal Sign-Up Workbook
 */
function exportToMealSignupWorkbook(
  targetSpreadsheetId: string,
  sourceScheduleOrSheetId: any,
  options?: MealSignupExportOptions
): MealSignupExportResult {
  let schedule: DaySchedule[] = [];

  if (Array.isArray(sourceScheduleOrSheetId)) {
    schedule = sourceScheduleOrSheetId;
  } else if (sourceScheduleOrSheetId && Array.isArray(sourceScheduleOrSheetId.schedule)) {
    schedule = sourceScheduleOrSheetId.schedule;
  } else if (typeof sourceScheduleOrSheetId === "string" && sourceScheduleOrSheetId.trim()) {
    const loaded = loadExistingScheduleFromSheet(sourceScheduleOrSheetId.trim());
    if (!loaded.success || loaded.schedule.length === 0) {
      throw new Error("Could not find a valid schedule in the provided source sheet.");
    }
    schedule = loaded.schedule;
  } else {
    throw new Error("Invalid source schedule provided for sign-up sheet export.");
  }

  return executeCreateMealSignupTab(targetSpreadsheetId, schedule, options);
}

/**
 * Prepares preview dates for creating a new monthly survey form
 */
function getSurveyFormDatesPreview(monthKey: string): {
  monthKey: string;
  defaultTitle: string;
  dates: SurveyFormDateConfig[];
} {
  return {
    monthKey,
    defaultTitle: deriveFormTitle(monthKey),
    dates: generateMonthlySurveyDates(monthKey),
  };
}

/**
 * Generates a Google Form & linked Google Sheet response spreadsheet
 */
function createMonthlySurveyForm(payload: CreateSurveyFormPayload): CreateSurveyFormResult {
  return executeCreateSurveyForm(payload);
}

/**
 * One-time authorization helper function.
 * Run this function once from the Google Apps Script editor (https://script.google.com/d/1goFp3XHJ93HWRDU3lNpWNfraX47G8N333E4EJo4XUT9nSXxJc88AE1Fw/edit)
 * to grant Google OAuth permissions for FormApp, DriveApp, GmailApp, and SpreadsheetApp.
 */
function authorizeAppScopes(): string {
  console.log("Authorizing Google Apps Script permissions for CookTeamTool...");

  // 1. Explicitly invoke FormApp to trigger Google Forms OAuth authorization
  try {
    const testForm = FormApp.create("Authorization Test Form - Delete Me");
    const testFormId = testForm.getId();
    console.log("FormApp authorized! Created temp test form:", testFormId);

    // Trash the temporary test form
    DriveApp.getFileById(testFormId).setTrashed(true);
    console.log("Trashed temp test form successfully.");
  } catch (err: any) {
    console.error("FormApp authorization error:", err);
    throw err;
  }

  // 2. Explicitly invoke Session, DriveApp, SpreadsheetApp
  try {
    const user = Session.getActiveUser().getEmail();
    console.log("Current user:", user);
  } catch (e) {
    console.warn("Could not get user:", e);
  }

  return "All required Google Apps Script OAuth scopes (Forms, Drive, Sheets, Gmail) successfully authorized!";
}

// Global exposure for Google Apps Script runtime & google.script.run
const g: any = typeof globalThis !== "undefined" ? globalThis : this;
g.dumpHistoricalRawDataOnly = dumpHistoricalRawDataOnly;
g.runHistoricalImportOnce = runHistoricalImportOnce;
g.doGet = doGet;
g.onOpen = onOpen;
g.openSidebar = openSidebar;
g.openModal = openModal;
g.getUserInfo = getUserInfo;
g.setupDriveWorkspace = setupDriveWorkspace;
g.createWebAppLinkLaunchers = createWebAppLinkLaunchers;
g.listAvailableDriveSheets = listAvailableDriveSheets;
g.getMasterRegistryData = getMasterRegistryData;
g.getIntakeData = getIntakeData;
g.loadExistingScheduleFromSheet = loadExistingScheduleFromSheet;
g.solveSchedule = solveSchedule;
g.setMemberActiveStatus = setMemberActiveStatus;
g.addCommunityMember = addCommunityMember;
g.updateCommunityMember = updateCommunityMember;
g.linkMemberAlias = linkMemberAlias;
g.bulkSaveCommunityMembers = bulkSaveCommunityMembers;
g.saveExceptionRule = saveExceptionRule;
g.deleteExceptionRule = deleteExceptionRule;
g.exportScheduleToSheet = exportScheduleToSheet;
g.sendScheduleEmail = sendScheduleEmail;
g.scanHistoricalFolder = scanHistoricalFolder;
g.importHistoricalMonths = importHistoricalMonths;
g.getHistoricalCommunityReports = getHistoricalCommunityReports;
g.getAvailableScheduleTabs = getAvailableScheduleTabs;
g.getMealSignupWorkbookInfo = getMealSignupWorkbookInfo;
g.exportToMealSignupWorkbook = exportToMealSignupWorkbook;
g.getSurveyFormDatesPreview = getSurveyFormDatesPreview;
g.createMonthlySurveyForm = createMonthlySurveyForm;
g.authorizeAppScopes = authorizeAppScopes;
g.updateUserGuideDoc = updateUserGuideDoc;

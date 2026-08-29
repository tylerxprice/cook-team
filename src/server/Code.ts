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
  MemberQuotaStat,
  MealType,
  EmailPayload,
  EmailResult,
} from "./types";
import { parseSurveySheetData } from "./parser";
import { solveCookAndCleanSchedule } from "./matchmaker";
import {
  MOCK_INTAKE_PAYLOAD,
  MOCK_MEMBERS,
  MOCK_EXCEPTIONS,
} from "./mockData";
import { setupCommunityDriveWorkspace, listDriveSpreadsheets, ProvisionResult, DriveSheetItem } from "./setupDrive";

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
      email: user.getEmail() || "brenda.coordinator@community.local",
      authMode: "V8 Runtime (Google Apps Script)",
      timezone: Session.getScriptTimeZone(),
      timestamp: new Date().toISOString(),
      isDevMode,
    };
  } catch {
    return {
      email: "brenda.coordinator@community.local",
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
 * Lists all available Google Sheets in the community Drive workspace
 */
function listAvailableDriveSheets(parentFolderId?: string): DriveSheetItem[] {
  return listDriveSpreadsheets(parentFolderId);
}

/**
 * Fetches the Master Community Registry data (members and rules) on demand.
 */
function getMasterRegistryData(
  isDevMode?: boolean
): { members: Member[]; exceptions: ExceptionRule[] } {
  let dev = isDevMode;
  if (typeof dev === "undefined") {
    try {
      const url = ScriptApp.getService().getUrl() || "";
      dev = url.endsWith("/dev");
    } catch {
      dev = false;
    }
  }

  const masterSpreadsheet = getMasterRegistrySpreadsheet(undefined, dev);
  let members: Member[] = [];
  let exceptions: ExceptionRule[] = [];

  if (masterSpreadsheet) {
    const membersTab = masterSpreadsheet.getSheetByName("Members");
    if (membersTab) {
      const mData = membersTab.getDataRange().getValues();
      for (let i = 1; i < mData.length; i++) {
        const row = mData[i];
        if (row[0] && String(row[0]).trim() !== "") {
          const val = String(row[2] || "").trim().toLowerCase();
          const isActive =
            row[2] === true ||
            val === "true" ||
            val === "yes" ||
            val === "y" ||
            val === "1" ||
            val === "active" ||
            val === "";

          members.push({
            name: String(row[0]).trim(),
            google_email: String(row[1] || "").trim(),
            active: isActive,
            last_active_survey: row[3] ? String(row[3]).trim() : undefined,
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
          const isHard =
            row[5] === true ||
            String(row[5] || "").trim().toLowerCase() === "true" ||
            String(row[5] || "").trim().toLowerCase() === "yes";

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

  return { members, exceptions };
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

    // Determine dev mode from URL or survey file location
    let isDevMode = false;
    try {
      const url = ScriptApp.getService().getUrl() || "";
      isDevMode = url.endsWith("/dev");
    } catch {}

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

    let members: Member[] = [];
    const membersTab = masterSpreadsheet.getSheetByName("Members");
    if (membersTab) {
      const mData = membersTab.getDataRange().getValues();
      if (mData.length > 1) {
        for (let i = 1; i < mData.length; i++) {
          const row = mData[i];
          if (row[0] && String(row[0]).trim() !== "") {
            const val = String(row[2] || "").trim().toLowerCase();
            const isActive =
              row[2] === true ||
              val === "true" ||
              val === "yes" ||
              val === "y" ||
              val === "1" ||
              val === "active" ||
              val === "";

            members.push({
              name: String(row[0]).trim(),
              google_email: String(row[1] || "").trim(),
              active: isActive,
              last_active_survey: row[3] ? String(row[3]).trim() : undefined,
            });
          }
        }
      }
    }

    // Fallback: If no members tab found in registry, extract from survey responses or mock
    if (members.length === 0) {
      if (isDevMode) {
        members = MOCK_MEMBERS;
      } else {
        const respondentsFromSurvey: Member[] = [];
        for (let r = 1; r < surveyData.length; r++) {
          const row = surveyData[r];
          const email = String(row[1] || "").trim();
          const name = String(row[2] || "").trim();
          if (name && !respondentsFromSurvey.some((m) => m.name.toLowerCase() === name.toLowerCase())) {
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

    let exceptions: ExceptionRule[] = isDevMode ? MOCK_EXCEPTIONS : [];
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

    // Detect if a Schedule tab already exists in this spreadsheet
    let existingScheduleTab: { name: string; url?: string; exists: boolean; dateMonth?: string } | undefined = undefined;
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

    return {
      sheetId: surveySpreadsheet.getId(),
      mealDates: parsed.mealDates,
      responses: parsed.responses,
      audit: parsed.audit,
      exceptions,
      members,
      existingScheduleTab,
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

    // Rows: ["Date", "Meal Type", "Special Note", "Cook Team", "Clean Team", "Status / Notes"]
    const schedule: DaySchedule[] = [];
    const memberStats: Record<string, MemberQuotaStat> = {};

    for (let r = 1; r < data.length; r++) {
      const row = data[r];
      if (!row[0]) continue;

      const dateLabel = String(row[0]).trim();
      const mealType = String(row[1] || "DINNER").trim().toUpperCase() as MealType;
      const specialNote = row[2] ? String(row[2]).trim() : undefined;
      const cooksStr = row[3] ? String(row[3]).trim() : "";
      const cleanersStr = row[4] ? String(row[4]).trim() : "";

      const cooks = cooksStr
        ? cooksStr
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s && !s.includes("Need Cooks"))
        : [];
      const cleaners = cleanersStr
        ? cleanersStr
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s && !s.includes("Need Cleaners"))
        : [];

      const targetCooks = mealType === "DINNER" ? 3 : 2;
      const targetCleaners = mealType === "DINNER" ? 3 : 2;
      const dateKey = `2026-10-${r < 10 ? `0${r}` : r}`;

      schedule.push({
        dateKey,
        dateLabel,
        mealType,
        specialNote,
        cooks,
        cleaners,
        targetCookCount: targetCooks,
        targetCleanCount: targetCleaners,
        unfilledCooks: Math.max(0, targetCooks - cooks.length),
        unfilledCleaners: Math.max(0, targetCleaners - cleaners.length),
      });

      for (const cook of cooks) {
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
        memberStats[cook].assignedCooks++;
        memberStats[cook].totalAssigned++;
      }

      for (const cleaner of cleaners) {
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
        memberStats[cleaner].assignedCleans++;
        memberStats[cleaner].totalAssigned++;
      }
    }

    const totalUnfilled = schedule.reduce(
      (acc, d) => acc + d.unfilledCooks + d.unfilledCleaners,
      0
    );

    return {
      success: true,
      schedule,
      memberStats,
      violations: [],
      unfilledSlotsCount: totalUnfilled,
      solveTimeMs: 1,
      cookPolicy: "ADAPTIVE_3_OR_2",
    };
  } catch (err: any) {
    console.error("Error loading saved schedule:", err);
    throw new Error(`Failed to load schedule from tab: ${err.message}`);
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

    // Determine month string from schedule if available (e.g. 2026-10)
    let monthSuffix = new Date().toISOString().slice(0, 7);
    if (scheduleOutput.schedule.length > 0 && scheduleOutput.schedule[0].dateKey) {
      monthSuffix = scheduleOutput.schedule[0].dateKey.slice(0, 7);
    }
    const tabName = `Schedule_${monthSuffix}`;

    let outputTab = sheet.getSheetByName(tabName);
    if (!outputTab) {
      outputTab = sheet.insertSheet(tabName);
    } else {
      outputTab.clear();
    }

    // Header
    const rows: any[][] = [
      ["Date", "Meal Type", "Special Note", "Cook Team", "Clean Team", "Status / Notes"],
    ];

    for (const d of scheduleOutput.schedule) {
      rows.push([
        d.dateLabel,
        d.mealType,
        d.specialNote || "",
        d.cooks.join(", ") || "(Need Cooks)",
        d.cleaners.join(", ") || "(Need Cleaners)",
        d.unfilledCooks + d.unfilledCleaners > 0
          ? `⚠️ Missing: ${d.unfilledCooks > 0 ? `${d.unfilledCooks} cook(s) ` : ""}${d.unfilledCleaners > 0 ? `${d.unfilledCleaners} cleaner(s)` : ""}`
          : "✅ Complete",
      ]);
    }

    const range = outputTab.getRange(1, 1, rows.length, rows[0].length);
    range.setValues(rows);

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

    const options: GoogleAppsScript.Gmail.GmailAdvancedOptions = {};
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
      return {
        success: true,
        mode: "send",
        message: `Announcement email successfully sent via Gmail to ${to}!`,
        recipientCount: 1,
      };
    }
  } catch (err: any) {
    console.error("Email sending error:", err);
    throw new Error(`Failed to ${payload.mode === "draft" ? "create draft" : "send email"}: ${err.message}`);
  }
}

// Global exposure for Google Apps Script runtime & google.script.run
const g: any = typeof globalThis !== "undefined" ? globalThis : this;
g.doGet = doGet;
g.onOpen = onOpen;
g.openSidebar = openSidebar;
g.openModal = openModal;
g.getUserInfo = getUserInfo;
g.setupDriveWorkspace = setupDriveWorkspace;
g.listAvailableDriveSheets = listAvailableDriveSheets;
g.getMasterRegistryData = getMasterRegistryData;
g.getIntakeData = getIntakeData;
g.loadExistingScheduleFromSheet = loadExistingScheduleFromSheet;
g.solveSchedule = solveSchedule;
g.setMemberActiveStatus = setMemberActiveStatus;
g.addCommunityMember = addCommunityMember;
g.saveExceptionRule = saveExceptionRule;
g.exportScheduleToSheet = exportScheduleToSheet;
g.sendScheduleEmail = sendScheduleEmail;

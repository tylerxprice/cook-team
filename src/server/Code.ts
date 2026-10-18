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
  ManualSurveyResponsePayload,
  ManualSurveyResponseResult,
  AppSettings,
  MasterRegistryPayload,
  SendBetaInvitesPayload,
  SendBetaInvitesResult,
  WebSurveyResponsePayload,
} from "./types";
import {
  parseSurveySheetData,
  mergeSurveyResponses,
  extractEmails,
  extractAliases,
  parseSheetBoolean,
  formatLastActiveSurvey,
} from "./parser";
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
import {
  SurveyFormDateConfig,
  CreateSurveyFormPayload,
  CreateSurveyFormResult,
  PublicScheduleResult,
  MonthStatus,
  MonthConfig,
  SaveMonthDatesPayload,
  SaveMonthDatesResult,
  SetMonthStatusResult,
  SurveyFormDatesPreviewResult,
  ExistingSurveyInfo,
} from "./types";

/**
 * Canonical list of completed historical months with finalized schedules.
 * Future months (e.g. 2026-11) are only added once the coordinator exports their schedule.
 */
const DEFAULT_COMPLETED_MONTHS = [
  "2026-11",
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

/**
 * Returns the list of month keys that have had their schedules completed.
 * Reads metadata from Master Registry Settings without expensive Drive scans.
 */
function getPublishedMonthKeys(masterSettings?: any): string[] {
  try {
    const raw = masterSettings?.published_months || masterSettings?.publishedMonths;
    if (typeof raw === "string" && raw.trim()) {
      const list = raw
        .split(",")
        .map((m: string) => m.trim())
        .filter((m: string) => /^\d{4}-\d{2}$/.test(m) && !m.startsWith("2011"));
      if (list.length > 0) {
        list.sort((a: string, b: string) => b.localeCompare(a));
        return list;
      }
    }
  } catch (e) {
    console.warn("Could not read published_months from settings:", e);
  }
  return [...DEFAULT_COMPLETED_MONTHS];
}

/**
 * Records a newly exported/published schedule month in Master Registry Settings metadata.
 */
function recordPublishedMonthInMaster(monthKey: string): void {
  try {
    const cleanKey = (monthKey || "").trim();
    if (!/^\d{4}-\d{2}$/.test(cleanKey)) return;

    const master = getMasterRegistrySpreadsheet();
    if (!master) return;

    let settingsSheet = master.getSheetByName("Settings");
    if (!settingsSheet) {
      settingsSheet = master.insertSheet("Settings");
      settingsSheet.appendRow(["Key", "Value", "Description"]);
    }

    const data = settingsSheet.getDataRange().getValues();
    let pubRow = -1;
    let existingVal = "";

    for (let i = 1; i < data.length; i++) {
      const k = String(data[i][0] || "")
        .trim()
        .toLowerCase()
        .replace(/[\s-_]+/g, "_");
      if (k === "published_months" || k === "publishedmonths") {
        pubRow = i + 1;
        existingVal = String(data[i][1] || "").trim();
        break;
      }
    }

    const set = new Set<string>();
    if (existingVal) {
      existingVal
        .split(",")
        .map((m: string) => m.trim())
        .filter((m: string) => /^\d{4}-\d{2}$/.test(m) && !m.startsWith("2011"))
        .forEach((m: string) => set.add(m));
    } else {
      DEFAULT_COMPLETED_MONTHS.forEach((m) => set.add(m));
    }
    set.add(cleanKey);

    const updatedList = Array.from(set)
      .filter((m) => /^\d{4}-\d{2}$/.test(m) && !m.startsWith("2011"))
      .sort((a, b) => b.localeCompare(a))
      .join(",");
    if (pubRow > 0) {
      settingsSheet.getRange(pubRow, 2).setValue(updatedList);
    } else {
      settingsSheet.appendRow([
        "published_months",
        updatedList,
        "Comma-separated list of months with finalized completed schedules",
      ]);
    }
  } catch (e) {
    console.warn("Could not record published month in master:", e);
  }
}

/**
 * Standalone helper runnable from Google Apps Script project editor.
 * Initializes or updates 'published_months' in the Master Registry spreadsheet's 'Settings' tab.
 */
function populatePublishedMonthsInMaster(customMasterSpreadsheetIdOrUrl?: string): {
  success: boolean;
  updatedSheets: Array<{ env: string; name: string; id: string; row: number; value: string }>;
  publishedMonths: string[];
  message: string;
} {
  Logger.log("=======================================================");
  Logger.log("  POPULATE PUBLISHED MONTHS IN MASTER SPREADSHEET");
  Logger.log("=======================================================");

  // 1. Gather all completed months
  const monthsSet = new Set<string>();
  DEFAULT_COMPLETED_MONTHS.forEach((m) => monthsSet.add(m));

  // Also discover any additional completed schedule months from Drive
  try {
    const driveItems = listDriveSpreadsheets();
    for (const item of driveItems) {
      // Skip survey response sheets or form responses - only completed schedules belong in published_months
      if (/responses|survey|form/i.test(item.name)) continue;
      const mMatch =
        item.name.match(/\b(20(?:2[4-9]|3[0-5]))[-_](0[1-9]|1[0-2])\b/) ||
        item.name.match(/\b(2[4-9])[-_](0[1-9]|1[0-2])\b/);
      if (mMatch) {
        const yr = mMatch[1].length === 2 ? `20${mMatch[1]}` : mMatch[1];
        monthsSet.add(`${yr}-${mMatch[2]}`);
      }
    }
  } catch (driveErr) {
    Logger.log("Notice: listDriveSpreadsheets skipped during month scan: " + driveErr);
  }

  // Filter valid YYYY-MM (strictly non-2011) and sort descending
  const sortedMonths = Array.from(monthsSet)
    .filter((m) => /^\d{4}-\d{2}$/.test(m) && !m.startsWith("2011"))
    .sort((a, b) => b.localeCompare(a));
  const monthsStr = sortedMonths.join(",");

  Logger.log("Target published months to write: " + monthsStr);

  const results: Array<{ env: string; name: string; id: string; row: number; value: string }> = [];

  // Determine target spreadsheets
  const targets: Array<{ label: string; sheet: GoogleAppsScript.Spreadsheet.Spreadsheet | null }> =
    [];
  if (customMasterSpreadsheetIdOrUrl && customMasterSpreadsheetIdOrUrl.trim()) {
    targets.push({
      label: "Custom",
      sheet: getMasterRegistrySpreadsheet(customMasterSpreadsheetIdOrUrl.trim()),
    });
  } else {
    targets.push({
      label: "Production",
      sheet: getMasterRegistrySpreadsheet(undefined, false),
    });
    targets.push({
      label: "Dev / Testing",
      sheet: getMasterRegistrySpreadsheet(undefined, true),
    });
  }

  const seenIds = new Set<string>();

  for (const target of targets) {
    const master = target.sheet;
    if (!master) {
      Logger.log(`⚠️ Could not locate ${target.label} Master Registry Spreadsheet.`);
      continue;
    }

    const sheetId = master.getId();
    if (seenIds.has(sheetId)) {
      continue;
    }
    seenIds.add(sheetId);

    try {
      Logger.log(`\nFound ${target.label} Master Registry: "${master.getName()}" (ID: ${sheetId})`);

      let settingsSheet = master.getSheetByName("Settings");
      if (!settingsSheet) {
        settingsSheet = master.insertSheet("Settings");
        settingsSheet.appendRow(["Key", "Value", "Description"]);
        settingsSheet.getRange(1, 1, 1, 3).setFontWeight("bold");
        Logger.log(`  + Created missing 'Settings' tab.`);
      }

      const data = settingsSheet.getDataRange().getValues();
      let pubRow = -1;

      for (let i = 1; i < data.length; i++) {
        const k = String(data[i][0] || "")
          .trim()
          .toLowerCase()
          .replace(/[\s-_]+/g, "_");
        if (k === "published_months" || k === "publishedmonths") {
          pubRow = i + 1;
          break;
        }
      }

      if (pubRow > 0) {
        settingsSheet.getRange(pubRow, 2).setValue(monthsStr);
        settingsSheet
          .getRange(pubRow, 3)
          .setValue("Comma-separated list of months with finalized completed schedules");
        Logger.log(`  ✓ Updated existing 'published_months' at row #${pubRow} to: ${monthsStr}`);
      } else {
        settingsSheet.appendRow([
          "published_months",
          monthsStr,
          "Comma-separated list of months with finalized completed schedules",
        ]);
        pubRow = settingsSheet.getLastRow();
        Logger.log(`  ✓ Appended new 'published_months' row #${pubRow} with: ${monthsStr}`);
      }

      results.push({
        env: target.label,
        name: master.getName(),
        id: sheetId,
        row: pubRow,
        value: monthsStr,
      });
    } catch (sheetErr: any) {
      Logger.log(
        `❌ Error updating ${target.label} Master Registry: ${sheetErr.message || sheetErr}`
      );
    }
  }

  Logger.log("\n=======================================================");
  Logger.log(
    `🎉 Finished! Successfully populated published_months in ${results.length} Master spreadsheet(s).`
  );
  Logger.log("=======================================================");

  return {
    success: results.length > 0,
    updatedSheets: results,
    publishedMonths: sortedMonths,
    message: `Successfully populated published_months in ${results.length} master spreadsheet(s).`,
  };
}

// -------------------------------------------------------------
// Canonical Deployment URLs & Helper
// -------------------------------------------------------------
export const PROD_WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbwFUo53qovtiFScRr8UufB62fdjjZiCQINHbkpj0U0nuJ6drjxkrJMj7LbJAPPQYN-8lQ/exec";
export const DEV_WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbw9ebwRim3jjSVaN6Pm6QeOvNmujB1nnc2MCkBhM7qs/dev";

function getDeploymentUrl(): string {
  try {
    const url = ScriptApp.getService().getUrl();
    if (url && typeof url === "string" && url.trim().startsWith("http")) {
      return url.trim();
    }
  } catch (e) {
    console.warn("Could not retrieve ScriptApp service URL:", e);
  }

  try {
    const propUrl =
      PropertiesService.getScriptProperties().getProperty("DEPLOYMENT_URL") ||
      PropertiesService.getScriptProperties().getProperty("WEB_APP_URL");
    if (propUrl && propUrl.trim().startsWith("http")) {
      return propUrl.trim();
    }
  } catch {
    // ignore
  }

  return PROD_WEB_APP_URL;
}

/**
 * Generates server-side bootstrap payload for zero-RPC instant client hydration on load.
 */
function getInitialBootstrapData(paramsOrEvent?: any): {
  userInfo: ReturnType<typeof getUserInfo>;
  registry: MasterRegistryPayload;
  driveSheets: DriveSheetItem[];
  urlParameters?: Record<string, string>;
  publicSchedule?: DaySchedule[];
  publicMonthKey?: string;
  publicMonthTitle?: string;
  availableMonths?: string[];
  publicScheduleSuccess?: boolean;
  deploymentUrl: string;
} {
  const urlParameters = paramsOrEvent?.parameter ? paramsOrEvent.parameter : paramsOrEvent;
  const cleanParams: Record<string, string> = {};
  const SYSTEM_PARAMS = new Set(["createoauthdialog", "authuser", "usp", "gclid", "gad_source"]);
  if (urlParameters && typeof urlParameters === "object") {
    for (const k of Object.keys(urlParameters)) {
      if (urlParameters[k] !== undefined && urlParameters[k] !== null) {
        if (SYSTEM_PARAMS.has(k.toLowerCase())) continue;
        const val = String(urlParameters[k]).trim();
        cleanParams[k] = val;
        cleanParams[k.toLowerCase()] = val;
      }
    }
  }

  const deploymentUrl = getDeploymentUrl();

  try {
    const userInfo = getUserInfo();
    const registry = getMasterRegistryData(userInfo.isDevMode);
    let driveSheets: DriveSheetItem[] = [];
    try {
      driveSheets = listAvailableDriveSheets();
    } catch (e) {
      console.warn("Could not list drive sheets in bootstrap:", e);
    }

    const targetMonthKey = cleanParams["month"] || "2026-10";
    let publicScheduleRes: PublicScheduleResult | null = null;
    try {
      publicScheduleRes = getPublicSchedule(targetMonthKey, cleanParams["sheet"]);
    } catch (e) {
      console.warn("Could not pre-fetch publicSchedule in bootstrap:", e);
    }

    const availableMonths =
      publicScheduleRes?.availableMonths && publicScheduleRes.availableMonths.length > 0
        ? publicScheduleRes.availableMonths
        : getPublishedMonthKeys(registry.settings);

    return {
      userInfo,
      registry,
      driveSheets,
      urlParameters: cleanParams,
      publicSchedule: publicScheduleRes?.schedule || [],
      publicMonthKey: publicScheduleRes?.monthKey || targetMonthKey,
      publicMonthTitle: publicScheduleRes?.monthTitle || formatMonthHeaderTitle(targetMonthKey),
      availableMonths:
        availableMonths && availableMonths.length > 0 ? availableMonths : DEFAULT_COMPLETED_MONTHS,
      publicScheduleSuccess: publicScheduleRes?.success ?? false,
      deploymentUrl,
    };
  } catch (err) {
    console.warn("Bootstrap data generation failed:", err);
    return {
      userInfo: getUserInfo(),
      registry: { members: [], exceptions: [] },
      driveSheets: [],
      urlParameters: cleanParams,
      availableMonths: DEFAULT_COMPLETED_MONTHS,
      deploymentUrl,
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

  if (e?.parameter?.action === "syncOpenMonths") {
    try {
      const res = syncOpenMonthsSetting();
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
  (template as any).bootstrapData = getInitialBootstrapData(e?.parameter);
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
  deploymentUrl: string;
} {
  const deploymentUrl = getDeploymentUrl();
  let isDevMode = false;
  try {
    isDevMode = deploymentUrl.endsWith("/dev");
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
      deploymentUrl,
    };
  } catch {
    return {
      email: "coordinator@community.local",
      authMode: "V8 Runtime",
      timezone: "America/Los_Angeles",
      timestamp: new Date().toISOString(),
      isDevMode: false,
      deploymentUrl,
    };
  }
}

/**
 * Helper function to explicitly trigger the Google Apps Script OAuth consent popup
 * for all required scopes (including UrlFetchApp, FormApp, Drive, Sheets, Gmail).
 */
function authorizeAllPermissions(): { success: boolean; user: string; message: string } {
  return authorizeAppScopesInternal();
}

function authorizeAppScopes(): string {
  const res = authorizeAppScopesInternal();
  return res.message;
}

function authorizeAppScopesInternal(): { success: boolean; user: string; message: string } {
  console.log("Authorizing Google Apps Script permissions for CookTeamTool...");

  // 1. Explicitly invoke FormApp to trigger Google Forms OAuth authorization
  try {
    const testForm = FormApp.create("Authorization Test Form - Delete Me");
    const testFormId = testForm.getId();
    console.log("FormApp authorized! Created temp test form:", testFormId);
    DriveApp.getFileById(testFormId).setTrashed(true);
    console.log("Trashed temp test form successfully.");
  } catch (err: any) {
    console.warn("FormApp authorization notice:", err);
  }

  // 2. Explicitly invoke UrlFetchApp to trigger script.external_request scope
  try {
    UrlFetchApp.fetch("https://forms.googleapis.com", { muteHttpExceptions: true });
    console.log("UrlFetchApp scope verified!");
  } catch (err: any) {
    console.warn("UrlFetchApp authorization notice:", err);
  }

  // 3. Explicitly invoke Session, DriveApp, SpreadsheetApp, GmailApp
  let userEmail = "unknown";
  try {
    userEmail = Session.getActiveUser().getEmail() || "authorized user";
    console.log("Current user:", userEmail);
  } catch (e) {
    console.warn("Could not get user:", e);
  }

  return {
    success: true,
    user: userEmail,
    message:
      "All required Google Apps Script OAuth scopes (Forms, Forms REST/UrlFetch, Drive, Sheets, Gmail) successfully authorized!",
  };
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
 * Fetches the Master Community Registry data (members, rules, and settings) on demand.
 */
function getMasterRegistryData(
  masterRegistryUrlOrIdOrDev?: string | boolean,
  isDevMode?: boolean
): MasterRegistryPayload {
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
  const settings: AppSettings = {
    announcementTo: "Vancouver Cohousing Residents <vancoho-residents@googlegroups.com>",
    announcementCc:
      "Ben Ernst <ben@earnesticecream.com>, Fabrice Retiere <fabrulous@gmail.com>, Patricia Fahrni <pfahrni@shaw.ca>",
    cookPolicy: "ADAPTIVE_3_OR_2",
    defaultCleanQuota: 1,
    autoCancelDeficitDates: true,
    communityName: "Vancouver Cohousing",
  };

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

          const isBetaTester = row[5] !== undefined ? parseSheetBoolean(row[5], false) : false;

          members.push({
            name: String(row[0]).trim(),
            google_email: rawEmail,
            active: isActive,
            last_active_survey: formatLastActiveSurvey(row[3]),
            aliases: aliases.length > 0 ? aliases : undefined,
            alternate_emails: emails.length > 1 ? emails.slice(1) : undefined,
            is_beta_tester: isBetaTester,
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

    const settingsTab = masterSpreadsheet.getSheetByName("Settings");
    if (settingsTab) {
      const sData = settingsTab.getDataRange().getValues();
      if (sData.length > 0) {
        // Resolve key column and value column index
        let keyCol = 0;
        let valCol = 1;

        const headerRow = sData[0].map((h) =>
          String(h || "")
            .trim()
            .toLowerCase()
        );
        const kIdx = headerRow.findIndex(
          (h) => h === "key" || h === "setting" || h === "property" || h === "name"
        );
        const vIdx = headerRow.findIndex(
          (h) => h === "value" || h === "val" || h === "setting value"
        );

        if (kIdx >= 0 && vIdx >= 0 && kIdx !== vIdx) {
          keyCol = kIdx;
          valCol = vIdx;
        }

        // Iterate through setting rows
        for (let i = 1; i < sData.length; i++) {
          const row = sData[i];
          const rawCell =
            row[keyCol] !== undefined && row[keyCol] !== null ? String(row[keyCol]).trim() : "";
          if (!rawCell) continue;

          const rawKey = rawCell.toLowerCase().replace(/[\s-_]+/g, "_");
          const val =
            row[valCol] !== undefined && row[valCol] !== null ? String(row[valCol]).trim() : "";
          if (!val) continue;

          if (
            [
              "announcement_to",
              "listserv_email",
              "email_to",
              "to_email",
              "recipients_to",
              "to",
              "announcement_recipients",
            ].includes(rawKey)
          ) {
            settings.announcementTo = val;
          } else if (
            [
              "announcement_cc",
              "email_cc",
              "cc_recipients",
              "cc_email",
              "default_cc",
              "cc",
              "announcement_cc_recipients",
            ].includes(rawKey)
          ) {
            settings.announcementCc = val;
          } else if (["cook_policy", "cook_team_policy", "sizing_policy"].includes(rawKey)) {
            if (
              val === "ADAPTIVE_3_OR_2" ||
              val === "DINNER_3_BRUNCH_2" ||
              val === "TWO_REGARDLESS"
            ) {
              settings.cookPolicy = val;
            }
          } else if (["default_clean_quota", "clean_quota", "default_clean"].includes(rawKey)) {
            const num = parseInt(val, 10);
            if (!isNaN(num)) settings.defaultCleanQuota = num;
          } else if (["community_name", "community", "organization_name"].includes(rawKey)) {
            settings.communityName = val;
          } else if (
            [
              "signup_workbook_id",
              "common_meal_signup_id",
              "signup_sheet_id",
              "signup_sheet_url",
            ].includes(rawKey)
          ) {
            settings.signupWorkbookId = val;
          } else if (["auto_cancel_deficit_dates", "drop_deficit_dates"].includes(rawKey)) {
            settings.autoCancelDeficitDates = parseSheetBoolean(val, true);
          } else if (
            [
              "beta_web_signup_enabled",
              "beta_signup_enabled",
              "beta_signup",
              "beta_web_signup",
            ].includes(rawKey)
          ) {
            settings.betaWebSignupEnabled = parseSheetBoolean(val, false);
          } else {
            settings[rawKey] = val;
            const monthMatch = rawCell
              .toLowerCase()
              .trim()
              .match(/^(month_(?:status|dates))_(\d{4})[-_](\d{2})$/);
            if (monthMatch) {
              const prefix = monthMatch[1];
              const year = monthMatch[2];
              const month = monthMatch[3];
              settings[`${prefix}_${year}-${month}`] = val;
              settings[`${prefix}_${year}_${month}`] = val;
            }
          }
        }

        // In-memory fallback if open_months is not yet persisted
        if (!settings.open_months) {
          const discoveredOpen: string[] = [];
          for (const [k, v] of Object.entries(settings)) {
            const m = k.match(/^month_status_(\d{4})[-_](\d{2})$/);
            if (m && String(v).trim().toUpperCase() === "OPEN") {
              discoveredOpen.push(`${m[1]}-${m[2]}`);
            }
          }
          if (discoveredOpen.length > 0) {
            settings.open_months = Array.from(new Set(discoveredOpen))
              .sort((a, b) => b.localeCompare(a))
              .join(",");
          }
        }
      }
    }
  }

  if (members.length === 0 && dev) {
    members = MOCK_MEMBERS;
    exceptions = MOCK_EXCEPTIONS;
  }

  members.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  return { members, exceptions, settings };
}

/**
 * Updates application settings in the Master Community Registry Settings tab.
 */
function saveMasterSettings(
  updatedSettings: Partial<AppSettings>,
  masterUrlOrId?: string,
  isDevMode?: boolean
): { success: boolean; message: string; settings: AppSettings } {
  let dev = isDevMode;
  if (typeof dev === "undefined") {
    try {
      const url = ScriptApp.getService().getUrl() || "";
      dev = url.endsWith("/dev");
    } catch {
      dev = false;
    }
  }

  const masterSpreadsheet = getMasterRegistrySpreadsheet(masterUrlOrId, dev);
  if (!masterSpreadsheet) {
    throw new Error("Could not find or open Master Community Registry spreadsheet.");
  }

  let settingsSheet = masterSpreadsheet.getSheetByName("Settings");
  const formatHeader = (
    sh: GoogleAppsScript.Spreadsheet.Sheet,
    numCols: number,
    bgColor: string
  ) => {
    const r = sh.getRange(1, 1, 1, numCols);
    r.setFontWeight("bold");
    r.setBackground(bgColor);
    sh.setFrozenRows(1);
  };

  if (!settingsSheet) {
    settingsSheet = masterSpreadsheet.insertSheet("Settings");
    settingsSheet.appendRow(["Key", "Value", "Description"]);
    formatHeader(settingsSheet, 3, "#ede9fe");
  } else {
    // Standardize header row 1 if missing or mislabeled
    const hRange = settingsSheet.getRange(1, 1, 1, 3);
    const currHeaders = hRange.getValues()[0];
    if (
      String(currHeaders[0] || "").trim() !== "Key" ||
      String(currHeaders[1] || "").trim() !== "Value"
    ) {
      hRange.setValues([["Key", "Value", "Description"]]);
      formatHeader(settingsSheet, 3, "#ede9fe");
    }
  }

  const sData = settingsSheet.getDataRange().getValues();
  const keyRowMap: Record<string, number> = {};
  for (let i = 1; i < sData.length; i++) {
    const rawK = String(sData[i][0] || "")
      .trim()
      .toLowerCase();
    const k = rawK.replace(/[\s-_]+/g, "_");
    if (rawK) keyRowMap[rawK] = i + 1; // 1-indexed sheet row (e.g. month_status_2026-11)
    if (k) keyRowMap[k] = i + 1; // e.g. month_status_2026_11
  }

  const settingMeta: Record<string, { key: string; sheetKey: string; desc: string }> = {
    announcementTo: {
      key: "announcementTo",
      sheetKey: "announcement_to",
      desc: "Default recipient listserv for monthly meal schedule announcements",
    },
    announcementCc: {
      key: "announcementCc",
      sheetKey: "announcement_cc",
      desc: "Default CC recipients for monthly meal schedule announcements",
    },
    cookPolicy: {
      key: "cookPolicy",
      sheetKey: "cook_policy",
      desc: "Adaptive cook sizing (Target 3 for dinner, accept 2 if agreed)",
    },
    defaultCleanQuota: {
      key: "defaultCleanQuota",
      sheetKey: "default_clean_quota",
      desc: "Default clean shifts per member when not specified",
    },
    autoCancelDeficitDates: {
      key: "autoCancelDeficitDates",
      sheetKey: "auto_cancel_deficit_dates",
      desc: "Auto-drop bottleneck deficit dates to maximize complete meals",
    },
    communityName: {
      key: "communityName",
      sheetKey: "community_name",
      desc: "Community organization name",
    },
    signupWorkbookId: {
      key: "signupWorkbookId",
      sheetKey: "signup_workbook_id",
      desc: "Master Common Meal Sign-Up Google Sheet ID or URL",
    },
    publishedMonths: {
      key: "publishedMonths",
      sheetKey: "published_months",
      desc: "Comma-separated list of months with finalized completed schedules",
    },
    betaWebSignupEnabled: {
      key: "betaWebSignupEnabled",
      sheetKey: "beta_web_signup_enabled",
      desc: "Enable web sign-up view and beta invitation workflow",
    },
  };

  for (const [prop, meta] of Object.entries(settingMeta)) {
    if (updatedSettings[prop as keyof AppSettings] !== undefined) {
      const val = String(updatedSettings[prop as keyof AppSettings]);
      const rowNum = keyRowMap[meta.sheetKey];
      if (rowNum) {
        settingsSheet.getRange(rowNum, 2).setValue(val);
      } else {
        settingsSheet.appendRow([meta.sheetKey, val, meta.desc]);
        keyRowMap[meta.sheetKey] = settingsSheet.getLastRow();
      }
    }
  }

  // Also persist dynamic settings (e.g. month_status_YYYY-MM, month_dates_YYYY-MM, open_months)
  for (const [rawKey, rawVal] of Object.entries(updatedSettings)) {
    if (rawVal === undefined || rawVal === null) continue;
    if (Object.keys(settingMeta).includes(rawKey)) continue;

    const rawLower = rawKey.trim().toLowerCase();
    const monthKeyMatch = rawLower.match(/^(month_(?:status|dates))_(\d{4})[-_](\d{2})$/);
    const sheetKey = monthKeyMatch
      ? `${monthKeyMatch[1]}_${monthKeyMatch[2]}-${monthKeyMatch[3]}`
      : rawLower.replace(/[\s-_]+/g, "_");
    const altSheetKey = monthKeyMatch
      ? `${monthKeyMatch[1]}_${monthKeyMatch[2]}_${monthKeyMatch[3]}`
      : sheetKey;

    const valStr = typeof rawVal === "object" ? JSON.stringify(rawVal) : String(rawVal);
    const rowNum = keyRowMap[sheetKey] || keyRowMap[altSheetKey];
    if (rowNum) {
      settingsSheet.getRange(rowNum, 2).setValue(valStr);
    } else {
      let desc = "Application configuration setting";
      if (sheetKey.startsWith("month_status_")) {
        desc = `Sign-up status for ${sheetKey.replace("month_status_", "")} (OPEN, CLOSED, NOT_OPEN)`;
      } else if (sheetKey.startsWith("month_dates_")) {
        desc = `Configured meal dates for ${sheetKey.replace("month_dates_", "")}`;
      } else if (sheetKey === "open_months") {
        desc = "Comma-separated list of currently open survey sign-up months";
      }
      settingsSheet.appendRow([sheetKey, valStr, desc]);
      keyRowMap[sheetKey] = settingsSheet.getLastRow();
      keyRowMap[altSheetKey] = settingsSheet.getLastRow();
    }
  }

  const refreshed = getMasterRegistryData(masterUrlOrId, dev);
  return {
    success: true,
    message: "Master Registry settings updated successfully.",
    settings: refreshed.settings || (updatedSettings as AppSettings),
  };
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

    const allIntakeSheets = surveySpreadsheet.getSheets();
    const formSheet =
      surveySpreadsheet.getSheetByName("Form Responses 1") ||
      allIntakeSheets.find((s) => /^(?:form\s*)?responses(?:\s*\d+)?$/i.test(s.getName().trim())) ||
      allIntakeSheets.find((s) => /responses/i.test(s.getName())) ||
      allIntakeSheets[0];
    const surveyData = formSheet ? formSheet.getDataRange().getValues() : [];

    // Determine dev mode from URL or survey file location
    let isDevMode = false;
    try {
      const url = ScriptApp.getService().getUrl() || "";
      isDevMode = url.endsWith("/dev");
    } catch {}

    let members: Member[] = [];
    let exceptions: ExceptionRule[] = [];

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
                last_active_survey: formatLastActiveSurvey(row[3]),
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

    // Fallback: If no members tab found in registry, use providedMembers or extract from survey or mock
    if (members.length === 0) {
      if (Array.isArray(providedMembers) && providedMembers.length > 0) {
        members = providedMembers;
        exceptions = Array.isArray(providedExceptions) ? providedExceptions : [];
      } else if (isDevMode) {
        members = MOCK_MEMBERS;
        exceptions = MOCK_EXCEPTIONS;
      } else {
        const respondentsFromSurvey: Member[] = [];
        const sHeaders = (surveyData[0] || []).map((h: any) => String(h || "").trim());
        const sNameIdx = sHeaders.findIndex((h: string) =>
          /name|resident|volunteer|who are you|respondent/i.test(h)
        );
        const sEmailIdx = sHeaders.findIndex((h: string) => /email|e-mail|username/i.test(h));
        const effectiveNameIdx = sNameIdx >= 0 ? sNameIdx : sEmailIdx === 1 ? 2 : 1;
        for (let r = 1; r < surveyData.length; r++) {
          const row = surveyData[r];
          const name = String(row[effectiveNameIdx] || "").trim();
          let email = sEmailIdx >= 0 ? String(row[sEmailIdx] || "").trim() : "";
          if (!email) {
            for (let c = 0; c < row.length; c++) {
              const val = String(row[c] || "").trim();
              if (/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/i.test(val)) {
                email = val;
                break;
              }
            }
          }
          if (
            name &&
            !respondentsFromSurvey.some((m) => m.name.toLowerCase() === name.toLowerCase())
          ) {
            respondentsFromSurvey.push({
              name,
              google_email: email,
              active: true,
              last_active_survey: undefined,
            });
          }
        }
        members = respondentsFromSurvey.length > 0 ? respondentsFromSurvey : MOCK_MEMBERS;
      }
    }

    const formParsed =
      surveyData.length > 1
        ? parseSurveySheetData(surveyData, members, surveySpreadsheet.getName())
        : {
            mealDates: [],
            responses: [],
            audit: {
              missingMembers: members.filter((m) => m.active),
              reactivatedMembers: [],
              unrecognizedRespondents: [],
              totalActiveMembers: members.filter((m) => m.active).length,
              respondentCount: 0,
            },
            reactivatedMembers: [],
          };

    formParsed.responses.forEach((r) => {
      r.source = "form";
    });

    let mergedResponses = formParsed.responses;
    let finalAudit = formParsed.audit;
    let finalMealDates = formParsed.mealDates;

    // Check if dedicated Web Responses tab exists in this spreadsheet
    const webSheet = surveySpreadsheet.getSheetByName("Web Responses");
    if (webSheet && webSheet.getLastRow() > 1) {
      try {
        const webData = webSheet.getDataRange().getValues();
        if (webData.length > 1) {
          const webParsed = parseSurveySheetData(webData, members, surveySpreadsheet.getName());
          webParsed.responses.forEach((r) => {
            r.source = "web";
          });

          const targetMonthKey =
            (formParsed.mealDates.length > 0 && formParsed.mealDates[0].dateKey
              ? formParsed.mealDates[0].dateKey.slice(0, 7)
              : undefined) ||
            (webParsed.mealDates.length > 0 && webParsed.mealDates[0].dateKey
              ? webParsed.mealDates[0].dateKey.slice(0, 7)
              : undefined) ||
            "2026-10";

          const merged = mergeSurveyResponses(
            formParsed.responses,
            webParsed.responses,
            members,
            targetMonthKey
          );
          mergedResponses = merged.responses;
          finalAudit = merged.audit;
          if (finalMealDates.length === 0) {
            finalMealDates = webParsed.mealDates;
          }
        }
      } catch (webErr) {
        console.warn("Could not parse Web Responses tab:", webErr);
      }
    }

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
      finalMealDates.length > 0 && finalMealDates[0].dateKey
        ? finalMealDates[0].dateKey.slice(0, 7)
        : undefined;
    const emailDispatchInfo =
      getEmailDispatchMetadata(surveySpreadsheet, surveyMonthKey) || undefined;
    const regSettings = getMasterRegistryData(masterRegistryUrlOrId, isDevMode).settings;
    const monthStatus: MonthStatus = existingScheduleTab?.exists
      ? "CLOSED"
      : surveyMonthKey
        ? getMonthConfig(surveyMonthKey).status
        : "OPEN";

    return {
      sheetId: surveySpreadsheet.getId(),
      mealDates: finalMealDates,
      responses: mergedResponses,
      audit: finalAudit,
      exceptions,
      members,
      settings: regSettings,
      existingScheduleTab,
      emailDispatchInfo,
      monthStatus,
    };
  } catch (err: any) {
    console.error("Error reading spreadsheet:", err);
    throw new Error(`Failed to parse Google Sheet: ${err.message}`);
  }
}

/**
 * Appends a manual survey response directly into the survey spreadsheet Form Responses tab
 */
function appendManualSurveyResponse(
  spreadsheetUrlOrId: string,
  payload: ManualSurveyResponsePayload,
  isDevMode?: boolean
): ManualSurveyResponseResult {
  if (!spreadsheetUrlOrId || spreadsheetUrlOrId.trim() === "") {
    throw new Error("Spreadsheet ID or URL is required to save response.");
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

  const now = new Date();
  const timestamp = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()} ${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;

  const sameDayPref = payload.sameDayPref || "NO";
  const canCookCleanSameDay = sameDayPref === "YES" || sameDayPref === "PREFERRED";
  const sameDayString =
    sameDayPref === "PREFERRED"
      ? "Prefer same day (Cook and Clean on the same day)"
      : sameDayPref === "YES"
        ? "Yes"
        : "No";

  const cookQuota = typeof payload.cookQuota === "number" ? payload.cookQuota : 1;
  const cleanQuota = typeof payload.cleanQuota === "number" ? payload.cleanQuota : 1;
  const maxTotalShifts =
    typeof payload.maxTotalShifts === "number" && payload.maxTotalShifts > 0
      ? payload.maxTotalShifts
      : cookQuota + cleanQuota;

  const surveyResponse: SurveyResponse = {
    timestamp,
    email: payload.email || "",
    name: payload.memberName.trim(),
    availability: payload.availability || {},
    cookTeamSizePref: payload.cookTeamSizePref || "Dinner = 3, Brunch = 2",
    canCookCleanSameDay,
    sameDayPref,
    cookQuota,
    cleanQuota,
    maxTotalShifts,
    specialInstructions: (payload.specialInstructions || "").trim(),
    source: "web",
  };

  try {
    const cleanId = spreadsheetUrlOrId.trim();
    let ss: GoogleAppsScript.Spreadsheet.Spreadsheet;
    if (cleanId.startsWith("http")) {
      ss = SpreadsheetApp.openByUrl(cleanId);
    } else {
      ss = SpreadsheetApp.openById(cleanId);
    }

    const sourceSheet = ss.getSheetByName("Form Responses 1") || ss.getSheets()[0];
    const lastCol = Math.max(1, sourceSheet.getLastColumn());
    const headers = sourceSheet.getRange(1, 1, 1, lastCol).getValues()[0];

    // Web and manual saves always target the dedicated "Web Responses" tab to avoid Google Form row-locking
    let targetSheet = ss.getSheetByName("Web Responses");
    if (!targetSheet) {
      targetSheet = ss.insertSheet("Web Responses");
      targetSheet.appendRow(headers);
      targetSheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    }

    if (targetSheet) {
      const newRow: any[] = new Array(headers.length).fill("");

      headers.forEach((h, colIdx) => {
        const headerStr = String(h || "").trim();
        if (/timestamp/i.test(headerStr)) {
          newRow[colIdx] = timestamp;
        } else if (/email/i.test(headerStr)) {
          newRow[colIdx] = surveyResponse.email;
        } else if (/name/i.test(headerStr)) {
          newRow[colIdx] = surveyResponse.name;
        } else if (
          /minimum number of cooks|2-person|two-person|cook team size|open to.*2|team.*size|cook.*size/i.test(
            headerStr
          )
        ) {
          newRow[colIdx] = surveyResponse.cookTeamSizePref;
        } else if (/cook and clean on the same day|same day/i.test(headerStr)) {
          newRow[colIdx] = sameDayString;
        } else if (/how many.*cook|cook.*quota|cook.*shifts|meals.*cook/i.test(headerStr)) {
          newRow[colIdx] = surveyResponse.cookQuota;
        } else if (/how many.*clean|clean.*quota|clean.*shifts|meals.*clean/i.test(headerStr)) {
          newRow[colIdx] = surveyResponse.cleanQuota;
        } else if (
          /maximum.*total.*shifts|max.*total.*shifts|total.*shifts.*max|combined.*shift.*limit|total.*shifts.*combined|max.*shifts/i.test(
            headerStr
          )
        ) {
          newRow[colIdx] =
            typeof surveyResponse.maxTotalShifts === "number" &&
            surveyResponse.maxTotalShifts < surveyResponse.cookQuota + surveyResponse.cleanQuota
              ? surveyResponse.maxTotalShifts
              : "No set limit (sum of cooks and cleans above)";
        } else if (/special instructions|notes|comments|instructions/i.test(headerStr)) {
          newRow[colIdx] = surveyResponse.specialInstructions;
        } else {
          const match = headerStr.match(/Select your available dates\s*\[([^\]]+)\]/i);
          if (match) {
            const dateLabel = match[1].trim();
            const avail = payload.availability[dateLabel] || "UNAVAILABLE";
            if (avail === "AVAILABLE") newRow[colIdx] = "Available";
            else if (avail === "COOK_ONLY") newRow[colIdx] = "Cook only";
            else if (avail === "CLEAN_ONLY") newRow[colIdx] = "Clean only";
            else newRow[colIdx] = "";
          }
        }
      });

      // Check if an existing row exists for this member to update in place
      const lastRow = targetSheet.getLastRow();
      let existingRowIndex = -1;
      const nameColIdx = headers.findIndex((h) => /name/i.test(String(h || "")));
      const emailColIdx = headers.findIndex((h) => /email/i.test(String(h || "")));

      if (lastRow > 1 && nameColIdx >= 0) {
        const existingData = targetSheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
        const targetName = surveyResponse.name.toLowerCase();
        const targetEmail = (surveyResponse.email || "").toLowerCase();

        for (let r = 0; r < existingData.length; r++) {
          const rowName = String(existingData[r][nameColIdx] || "")
            .trim()
            .toLowerCase();
          const rowEmail =
            emailColIdx >= 0
              ? String(existingData[r][emailColIdx] || "")
                  .trim()
                  .toLowerCase()
              : "";
          if (
            (targetEmail && rowEmail && rowEmail === targetEmail) ||
            (targetName && rowName && rowName === targetName)
          ) {
            existingRowIndex = r + 2; // 1-indexed sheet row (row 1 is headers)
            break;
          }
        }
      }

      if (existingRowIndex > 1) {
        targetSheet.getRange(existingRowIndex, 1, 1, newRow.length).setValues([newRow]);
      } else {
        targetSheet.appendRow(newRow);
      }
      SpreadsheetApp.flush();
    }
  } catch (err: any) {
    console.warn("Could not save row to Google Sheet (running in dev/mock or offline):", err);
    if (!dev) {
      throw new Error(`Failed to write survey response to Google Sheet: ${err.message}`);
    }
  }

  return {
    success: true,
    message: `Successfully saved availability response for ${payload.memberName}.`,
    response: surveyResponse,
  };
}

/**
 * Saves availability response submitted via the custom Web Survey view (?view=survey).
 */
function saveWebSurveyResponse(
  payload: WebSurveyResponsePayload,
  isDevMode?: boolean
): ManualSurveyResponseResult {
  if (payload.monthKey) {
    const preview = getSurveyFormDatesPreview(payload.monthKey);
    if (preview.status === "CLOSED") {
      throw new Error(
        `Sign-ups for ${payload.monthKey} are closed because meal teams have already been scheduled.`
      );
    }
    if (preview.status === "NOT_OPEN") {
      throw new Error(`Sign-ups for ${payload.monthKey} have not opened yet.`);
    }
  }

  let targetId = (payload.spreadsheetId || "").trim();

  if (!targetId) {
    // Attempt auto-resolve by monthKey from drive files
    try {
      const driveSheets = listAvailableDriveSheets();
      const monthPart = payload.monthKey || "";
      const yyMm = monthPart && monthPart.length >= 7 ? monthPart.slice(2) : "";
      const match = driveSheets.find((s) => {
        const n = s.name.toLowerCase();
        if (monthPart) {
          return n.includes(monthPart.toLowerCase()) || (yyMm && n.includes(yyMm));
        }
        return n.includes("meal team sign-up") || n.includes("responses");
      });
      if (match) {
        targetId = match.id;
      }
    } catch (e) {
      console.warn("Could not auto-resolve survey spreadsheet for month:", e);
    }
  }

  if (!targetId) {
    throw new Error(
      `Could not identify the survey response spreadsheet for month ${payload.monthKey || "selected"}. Please provide a spreadsheet ID.`
    );
  }

  return appendManualSurveyResponse(targetId, payload, isDevMode);
}

/**
 * Sends personalized beta survey invitation emails to selected beta testers.
 */
function sendBetaSurveyInvitations(payload: SendBetaInvitesPayload): SendBetaInvitesResult {
  const { monthKey, subject, bodyTemplate, replyTo, recipients } = payload;
  if (!recipients || recipients.length === 0) {
    return {
      success: true,
      dispatchedCount: 0,
      failedCount: 0,
      message: "No beta testers were selected.",
      details: [],
    };
  }

  const deploymentUrl = getDeploymentUrl();
  let dispatched = 0;
  let failed = 0;
  const details: Array<{ name: string; email: string; success: boolean; error?: string }> = [];

  for (const r of recipients) {
    if (!r.email || !r.email.trim()) {
      failed++;
      details.push({ name: r.name, email: "", success: false, error: "Missing email address" });
      continue;
    }

    try {
      // Build / sanitize the personalized survey link to ensure it uses the official deployment URL
      let personalizedLink = (r.link || "").trim();
      if (
        !personalizedLink ||
        personalizedLink.includes("googleusercontent.com") ||
        personalizedLink.includes("userCodeAppPanel") ||
        !personalizedLink.startsWith("http")
      ) {
        const queryParams = personalizedLink.includes("?")
          ? personalizedLink.substring(personalizedLink.indexOf("?"))
          : `?view=survey&month=${encodeURIComponent(monthKey)}&m=${encodeURIComponent(r.name)}${
              payload.spreadsheetId ? `&sheetId=${encodeURIComponent(payload.spreadsheetId)}` : ""
            }`;
        personalizedLink = `${deploymentUrl}${queryParams}`;
      }

      // Replace template placeholders: {{name}}, {{link}}, {{month}}
      const personalizedBody = (bodyTemplate || "")
        .replace(/\{\{\s*name\s*\}\}/gi, r.name)
        .replace(/\{\{\s*link\s*\}\}/gi, personalizedLink)
        .replace(/\{\{\s*month\s*\}\}/gi, monthKey);

      const personalizedSubject = (subject || "")
        .replace(/\{\{\s*name\s*\}\}/gi, r.name)
        .replace(/\{\{\s*month\s*\}\}/gi, monthKey);

      const options: GoogleAppsScript.Gmail.GmailAdvancedOptions = {
        htmlBody: textToHtmlEmailBody(personalizedBody),
      };

      if (replyTo && replyTo.trim()) {
        options.replyTo = replyTo.trim();
      }

      GmailApp.sendEmail(r.email.trim(), personalizedSubject, personalizedBody, options);
      dispatched++;
      details.push({ name: r.name, email: r.email, success: true });
    } catch (err: any) {
      failed++;
      details.push({
        name: r.name,
        email: r.email,
        success: false,
        error: err.message || String(err),
      });
    }
  }

  return {
    success: dispatched > 0,
    dispatchedCount: dispatched,
    failedCount: failed,
    message: `Successfully dispatched ${dispatched} beta invitation email(s)${failed > 0 ? ` (${failed} failed)` : ""}.`,
    details,
  };
}

/**
 * Loads a previously saved schedule from an existing "Schedule_YYYY-MM" tab in Google Sheets.
 */
function findSheetIgnoreCase(
  ss: GoogleAppsScript.Spreadsheet.Spreadsheet,
  targetName: string
): GoogleAppsScript.Spreadsheet.Sheet | null {
  if (!targetName) return null;
  const clean = targetName.trim().toLowerCase();
  for (const s of ss.getSheets()) {
    if (s.getName().trim().toLowerCase() === clean) {
      return s;
    }
  }
  return null;
}

function loadExistingScheduleFromSheet(
  spreadsheetUrlOrId: string,
  tabName?: string,
  targetMonthKey?: string
): ScheduleOutput {
  try {
    let surveySpreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet;
    const cleanId = (spreadsheetUrlOrId || "").trim();
    if (cleanId.startsWith("http")) {
      surveySpreadsheet = SpreadsheetApp.openByUrl(cleanId);
    } else {
      surveySpreadsheet = SpreadsheetApp.openById(cleanId);
    }

    const allSheets = surveySpreadsheet.getSheets();
    let targetTab: GoogleAppsScript.Spreadsheet.Sheet | null = null;

    // 1. Try explicit tabName
    if (tabName) {
      targetTab = findSheetIgnoreCase(surveySpreadsheet, tabName);
    }

    // 2. Try candidate names matching the target month
    if (!targetTab && targetMonthKey) {
      const yyyy = targetMonthKey.slice(0, 4);
      const yy = targetMonthKey.slice(2, 4);
      const mm = targetMonthKey.slice(5, 7);
      const mNum = parseInt(mm, 10);
      const mNames = [
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
      const mNamesFull = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];
      const sMon = mNames[mNum - 1] || "";
      const sMonUpper = sMon.toUpperCase();
      const fullMon = mNamesFull[mNum - 1] || "";
      const fullMonUpper = fullMon.toUpperCase();

      const candidates = [
        `Schedule_${targetMonthKey}`,
        `Schedule_${yy}-${mm}`,
        `Schedule ${targetMonthKey}`,
        `Schedule ${yy}-${mm}`,
        `${sMonUpper} ${yyyy}`,
        `${sMon} ${yyyy}`,
        `${fullMonUpper} ${yyyy}`,
        `${fullMon} ${yyyy}`,
        `${sMonUpper} ${yy}`,
        `${sMon} ${yy}`,
        `${fullMonUpper} ${yy}`,
        `${fullMon} ${yy}`,
        `Schedule_${sMon}`,
        `Schedule ${sMon}`,
        `Schedule_${fullMon}`,
        `Schedule ${fullMon}`,
        `${sMonUpper}`,
        `${sMon}`,
        `${fullMon}`,
        `${targetMonthKey}`,
        `${yy}-${mm}`,
        `${mm}/${yyyy}`,
        `${mm}/${yy}`,
        `Schedule`,
      ];
      for (const cand of candidates) {
        targetTab = findSheetIgnoreCase(surveySpreadsheet, cand);
        if (targetTab) break;
      }

      // Fuzzy match: sheet name contains month and year
      if (!targetTab) {
        targetTab =
          allSheets.find((s) => {
            const n = s.getName().trim().toLowerCase();
            const hasMonth = n.includes(sMon.toLowerCase()) || n.includes(fullMon.toLowerCase());
            const hasYear = n.includes(yy) || n.includes(yyyy);
            return hasMonth && hasYear;
          }) || null;
      }
    }

    // 3. Try any tab whose name starts with or contains "schedule" (excluding tabs of OTHER months)
    if (!targetTab) {
      const otherMonthWords = [
        "jan",
        "january",
        "feb",
        "february",
        "mar",
        "march",
        "apr",
        "april",
        "may",
        "jun",
        "june",
        "jul",
        "july",
        "aug",
        "august",
        "sep",
        "september",
        "oct",
        "october",
        "nov",
        "november",
        "dec",
        "december",
      ];
      const targetMonthWord = targetMonthKey
        ? ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"][
            parseInt(targetMonthKey.slice(5, 7), 10) - 1
          ]
        : null;
      const excludedWords = targetMonthWord
        ? otherMonthWords.filter((w) => !w.startsWith(targetMonthWord))
        : [];

      targetTab =
        allSheets.find((s) => {
          const n = s.getName().toLowerCase();
          const isSched = n.startsWith("schedule") || n.includes("schedule");
          if (!isSched) return false;
          return !excludedWords.some((w) => n.includes(w));
        }) || null;
    }

    // 4. Try any tab whose first rows have "Cook" and "Clean" header columns or Sign-Up Workbook layout
    if (!targetTab) {
      for (const s of allSheets) {
        if (s.getLastRow() >= 2 && s.getLastColumn() >= 2) {
          try {
            const topRows = s
              .getRange(1, 1, Math.min(s.getLastRow(), 8), Math.min(s.getLastColumn(), 15))
              .getValues();
            let hasCook = false;
            let hasClean = false;
            for (const r of topRows) {
              for (const c of r) {
                const str = String(c || "").toLowerCase();
                if (str.includes("cook") || str.includes("meal maker")) hasCook = true;
                if (str.includes("clean")) hasClean = true;
              }
            }
            if (hasCook && hasClean) {
              targetTab = s;
              break;
            }
          } catch {
            // ignore
          }
        }
      }
    }

    // If a schedule tab with rows was found, parse it!
    if (targetTab) {
      const data = targetTab.getDataRange().getValues();
      if (data.length > 1) {
        let formTab = surveySpreadsheet.getSheetByName("Form Responses 1");
        if (!formTab) {
          formTab =
            allSheets.find((s) => /^(?:form\s*)?responses(?:\s*\d+)?$/i.test(s.getName().trim())) ||
            allSheets.find((s) => /responses/i.test(s.getName())) ||
            allSheets[0];
        }
        let responses: SurveyResponse[] | undefined = undefined;
        if (formTab && formTab.getName() !== targetTab.getName()) {
          try {
            const formData = formTab.getDataRange().getValues();
            const parsedSurvey = parseSurveySheetData(formData, []);
            responses = parsedSurvey.responses;
          } catch (e) {
            console.warn("Could not parse survey responses for memberStats:", e);
          }
        }
        const parsedSched = parseScheduleGridData(data, responses);
        if (parsedSched.success && parsedSched.schedule.length > 0) {
          return parsedSched;
        }
      }
    }

    // 5. Fallback: If no Schedule tab exists, but Form Responses exists, dynamically solve it!
    let formTab = surveySpreadsheet.getSheetByName("Form Responses 1");
    if (!formTab) {
      formTab =
        allSheets.find((s) => /^(?:form\s*)?responses(?:\s*\d+)?$/i.test(s.getName().trim())) ||
        allSheets.find((s) => /responses/i.test(s.getName())) ||
        allSheets[0];
    }
    if (formTab) {
      const formData = formTab.getDataRange().getValues();
      if (formData.length > 1) {
        const parsedSurvey = parseSurveySheetData(formData, []);
        if (parsedSurvey.mealDates.length > 0 && parsedSurvey.responses.length > 0) {
          const solved = solveCookAndCleanSchedule(
            parsedSurvey.mealDates,
            parsedSurvey.responses,
            [],
            { cookPolicy: "ADAPTIVE_3_OR_2" }
          );
          if (solved.schedule.length > 0) {
            return solved;
          }
        }
      }
    }

    // 6. Final fallback: If this is an archived month, check baseline historical schedules
    if (targetMonthKey) {
      const baseline = getBaselineHistoricalSchedules();
      const match = baseline.find((b) => b.monthKey === targetMonthKey);
      if (match && match.schedule.length > 0) {
        return {
          success: true,
          schedule: match.schedule,
          memberStats: {},
          violations: [],
          unfilledSlotsCount: 0,
          solveTimeMs: 0,
          cookPolicy: "ADAPTIVE_3_OR_2",
        };
      }
    }

    throw new Error(`Schedule tab not found in spreadsheet.`);
  } catch (err: any) {
    console.error("Failed to load existing schedule:", err);
    throw new Error(`Failed to load schedule from sheet: ${err.message}`);
  }
}

/**
 * Matches a spreadsheet from Google Drive corresponding to a target month key (e.g. 2026-10).
 * Robustly matches real-world naming conventions:
 * - "26-10 Oct Meal Team Sign-Up (Responses)"
 * - "26-09 SEP Cook Team Survey (Responses)"
 * - "2026-10 Cook Team Survey"
 * - "October 2026 Schedule"
 */
function findSpreadsheetForMonth(
  sheets: { id: string; name: string }[],
  targetMonthKey: string
): { id: string; name: string } | undefined {
  if (!sheets || sheets.length === 0 || !targetMonthKey) return undefined;

  const mParts = targetMonthKey.split("-");
  const yyyy = mParts[0];
  const yy = yyyy.slice(-2); // "26"
  const mm = mParts[1]; // "10"
  const monthNum = parseInt(mm, 10);
  const monthNamesShort = [
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
  const shortMonth = monthNamesShort[monthNum - 1] || "";
  const monthNamesFull = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ];
  const fullMonth = monthNamesFull[monthNum - 1] || "";

  // 1. Match "26-11", "2026-11", "26/11", "11/26", "26 11", "11 26", "26_11", "26.11"
  let found = sheets.find((s) => {
    const n = s.name.toLowerCase();
    return (
      n.includes(`${yy}-${mm}`) ||
      n.includes(`${yyyy}-${mm}`) ||
      n.includes(`${yy}_${mm}`) ||
      n.includes(`${yyyy}_${mm}`) ||
      n.includes(`${yy}/${mm}`) ||
      n.includes(`${mm}/${yy}`) ||
      n.includes(`${yyyy}/${mm}`) ||
      n.includes(`${mm}/${yyyy}`) ||
      n.includes(`${yy} ${mm}`) ||
      n.includes(`${mm} ${yy}`) ||
      n.includes(`${yy}.${mm}`) ||
      n.includes(`${yyyy}.${mm}`) ||
      n.includes(`${yy}${mm}`) ||
      n.includes(`${yyyy}${mm}`)
    );
  });
  if (found) return found;

  // 2. Match month abbreviation + 2-digit or 4-digit year (e.g. "nov" and "26", "november" and "2026")
  if (shortMonth) {
    found = sheets.find((s) => {
      const n = s.name.toLowerCase();
      const hasMonth = n.includes(shortMonth) || (fullMonth && n.includes(fullMonth));
      const hasYear = n.includes(yy) || n.includes(yyyy);
      return hasMonth && hasYear;
    });
    if (found) return found;
  }

  // 3. Match month number in word boundary and year
  found = sheets.find((s) => {
    const n = s.name.toLowerCase();
    const hasNum = new RegExp(`(?:^|[\\s-_])${mm}(?:[\\s-_]|$)`).test(n);
    const hasYear = n.includes(yy) || n.includes(yyyy);
    return hasNum && hasYear;
  });
  if (found) return found;

  // 4. Match month name alone (e.g. "November Cook Team Survey" without explicit 26 or 2026)
  if (shortMonth) {
    found = sheets.find((s) => {
      const n = s.name.toLowerCase();
      if (fullMonth && n.includes(fullMonth)) return true;
      return (
        n.includes(shortMonth) &&
        !n.includes("aug") &&
        !n.includes("sep") &&
        !n.includes("oct") &&
        !n.includes("dec")
      );
    });
    if (found) return found;
  }

  // 5. Direct search in Google Drive (in case sheet is outside default parent folder)
  try {
    if (typeof DriveApp !== "undefined" && DriveApp.searchFiles) {
      const searchQueries = [
        `title contains '${yy}-${mm}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`,
        `title contains '${yyyy}-${mm}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`,
      ];
      if (fullMonth) {
        searchQueries.push(
          `title contains '${fullMonth}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`
        );
      }
      if (shortMonth) {
        searchQueries.push(
          `title contains '${shortMonth}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`
        );
      }
      for (const q of searchQueries) {
        const files = DriveApp.searchFiles(q);
        while (files.hasNext()) {
          const f = files.next();
          const n = f.getName().toLowerCase();
          if (
            n.includes(`${yy}-${mm}`) ||
            n.includes(`${yyyy}-${mm}`) ||
            (fullMonth && n.includes(fullMonth)) ||
            (shortMonth && n.includes(shortMonth) && (n.includes(yy) || n.includes(yyyy)))
          ) {
            return { id: f.getId(), name: f.getName() };
          }
        }
      }
    }
  } catch (err) {
    console.warn("Direct DriveApp search in findSpreadsheetForMonth failed:", err);
  }

  // 6. Direct search in Historical folder (1Lm-l2Cm8DFO4swnPuDHpYlTz8FOGN8df)
  try {
    if (typeof DriveApp !== "undefined" && DriveApp.getFolderById) {
      const histFolder = DriveApp.getFolderById("1Lm-l2Cm8DFO4swnPuDHpYlTz8FOGN8df");
      if (histFolder) {
        const hFiles = histFolder.getFilesByType(MimeType.GOOGLE_SHEETS);
        while (hFiles.hasNext()) {
          const f = hFiles.next();
          const n = f.getName().toLowerCase();
          if (
            n.includes(`${yy}-${mm}`) ||
            n.includes(`${yyyy}-${mm}`) ||
            (fullMonth && n.includes(fullMonth)) ||
            (shortMonth && n.includes(shortMonth) && (n.includes(yy) || n.includes(yyyy)))
          ) {
            return { id: f.getId(), name: f.getName() };
          }
        }
      }
    }
  } catch (err) {
    console.warn("Direct historical folder search in findSpreadsheetForMonth failed:", err);
  }

  return undefined;
}

/**
 * Loads the published schedule for the public resident calendar view.
 * If spreadsheetIdOrUrl is not provided, looks for a spreadsheet with Schedule_YYYY-MM tab.
 */
function getPublicSchedule(monthKey?: string, spreadsheetIdOrUrl?: string): PublicScheduleResult {
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  let availableMonths: string[] = [];
  try {
    availableMonths = getAvailableScheduleTabs(spreadsheetIdOrUrl);
  } catch (e) {
    console.warn("Could not load availableScheduleTabs:", e);
    availableMonths = [
      "2026-11",
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

  // If monthKey is explicitly provided, use it; otherwise prefer current month if published, or latest published
  let targetMonthKey = (monthKey || "").trim();
  if (!targetMonthKey) {
    if (availableMonths.includes(currentMonthKey)) {
      targetMonthKey = currentMonthKey;
    } else if (availableMonths.length > 0) {
      targetMonthKey = availableMonths[0];
    } else {
      targetMonthKey = currentMonthKey;
    }
  }

  if (!availableMonths.includes(targetMonthKey)) {
    availableMonths.unshift(targetMonthKey);
  }
  availableMonths.sort((a, b) => b.localeCompare(a));

  try {
    let sheetId = (spreadsheetIdOrUrl || "").trim();
    const masterData = getMasterRegistryData();
    const communityName = masterData.settings?.communityName || "Vancouver Cohousing";

    if (!sheetId) {
      const sheets = listAvailableDriveSheets();
      const matched = findSpreadsheetForMonth(sheets, targetMonthKey);
      if (matched) {
        sheetId = matched.id;
      }
      // If no standalone file found for this month, check common meal signup workbook
      if (!sheetId && masterData.settings?.signupWorkbookId) {
        sheetId = masterData.settings.signupWorkbookId;
      }
      // Only fallback to first sheet if NO target month was specified by user
      if (!sheetId && !monthKey && sheets.length > 0) {
        const schedSheet = sheets.find(
          (s) =>
            s.name.toLowerCase().includes("schedule") ||
            s.name.toLowerCase().includes("responses") ||
            s.name.toLowerCase().includes("survey")
        );
        if (schedSheet) {
          sheetId = schedSheet.id;
        } else {
          sheetId = sheets[0].id;
        }
      }
    }

    if (!sheetId) {
      // Fallback to baseline historical schedules if available
      const baseline = getBaselineHistoricalSchedules();
      const match = baseline.find((b) => b.monthKey === targetMonthKey);
      if (match && match.schedule.length > 0) {
        return {
          success: true,
          schedule: match.schedule,
          monthKey: targetMonthKey,
          monthTitle: formatMonthHeaderTitle(targetMonthKey),
          communityName,
          availableMonths,
          message: "Loaded from historical baseline archive.",
        };
      }

      return {
        success: false,
        schedule: [],
        monthKey: targetMonthKey,
        monthTitle: formatMonthHeaderTitle(targetMonthKey),
        communityName,
        availableMonths,
        message: "No schedule spreadsheet found.",
      };
    }

    const tabName = targetMonthKey ? `Schedule_${targetMonthKey}` : undefined;
    let loaded: ScheduleOutput | null = null;
    try {
      loaded = loadExistingScheduleFromSheet(sheetId, tabName, targetMonthKey);
    } catch (loadErr) {
      console.warn(`Could not load schedule from sheet ${sheetId}:`, loadErr);
    }

    // If initial sheet failed or returned empty schedule, fallback to signupWorkbookId
    if (
      (!loaded || !loaded.success || loaded.schedule.length === 0) &&
      masterData.settings?.signupWorkbookId &&
      masterData.settings.signupWorkbookId !== sheetId
    ) {
      try {
        const fbLoaded = loadExistingScheduleFromSheet(
          masterData.settings.signupWorkbookId,
          undefined,
          targetMonthKey
        );
        if (fbLoaded.success && fbLoaded.schedule.length > 0) {
          loaded = fbLoaded;
          sheetId = masterData.settings.signupWorkbookId;
        }
      } catch (fbErr) {
        console.warn("Could not load schedule from signupWorkbookId fallback:", fbErr);
      }
    }

    if (!loaded || !loaded.success || loaded.schedule.length === 0) {
      // Check baseline historical schedules if available
      const baseline = getBaselineHistoricalSchedules();
      const match = baseline.find((b) => b.monthKey === targetMonthKey);
      if (match && match.schedule.length > 0) {
        return {
          success: true,
          schedule: match.schedule,
          monthKey: targetMonthKey,
          monthTitle: formatMonthHeaderTitle(targetMonthKey),
          communityName,
          availableMonths,
          message: "Loaded from historical baseline archive.",
        };
      }
    }

    if (!loaded) {
      throw new Error("Failed to load schedule from sheet.");
    }

    let monthTitle = formatMonthHeaderTitle(targetMonthKey);
    let derivedMonthKey = targetMonthKey;
    if (loaded.schedule.length > 0) {
      const first = loaded.schedule[0];
      const parsed = parseDateFromLabelOrKey(first.dateLabel, first.dateKey);
      if (parsed && !isNaN(parsed.getTime())) {
        monthTitle = parsed.toLocaleString("en-US", { month: "long", year: "numeric" });
        derivedMonthKey = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`;
      }
    }

    return {
      success: true,
      schedule: loaded.schedule,
      monthKey: derivedMonthKey || targetMonthKey,
      monthTitle,
      communityName,
      availableMonths,
      sourceSheetName: `Schedule_${derivedMonthKey || targetMonthKey}`,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${sheetId}`,
    };
  } catch (err: any) {
    console.warn("getPublicSchedule error, trying baseline fallback:", err);
    // As a safe fallback for residents, check baseline archive
    try {
      const baseline = getBaselineHistoricalSchedules();
      const match = baseline.find((b) => b.monthKey === targetMonthKey);
      if (match && match.schedule.length > 0) {
        return {
          success: true,
          schedule: match.schedule,
          monthKey: targetMonthKey,
          monthTitle: formatMonthHeaderTitle(targetMonthKey),
          communityName: "Vancouver Cohousing",
          availableMonths,
        };
      }
    } catch {}

    return {
      success: false,
      schedule: [],
      monthKey: targetMonthKey,
      monthTitle: formatMonthHeaderTitle(targetMonthKey),
      communityName: "Vancouver Cohousing",
      availableMonths,
      message: err.message,
    };
  }
}

function formatMonthHeaderTitle(monthKey: string): string {
  const parts = (monthKey || "").split("-");
  if (parts.length >= 2) {
    const yr = parts[0];
    const mo = parseInt(parts[1], 10);
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    if (mo >= 1 && mo <= 12) {
      return `${months[mo - 1]} ${yr}`;
    }
  }
  return "Community Meals";
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

    try {
      recordPublishedMonthInMaster(monthSuffix);
      setMonthStatus(monthSuffix, "CLOSED");
    } catch (e) {
      console.warn("Could not record published month or close status in master:", e);
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
 * Converts plain text email body with date headings, individual cooks, and italic cleaners to clean, formatted HTML email
 */
function textToHtmlEmailBody(plainText: string): string {
  const escaped = String(plainText || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const lines = escaped.split("\n");
  let html = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1e293b;">`;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      html += `<div style="height: 10px;"></div>`;
    } else if (/^(\*|_)?(cleaners?|cleaning):/i.test(trimmed)) {
      const cleanLine = trimmed.replace(/^(\*|_)+|(\*|_)+$/g, "");
      html += `<div style="font-style: italic; color: #475569; margin: 3px 0;">${cleanLine}</div>`;
    } else if (trimmed === "NO COMMUNITY MEAL" || trimmed.startsWith("NO COMMUNITY MEAL")) {
      html += `<div style="font-weight: bold; color: #64748b; margin: 3px 0;">NO COMMUNITY MEAL</div>`;
    } else if (trimmed.startsWith("• ") || trimmed.startsWith("  • ")) {
      html += `<div style="padding-left: 18px; margin: 3px 0;">${trimmed}</div>`;
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
        line.includes("Sun") ||
        line.includes("Jan") ||
        line.includes("Feb") ||
        line.includes("Mar") ||
        line.includes("Apr") ||
        line.includes("May") ||
        line.includes("Jun") ||
        line.includes("Jul") ||
        line.includes("Aug") ||
        line.includes("Sep") ||
        line.includes("Oct") ||
        line.includes("Nov") ||
        line.includes("Dec"))
    ) {
      html += `<div style="font-weight: bold; margin-top: 14px; margin-bottom: 3px; color: #0f172a;">${line}</div>`;
    } else {
      html += `<div style="margin: 2px 0;">${line}</div>`;
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
function getAvailableScheduleTabs(_spreadsheetIdOrUrl?: string | any): string[] {
  try {
    const masterData = getMasterRegistryData();
    return getPublishedMonthKeys(masterData.settings);
  } catch (err: any) {
    console.warn("getAvailableScheduleTabs error:", err);
    return [...DEFAULT_COMPLETED_MONTHS];
  }
}

/**
 * Retrieves metadata for Common Meal Sign-Up Workbook
 */
function getMealSignupWorkbookInfo(
  targetSpreadsheetId?: string,
  defaultMonthTab?: string
): MealSignupWorkbookInfo {
  let target = targetSpreadsheetId;
  if (!target || !target.trim()) {
    try {
      const masterData = getMasterRegistryData();
      if (masterData.settings && masterData.settings.signupWorkbookId) {
        target = masterData.settings.signupWorkbookId;
      }
    } catch (e) {
      console.warn("Could not load signupWorkbookId from Master Registry:", e);
    }
  }
  return inspectMealSignupWorkbook(target, defaultMonthTab);
}

/**
 * Creates/overwrites the monthly tab in the Common Meal Sign-Up Workbook
 */
function exportToMealSignupWorkbook(
  targetSpreadsheetId: string,
  sourceScheduleOrSheetId: any,
  options?: MealSignupExportOptions
): MealSignupExportResult {
  let target = targetSpreadsheetId;
  if (!target || !target.trim()) {
    try {
      const masterData = getMasterRegistryData();
      if (masterData.settings && masterData.settings.signupWorkbookId) {
        target = masterData.settings.signupWorkbookId;
      }
    } catch (e) {
      console.warn("Could not load signupWorkbookId from Master Registry:", e);
    }
  }

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

  const result = executeCreateMealSignupTab(target, schedule, options);
  try {
    if (schedule.length > 0) {
      let mKey = "";
      if (schedule[0].dateKey && /^\d{4}-\d{2}/.test(schedule[0].dateKey)) {
        mKey = schedule[0].dateKey.slice(0, 7);
      } else {
        const parsed = parseDateFromLabelOrKey(schedule[0].dateLabel, schedule[0].dateKey);
        if (parsed && !isNaN(parsed.getTime())) {
          mKey = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`;
        }
      }
      if (mKey) {
        setMonthStatus(mKey, "CLOSED");
      }
    }
  } catch (statusErr) {
    console.warn("Could not mark month closed during meal signup workbook export:", statusErr);
  }
  return result;
}

/**
 * Loads the saved configuration (status and configured meal dates) for a month
 */
function getMonthConfig(monthKey: string): MonthConfig {
  const cleanMonth = (monthKey || "").trim();
  let savedConfig: MonthConfig | null = null;

  // 1. Check ScriptProperties
  try {
    const props = PropertiesService.getScriptProperties();
    const raw = props.getProperty(`MONTH_CONFIG_${cleanMonth}`);
    if (raw) {
      savedConfig = JSON.parse(raw);
    }
  } catch (e) {
    console.warn("Could not read month config from ScriptProperties:", e);
  }

  // 2. Check Master Registry Settings
  if (!savedConfig) {
    try {
      const masterData = getMasterRegistryData();
      const statusKey = `month_status_${cleanMonth}`;
      const datesKey = `month_dates_${cleanMonth}`;
      const altStatusKey = `month_status_${cleanMonth.replace("-", "_")}`;
      const altDatesKey = `month_dates_${cleanMonth.replace("-", "_")}`;
      const statusVal = masterData.settings
        ? (masterData.settings as any)[statusKey] || (masterData.settings as any)[altStatusKey]
        : undefined;
      const datesVal = masterData.settings
        ? (masterData.settings as any)[datesKey] || (masterData.settings as any)[altDatesKey]
        : undefined;
      if (statusVal) {
        let parsedDates: SurveyFormDateConfig[] = [];
        try {
          if (datesVal) parsedDates = JSON.parse(datesVal);
        } catch {}
        savedConfig = {
          monthKey: cleanMonth,
          status: statusVal as MonthStatus,
          dates: parsedDates,
          isConfigured: true,
        };
      }
    } catch (e) {
      console.warn("Could not read month config from Master Registry:", e);
    }
  }

  // 3. Fallback check: If month is historical / already scheduled
  if (!savedConfig) {
    const isCompleted =
      DEFAULT_COMPLETED_MONTHS.includes(cleanMonth) ||
      (() => {
        try {
          const tabs = getAvailableScheduleTabs();
          return tabs.includes(cleanMonth) || tabs.includes(`Schedule_${cleanMonth}`);
        } catch {
          return false;
        }
      })();

    if (isCompleted) {
      return {
        monthKey: cleanMonth,
        status: "CLOSED",
        dates: [],
        closedAt: new Date().toISOString(),
        isConfigured: false,
      };
    }

    return {
      monthKey: cleanMonth,
      status: "NOT_OPEN",
      dates: [],
      isConfigured: false,
    };
  }

  return savedConfig;
}

/**
 * Synchronizes the summary "open_months" setting row in Master Settings with currently open months.
 */
function syncOpenMonthsSetting(): { success: boolean; openMonths: string; message: string } {
  try {
    const master = getMasterRegistrySpreadsheet();
    if (!master) {
      return { success: false, openMonths: "", message: "Master spreadsheet not found." };
    }
    const settingsSheet = master.getSheetByName("Settings");
    if (!settingsSheet) {
      return { success: false, openMonths: "", message: "Settings tab not found." };
    }
    const data = settingsSheet.getDataRange().getValues();
    const openSet = new Set<string>();

    for (let i = 1; i < data.length; i++) {
      const k = String(data[i][0] || "")
        .trim()
        .toLowerCase();
      const v = String(data[i][1] || "")
        .trim()
        .toUpperCase();
      const match = k.match(/^month_status_(\d{4})[-_](\d{2})$/);
      if (match && v === "OPEN") {
        openSet.add(`${match[1]}-${match[2]}`);
      }
    }

    const openList = Array.from(openSet)
      .sort((a, b) => b.localeCompare(a))
      .join(",");
    saveMasterSettings({ open_months: openList } as any);
    const msg = openList
      ? `Successfully synchronized open_months to: ${openList}`
      : "No months currently OPEN. Setting open_months to empty.";
    Logger.log(msg);
    return {
      success: true,
      openMonths: openList,
      message: msg,
    };
  } catch (err: any) {
    console.warn("Could not sync open_months setting:", err);
    return {
      success: false,
      openMonths: "",
      message: err.message || "Failed to sync open_months.",
    };
  }
}

/**
 * Saves configured meal dates/types/notes as draft or marks the month as OPEN for sign-ups.
 */
function saveMonthDatesAndOpen(payload: SaveMonthDatesPayload): SaveMonthDatesResult {
  const monthKey = (payload.monthKey || "").trim();
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) {
    throw new Error(
      `Invalid month key format: '${monthKey}'. Expected 'YYYY-MM' (e.g. '2026-11').`
    );
  }

  const allDates = payload.dates || [];
  const activeDates = allDates.filter((d) => d.included !== false);
  if (activeDates.length === 0) {
    throw new Error("Cannot save dates with 0 meal dates. Please include at least one date.");
  }

  const status: MonthStatus = payload.status || "OPEN";
  const now = new Date().toISOString();

  const config: MonthConfig = {
    monthKey,
    status,
    dates: allDates,
    defaultTitle: payload.title || deriveFormTitle(monthKey),
    openedAt: status === "OPEN" ? now : undefined,
    closedAt: status === "CLOSED" ? now : undefined,
    isConfigured: true,
  };

  // 1. Save in ScriptProperties
  try {
    const props = PropertiesService.getScriptProperties();
    props.setProperty(`MONTH_CONFIG_${monthKey}`, JSON.stringify(config));
  } catch (propErr) {
    console.warn("Could not save month config to ScriptProperties:", propErr);
  }

  // 2. Save in Master Registry Settings
  try {
    saveMasterSettings({
      [`month_status_${monthKey}`]: status,
      [`month_dates_${monthKey}`]: JSON.stringify(allDates),
    } as any);
    syncOpenMonthsSetting();
  } catch (masterErr) {
    console.warn("Could not save month config to Master Settings:", masterErr);
  }

  const message =
    status === "OPEN"
      ? `Meal dates saved and sign-ups for ${monthKey} are now OPEN (${activeDates.length} meal dates included)!`
      : `Meal dates draft saved for ${monthKey} (${activeDates.length} meal dates configured). Sign-ups remain draft.`;

  return {
    success: true,
    message,
    monthKey,
    status,
    dates: allDates,
  };
}

/**
 * Updates a month's sign-up status (e.g. CLOSING by scheduling teams, or REOPENING).
 */
function setMonthStatus(monthKey: string, status: MonthStatus): SetMonthStatusResult {
  const cleanMonth = (monthKey || "").trim();
  if (!cleanMonth || !/^\d{4}-\d{2}$/.test(cleanMonth)) {
    throw new Error(`Invalid month key format: '${cleanMonth}'. Expected 'YYYY-MM'.`);
  }

  const now = new Date().toISOString();
  const existingConfig = getMonthConfig(cleanMonth);
  const updatedConfig: MonthConfig = {
    ...existingConfig,
    monthKey: cleanMonth,
    status,
    closedAt: status === "CLOSED" ? now : existingConfig.closedAt,
    openedAt: status === "OPEN" ? existingConfig.openedAt || now : existingConfig.openedAt,
  };

  try {
    const props = PropertiesService.getScriptProperties();
    props.setProperty(`MONTH_CONFIG_${cleanMonth}`, JSON.stringify(updatedConfig));
  } catch (e) {
    console.warn("Could not update status in ScriptProperties:", e);
  }

  try {
    saveMasterSettings({
      [`month_status_${cleanMonth}`]: status,
    } as any);
    syncOpenMonthsSetting();
  } catch (e) {
    console.warn("Could not update status in Master Settings:", e);
  }

  return {
    success: true,
    message: `Sign-up status for ${cleanMonth} set to ${status}.`,
    monthKey: cleanMonth,
    status,
  };
}

/**
 * Checks if a survey response spreadsheet already exists for a month and counts submitted responses.
 */
function checkExistingSurveyForMonth(monthKey: string): ExistingSurveyInfo {
  const cleanMonth = (monthKey || "").trim();
  const yyMm = cleanMonth.length >= 7 ? cleanMonth.slice(2) : "";

  let matchedSheet: DriveSheetItem | null = null;
  try {
    const driveSheets = listAvailableDriveSheets();
    matchedSheet =
      driveSheets.find((s) => {
        const n = s.name.toLowerCase();
        const hasMonth = n.includes(cleanMonth.toLowerCase()) || (yyMm && n.includes(yyMm));
        return hasMonth && (n.includes("meal team sign-up") || n.includes("responses"));
      }) || null;
  } catch (e) {
    console.warn("Could not check drive sheets for month:", e);
  }

  if (!matchedSheet) {
    return {
      exists: false,
      responseCount: 0,
      canOverwrite: true,
    };
  }

  let responseCount = 0;
  try {
    const ss = SpreadsheetApp.openById(matchedSheet.id);
    const sheets = ss.getSheets();
    const formTab = ss.getSheetByName("Form Responses 1") || sheets[0];
    if (formTab && formTab.getLastRow() > 1) {
      responseCount += Math.max(0, formTab.getLastRow() - 1);
    }
    const webTab = ss.getSheetByName("Web Responses");
    if (webTab && webTab.getLastRow() > 1) {
      responseCount += Math.max(0, webTab.getLastRow() - 1);
    }
  } catch (e) {
    console.warn("Could not read response count from existing sheet:", e);
  }

  const canOverwrite = responseCount <= 1;
  let warningMessage = "";
  if (responseCount > 1) {
    warningMessage = `A survey spreadsheet already exists with ${responseCount} responses ('${matchedSheet.name}'). Creating a new form is blocked to prevent losing responses.`;
  } else if (responseCount === 1) {
    warningMessage = `A survey spreadsheet already exists with 1 response ('${matchedSheet.name}'). Overwriting will create a new form and response sheet.`;
  } else {
    warningMessage = `A survey spreadsheet already exists with 0 responses ('${matchedSheet.name}').`;
  }

  return {
    exists: true,
    spreadsheetId: matchedSheet.id,
    spreadsheetName: matchedSheet.name,
    spreadsheetUrl: matchedSheet.url,
    responseCount,
    canOverwrite,
    warningMessage,
  };
}

/**
 * Prepares preview dates for creating or reviewing a monthly survey form,
 * returning saved configured dates and status if opened, or generated draft dates if not open yet.
 */
function getSurveyFormDatesPreview(monthKey: string): SurveyFormDatesPreviewResult {
  const cleanMonth = (monthKey || "2026-11").trim();
  const config = getMonthConfig(cleanMonth);
  const existingSurvey = checkExistingSurveyForMonth(cleanMonth);

  // If OPEN, ensure open_months setting in Master Registry stays synchronized
  if (config.status === "OPEN") {
    try {
      syncOpenMonthsSetting();
    } catch (e) {
      console.warn("Could not auto-sync open_months in getSurveyFormDatesPreview:", e);
    }
  }

  // If already configured with saved dates, return those exact dates
  if (config.isConfigured && config.dates && config.dates.length > 0) {
    return {
      monthKey: cleanMonth,
      defaultTitle: config.defaultTitle || deriveFormTitle(cleanMonth),
      dates: config.dates,
      status: config.status,
      openedAt: config.openedAt,
      closedAt: config.closedAt,
      isConfigured: true,
      existingSurvey,
    };
  }

  // Otherwise generate standard algorithmic draft dates
  const draftDates = generateMonthlySurveyDates(cleanMonth);
  return {
    monthKey: cleanMonth,
    defaultTitle: deriveFormTitle(cleanMonth),
    dates: draftDates,
    status: config.status, // "NOT_OPEN" or "CLOSED"
    openedAt: config.openedAt,
    closedAt: config.closedAt,
    isConfigured: false,
    existingSurvey,
  };
}

/**
 * Generates a Google Form & linked Google Sheet response spreadsheet,
 * and marks the month sign-up as OPEN with the configured dates.
 */
function createMonthlySurveyForm(payload: CreateSurveyFormPayload): CreateSurveyFormResult {
  const existing = checkExistingSurveyForMonth(payload.monthKey);
  if (existing.exists) {
    if (existing.responseCount > 1) {
      throw new Error(
        `Cannot create a new survey form: ${existing.responseCount} responses have already been received in '${existing.spreadsheetName}'. Overwriting is blocked to protect member submissions.`
      );
    }
    if (!payload.allowOverwrite) {
      throw new Error(
        `A survey spreadsheet already exists for ${payload.monthKey} ('${existing.spreadsheetName}'). Overwrite confirmation is required.`
      );
    }
  }

  const result = executeCreateSurveyForm(payload);
  try {
    saveMonthDatesAndOpen({
      monthKey: payload.monthKey,
      dates: payload.dates,
      title: payload.title,
      status: "OPEN",
    });
  } catch (e) {
    console.warn("Could not mark month open during createMonthlySurveyForm:", e);
  }
  return result;
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
g.saveMasterSettings = saveMasterSettings;
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
g.getMonthConfig = getMonthConfig;
g.saveMonthDatesAndOpen = saveMonthDatesAndOpen;
g.setMonthStatus = setMonthStatus;
g.getSurveyFormDatesPreview = getSurveyFormDatesPreview;
g.checkExistingSurveyForMonth = checkExistingSurveyForMonth;
g.createMonthlySurveyForm = createMonthlySurveyForm;
g.appendManualSurveyResponse = appendManualSurveyResponse;
g.saveWebSurveyResponse = saveWebSurveyResponse;
g.sendBetaSurveyInvitations = sendBetaSurveyInvitations;
g.authorizeAppScopes = authorizeAppScopes;
g.authorizeAllPermissions = authorizeAllPermissions;
g.updateUserGuideDoc = updateUserGuideDoc;
g.getPublicSchedule = getPublicSchedule;
g.populatePublishedMonthsInMaster = populatePublishedMonthsInMaster;
g.getDeploymentUrl = getDeploymentUrl;
g.syncOpenMonthsSetting = syncOpenMonthsSetting;

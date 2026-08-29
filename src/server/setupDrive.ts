/**
 * Automated Google Drive & Google Sheets Workspace Provisioner
 * Sets up folder hierarchy, Master Community Registry, and Test Scenario Spreadsheets.
 */

import {
  MOCK_MEMBERS,
  MOCK_EXCEPTIONS,
  MOCK_PRESETS,
} from "./mockData";
import { MealDate, SurveyResponse } from "./types";

export interface ProvisionResult {
  rootFolderId: string;
  liveFolderId: string;
  devFolderId: string;
  liveMasterSheetId: string;
  liveMasterSheetUrl: string;
  devMasterSheetId: string;
  devMasterSheetUrl: string;
  testSheets: { key: string; name: string; id: string; url: string }[];
}

const DEFAULT_DRIVE_FOLDER_ID = "1U0cJqnxCgWn-5k0RCj2BjCUj9nc1dMGl";

/**
 * Gets or creates a subfolder by name within a parent folder
 */
function getOrCreateSubfolder(
  parentFolder: GoogleAppsScript.Drive.Folder,
  name: string
): GoogleAppsScript.Drive.Folder {
  const folders = parentFolder.getFoldersByName(name);
  if (folders.hasNext()) {
    return folders.next();
  }
  return parentFolder.createFolder(name);
}

/**
 * Formats a header row with background, bold text, and frozen header
 */
function formatHeader(sheet: GoogleAppsScript.Spreadsheet.Sheet, numColumns: number, bgColor = "#f1f5f9") {
  const headerRange = sheet.getRange(1, 1, 1, numColumns);
  headerRange.setFontWeight("bold");
  headerRange.setBackground(bgColor);
  headerRange.setFontColor("#1e293b");
  sheet.setFrozenRows(1);
}

/**
 * Creates and populates the Master Community Registry spreadsheet
 */
function createMasterRegistrySheet(
  folder: GoogleAppsScript.Drive.Folder,
  title: string
): GoogleAppsScript.Spreadsheet.Spreadsheet {
  // Check if sheet already exists
  const existingFiles = folder.getFilesByName(title);
  let spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet;

  if (existingFiles.hasNext()) {
    const file = existingFiles.next();
    spreadsheet = SpreadsheetApp.openById(file.getId());
  } else {
    spreadsheet = SpreadsheetApp.create(title);
    const file = DriveApp.getFileById(spreadsheet.getId());
    file.moveTo(folder);
  }

  // 1. Members Tab
  let membersSheet = spreadsheet.getSheetByName("Members");
  if (!membersSheet) {
    membersSheet = spreadsheet.insertSheet("Members", 0);
  }
  membersSheet.clear();

  const memberRows: any[][] = [
    ["Name", "Google Email", "Active", "Last Active Survey"],
  ];
  for (const m of MOCK_MEMBERS) {
    memberRows.push([m.name, m.google_email, m.active, m.last_active_survey || "2026-08"]);
  }
  membersSheet.getRange(1, 1, memberRows.length, memberRows[0].length).setValues(memberRows);
  formatHeader(membersSheet, 4, "#e0f2fe"); // soft sky blue

  // 2. Exceptions Tab
  let exceptionsSheet = spreadsheet.getSheetByName("Exceptions");
  if (!exceptionsSheet) {
    exceptionsSheet = spreadsheet.insertSheet("Exceptions", 1);
  }
  exceptionsSheet.clear();

  const exceptionRows: any[][] = [
    ["Person A", "Person B", "Rule Type", "Target Role A", "Target Role B", "Is Hard Rule", "Notes"],
  ];
  for (const e of MOCK_EXCEPTIONS) {
    exceptionRows.push([
      e.person_a,
      e.person_b || "",
      e.rule_type,
      e.target_role_a || "",
      e.target_role_b || "",
      e.is_hard_rule,
      e.notes || "",
    ]);
  }
  exceptionsSheet.getRange(1, 1, exceptionRows.length, exceptionRows[0].length).setValues(exceptionRows);
  formatHeader(exceptionsSheet, 7, "#fef3c7"); // soft amber

  // 3. Settings Tab
  let settingsSheet = spreadsheet.getSheetByName("Settings");
  if (!settingsSheet) {
    settingsSheet = spreadsheet.insertSheet("Settings", 2);
  }
  settingsSheet.clear();

  const settingRows: any[][] = [
    ["Key", "Value", "Description"],
    ["cook_policy", "ADAPTIVE_3_OR_2", "Adaptive cook sizing (Target 3 for dinner, accept 2 if agreed)"],
    ["default_clean_quota", "1", "Default clean shifts per member when not specified"],
    ["community_name", "Cohousing Community", "Community organization name"],
  ];
  settingsSheet.getRange(1, 1, settingRows.length, settingRows[0].length).setValues(settingRows);
  formatHeader(settingsSheet, 3, "#ede9fe"); // soft purple

  // Remove default "Sheet1" if present
  const defaultSheet = spreadsheet.getSheetByName("Sheet1");
  if (defaultSheet && spreadsheet.getSheets().length > 1) {
    spreadsheet.deleteSheet(defaultSheet);
  }

  return spreadsheet;
}

/**
 * Creates a synthetic survey responses sheet formatted like Google Forms
 */
function createSurveyResponsesSheet(
  folder: GoogleAppsScript.Drive.Folder,
  title: string,
  mealDates: MealDate[],
  responses: SurveyResponse[]
): GoogleAppsScript.Spreadsheet.Spreadsheet {
  const existingFiles = folder.getFilesByName(title);
  let spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet;

  if (existingFiles.hasNext()) {
    const file = existingFiles.next();
    spreadsheet = SpreadsheetApp.openById(file.getId());
  } else {
    spreadsheet = SpreadsheetApp.create(title);
    const file = DriveApp.getFileById(spreadsheet.getId());
    file.moveTo(folder);
  }

  let sheet = spreadsheet.getSheetByName("Form Responses 1");
  if (!sheet) {
    sheet = spreadsheet.insertSheet("Form Responses 1", 0);
  }
  sheet.clear();

  // Construct Google Form Header
  // [Timestamp, Name, Cook Quota, Clean Quota, ...Dates, 2-person dinner willing, Same day willing, Special instructions]
  const headers = [
    "Timestamp",
    "Your Name:",
    "How many meals can you cook this month?",
    "How many meals can you clean this month?",
  ];

  for (const d of mealDates) {
    const notePart = d.specialNote ? ` - ${d.specialNote}` : "";
    headers.push(
      `Select your available dates [${d.dateLabel} (${d.mealType}${notePart})]`
    );
  }

  headers.push("Would you be open to a 2-person cook team on dinners if needed?");
  headers.push("Can you cook and clean on the same day?");
  headers.push("Any special instructions, childcare constraints, or kitchen preferences?");

  const rows: any[][] = [headers];

  const now = new Date();
  for (let i = 0; i < responses.length; i++) {
    const r = responses[i];
    const timestamp = new Date(now.getTime() - (responses.length - i) * 3600000).toLocaleString();
    const row: any[] = [
      timestamp,
      r.name,
      r.cookQuota,
      r.cleanQuota ?? 1,
    ];

    for (const d of mealDates) {
      const avail = r.availability[d.dateLabel] || "Unavailable";
      // Convert to human survey string
      const humanAvail =
        avail === "AVAILABLE"
          ? "Available"
          : avail === "COOK_ONLY"
          ? "Cook Only"
          : avail === "CLEAN_ONLY"
          ? "Clean Only"
          : "Unavailable";
      row.push(humanAvail);
    }

    row.push(r.cookTeamSizePref || "3 on dinners, 2 on brunches");
    row.push(r.canCookCleanSameDay ? "Yes" : "No");
    row.push(r.specialInstructions || "");

    rows.push(row);
  }

  sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  formatHeader(sheet, headers.length, "#ffedd5"); // soft orange

  const defaultSheet = spreadsheet.getSheetByName("Sheet1");
  if (defaultSheet && spreadsheet.getSheets().length > 1) {
    spreadsheet.deleteSheet(defaultSheet);
  }

  return spreadsheet;
}

/**
 * Main Setup function to provision the entire workspace in Google Drive
 */
export function setupCommunityDriveWorkspace(
  parentFolderId = DEFAULT_DRIVE_FOLDER_ID
): ProvisionResult {
  console.log(`Starting Drive provisioning in root folder: ${parentFolderId}`);
  const rootFolder = DriveApp.getFolderById(parentFolderId);

  // 1. Create Subfolders
  const liveFolder = getOrCreateSubfolder(rootFolder, "01_Live_Production");
  const devFolder = getOrCreateSubfolder(rootFolder, "02_Dev_and_Testing");
  const monthlyFolder = getOrCreateSubfolder(liveFolder, "Monthly_Surveys");

  // 2. Provision Live Master Registry
  console.log("Creating Live Master Community Registry...");
  const liveMasterSheet = createMasterRegistrySheet(
    liveFolder,
    "Master Community Registry (Live)"
  );

  // 3. Provision Dev Master Registry
  console.log("Creating Dev/Test Master Community Registry...");
  const devMasterSheet = createMasterRegistrySheet(
    devFolder,
    "Master Community Registry (Dev/Test)"
  );

  // Save the Live Master Sheet ID into Script Properties
  try {
    PropertiesService.getScriptProperties().setProperty(
      "MASTER_REGISTRY_SHEET_ID",
      liveMasterSheet.getId()
    );
    PropertiesService.getScriptProperties().setProperty(
      "DEV_MASTER_REGISTRY_SHEET_ID",
      devMasterSheet.getId()
    );
  } catch (e) {
    console.log("Could not set Script Properties (running in test mode).");
  }

  // 4. Provision the 5 Test Scenario Spreadsheets in Dev & Testing
  console.log("Provisioning 5 Test Scenario Spreadsheets in Dev & Testing folder...");
  const testSheets: { key: string; name: string; id: string; url: string }[] = [];

  const presetTitles: Record<string, string> = {
    standard: "Test Scenario 1 - Standard Healthy (30 Responses, 0 Shortages)",
    holiday_shortage: "Test Scenario 2 - Holiday Shortage (Oct 11-12 Thanksgiving Deficit)",
    quota_deficit: "Test Scenario 3 - Quota Deficit (Undersubscribed Volunteers)",
    high_conflict: "Test Scenario 4 - High Conflict (Roommates & Entangled Rules)",
    single_respondent: "Test Scenario 5 - Single Respondent (Edge Case)",
  };

  for (const [key, preset] of Object.entries(MOCK_PRESETS)) {
    const title = presetTitles[key] || `Test Scenario - ${preset.name}`;
    const testSheet = createSurveyResponsesSheet(
      devFolder,
      title,
      preset.payload.mealDates,
      preset.payload.responses
    );
    testSheets.push({
      key,
      name: title,
      id: testSheet.getId(),
      url: testSheet.getUrl(),
    });
  }

  return {
    rootFolderId: parentFolderId,
    liveFolderId: liveFolder.getId(),
    devFolderId: devFolder.getId(),
    liveMasterSheetId: liveMasterSheet.getId(),
    liveMasterSheetUrl: liveMasterSheet.getUrl(),
    devMasterSheetId: devMasterSheet.getId(),
    devMasterSheetUrl: devMasterSheet.getUrl(),
    testSheets,
  };
}

export interface DriveSheetItem {
  id: string;
  name: string;
  folderName: string;
  folderCategory: "live" | "dev" | "other";
  url: string;
  lastUpdated?: string;
}

/**
 * Lists available survey spreadsheets across Google Drive workspace
 */
export function listDriveSpreadsheets(
  parentFolderId = DEFAULT_DRIVE_FOLDER_ID
): DriveSheetItem[] {
  const items: DriveSheetItem[] = [];

  try {
    const rootFolder = DriveApp.getFolderById(parentFolderId);

    const scanFolder = (
      folder: GoogleAppsScript.Drive.Folder,
      folderCategory: "live" | "dev" | "other"
    ) => {
      const folderName = folder.getName();
      const files = folder.getFilesByType(MimeType.GOOGLE_SHEETS);
      while (files.hasNext()) {
        const file = files.next();
        const name = file.getName();
        if (name.includes("Master") || name.includes("Registry")) continue;

        items.push({
          id: file.getId(),
          name,
          folderName,
          folderCategory,
          url: file.getUrl(),
          lastUpdated: file.getLastUpdated().toISOString(),
        });
      }

      const subfolders = folder.getFolders();
      while (subfolders.hasNext()) {
        const sub = subfolders.next();
        const subName = sub.getName();
        const subCat: "live" | "dev" | "other" =
          subName.includes("Live") || folderCategory === "live"
            ? "live"
            : subName.includes("Dev") || folderCategory === "dev"
            ? "dev"
            : "other";
        scanFolder(sub, subCat);
      }
    };

    // Scan Subfolders
    const subfolders = rootFolder.getFolders();
    while (subfolders.hasNext()) {
      const sub = subfolders.next();
      const subName = sub.getName();
      const cat: "live" | "dev" | "other" = subName.includes("Live")
        ? "live"
        : subName.includes("Dev")
        ? "dev"
        : "other";
      scanFolder(sub, cat);
    }

    // Scan Root files (if any outside subfolders)
    const rootFiles = rootFolder.getFilesByType(MimeType.GOOGLE_SHEETS);
    while (rootFiles.hasNext()) {
      const file = rootFiles.next();
      const name = file.getName();
      if (!name.includes("Master") && !name.includes("Registry")) {
        items.push({
          id: file.getId(),
          name,
          folderName: rootFolder.getName(),
          folderCategory: "live",
          url: file.getUrl(),
          lastUpdated: file.getLastUpdated().toISOString(),
        });
      }
    }
  } catch (err) {
    console.warn("Could not list Drive spreadsheets:", err);
  }

  // Sort alphabetically using natural numerical ordering (e.g. Scenario 1 before Scenario 2)
  items.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
  );

  return items;
}


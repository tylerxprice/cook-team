/**
 * Automated Google Drive & Google Sheets Workspace Provisioner
 * Sets up folder hierarchy, Master Community Registry, and Test Scenario Spreadsheets.
 */

import { MOCK_MEMBERS, MOCK_EXCEPTIONS, MOCK_PRESETS } from "./mockData";
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
function formatHeader(
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
  numColumns: number,
  bgColor = "#f1f5f9"
) {
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

  const memberRows: any[][] = [["Name", "Google Email", "Active", "Last Active Survey"]];
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
    [
      "Person A",
      "Person B",
      "Rule Type",
      "Target Role A",
      "Target Role B",
      "Is Hard Rule",
      "Notes",
    ],
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
  exceptionsSheet
    .getRange(1, 1, exceptionRows.length, exceptionRows[0].length)
    .setValues(exceptionRows);
  formatHeader(exceptionsSheet, 7, "#fef3c7"); // soft amber

  // 3. Settings Tab
  let settingsSheet = spreadsheet.getSheetByName("Settings");
  if (!settingsSheet) {
    settingsSheet = spreadsheet.insertSheet("Settings", 2);
  }
  settingsSheet.clear();

  const settingRows: any[][] = [
    ["Key", "Value", "Description"],
    [
      "cook_policy",
      "ADAPTIVE_3_OR_2",
      "Adaptive cook sizing (Target 3 for dinner, accept 2 if agreed)",
    ],
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
    headers.push(`Select your available dates [${d.dateLabel} (${d.mealType}${notePart})]`);
  }

  headers.push("Would you be open to a 2-person cook team on dinners if needed?");
  headers.push("Can you cook and clean on the same day?");
  headers.push("Any special instructions, childcare constraints, or kitchen preferences?");

  const rows: any[][] = [headers];

  const now = new Date();
  for (let i = 0; i < responses.length; i++) {
    const r = responses[i];
    const timestamp = new Date(now.getTime() - (responses.length - i) * 3600000).toLocaleString();
    const row: any[] = [timestamp, r.name, r.cookQuota, r.cleanQuota ?? 1];

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
  const _monthlyFolder = getOrCreateSubfolder(liveFolder, "Monthly_Surveys");

  // 2. Provision Live Master Registry
  console.log("Creating Live Master Community Registry...");
  const liveMasterSheet = createMasterRegistrySheet(liveFolder, "Master Community Registry (Live)");

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
  } catch {
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

  // 5. Create Web App Link Launchers (Google Docs & HTML shortcuts)
  try {
    createDriveWebAppLinkLaunchers(parentFolderId);
  } catch (launcherErr) {
    console.warn("Could not create web app link launchers:", launcherErr);
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

const PROD_WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbwFUo53qovtiFScRr8UufB62fdjjZiCQINHbkpj0U0nuJ6drjxkrJMj7LbJAPPQYN-8lQ/exec";
const DEV_WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbw9ebwRim3jjSVaN6Pm6QeOvNmujB1nnc2MCkBhM7qs/dev";

/**
 * Creates rich Google Doc launch shortcuts in Drive folders and cleans up unnecessary HTML files
 */
export function createDriveWebAppLinkLaunchers(parentFolderId = DEFAULT_DRIVE_FOLDER_ID) {
  const rootFolder = DriveApp.getFolderById(parentFolderId);
  const liveFolder = getOrCreateSubfolder(rootFolder, "01_Live_Production");
  const devFolder = getOrCreateSubfolder(rootFolder, "02_Dev_and_Testing");

  // Clean up any .html files that were previously created
  const trashHtmlFiles = (folder: GoogleAppsScript.Drive.Folder) => {
    const htmlFiles = folder.getFilesByType(MimeType.HTML);
    while (htmlFiles.hasNext()) {
      htmlFiles.next().setTrashed(true);
    }
  };
  trashHtmlFiles(rootFolder);
  trashHtmlFiles(liveFolder);
  trashHtmlFiles(devFolder);

  const createGoogleDocLauncher = (
    folder: GoogleAppsScript.Drive.Folder,
    docTitle: string,
    appUrl: string,
    _description: string,
    isProd: boolean
  ) => {
    const existing = folder.getFilesByName(docTitle);
    while (existing.hasNext()) {
      existing.next().setTrashed(true);
    }

    const doc = DocumentApp.create(docTitle);
    populateUserGuideDocBody(doc.getBody(), isProd, appUrl);
    doc.saveAndClose();

    const file = DriveApp.getFileById(doc.getId());
    file.moveTo(folder);
    return file;
  };

  // Create in Root
  createGoogleDocLauncher(
    rootFolder,
    "🚀 Launch Cook Team App (Production)",
    PROD_WEB_APP_URL,
    "Main production web app for Brenda and meal coordinators",
    true
  );
  createGoogleDocLauncher(
    rootFolder,
    "🧪 Launch Cook Team App (Dev & Test)",
    DEV_WEB_APP_URL,
    "Developer test harness with 30 mock members & test scenarios",
    false
  );

  // Create in 01_Live_Production
  createGoogleDocLauncher(
    liveFolder,
    "🚀 Launch Production Web App",
    PROD_WEB_APP_URL,
    "Main production web app for Brenda and meal coordinators",
    true
  );

  // Create in 02_Dev_and_Testing
  createGoogleDocLauncher(
    devFolder,
    "🧪 Launch Dev & Test Web App",
    DEV_WEB_APP_URL,
    "Developer test harness with 30 mock members & test scenarios",
    false
  );

  return {
    success: true,
    message: "Launcher documents created and HTML preview files removed.",
    prodUrl: PROD_WEB_APP_URL,
    devUrl: DEV_WEB_APP_URL,
  };
}

/**
 * Populates a Google Document with the full user guide and coordinator manual.
 */
export function populateUserGuideDocBody(
  body: GoogleAppsScript.Document.Body,
  isProd: boolean,
  appUrl: string
): void {
  body.clear();

  // Title
  const title = isProd
    ? "🍳 CookTeamTool — User Guide & Coordinator Manual"
    : "🧪 CookTeamTool — Developer & Testing Guide";
  const titlePara = body.appendParagraph(title);
  titlePara.setHeading(DocumentApp.ParagraphHeading.HEADING1);

  const sub = body.appendParagraph(
    "Comprehensive manual and quick launcher for community meal planning, survey auditing, matchmaker scheduling, and listserv announcements at Vancouver Cohousing."
  );
  sub.editAsText().setItalic(true);

  body.appendHorizontalRule();

  // Web App Link Banner
  const linkHeading = body.appendParagraph("🚀 Launch Web Application");
  linkHeading.setHeading(DocumentApp.ParagraphHeading.HEADING2);

  const linkPara = body.appendParagraph("👉 Click Here to Open CookTeamTool:\n" + appUrl);
  linkPara.setLinkUrl(appUrl);
  linkPara.editAsText().setBold(true);

  body.appendParagraph(
    isProd
      ? "📌 Production Environment: Scoped to 01_Live_Production folder | Reads Master Community Registry | Default Announcement: Vancouver Cohousing Residents <vancoho-residents@googlegroups.com>"
      : "📌 Dev / Test Environment: Scoped to 02_Dev_and_Testing folder | Reads 30 synthetic members & 6 scenario presets | Default Announcement: tylerxprice@gmail.com"
  );

  body.appendHorizontalRule();

  // Section 1: Monthly Workflow Overview
  const sec1 = body.appendParagraph("1. Monthly Coordinator Workflow (Overview)");
  sec1.setHeading(DocumentApp.ParagraphHeading.HEADING2);

  body.appendParagraph(
    "CookTeamTool streamlines the entire monthly meal coordination process across 6 interconnected phases:"
  );
  body.appendListItem(
    "Phase 1: Survey Generation — Auto-create next month's Google Form survey and linked spreadsheet."
  );
  body.appendListItem(
    "Phase 2: Step 1 (Intake & Audit) — Load responses, identify missing active members, and update directory."
  );
  body.appendListItem(
    "Phase 3: Step 2 (Notes & Rules) — Review childcare constraints, kitchen prefs, and configure pairing rules."
  );
  body.appendListItem(
    "Phase 4: Step 3 (Solve & Review) — Run the CSP matchmaker solver, review the interactive roster, fill shortages, and verify quota equity."
  );
  body.appendListItem(
    "Phase 5: Step 4 (Publish & Email) — Export the finalized schedule tab to Google Sheets, create a Gmail draft, and dispatch the listserv announcement."
  );
  body.appendListItem(
    "Phase 6: Sign-Up Workbook Generator — Generate the monthly diner sign-up sheet for Rose and community members."
  );

  body.appendHorizontalRule();

  // Section 2: Step 1 Intake & Completeness Audit
  const sec2 = body.appendParagraph("2. Step 1: Survey Intake & Completeness Audit");
  sec2.setHeading(DocumentApp.ParagraphHeading.HEADING2);

  body.appendParagraph(
    "• Selecting the Survey: Pick your active survey from the Google Drive dropdown or paste any survey spreadsheet URL."
  );
  body.appendParagraph(
    "• The Active Member Nag Screen: The intake audit automatically compares registered active members against respondents. Anyone who hasn't submitted a survey appears in the Missing Active Members card so you can send a friendly reminder."
  );
  body.appendParagraph(
    "• [Mark Inactive] Action: If a resident is away for the season, on sabbatical, or dormant, click 'Mark Inactive' to update the Master Registry. They will instantly disappear from current and future missing audits."
  );
  body.appendParagraph(
    "• Auto-Reactivation: If an inactive member submits a survey in any future month, the tool automatically re-activates them (active: true)."
  );
  body.appendParagraph(
    "• Unrecognized Respondents: If someone submits a survey under a new nickname or alternate email, an alert lets you link their alias to an existing member or create a new resident profile with one click."
  );
  body.appendParagraph(
    "• Member Directory (Modal 1): Click 'Member Directory' in the top navigation bar to manage emails, aliases (e.g. Alex / Sasha), active status, or bulk-import roster lists."
  );

  body.appendHorizontalRule();

  // Section 3: Step 2 Special Instructions & Exception Rules
  const sec3 = body.appendParagraph("3. Step 2: Special Instructions & Exception Rules");
  sec3.setHeading(DocumentApp.ParagraphHeading.HEADING2);

  body.appendParagraph(
    "• Reviewing Requests: Read notes submitted in survey responses (e.g. partner childcare constraints, specific days unavailable, preferences)."
  );
  body.appendParagraph(
    "• Coordinator Exception Rules (Modal 2): Click [+ Add Exception Rule] to set pairing constraints:"
  );
  body.appendListItem(
    "NOT_SAME_TEAM: Person A and Person B cannot be on the same cook or clean team."
  );
  body.appendListItem(
    "NOT_SAME_DAY: Person A and Person B cannot be scheduled on the same date for any shift."
  );
  body.appendListItem(
    "SAME_DAY_DIFF_TEAM: Person A and Person B work on the same day if either is scheduled, but on opposite teams (one cooks, one cleans)."
  );
  body.appendListItem("PAIR_WITH_ROLE: Person A is on Role X whenever Person B is on Role Y.");
  body.appendListItem("PREF_SAME_DAY: Allows Person A to cook and clean on the same day.");
  body.appendParagraph(
    "• Hard vs. Soft Rules: Hard rules are strictly enforced; soft rules are prioritized during optimization but will not block schedule creation if impossible."
  );

  body.appendHorizontalRule();

  // Section 4: Step 3 Solve & Review Schedule
  const sec4 = body.appendParagraph("4. Step 3: Solve & Review Schedule");
  sec4.setHeading(DocumentApp.ParagraphHeading.HEADING2);

  body.appendParagraph(
    "• Matchmaker Solver: Click [Run Matchmaker Solver] to generate an optimal, constraint-compliant schedule that balances quotas and maximizes complete meals."
  );
  body.appendParagraph("• Team Sizing Policies:");
  body.appendListItem(
    "Adaptive 3 or 2 (Default & Recommended): Targets 3 cooks on Dinners & 2 on Brunches; dynamically accepts 2 cooks on a Dinner if all assigned cooks agreed to 2-person dinners."
  );
  body.appendListItem("Dinner = 3, Brunch = 2 (Strict): Strict 3 cooks on Dinners, 2 on Brunches.");
  body.appendListItem("2 Regardless (Strict): Strict 2 cooks across all meals.");
  body.appendListItem("Clean Team Size: Dinner = 3 cleaners, Brunch = 2 cleaners.");
  body.appendParagraph("• Interactive Roster & Volunteer Inspector:");
  body.appendListItem(
    "Click any volunteer name badge to open the Member Calendar Inspector (Modal 3) to view their assigned dates and availability."
  );
  body.appendListItem(
    "[+ Fill Missing Slot] (Modal 4): Click on an unfilled slot to view available volunteers ranked by quota deficit and assign them with one click."
  );
  body.appendListItem(
    "[Swap Shifts] (Modal 6): Safely swap two volunteers across dates with full conflict validation."
  );
  body.appendListItem(
    "[Cancel Meal] / [Restore Meal]: Drops deficit dates to protect volunteer equity, releasing volunteers back into the quota pool."
  );
  body.appendListItem(
    "Near-Complete Opportunities (Modal 10): Generates targeted outreach messages for dates missing just 1 volunteer."
  );
  body.appendParagraph(
    "• Quota Equity Table: Live tracking of requested vs assigned cook/clean shifts, highlighting oversubscribed members in yellow."
  );

  body.appendHorizontalRule();

  // Section 5: Step 4 Publish & Email Announcement
  const sec5 = body.appendParagraph("5. Step 4: Publish Schedule & Announce to Listserv");
  sec5.setHeading(DocumentApp.ParagraphHeading.HEADING2);

  body.appendParagraph(
    "• Export Schedule to Google Sheets: Click [Export Schedule to Google Sheet] to append a clean, formatted Schedule_YYYY-MM tab to your survey spreadsheet."
  );
  body.appendParagraph(
    "• Email Announcement Generator: Pre-formats a friendly announcement starting with 'Hi precious friends & neighbours,' with clean date headers and 'NO COMMUNITY MEAL' labels on cancelled dates."
  );
  body.appendParagraph("• One-Click Email Actions:");
  body.appendListItem("[Copy Email Text]: Copies plain text announcement to your clipboard.");
  body.appendListItem("[Create Gmail Draft]: Creates a draft in your Gmail account for review.");
  body.appendListItem("[Send via Gmail]: Sends directly to the community listserv.");
  body.appendParagraph(
    "• Duplicate Send Safeguard: Automatically detects if an announcement was already sent for the month and requires confirmation before resending."
  );

  body.appendHorizontalRule();

  // Section 6: Auxiliary Tools
  const sec6 = body.appendParagraph("6. Auxiliary Coordinator Tools");
  sec6.setHeading(DocumentApp.ParagraphHeading.HEADING2);

  body.appendParagraph(
    "• Community Reports & Equity Leaderboard (Modal 7): Multi-month historical aggregator tracking shifts and awarding volunteer badges (Super Volunteer, Cook Master, Clean Master, Same-Day Star, Equity Leader)."
  );
  body.appendParagraph(
    "• Meal Sign-Up Sheet Generator (Modal 8): Creates the monthly diner sign-up workbook used by Rose and the community with custom deadlines and day labels."
  );
  body.appendParagraph(
    "• Survey Form Generator (Modal 9): Generates next month's Google Form availability survey with automatic Thursday/Sunday date options."
  );

  body.appendHorizontalRule();

  // Footer
  const footer = body.appendParagraph(
    "CookTeamTool — Developed for Vancouver Cohousing Community Meal Planning"
  );
  footer.editAsText().setItalic(true);
}

/**
 * Updates a specific Google Document (such as the main User Guide launcher) with the full user guide.
 */
export function updateUserGuideDoc(docId = "1YQLQNDpjgTxczQiVWmLFTGG595cF3rj2_QVqAvPYyLI"): {
  success: boolean;
  docId: string;
  docUrl: string;
  message: string;
} {
  const doc = DocumentApp.openById(docId);
  const body = doc.getBody();
  populateUserGuideDocBody(
    body,
    true,
    "https://script.google.com/macros/s/AKfycbwFUo53qovtiFScRr8UufB62fdjjZiCQINHbkpj0U0nuJ6drjxkrJMj7LbJAPPQYN-8lQ/exec"
  );
  doc.saveAndClose();

  return {
    success: true,
    docId,
    docUrl: doc.getUrl(),
    message: "Successfully updated Google Doc User Guide with complete coordinator walkthrough!",
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
export function listDriveSpreadsheets(parentFolderId = DEFAULT_DRIVE_FOLDER_ID): DriveSheetItem[] {
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

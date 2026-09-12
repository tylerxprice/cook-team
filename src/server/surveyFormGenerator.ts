/**
 * Monthly Google Form Survey Generator (Brenda's Workflow)
 * Automatically constructs next month's community meal availability Google Form,
 * populates the standard 8-question suite and date availability grid,
 * links to a new Google Sheet response destination, and saves to Google Drive.
 */

import {
  MealType,
  SurveyFormDateConfig,
  CreateSurveyFormPayload,
  CreateSurveyFormResult,
} from "./types";

const MONTH_NAMES = [
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

/**
 * Derives standard Form title from monthKey (e.g. "2026-11" -> "26-11 Nov Meal Team Sign-Up")
 */
export function deriveFormTitle(monthKey: string): string {
  const m = monthKey.match(/^(\d{2,4})[-_](\d{1,2})$/);
  if (!m) return `${monthKey} Meal Team Sign-Up`;

  const year = parseInt(m[1], 10);
  const monthNum = parseInt(m[2], 10);
  const yy = String(year).slice(-2);
  const mm = String(monthNum).padStart(2, "0");
  const monthName = MONTH_NAMES[monthNum - 1] || "Month";

  return `${yy}-${mm} ${monthName} Meal Team Sign-Up`;
}

/**
 * Automatically generates all standard Sundays (alternating Brunch/Dinner),
 * Mondays (Dinner), and Thursdays (Dinner) for a given monthKey (e.g. "2026-11").
 */
export function generateMonthlySurveyDates(monthKey: string): SurveyFormDateConfig[] {
  const m = monthKey.match(/^(\d{4})[-_](\d{1,2})$/);
  if (!m) {
    throw new Error(
      `Invalid month key format: '${monthKey}'. Expected 'YYYY-MM' (e.g. '2026-11').`
    );
  }

  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10) - 1; // 0-indexed for Date
  const monthShort = MONTH_NAMES[month];

  const dates: SurveyFormDateConfig[] = [];
  let sundayCounter = 0;

  const totalDays = new Date(year, month + 1, 0).getDate();

  for (let day = 1; day <= totalDays; day++) {
    const d = new Date(year, month, day);
    const dayOfWeek = d.getDay(); // 0 = Sun, 1 = Mon, 4 = Thu
    const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    if (dayOfWeek === 0) {
      // Sunday: Alternate Brunch and Dinner
      const isBrunch = sundayCounter % 2 === 0;
      sundayCounter++;
      const mealType: MealType = isBrunch ? "BRUNCH" : "DINNER";
      const typeLabel = isBrunch ? "Sun, Brunch" : "Sun, Dinner";
      const dateLabel = `${monthShort} ${day} (${typeLabel})`;

      dates.push({
        dateKey,
        dateLabel,
        dayOfWeek: "Sunday",
        mealType,
        included: true,
      });
    } else if (dayOfWeek === 1) {
      // Monday: Dinner
      const dateLabel = `${monthShort} ${day} (Mon)`;
      dates.push({
        dateKey,
        dateLabel,
        dayOfWeek: "Monday",
        mealType: "DINNER",
        included: true,
      });
    } else if (dayOfWeek === 4) {
      // Thursday: Dinner
      const dateLabel = `${monthShort} ${day} (Thur)`;
      dates.push({
        dateKey,
        dateLabel,
        dayOfWeek: "Thursday",
        mealType: "DINNER",
        included: true,
      });
    }
  }

  return dates;
}

/**
 * Builds the date row label used in the Google Form Multiple Choice Grid
 * e.g. "Nov 1 (Sun, Brunch)" or "Nov 5 (Thur) - Thanksgiving"
 */
export function buildFormGridRowLabel(date: SurveyFormDateConfig): string {
  let label = date.dateLabel.trim();
  if (date.specialNote && date.specialNote.trim()) {
    label = `${label} - ${date.specialNote.trim()}`;
  }
  return label;
}

/**
 * Google Apps Script backend function to create the Google Form,
 * configure the 8-question suite and date grid, link the response spreadsheet,
 * and organize files into the designated Google Drive folder.
 */
export function executeCreateSurveyForm(payload: CreateSurveyFormPayload): CreateSurveyFormResult {
  try {
    const monthKey = payload.monthKey || "2026-11";
    const title = (payload.title || deriveFormTitle(monthKey)).trim();
    const activeDates = (payload.dates || []).filter((d) => d.included);

    if (activeDates.length === 0) {
      throw new Error(
        "Cannot create survey form with 0 meal dates. Please include at least one date."
      );
    }

    // 1. Create Google Form
    const form = FormApp.create(title);
    const formDescription =
      payload.description ||
      "Community Meal Team Survey\nPlease indicate your availability and shift preferences for this month's meals.";
    form.setDescription(formDescription);

    try {
      form.setAllowResponseEdits(true);
      form.setLimitOneResponsePerUser(true);
      form.setPublishingSummary(true);
      try {
        form.setRequireLogin(false);
      } catch {}
    } catch (e) {
      console.warn("Could not set form preferences on form:", e);
    }

    // 2. Question 1: Name (Short Answer)
    form
      .addTextItem()
      .setTitle("Your name")
      .setHelpText("Please enter your name as it appears in the member directory.")
      .setRequired(true);

    // 3. Question 2: Cook Quota (Dropdown: 1, 2, 3, 0)
    form
      .addListItem()
      .setTitle("How many meals can you cook this month?")
      .setChoiceValues(["1", "2", "3", "0"])
      .setRequired(true);

    // 4. Question 3: Clean Quota (Dropdown: 1, 2, 3, 0)
    form
      .addListItem()
      .setTitle("How many meals can you clean this month?")
      .setChoiceValues(["1", "2", "3", "0"])
      .setRequired(true);

    // 5. Question 4: Cook Team Size Preference (Dropdown)
    form
      .addListItem()
      .setTitle("What is your preference for cook team size?")
      .setChoiceValues(["Dinner = 3, Brunch = 2 (Preferred)", "2 regardless of meal type"])
      .setRequired(true);

    // 6. Question 5: Same-Day Shift (Dropdown)
    form
      .addListItem()
      .setTitle("Can you cook and clean on the same day?")
      .setChoiceValues(["No", "Yes", "Yes, prefer same day"])
      .setRequired(true);

    // 7. Question 6: Date Availability Grid (Multiple Choice Grid)
    const gridRows = activeDates.map((d) => buildFormGridRowLabel(d));
    const gridColumns = ["Available", "Cook only", "Clean only"];

    const gridItem = form.addGridItem();
    gridItem
      .setTitle("Select your available dates")
      .setHelpText("Select your availability for each meal date. Leave blank if unavailable.")
      .setRows(gridRows)
      .setColumns(gridColumns)
      .setRequired(false);

    // 8. Question 7: Special Instructions (Paragraph Text)
    form
      .addParagraphTextItem()
      .setTitle("Special instructions, dietary restrictions, or notes")
      .setHelpText("e.g. Pairing preferences, dietary notes, specific schedule constraints...")
      .setRequired(false);

    // 9. Create Linked Response Spreadsheet
    const responseSheetTitle = `${title} (Responses)`;
    const responseSs = SpreadsheetApp.create(responseSheetTitle);
    form.setDestination(FormApp.DestinationType.SPREADSHEET, responseSs.getId());

    // 10. Locate Target Google Drive Folder
    let targetFolder: GoogleAppsScript.Drive.Folder | null = null;
    const folderId =
      payload.folderId ||
      PropertiesService.getScriptProperties().getProperty("FOLDER_ID") ||
      "1miNkXw-7co1ncAMZvaRJYUZXkFT07R4o";

    if (folderId) {
      try {
        targetFolder = DriveApp.getFolderById(folderId);
      } catch (fErr) {
        console.warn(`Could not open target folder by ID ${folderId}:`, fErr);
      }
    }

    // Move files into target folder if found
    if (targetFolder) {
      try {
        const formFile = DriveApp.getFileById(form.getId());
        targetFolder.addFile(formFile);
        DriveApp.getRootFolder().removeFile(formFile);
      } catch (mErr) {
        console.warn("Could not move form into folder:", mErr);
      }

      try {
        const ssFile = DriveApp.getFileById(responseSs.getId());
        targetFolder.addFile(ssFile);
        DriveApp.getRootFolder().removeFile(ssFile);
      } catch (sErr) {
        console.warn("Could not move response spreadsheet into folder:", sErr);
      }
    }

    // 11. Explicitly set emailCollectionType to VERIFIED (1-click account consent) via Google Forms REST API v1
    let emailStatus = "Verified email mode enabled";
    try {
      const token = ScriptApp.getOAuthToken();
      if (token) {
        const formId = form.getId();
        const apiUrl = `https://forms.googleapis.com/v1/forms/${formId}:batchUpdate`;
        const updatePayload = {
          includeFormInResponse: false,
          requests: [
            {
              updateSettings: {
                settings: {
                  emailCollectionType: "VERIFIED",
                },
                updateMask: "emailCollectionType",
              },
            },
          ],
        };
        const response = UrlFetchApp.fetch(apiUrl, {
          method: "post",
          contentType: "application/json",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          payload: JSON.stringify(updatePayload),
          muteHttpExceptions: true,
        });
        const code = response.getResponseCode();
        if (code >= 200 && code < 300) {
          console.info(`Form ${formId} emailCollectionType successfully updated to VERIFIED`);
          emailStatus = "Verified email mode enabled (1-click consent)";
        } else {
          console.warn(
            `Google Forms REST API updateSettings returned status ${code}:`,
            response.getContentText()
          );
          emailStatus = `API status ${code}: ${response.getContentText()}`;
        }
      }
    } catch (apiErr: any) {
      console.warn("Could not invoke Forms REST API for VERIFIED mode:", apiErr);
      emailStatus = `API note: ${apiErr?.message || apiErr}`;
    }

    const formEditUrl = form.getEditUrl();
    const formPublishedUrl = form.getPublishedUrl();
    const spreadsheetUrl = responseSs.getUrl();
    const folderUrl = targetFolder ? targetFolder.getUrl() : undefined;

    return {
      success: true,
      formId: form.getId(),
      formTitle: title,
      formEditUrl,
      formPublishedUrl,
      spreadsheetId: responseSs.getId(),
      spreadsheetUrl,
      folderId: targetFolder ? targetFolder.getId() : undefined,
      folderUrl,
      totalDates: activeDates.length,
      message: `Successfully created Google Form '${title}' with ${activeDates.length} dates and linked response sheet (${emailStatus}).`,
    };
  } catch (err: any) {
    console.error("executeCreateSurveyForm error:", err);
    throw new Error(`Failed to create survey form: ${err.message}`);
  }
}

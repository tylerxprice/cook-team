/**
 * Helper utility to interact with Google Apps Script server functions (google.script.run)
 * using Promises. Automatically falls back to mock responses with persistent local state
 * when running in local development (Vite dev server on localhost:5173).
 */

import {
  IntakePayload,
  Member,
  ExceptionRule,
  MealDate,
  SurveyResponse,
  SolverOptions,
  ScheduleOutput,
  EmailDispatchInfo,
  EmailPayload,
} from "../../server/types";
import {
  MOCK_INTAKE_PAYLOAD,
  MOCK_SAVED_SCHEDULE_PAYLOAD,
  MOCK_MEMBERS,
  MOCK_EXCEPTIONS,
  MOCK_PRESETS,
} from "../../server/mockData";
import { solveCookAndCleanSchedule } from "../../server/matchmaker";
import { parseScheduleGridData, parseDateFromLabelOrKey } from "../../server/scheduleParser";
import { computeCommunityReportSummary } from "../../server/reports";
import { getBaselineHistoricalSchedules } from "../../server/historicalArchiveData";
import { generateMonthlySurveyDates, deriveFormTitle } from "../../server/surveyFormGenerator";

export const isGasEnvironment = (): boolean => {
  return (
    typeof window !== "undefined" &&
    typeof (window as any).google !== "undefined" &&
    typeof (window as any).google.script !== "undefined" &&
    typeof (window as any).google.script.run !== "undefined"
  );
};

// Local mock state
let localMembers = [...MOCK_MEMBERS];
let localExceptions = [...MOCK_EXCEPTIONS];
const mockEmailDispatchLog: Record<string, EmailDispatchInfo> = {};
let localIntake: IntakePayload = {
  ...MOCK_INTAKE_PAYLOAD,
  members: localMembers,
  exceptions: localExceptions,
};

export async function callGas<T = any>(functionName: string, ...args: any[]): Promise<T> {
  // If running inside Google Apps Script iframe
  if (isGasEnvironment()) {
    // Sanitize arguments to guarantee plain JSON-serializable structures for GAS RPC
    const cleanArgs = args.map((arg) => {
      if (arg === undefined) return null;
      if (typeof arg === "function" || typeof arg === "symbol") return null;
      if (typeof arg === "object" && arg !== null) {
        try {
          return JSON.parse(JSON.stringify(arg));
        } catch {
          return {};
        }
      }
      return arg;
    });

    return new Promise((resolve, reject) => {
      const timeoutMs = 35000;
      let timer: any = setTimeout(() => {
        timer = null;
        reject(
          new Error(
            `Operation timed out after 35s calling server function "${functionName}". Please refresh and try again.`
          )
        );
      }, timeoutMs);

      try {
        const runner = (window as any).google.script.run
          .withSuccessHandler((result: T) => {
            if (timer) {
              clearTimeout(timer);
              timer = null;
            }
            resolve(result);
          })
          .withFailureHandler((error: any) => {
            if (timer) {
              clearTimeout(timer);
              timer = null;
            }
            const msg =
              error && error.message ? error.message : String(error || "Server call failed");
            console.error(`[GAS RPC Error] ${functionName}:`, error);
            reject(new Error(msg));
          });

        if (typeof runner[functionName] !== "function") {
          if (timer) {
            clearTimeout(timer);
            timer = null;
          }
          const errMsg = `Server function "${functionName}" is not available on google.script.run. Please redeploy the web app.`;
          console.error(errMsg);
          reject(new Error(errMsg));
          return;
        }

        runner[functionName](...cleanArgs);
      } catch (syncErr: any) {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        console.error(`[GAS RPC Sync Error] ${functionName}:`, syncErr);
        reject(syncErr);
      }
    });
  }

  // Local development mock fallback
  console.info(`[Local Mock GAS] Executing "${functionName}" with arguments:`, args);
  await new Promise((r) => setTimeout(r, 150)); // simulate brief network latency

  switch (functionName) {
    case "getUserInfo":
      return {
        email: "coordinator@local-vite.dev",
        authMode: "Local Dev Mock (Vite HMR)",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        timestamp: new Date().toISOString(),
        isDevMode: true,
      } as unknown as T;

    case "getMasterRegistryData": {
      const isDev = args[0] !== false;
      const mList = isDev
        ? localMembers
        : [
            {
              name: "Alex Taylor",
              google_email: "alex.taylor@example.com",
              active: true,
              last_active_survey: "2026-10",
            },
          ];
      return {
        members: [...mList].sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
        ),
        exceptions: isDev ? localExceptions : [],
      } as unknown as T;
    }

    case "getMockPresets":
      return MOCK_PRESETS as unknown as T;

    case "loadMockPreset": {
      const [presetKey] = args as [string];
      const preset = MOCK_PRESETS[presetKey] || MOCK_PRESETS.standard;
      const monthKey = preset.payload.mealDates?.[0]?.dateKey?.slice(0, 7) || "2026-10";
      localMembers = [...preset.payload.members];
      localExceptions = [...preset.payload.exceptions];
      localIntake = {
        ...preset.payload,
        members: localMembers,
        exceptions: localExceptions,
        emailDispatchInfo: mockEmailDispatchLog[monthKey] || undefined,
      };
      return localIntake as unknown as T;
    }

    case "getIntakeData": {
      const [sheetUrlOrId] = args as [string];
      if (sheetUrlOrId === "test-sheet-saved" || sheetUrlOrId === "saved_schedule") {
        localIntake = { ...MOCK_SAVED_SCHEDULE_PAYLOAD };
      }
      const monthKey = localIntake.mealDates?.[0]?.dateKey?.slice(0, 7) || "2026-10";
      return {
        ...localIntake,
        emailDispatchInfo: mockEmailDispatchLog[monthKey] || undefined,
      } as unknown as T;
    }

    case "solveSchedule": {
      const [mealDates, responses, exceptions, options] = args as [
        MealDate[],
        SurveyResponse[],
        ExceptionRule[],
        SolverOptions,
      ];
      const result = solveCookAndCleanSchedule(
        mealDates || localIntake.mealDates,
        responses || localIntake.responses,
        exceptions || localExceptions,
        options || { cookPolicy: "DINNER_3_BRUNCH_2" }
      );
      return result as unknown as T;
    }

    case "setMemberActiveStatus": {
      const [name, active] = args as [string, boolean];
      localMembers = localMembers.map((m) =>
        m.name.toLowerCase() === name.toLowerCase() ? { ...m, active } : m
      );
      // Update missing list in audit
      localIntake.audit.missingMembers = localIntake.audit.missingMembers.filter(
        (m) => m.name.toLowerCase() !== name.toLowerCase()
      );
      localIntake.members = localMembers;
      return localMembers as unknown as T;
    }

    case "saveExceptionRule": {
      const [rule] = args as [ExceptionRule];
      const idx = localExceptions.findIndex((r) => r.id === rule.id);
      if (idx >= 0) {
        localExceptions[idx] = rule;
      } else {
        localExceptions.push({
          ...rule,
          id: rule.id || `RULE-${Date.now().toString().slice(-4)}`,
        });
      }
      localIntake.exceptions = [...localExceptions];
      return localExceptions as unknown as T;
    }

    case "deleteExceptionRule": {
      const [ruleId] = args as [string];
      localExceptions = localExceptions.filter((r) => r.id !== ruleId);
      localIntake.exceptions = [...localExceptions];
      return localExceptions as unknown as T;
    }

    case "addCommunityMember": {
      const [newMember] = args as [Member];
      localMembers.push(newMember);
      localIntake.members = [...localMembers];
      return localMembers as unknown as T;
    }

    case "updateCommunityMember": {
      const [originalName, updatedMember] = args as [string, Member];
      const idx = localMembers.findIndex(
        (m) => m.name.toLowerCase() === originalName.toLowerCase()
      );
      if (idx >= 0) {
        localMembers[idx] = { ...updatedMember };
      } else {
        localMembers.push(updatedMember);
      }
      localIntake.members = [...localMembers];
      return localMembers as unknown as T;
    }

    case "bulkSaveCommunityMembers": {
      const [newMembersList] = args as [Member[]];
      localMembers = [...newMembersList];
      localIntake.members = [...localMembers];
      return localMembers as unknown as T;
    }

    case "linkMemberAlias": {
      const [canonicalName, aliasName, aliasEmail] = args as [string, string, string | undefined];
      const mem = localMembers.find((m) => m.name.toLowerCase() === canonicalName.toLowerCase());
      if (mem) {
        if (aliasName && !mem.aliases?.some((a) => a.toLowerCase() === aliasName.toLowerCase())) {
          mem.aliases = [...(mem.aliases || []), aliasName.trim()];
        }
        if (aliasEmail && aliasEmail.trim()) {
          const ems = (mem.google_email || "")
            .split(/[,;]/)
            .map((e) => e.trim().toLowerCase())
            .filter(Boolean);
          if (!ems.includes(aliasEmail.trim().toLowerCase())) {
            ems.push(aliasEmail.trim().toLowerCase());
            mem.google_email = ems.join(", ");
          }
        }
      }
      // Re-normalize localIntake responses and audit
      if (localIntake) {
        localIntake.responses = localIntake.responses.map((r) =>
          r.name.toLowerCase() === aliasName.toLowerCase() ? { ...r, name: canonicalName } : r
        );
        localIntake.audit.unrecognizedRespondents =
          localIntake.audit.unrecognizedRespondents.filter(
            (n) => n.toLowerCase() !== aliasName.toLowerCase()
          );
      }
      return localMembers as unknown as T;
    }

    case "setupDriveWorkspace": {
      const [parentFolderId = "1U0cJqnxCgWn-5k0RCj2BjCUj9nc1dMGl"] = args as [string];
      return {
        rootFolderId: parentFolderId,
        liveFolderId: "folder-live-01",
        devFolderId: "folder-dev-02",
        liveMasterSheetId: "sheet-live-master-123",
        liveMasterSheetUrl: "https://docs.google.com/spreadsheets/d/live-master",
        devMasterSheetId: "sheet-dev-master-456",
        devMasterSheetUrl: "https://docs.google.com/spreadsheets/d/dev-master",
        testSheets: [
          {
            key: "standard",
            name: "Test Scenario 1 - Standard Healthy",
            id: "test-sheet-1",
            url: "https://docs.google.com/spreadsheets/d/test-1",
          },
          {
            key: "holiday_shortage",
            name: "Test Scenario 2 - Holiday Shortage",
            id: "test-sheet-2",
            url: "https://docs.google.com/spreadsheets/d/test-2",
          },
          {
            key: "quota_deficit",
            name: "Test Scenario 3 - Quota Deficit",
            id: "test-sheet-3",
            url: "https://docs.google.com/spreadsheets/d/test-3",
          },
          {
            key: "high_conflict",
            name: "Test Scenario 4 - High Conflict",
            id: "test-sheet-4",
            url: "https://docs.google.com/spreadsheets/d/test-4",
          },
          {
            key: "single_respondent",
            name: "Test Scenario 5 - Single Respondent",
            id: "test-sheet-5",
            url: "https://docs.google.com/spreadsheets/d/test-5",
          },
        ],
      } as unknown as T;
    }

    case "listAvailableDriveSheets": {
      return [
        {
          id: "1GHPTpg1Mk8gIUxij1eB-_P4RDmPhfEIMwoVYMMTo5A4",
          name: "2026-10 Cook Team Survey (Responses)",
          folderName: "Monthly_Surveys",
          folderCategory: "live",
          url: "https://docs.google.com/spreadsheets/d/1GHPTpg1Mk8gIUxij1eB-_P4RDmPhfEIMwoVYMMTo5A4",
          lastUpdated: new Date().toISOString(),
        },
        {
          id: "test-sheet-standard",
          name: "Test Scenario 1 - Standard Healthy (30 Responses)",
          folderName: "02_Dev_and_Testing",
          folderCategory: "dev",
          url: "https://docs.google.com/spreadsheets/d/test-sheet-standard",
          lastUpdated: new Date().toISOString(),
        },
        {
          id: "test-sheet-holiday",
          name: "Test Scenario 2 - Holiday Shortage (Oct 11-12)",
          folderName: "02_Dev_and_Testing",
          folderCategory: "dev",
          url: "https://docs.google.com/spreadsheets/d/test-sheet-holiday",
          lastUpdated: new Date().toISOString(),
        },
        {
          id: "test-sheet-deficit",
          name: "Test Scenario 3 - Quota Deficit",
          folderName: "02_Dev_and_Testing",
          folderCategory: "dev",
          url: "https://docs.google.com/spreadsheets/d/test-sheet-deficit",
          lastUpdated: new Date().toISOString(),
        },
        {
          id: "test-sheet-conflict",
          name: "Test Scenario 4 - High Conflict",
          folderName: "02_Dev_and_Testing",
          folderCategory: "dev",
          url: "https://docs.google.com/spreadsheets/d/test-sheet-conflict",
          lastUpdated: new Date().toISOString(),
        },
        {
          id: "test-sheet-single",
          name: "Test Scenario 5 - Single Respondent",
          folderName: "02_Dev_and_Testing",
          folderCategory: "dev",
          url: "https://docs.google.com/spreadsheets/d/test-sheet-single",
          lastUpdated: new Date().toISOString(),
        },
        {
          id: "test-sheet-saved",
          name: "Test Scenario 6 - Existing Saved Schedule (Resume in Step 3)",
          folderName: "02_Dev_and_Testing",
          folderCategory: "dev",
          url: "https://docs.google.com/spreadsheets/d/test-sheet-saved",
          lastUpdated: new Date().toISOString(),
        },
      ] as unknown as T;
    }

    case "createWebAppLinkLaunchers": {
      return {
        success: true,
        message: "Launcher documents and redirect shortcuts created across Google Drive folders.",
        prodUrl:
          "https://script.google.com/macros/s/AKfycbwFUo53qovtiFScRr8UufB62fdjjZiCQINHbkpj0U0nuJ6drjxkrJMj7LbJAPPQYN-8lQ/exec",
        devUrl:
          "https://script.google.com/macros/s/AKfycbw9ebwRim3jjSVaN6Pm6QeOvNmujB1nnc2MCkBhM7qs/dev",
      } as unknown as T;
    }

    case "scanHistoricalFolder": {
      return {
        folderId: "1Lm-l2Cm8DFO4swnPuDHpYlTz8FOGN8df",
        folderName: "Historical Meal Data & Announcements",
        files: [
          {
            id: "hist-sheet-1",
            name: "Community Cook & Clean Teams (Legacy Signup)",
            mimeType: "application/vnd.google-apps.spreadsheet",
            url: "https://docs.google.com/spreadsheets/d/hist-sheet-1",
            tabs: ["Aug 2026", "Jul 2026", "Jun 2026", "May 2026", "Apr 2026"],
          },
          {
            id: "hist-doc-1",
            name: "MEAL SCHEDULE - August 1 - August 31 (Announcement)",
            mimeType: "application/vnd.google-apps.document",
            url: "https://docs.google.com/document/d/hist-doc-1",
            snippet: "MEAL SCHEDULE - August 1 - August 31 - Please Note Your Dates...",
          },
        ],
      } as unknown as T;
    }

    case "importHistoricalMonths": {
      return {
        success: true,
        createdSheets: [
          {
            monthName: "Aug 2026",
            title: "26-08 AUG Cook Team Survey (Responses)",
            id: "hist-aug-2026",
            url: "https://docs.google.com/spreadsheets/d/hist-aug-2026",
          },
          {
            monthName: "Jul 2026",
            title: "26-07 JUL Cook Team Survey (Responses)",
            id: "hist-jul-2026",
            url: "https://docs.google.com/spreadsheets/d/hist-jul-2026",
          },
        ],
        emailsFound: 1,
        message:
          "Converted 2 historical months into standardized survey sheets with handcrafted schedule comparison tabs!",
      } as unknown as T;
    }

    case "loadExistingScheduleFromSheet": {
      // Mock schedule grid with dynamic multi-column layout (Cook 1..4, Clean 1..4)
      const mockScheduleGrid: any[][] = [
        [
          "Date",
          "Meal Type",
          "Cook 1",
          "Cook 2",
          "Cook 3",
          "Cook 4",
          "Clean 1",
          "Clean 2",
          "Clean 3",
          "Clean 4",
          "Notes",
        ],
        [
          "Oct 1 (Thu)",
          "DINNER",
          "Tyler",
          "Brenda",
          "Michael",
          "",
          "Cyrena",
          "Lisa",
          "Sam",
          "",
          "Regular 3-cook dinner",
        ],
        [
          "Oct 4 (Sun, Brunch)",
          "BRUNCH",
          "Brenda",
          "Sam",
          "",
          "",
          "Alex",
          "Rose",
          "",
          "",
          "Standard Brunch",
        ],
        [
          "Oct 12 (Mon)",
          "DINNER",
          "Brenda",
          "Sam",
          "Michael",
          "David",
          "Tyler",
          "Sarah",
          "Jessica",
          "Lisa",
          "Thanksgiving with 4 cooks & 4 cleaners",
        ],
      ];
      return parseScheduleGridData(mockScheduleGrid) as unknown as T;
    }

    case "exportScheduleToSheet": {
      const [spreadsheetId, scheduleOutput] = args as [string, ScheduleOutput];
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
      if (!monthSuffix) monthSuffix = "2026-10";
      const sheetTabName = `Schedule_${monthSuffix}`;
      return {
        success: true,
        sheetName: sheetTabName,
        url: `https://docs.google.com/spreadsheets/d/${spreadsheetId || "sheet-1"}#gid=0`,
        message: `Successfully exported ${scheduleOutput?.schedule?.length || 13} meal dates to spreadsheet tab "${sheetTabName}"!`,
      } as unknown as T;
    }

    case "sendScheduleEmail": {
      const [payload] = args as [EmailPayload];
      const monthKey = payload.monthKey || "2026-10";
      let dispatchInfo: EmailDispatchInfo | undefined = undefined;
      if (payload.mode === "send") {
        dispatchInfo = {
          alreadySent: true,
          sentAt: new Date().toISOString(),
          to: payload.to,
          subject: payload.subject,
          sentBy: "coordinator@local-vite.dev",
          monthKey,
        };
        mockEmailDispatchLog[monthKey] = dispatchInfo;
      }
      return {
        success: true,
        mode: payload.mode,
        message:
          payload.mode === "draft"
            ? `Draft created in your Gmail account for ${payload.to}!`
            : `Announcement email successfully sent via Gmail to ${payload.to}!`,
        recipientCount: 1,
        emailDispatchInfo: dispatchInfo,
      } as unknown as T;
    }

    case "getAvailableScheduleTabs": {
      const baseline = getBaselineHistoricalSchedules();
      const list = baseline.map((b) => b.monthKey);
      if (!list.includes("2026-10")) list.unshift("2026-10");
      return list as unknown as T;
    }

    case "getHistoricalCommunityReports": {
      const selectedMonths = (args[1] || []) as string[];
      let allRecords = getBaselineHistoricalSchedules();
      // add Oct 2026 current
      const octSched = solveCookAndCleanSchedule(
        localIntake.mealDates,
        localIntake.responses,
        localExceptions,
        { cookPolicy: "ADAPTIVE_3_OR_2" }
      ).schedule;
      allRecords.unshift({
        monthKey: "2026-10",
        monthLabel: "2026-10",
        schedule: octSched,
      });

      if (selectedMonths && selectedMonths.length > 0) {
        allRecords = allRecords.filter((m) => selectedMonths.includes(m.monthKey));
      }

      return computeCommunityReportSummary(allRecords) as unknown as T;
    }

    case "getMealSignupWorkbookInfo": {
      const targetId = (args[0] as string) || "sample-common-meal-signup-coho";
      const suggestedTab = (args[1] as string) || "OCT 2026";
      const clean = targetId.trim();

      if (clean === "invalid" || clean === "error" || clean.includes("notfound")) {
        throw new Error("Could not access spreadsheet. Please check the URL or permissions.");
      }

      let name = "Sample Only - Common Meal Sign Up - Coho";
      const url = clean.startsWith("http")
        ? clean
        : `https://docs.google.com/spreadsheets/d/${clean}`;
      if (clean.includes("Test") || clean.includes("Dev")) {
        name = "Dev Test - Common Meal Sign Up Workbook";
      } else if (clean.length > 20 && !clean.startsWith("sample")) {
        name = "Common Meal Sign Up - Community";
      }

      return {
        spreadsheetId: clean,
        spreadsheetName: name,
        spreadsheetUrl: url,
        hasTemplate: true,
        existingTabs: [
          "AUG 2026",
          "SEP 2026",
          "Template",
          "JAN 2026",
          "FEB 2026",
          "MAR 2026",
          "APR 2026",
          "MAY 2026",
          "JUN 2026",
          "JUL 2026",
        ],
        suggestedMonthTab: suggestedTab,
        isTargetTabExisting: false,
      } as unknown as T;
    }

    case "exportToMealSignupWorkbook": {
      const targetId = (args[0] as string) || "sample-common-meal-signup-coho";
      const options = (args[2] || {}) as any;
      const tabName = options.monthTabName || "OCT 2026";
      return {
        success: true,
        spreadsheetId: targetId,
        spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sample-common-meal-signup-coho",
        tabName,
        tabUrl: `https://docs.google.com/spreadsheets/d/sample-common-meal-signup-coho#gid=999`,
        isBackupCreated: true,
        backupTabName: `${tabName} (Backup - 2026-08-30)`,
        totalMealColumns: 12,
        message: `Successfully created and published '${tabName}' in Common Meal Sign-Up Workbook!`,
      } as unknown as T;
    }

    case "getSurveyFormDatesPreview": {
      const monthKey = (args[0] as string) || "2026-11";
      return {
        monthKey,
        defaultTitle: deriveFormTitle(monthKey),
        dates: generateMonthlySurveyDates(monthKey),
      } as unknown as T;
    }

    case "createMonthlySurveyForm": {
      const payload = (args[0] || {}) as any;
      const monthKey = payload.monthKey || "2026-11";
      const title = payload.title || deriveFormTitle(monthKey);
      const activeDates = (payload.dates || []).filter((d: any) => d.included);
      return {
        success: true,
        formId: "mock-form-id-12345",
        formTitle: title,
        formEditUrl: `https://docs.google.com/forms/d/mock-form-id-12345/edit`,
        formPublishedUrl: `https://docs.google.com/forms/d/e/1FAIpQLSd-mock-published-url/viewform`,
        spreadsheetId: "mock-response-ss-id-67890",
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/mock-response-ss-id-67890/edit`,
        folderId: payload.folderId || "1miNkXw-7co1ncAMZvaRJYUZXkFT07R4o",
        folderUrl: `https://drive.google.com/drive/folders/1miNkXw-7co1ncAMZvaRJYUZXkFT07R4o`,
        totalDates: activeDates.length || 11,
        message: `Successfully created Google Form '${title}' with ${activeDates.length || 11} dates and linked response sheet!`,
      } as unknown as T;
    }

    default:
      return {
        mock: true,
        message: `Mock response for function ${functionName}`,
      } as unknown as T;
  }
}

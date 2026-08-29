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
} from "../../server/types";
import {
  MOCK_INTAKE_PAYLOAD,
  MOCK_MEMBERS,
  MOCK_EXCEPTIONS,
  MOCK_PRESETS,
} from "../../server/mockData";
import { solveCookAndCleanSchedule } from "../../server/matchmaker";

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
let localIntake: IntakePayload = {
  ...MOCK_INTAKE_PAYLOAD,
  members: localMembers,
  exceptions: localExceptions,
};

export async function callGas<T = any>(
  functionName: string,
  ...args: any[]
): Promise<T> {
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
      google.script.run
        .withSuccessHandler((result: T) => resolve(result))
        .withFailureHandler((error: Error) => reject(error))[functionName](...cleanArgs);
    });
  }

  // Local development mock fallback
  console.info(
    `[Local Mock GAS] Executing "${functionName}" with arguments:`,
    args
  );
  await new Promise((r) => setTimeout(r, 150)); // simulate brief network latency

  switch (functionName) {
    case "getUserInfo":
      return {
        email: "brenda.coordinator@local-vite.dev",
        authMode: "Local Dev Mock (Vite HMR)",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        timestamp: new Date().toISOString(),
        isDevMode: true,
      } as unknown as T;

    case "getMasterRegistryData": {
      const isDev = args[0] !== false;
      return {
        members: isDev ? localMembers : [{ name: "Tyler Price", google_email: "tylerxprice@gmail.com", active: true, last_active_survey: "2026-10" }],
        exceptions: isDev ? localExceptions : [],
      } as unknown as T;
    }

    case "getMockPresets":
      return MOCK_PRESETS as unknown as T;

    case "loadMockPreset": {
      const [presetKey] = args as [string];
      const preset = MOCK_PRESETS[presetKey] || MOCK_PRESETS.standard;
      localMembers = [...preset.payload.members];
      localExceptions = [...preset.payload.exceptions];
      localIntake = {
        ...preset.payload,
        members: localMembers,
        exceptions: localExceptions,
      };
      return localIntake as unknown as T;
    }

    case "getIntakeData": {
      const [sheetUrlOrId] = args as [string];
      if (sheetUrlOrId === "test-sheet-saved" || sheetUrlOrId === "saved_schedule") {
        localIntake = { ...MOCK_SAVED_SCHEDULE_PAYLOAD };
        return localIntake as unknown as T;
      }
      return localIntake as unknown as T;
    }

    case "solveSchedule": {
      const [mealDates, responses, exceptions, options] = args as [
        MealDate[],
        SurveyResponse[],
        ExceptionRule[],
        SolverOptions
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

    case "bulkSaveCommunityMembers": {
      const [newMembersList] = args as [Member[]];
      localMembers = [...newMembersList];
      localIntake.members = [...localMembers];
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
          { key: "standard", name: "Test Scenario 1 - Standard Healthy", id: "test-sheet-1", url: "https://docs.google.com/spreadsheets/d/test-1" },
          { key: "holiday_shortage", name: "Test Scenario 2 - Holiday Shortage", id: "test-sheet-2", url: "https://docs.google.com/spreadsheets/d/test-2" },
          { key: "quota_deficit", name: "Test Scenario 3 - Quota Deficit", id: "test-sheet-3", url: "https://docs.google.com/spreadsheets/d/test-3" },
          { key: "high_conflict", name: "Test Scenario 4 - High Conflict", id: "test-sheet-4", url: "https://docs.google.com/spreadsheets/d/test-4" },
          { key: "single_respondent", name: "Test Scenario 5 - Single Respondent", id: "test-sheet-5", url: "https://docs.google.com/spreadsheets/d/test-5" },
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
        prodUrl: "https://script.google.com/macros/s/AKfycbwFUo53qovtiFScRr8UufB62fdjjZiCQINHbkpj0U0nuJ6drjxkrJMj7LbJAPPQYN-8lQ/exec",
        devUrl: "https://script.google.com/macros/s/AKfycbw9ebwRim3jjSVaN6Pm6QeOvNmujB1nnc2MCkBhM7qs/dev",
      } as unknown as T;
    }

    case "loadExistingScheduleFromSheet": {
      // Return a simulated solved schedule for testing
      const simulatedSolver = solveCookAndCleanSchedule(
        localIntake.mealDates,
        localIntake.responses,
        localIntake.exceptions || [],
        { cookPolicy: "ADAPTIVE_3_OR_2", maxCleanPerMember: 1 }
      );
      return simulatedSolver as unknown as T;
    }

    case "exportScheduleToSheet": {
      const [spreadsheetId, scheduleOutput] = args as [string, ScheduleOutput];
      return {
        success: true,
        sheetName: "Schedule_2026-10",
        url: `https://docs.google.com/spreadsheets/d/${spreadsheetId || "sheet-1"}#gid=0`,
        message: `Successfully exported ${scheduleOutput?.schedule?.length || 13} meal dates to spreadsheet tab "Schedule_2026-10"!`,
      } as unknown as T;
    }

    case "sendScheduleEmail": {
      const [payload] = args as [EmailPayload];
      return {
        success: true,
        mode: payload.mode,
        message:
          payload.mode === "draft"
            ? `Draft created in your Gmail account for ${payload.to}!`
            : `Announcement email successfully sent via Gmail to ${payload.to}!`,
        recipientCount: 1,
      } as unknown as T;
    }

    default:
      return {
        mock: true,
        message: `Mock response for function ${functionName}`,
      } as unknown as T;
  }
}

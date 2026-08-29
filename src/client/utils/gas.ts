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
    return new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler((result: T) => resolve(result))
        .withFailureHandler((error: Error) => reject(error))[functionName](...args);
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
      } as unknown as T;

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

    case "getIntakeData":
      return localIntake as unknown as T;

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

    case "exportScheduleToSheet": {
      const [spreadsheetId, scheduleOutput] = args as [string, ScheduleOutput];
      return {
        success: true,
        sheetName: "Schedule_2026-10",
        message: `Successfully exported ${scheduleOutput.schedule.length} meal dates to spreadsheet (${spreadsheetId || "Default Master"}) tab "Schedule_2026-10"!`,
      } as unknown as T;
    }

    default:
      return {
        mock: true,
        message: `Mock response for function ${functionName}`,
      } as unknown as T;
  }
}

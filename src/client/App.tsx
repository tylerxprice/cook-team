import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Utensils,
  Users,
  CheckCircle2,
  Calendar,
  Settings,
  RefreshCw,
  Mail,
  ChevronRight,
  FileText,
  BarChart3,
  ClipboardList,
  Menu,
  X,
} from "lucide-react";
import { callGas, isGasEnvironment, getBootstrapData, getPublicWebAppUrl } from "./utils/gas";
import { parseAndDisambiguateGoogleGroupRoster } from "./utils/nameParser";
import {
  IntakePayload,
  EmailResult,
  ExceptionRule,
  Member,
  ScheduleOutput,
  DaySchedule,
  MealDate,
  CookTeamPolicy,
  RuleType,
  Role,
  CommunityReportSummary,
  MealSignupExportResult,
  MealSignupWorkbookInfo,
  SurveyFormDateConfig,
  CreateSurveyFormResult,
  EmailDispatchInfo,
  ManualSurveyResponsePayload,
  AppSettings,
  PublicScheduleResult,
  MonthStatus,
  SaveMonthDatesResult,
  SetMonthStatusResult,
  SurveyFormDatesPreviewResult,
  ExistingSurveyInfo,
} from "../server/types";
import {
  computeMemberQuotaStats,
  isWillingTwoPersonDinner,
  parseDateFromLabelOrKey,
} from "../server/scheduleParser";
import { deriveMonthTabName } from "../server/signupWorkbook";
import { extractEmails, extractAliases } from "../server/parser";
import { formatSurveyDateLabel } from "../server/surveyFormGenerator";

import { ErrorBoundary } from "./components/common/ErrorBoundary";

import { Step1IntakeAudit } from "./components/steps/Step1IntakeAudit";
import { Step2NotesRules } from "./components/steps/Step2NotesRules";
import { Step3SolveReview } from "./components/steps/Step3SolveReview";
import { Step4PublishEmail } from "./components/steps/Step4PublishEmail";

import { MemberDirectoryModal } from "./components/modals/MemberDirectoryModal";
import { RuleConfigModal } from "./components/modals/RuleConfigModal";
import { MemberCalendarInspectorModal } from "./components/modals/MemberCalendarInspectorModal";
import { FillMissingSlotModal } from "./components/modals/FillMissingSlotModal";
import { GlobalSettingsModal } from "./components/modals/GlobalSettingsModal";
import { SwapShiftsModal } from "./components/modals/SwapShiftsModal";
import { CommunityReportsModal } from "./components/modals/CommunityReportsModal";
import { MealSignupGeneratorModal } from "./components/modals/MealSignupGeneratorModal";
import { OverwriteSurveyConfirmModal } from "./components/modals/OverwriteSurveyConfirmModal";
import { NearCompleteOpportunityModal } from "./components/modals/NearCompleteOpportunityModal";
import { ResendConfirmModal } from "./components/modals/ResendConfirmModal";
import { ManualSurveyResponseModal } from "./components/modals/ManualSurveyResponseModal";
import { WhitelistRuleModal } from "./components/modals/WhitelistRuleModal";

import { PortalLandingView } from "./components/views/PortalLandingView";
import { ResidentScheduleView } from "./components/views/ResidentScheduleView";
import { WebSurveySignupView } from "./components/views/WebSurveySignupView";
import { SurveyFormGeneratorView } from "./components/views/SurveyFormGeneratorView";
import { TopHeader } from "./components/common/TopHeader";
import { Toast } from "./components/common/Toast";

export type AppView = "portal" | "coordinator" | "resident" | "survey" | "form-generator";

export const DEFAULT_AVAILABLE_MONTHS = [
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

export { getBootstrapData, getPublicWebAppUrl };

export const SYSTEM_QUERY_PARAMS = new Set([
  "createoauthdialog",
  "authuser",
  "usp",
  "gclid",
  "gad_source",
]);

export function filterCleanUrlParams(params: URLSearchParams): URLSearchParams {
  const clean = new URLSearchParams();
  for (const [key, value] of params.entries()) {
    if (!SYSTEM_QUERY_PARAMS.has(key.toLowerCase())) {
      clean.set(key, value);
    }
  }
  return clean;
}

export function toGasParamsObject(params: URLSearchParams): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    if (!SYSTEM_QUERY_PARAMS.has(key.toLowerCase()) && value) {
      obj[key] = value;
    }
  }
  return obj;
}

export function getAppUrlParams(): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams();

  const rawParams = new URLSearchParams();

  // 1. In Google Apps Script Web App iframes, parameters passed to doGet(e.parameter)
  // are delivered via the bootstrap JSON script tag. This is the primary parameter source in GAS.
  const boot = getBootstrapData();
  if (boot && boot.urlParameters && typeof boot.urlParameters === "object") {
    for (const [key, val] of Object.entries(boot.urlParameters)) {
      if (val !== undefined && val !== null && !SYSTEM_QUERY_PARAMS.has(key.toLowerCase())) {
        rawParams.set(key, String(val));
      }
    }
  }

  // 2. In standard dev or direct browsers, window.location.search contains query parameters
  if (window.location.search) {
    const windowParams = new URLSearchParams(window.location.search);
    for (const [key, val] of windowParams.entries()) {
      if (!SYSTEM_QUERY_PARAMS.has(key.toLowerCase()) && val) {
        rawParams.set(key, val);
      }
    }
  }

  // 3. Fallback: If window.location.hash accidentally contains query parameters
  // (e.g. #createOAuthDialog=true&month=2026-10&name=Tyler&view=schedule), recover any valid params from it
  if (
    typeof window !== "undefined" &&
    window.location.hash &&
    window.location.hash.includes("=") &&
    !window.location.hash.startsWith("#step-")
  ) {
    try {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      for (const [key, val] of hashParams.entries()) {
        if (!rawParams.has(key) && !SYSTEM_QUERY_PARAMS.has(key.toLowerCase())) {
          rawParams.set(key, val);
        }
      }
    } catch {
      // ignore
    }
  }

  return filterCleanUrlParams(rawParams);
}

export function parseStepFromHash(hash?: string): 1 | 2 | 3 | 4 {
  const targetHash =
    hash !== undefined ? hash : typeof window !== "undefined" ? window.location.hash : "";
  if (!targetHash) return 1;
  const match = targetHash.match(/(?:#|^)step-([1-4])(?:\b|$)/);
  if (match) {
    const parsed = parseInt(match[1], 10);
    if ([1, 2, 3, 4].includes(parsed)) return parsed as 1 | 2 | 3 | 4;
  }
  return 1;
}

export function getAppViewFromUrl(params?: URLSearchParams, hash?: string): AppView {
  const urlParams =
    params !== undefined
      ? filterCleanUrlParams(params)
      : typeof window !== "undefined"
        ? getAppUrlParams()
        : new URLSearchParams();
  const currentHash =
    hash !== undefined ? hash : typeof window !== "undefined" ? window.location.hash : "";
  const viewParam = (urlParams.get("view") || urlParams.get("mode") || "").toLowerCase();
  if (viewParam === "survey" || viewParam === "signup") {
    return "survey";
  }
  if (viewParam === "schedule" || viewParam === "resident" || viewParam === "my-shifts") {
    return "resident";
  }
  if (viewParam === "coordinator" || viewParam === "admin" || viewParam === "wizard") {
    return "coordinator";
  }
  if (
    viewParam === "form-generator" ||
    viewParam === "generator" ||
    viewParam === "survey-generator" ||
    viewParam === "launch"
  ) {
    return "form-generator";
  }
  if (viewParam === "portal" || viewParam === "home") {
    return "portal";
  }
  if (currentHash && /(?:#|^)step-[1-4]/.test(currentHash)) {
    return "coordinator";
  }
  return "portal";
}

export function getInitialAppView(): AppView {
  return getAppViewFromUrl();
}

function MainApp() {
  const [inGas, setInGas] = useState(false);
  const [isDevMode, setIsDevMode] = useState<boolean>(!isGasEnvironment());
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStepState] = useState<1 | 2 | 3 | 4>(1);
  const [appView, setAppView] = useState<AppView>(getInitialAppView);
  const [urlMemberName, setUrlMemberName] = useState<string>(() => {
    const p = getAppUrlParams();
    return p.get("m") || p.get("name") || p.get("user") || "";
  });
  const [publicMonthKey, setPublicMonthKey] = useState<string>(() => {
    const params = getAppUrlParams();
    const m = params.get("month");
    if (m && /^\d{4}-\d{2}$/.test(m)) return m;
    const boot = getBootstrapData();
    if (boot?.publicMonthKey && /^\d{4}-\d{2}$/.test(boot.publicMonthKey))
      return boot.publicMonthKey;
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [publicSchedule, setPublicSchedule] = useState<DaySchedule[]>(() => {
    const boot = getBootstrapData();
    if (
      boot?.publicSchedule &&
      Array.isArray(boot.publicSchedule) &&
      boot.publicSchedule.length > 0
    ) {
      return boot.publicSchedule;
    }
    return [];
  });
  const [publicMonthTitle, setPublicMonthTitle] = useState<string>(() => {
    const boot = getBootstrapData();
    if (boot?.publicMonthTitle) return boot.publicMonthTitle;
    return "Community Meals";
  });
  const [publicAvailableMonths, setPublicAvailableMonths] = useState<string[]>(() => {
    const boot = getBootstrapData();
    if (
      boot?.availableMonths &&
      Array.isArray(boot.availableMonths) &&
      boot.availableMonths.length > 0
    ) {
      return boot.availableMonths;
    }
    return DEFAULT_AVAILABLE_MONTHS;
  });
  const [loadingPublicSchedule, setLoadingPublicSchedule] = useState<boolean>(false);
  const [notification, setNotification] = useState<{
    msg: string;
    type: "success" | "error";
  } | null>(null);

  // Swap Modal State
  const [swapModal, setSwapModal] = useState<{
    isOpen: boolean;
    sourceDateKey: string;
    sourceRole: Role;
    sourceMemberName: string;
  } | null>(null);
  const [swapSearchText, setSwapSearchText] = useState("");

  // Reports Modal State
  const [showReportsModal, setShowReportsModal] = useState(false);
  const [availableReportMonths, setAvailableReportMonths] = useState<string[]>([]);
  const [selectedReportMonths, setSelectedReportMonths] = useState<string[]>([]);
  const [_loadingReportMonths, setLoadingReportMonths] = useState(false);
  const [communityReport, setCommunityReport] = useState<CommunityReportSummary | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportSearch, setReportSearch] = useState("");
  const [reportSort, setReportSort] = useState<"shifts" | "cooks" | "cleans" | "months" | "name">(
    "shifts"
  );

  const [sheetInput, setSheetInput] = useState("");

  // Core Data States
  const [intakeData, setIntakeData] = useState<IntakePayload | null>(null);
  const intakeCacheRef = useRef<Record<string, IntakePayload>>({});
  const [exceptions, setExceptions] = useState<ExceptionRule[]>([]);
  const [members, setMembers] = useState<Member[]>(() => {
    const boot = getBootstrapData();
    if (boot?.registry?.members && Array.isArray(boot.registry.members)) {
      return boot.registry.members;
    }
    return [];
  });
  const [cookPolicy, setCookPolicy] = useState<CookTeamPolicy>("ADAPTIVE_3_OR_2");
  const [autoCancelDeficitDates, setAutoCancelDeficitDates] = useState<boolean>(true);
  const [betaWebSignupEnabled, setBetaWebSignupEnabled] = useState<boolean>(false);
  const [solverResult, setSolverResult] = useState<ScheduleOutput | null>(null);

  // Modals
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [defaultCleanQuota, setDefaultCleanQuota] = useState<number>(1);
  const [driveFolderId, setDriveFolderId] = useState("1U0cJqnxCgWn-5k0RCj2BjCUj9nc1dMGl");
  const [masterSheetInput, setMasterSheetInput] = useState("");
  const [provisionResult, setProvisionResult] = useState<any>(null);
  const [provisioning, setProvisioning] = useState(false);
  const [memberFilter, setMemberFilter] = useState<"all" | "active" | "inactive">("all");
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [updatingMemberName, setUpdatingMemberName] = useState<string | null>(null);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberAliases, setNewMemberAliases] = useState("");
  const [editingMember, setEditingMember] = useState<{
    originalName: string;
    name: string;
    emails: string;
    aliases: string;
    active: boolean;
  } | null>(null);
  const [isSavingMember, setIsSavingMember] = useState(false);
  const [linkingAliasFor, setLinkingAliasFor] = useState<string | null>(null);
  const [selectedCanonicalLinkMap, setSelectedCanonicalLinkMap] = useState<Record<string, string>>(
    {}
  );
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkImportText, setBulkImportText] = useState("");
  const [bulkImportSaving, setBulkImportSaving] = useState(false);
  const [showAddRuleModal, setShowAddRuleModal] = useState(false);
  const [showWhitelistModal, setShowWhitelistModal] = useState(false);
  const [editingWhitelistRule, setEditingWhitelistRule] = useState<ExceptionRule | null>(null);
  const [modalContextNote, setModalContextNote] = useState<string | null>(null);
  const [selectedQuotaMember, setSelectedQuotaMember] = useState<string | null>(null);
  const [selectedQuotaFocusDateKey, setSelectedQuotaFocusDateKey] = useState<string | null>(null);
  const [selectedSlotToFill, setSelectedSlotToFill] = useState<{
    dateKey: string;
    dateLabel: string;
    role: Role;
  } | null>(null);
  const [selectedNearCompleteDateKey, setSelectedNearCompleteDateKey] = useState<string | null>(
    null
  );
  const [recoverySelectedCooks, setRecoverySelectedCooks] = useState<string[]>([]);
  const [recoverySelectedCleaners, setRecoverySelectedCleaners] = useState<string[]>([]);
  const [showNonParticipatingQuota, setShowNonParticipatingQuota] = useState(false);
  const [newRule, setNewRule] = useState<Partial<ExceptionRule>>({
    rule_type: "NOT_SAME_TEAM",
    is_hard_rule: true,
    person_a: "",
    person_b: "",
    target_role_a: "COOK",
    target_role_b: "CLEAN",
  });

  // Meal Signup Workbook Generator (Rose's Workflow) State
  const [showMealSignupModal, setShowMealSignupModal] = useState(false);
  const [mealSignupSourceSheet, setMealSignupSourceSheet] = useState<string>("");
  const [mealSignupTargetWorkbookId, setMealSignupTargetWorkbookId] = useState<string>("");
  const [mealSignupTargetTabName, setMealSignupTargetTabName] = useState<string>("");
  const [mealSignupBackupExisting, setMealSignupBackupExisting] = useState<boolean>(true);
  const [mealSignupHideOlder, setMealSignupHideOlder] = useState<boolean>(true);
  const [mealSignupCustomDeadlines, setMealSignupCustomDeadlines] = useState<
    Record<string, string>
  >({});
  const [mealSignupCustomDayLabels, setMealSignupCustomDayLabels] = useState<
    Record<string, string>
  >({});
  const [mealSignupSchedule, setMealSignupSchedule] = useState<DaySchedule[]>([]);
  const [mealSignupLoadingInfo, setMealSignupLoadingInfo] = useState<boolean>(false);
  const [mealSignupLoadingExport, setMealSignupLoadingExport] = useState<boolean>(false);
  const [mealSignupWorkbookInfo, setMealSignupWorkbookInfo] =
    useState<MealSignupWorkbookInfo | null>(null);
  const [mealSignupWorkbookError, setMealSignupWorkbookError] = useState<string | null>(null);
  const [mealSignupLoadingWorkbook, setMealSignupLoadingWorkbook] = useState<boolean>(false);
  const [mealSignupExportResult, setMealSignupExportResult] =
    useState<MealSignupExportResult | null>(null);
  const mealSignupModalBodyRef = useRef<HTMLDivElement>(null);

  // Survey Form Generator View State
  const [surveyFormMonthKey, setSurveyFormMonthKey] = useState("2026-11");
  const [surveyFormTitle, setSurveyFormTitle] = useState("26-11 Nov Meal Team Sign-Up");
  const [surveyFormFolderId, setSurveyFormFolderId] = useState("1miNkXw-7co1ncAMZvaRJYUZXkFT07R4o");
  const [surveyFormDates, setSurveyFormDates] = useState<SurveyFormDateConfig[]>([]);
  const [surveyFormMonthStatus, setSurveyFormMonthStatus] = useState<MonthStatus>("NOT_OPEN");
  const [surveyFormSavingDates, setSurveyFormSavingDates] = useState(false);
  const [surveyFormLoadingDates, setSurveyFormLoadingDates] = useState(false);
  const [surveyFormLoadingCreate, setSurveyFormLoadingCreate] = useState(false);
  const [surveyFormResult, setSurveyFormResult] = useState<CreateSurveyFormResult | null>(null);
  const [surveyFormCopiedLink, setSurveyFormCopiedLink] = useState(false);
  const [surveyFormExistingSurvey, setSurveyFormExistingSurvey] =
    useState<ExistingSurveyInfo | null>(null);
  const [showOverwriteSurveyModal, setShowOverwriteSurveyModal] = useState(false);
  const [deploymentUrl, setDeploymentUrl] = useState<string>("");

  // Modal: Manual Survey Response Entry (Brenda's Coordinator Workflow)
  const [showManualSurveyModal, setShowManualSurveyModal] = useState(false);
  const [manualSurveyTargetMember, setManualSurveyTargetMember] = useState<string | null>(null);
  const [manualSurveySaving, setManualSurveySaving] = useState(false);

  // Main Navigation Hamburger Menu State
  const [showMainMenu, setShowMainMenu] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("#header-menu-container")) {
        setShowMainMenu(false);
      }
    };
    if (showMainMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showMainMenu]);

  // Fetch public schedule for Resident View / Portal
  const fetchPublicSchedule = useCallback(
    async (targetMonth?: string) => {
      try {
        setLoadingPublicSchedule(true);
        const params = getAppUrlParams();
        const monthParam = targetMonth || params.get("month") || publicMonthKey;
        const sheetParam =
          appView === "resident"
            ? params.get("sheet") || undefined
            : params.get("sheet") || sheetInput || undefined;
        const res = await callGas<PublicScheduleResult>(
          "getPublicSchedule",
          monthParam,
          sheetParam
        );
        if (res) {
          if (res.schedule) {
            setPublicSchedule(res.schedule);
          }
          if (res.monthTitle) {
            setPublicMonthTitle(res.monthTitle);
          }
          if (res.monthKey) {
            setPublicMonthKey(res.monthKey);
          }
          if (res.availableMonths && res.availableMonths.length > 0) {
            setPublicAvailableMonths(res.availableMonths);
          }
        }
      } catch (err) {
        console.warn("Could not fetch public schedule:", err);
      } finally {
        setLoadingPublicSchedule(false);
      }
    },
    [sheetInput, publicMonthKey]
  );

  useEffect(() => {
    if (appView !== "resident" && appView !== "portal") return;

    if (solverResult?.schedule && solverResult.schedule.length > 0 && publicSchedule.length === 0) {
      setPublicSchedule(solverResult.schedule);
    }

    if (publicSchedule.length === 0) {
      fetchPublicSchedule();
    }
  }, [appView, solverResult?.schedule, publicSchedule.length, fetchPublicSchedule]);

  // Listen for Google Apps Script outer window URL location (fallback / dynamic navigation)
  useEffect(() => {
    if (
      typeof (window as any).google !== "undefined" &&
      (window as any).google?.script?.url?.getLocation
    ) {
      try {
        (window as any).google.script.url.getLocation((loc: any) => {
          if (loc && loc.parameter) {
            const raw = new URLSearchParams();
            for (const [k, v] of Object.entries(loc.parameter)) {
              if (v !== undefined && v !== null) {
                raw.set(k, Array.isArray(v) ? v[0] : String(v));
              }
            }
            const clean = filterCleanUrlParams(raw);
            const view = (clean.get("view") || clean.get("mode") || "").toLowerCase();
            if (view === "survey" || view === "signup") {
              setAppView("survey");
            } else if (
              view === "form-generator" ||
              view === "generator" ||
              view === "survey-generator" ||
              view === "launch"
            ) {
              setAppView("form-generator");
            } else if (view === "schedule" || view === "resident" || view === "my-shifts") {
              setAppView("resident");
            } else if (view === "coordinator" || view === "admin" || view === "wizard") {
              setAppView("coordinator");
            } else if (view === "portal" || view === "home") {
              setAppView("portal");
            }

            const month = clean.get("month");
            if (month && /^\d{4}-\d{2}$/.test(month)) {
              setPublicMonthKey(month);
              setSurveyFormMonthKey(month);
            }
            const member = clean.get("m") || clean.get("name") || clean.get("user");
            if (member) {
              setUrlMemberName(member);
            }
          }
        });
      } catch (e) {
        console.warn("getLocation failed:", e);
      }
    }
  }, []);

  const handleSelectPublicMonth = (newMonthKey: string, memberName?: string) => {
    setPublicMonthKey(newMonthKey);
    const effectiveMember =
      memberName ||
      urlMemberName ||
      (typeof window !== "undefined"
        ? localStorage.getItem("cookteam_resident_name") || ""
        : "");
    if (effectiveMember) {
      setUrlMemberName(effectiveMember);
    }
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      for (const sp of SYSTEM_QUERY_PARAMS) {
        url.searchParams.delete(sp);
      }
      url.searchParams.set("view", "schedule");
      url.searchParams.set("month", newMonthKey);
      url.searchParams.delete("sheet");
      if (effectiveMember) {
        url.searchParams.set("name", effectiveMember);
      } else {
        url.searchParams.delete("name");
        url.searchParams.delete("m");
        url.searchParams.delete("user");
      }
      url.hash = "";
      window.history.pushState(
        { view: "resident", month: newMonthKey, name: effectiveMember },
        "",
        url.toString()
      );
    }
    if (typeof (window as any).google !== "undefined" && (window as any).google?.script?.history) {
      try {
        const gasParams: Record<string, string> = {
          view: "schedule",
          month: newMonthKey,
        };
        if (effectiveMember) gasParams.name = effectiveMember;
        (window as any).google.script.history.push(
          { view: "resident", month: newMonthKey, name: effectiveMember },
          gasParams,
          ""
        );
      } catch (err) {
        console.warn("GAS history push failed:", err);
      }
    }
    fetchPublicSchedule(newMonthKey);
  };

  // Synchronize wizard navigation with browser history (Back / Forward buttons)
  const goToStep = (step: 1 | 2 | 3 | 4, replace = false) => {
    setCurrentStepState(step);
    const hash = `#step-${step}`;
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      for (const sp of SYSTEM_QUERY_PARAMS) {
        url.searchParams.delete(sp);
      }
      url.searchParams.set("view", "coordinator");
      url.hash = hash;
      const state = { view: "coordinator", step };
      if (replace) {
        window.history.replaceState(state, "", url.toString());
      } else {
        window.history.pushState(state, "", url.toString());
      }
    }
    if (typeof (window as any).google !== "undefined" && (window as any).google?.script?.history) {
      try {
        const historyMethod = replace
          ? (window as any).google.script.history.replace
          : (window as any).google.script.history.push;
        historyMethod({ view: "coordinator", step }, { view: "coordinator" }, `step-${step}`);
      } catch (err) {
        console.warn("GAS history push failed:", err);
      }
    }
    window.scrollTo({ top: 0, behavior: "smooth" });

    // Auto-export when navigating to Step 4 if a schedule is generated
    if (step === 4 && solverResult) {
      handleExportSheet(solverResult);
    }
  };

  // Centralized navigation router that synchronizes app views with URL query parameters and browser history
  const navigateToView = useCallback(
    (
      targetView: AppView,
      options?: {
        replace?: boolean;
        month?: string;
        step?: 1 | 2 | 3 | 4;
        member?: string;
      }
    ) => {
      setAppView(targetView);

      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        const replace = options?.replace ?? false;
        for (const sp of SYSTEM_QUERY_PARAMS) {
          url.searchParams.delete(sp);
        }

        const gasHistory =
          typeof (window as any).google !== "undefined" && (window as any).google?.script?.history
            ? (window as any).google.script.history
            : null;
        const historyAction =
          replace && gasHistory?.replace ? gasHistory.replace : gasHistory?.push;

        if (targetView === "portal") {
          url.searchParams.delete("view");
          url.searchParams.delete("month");
          url.searchParams.delete("name");
          url.searchParams.delete("m");
          url.searchParams.delete("user");
          url.hash = "";
          const state = { view: "portal" };
          const newUrl = url.pathname + (url.search ? url.search : "");
          if (replace) {
            window.history.replaceState(state, "", newUrl);
          } else {
            window.history.pushState(state, "", newUrl);
          }
          if (historyAction) {
            try {
              historyAction.call(gasHistory, { view: "portal" }, {}, "");
            } catch (err) {
              console.warn("GAS history navigation failed:", err);
            }
          }
        } else if (targetView === "resident") {
          url.searchParams.set("view", "schedule");
          const targetMonth = options?.month || publicMonthKey;
          if (targetMonth) {
            url.searchParams.set("month", targetMonth);
          }
          if (options?.member) {
            url.searchParams.set("name", options.member);
          } else {
            url.searchParams.delete("name");
            url.searchParams.delete("m");
            url.searchParams.delete("user");
          }
          url.hash = "";
          const state = { view: "resident", month: targetMonth, name: options?.member };
          if (replace) {
            window.history.replaceState(state, "", url.toString());
          } else {
            window.history.pushState(state, "", url.toString());
          }
          if (historyAction) {
            try {
              const gasParams: Record<string, string> = {
                view: "schedule",
                ...(targetMonth ? { month: targetMonth } : {}),
                ...(options?.member ? { name: options.member } : {}),
              };
              historyAction.call(gasHistory, state, gasParams, "");
            } catch (err) {
              console.warn("GAS history navigation failed:", err);
            }
          }
        } else if (targetView === "coordinator") {
          url.searchParams.set("view", "coordinator");
          const targetStep = options?.step || currentStep || 1;
          setCurrentStepState(targetStep);
          url.hash = `#step-${targetStep}`;
          const state = { view: "coordinator", step: targetStep };
          if (replace) {
            window.history.replaceState(state, "", url.toString());
          } else {
            window.history.pushState(state, "", url.toString());
          }
          if (historyAction) {
            try {
              historyAction.call(gasHistory, state, { view: "coordinator" }, `step-${targetStep}`);
            } catch (err) {
              console.warn("GAS history navigation failed:", err);
            }
          }
        } else if (targetView === "survey") {
          url.searchParams.set("view", "survey");
          const targetMonth = options?.month || surveyFormMonthKey || "2026-11";
          url.searchParams.set("month", targetMonth);
          if (options?.member) {
            url.searchParams.set("m", options.member);
          } else {
            url.searchParams.delete("m");
          }
          url.hash = "";
          const state = { view: "survey", month: targetMonth, member: options?.member };
          if (replace) {
            window.history.replaceState(state, "", url.toString());
          } else {
            window.history.pushState(state, "", url.toString());
          }
          if (historyAction) {
            try {
              const gasParams: Record<string, string> = {
                view: "survey",
                month: targetMonth,
                ...(options?.member ? { m: options.member } : {}),
              };
              historyAction.call(gasHistory, state, gasParams, "");
            } catch (err) {
              console.warn("GAS history navigation failed:", err);
            }
          }
        } else if (targetView === "form-generator") {
          url.searchParams.set("view", "form-generator");
          const targetMonth = options?.month || surveyFormMonthKey || "2026-11";
          url.searchParams.set("month", targetMonth);
          url.searchParams.delete("name");
          url.searchParams.delete("m");
          url.searchParams.delete("user");
          url.hash = "";
          const state = { view: "form-generator", month: targetMonth };
          if (replace) {
            window.history.replaceState(state, "", url.toString());
          } else {
            window.history.pushState(state, "", url.toString());
          }
          if (historyAction) {
            try {
              const gasParams: Record<string, string> = {
                view: "form-generator",
                month: targetMonth,
              };
              historyAction.call(gasHistory, state, gasParams, "");
            } catch (err) {
              console.warn("GAS history navigation failed:", err);
            }
          }
        }
      }
    },
    [publicMonthKey, surveyFormMonthKey, currentStep]
  );

  const scanReportMonths = async () => {
    setLoadingReportMonths(true);
    try {
      const activeTarget = sheetInput || undefined;
      const months = await callGas<string[]>("getAvailableScheduleTabs", activeTarget);
      const uniqueMonths = Array.from(
        new Set(
          months.length > 0
            ? months
            : [
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
              ]
        )
      );
      setAvailableReportMonths(uniqueMonths);
      if (selectedReportMonths.length === 0) {
        setSelectedReportMonths(uniqueMonths);
      }
    } catch (err: any) {
      console.error("scanReportMonths error:", err);
      const fallback = [
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
      setAvailableReportMonths(fallback);
      if (selectedReportMonths.length === 0) {
        setSelectedReportMonths(fallback);
      }
    } finally {
      setLoadingReportMonths(false);
    }
  };

  const fetchCommunityReports = async (monthsToFetch?: string[]) => {
    const months =
      monthsToFetch || (selectedReportMonths.length > 0 ? selectedReportMonths : undefined);
    setLoadingReport(true);
    try {
      const activeTarget = sheetInput || undefined;
      const res = await callGas<CommunityReportSummary>(
        "getHistoricalCommunityReports",
        activeTarget,
        months
      );
      setCommunityReport(res);
      if (res.monthsList && res.monthsList.length > 0) {
        setAvailableReportMonths((prev) => Array.from(new Set([...prev, ...res.monthsList])));
        if (selectedReportMonths.length === 0) {
          setSelectedReportMonths(res.monthsList);
        }
      }
    } catch (err: any) {
      console.error("fetchCommunityReports error:", err);
      showToast("Could not load community report: " + err.message, "error");
    } finally {
      setLoadingReport(false);
    }
  };

  const initMealSignupModal = async (sourceSheetId?: string) => {
    setMealSignupLoadingInfo(true);
    setMealSignupExportResult(null);
    try {
      // 1. Determine active schedule
      let activeSchedule: DaySchedule[] = [];
      const srcId = sourceSheetId || mealSignupSourceSheet || sheetInput;

      if (
        solverResult &&
        solverResult.schedule.length > 0 &&
        (!sourceSheetId || sourceSheetId === sheetInput)
      ) {
        activeSchedule = solverResult.schedule;
      } else if (srcId) {
        const loaded = await callGas<ScheduleOutput>("loadExistingScheduleFromSheet", srcId);
        if (loaded && loaded.schedule.length > 0) {
          activeSchedule = loaded.schedule;
        }
      }

      setMealSignupSchedule(activeSchedule);
      const derivedTab = deriveMonthTabName(activeSchedule.length > 0 ? activeSchedule : undefined);
      setMealSignupTargetTabName(derivedTab);

      // 2. Fetch workbook metadata (Check saved Script Properties first, then state, then Drive auto-discovery)
      let targetId = mealSignupTargetWorkbookId;
      try {
        const info = await callGas<MealSignupWorkbookInfo>(
          "getMealSignupWorkbookInfo",
          targetId || undefined,
          derivedTab
        );
        if (info && info.spreadsheetId) {
          setMealSignupWorkbookInfo(info);
          setMealSignupTargetWorkbookId(info.spreadsheetId);
          targetId = info.spreadsheetId;
        }
      } catch {
        // If no property was saved yet, try driveSheets auto-discovery
        if (!targetId && driveSheets.length > 0) {
          const found = driveSheets.find(
            (s) =>
              s.name?.toLowerCase().includes("common meal sign up") ||
              s.name?.toLowerCase().includes("meal sign up") ||
              s.name?.toLowerCase().includes("sign-up")
          );
          if (found) {
            targetId = found.id;
            setMealSignupTargetWorkbookId(targetId);
            await checkTargetWorkbook(targetId, derivedTab);
          }
        }
      }
    } catch (err: any) {
      console.warn("initMealSignupModal error:", err);
      showToast("Notice: " + err.message, "error");
    } finally {
      setMealSignupLoadingInfo(false);
    }
  };

  const checkTargetWorkbook = async (targetIdOrUrl: string, tabNameOverride?: string) => {
    const clean = (targetIdOrUrl || "").trim();
    if (!clean) {
      setMealSignupWorkbookInfo(null);
      setMealSignupWorkbookError(null);
      return;
    }

    setMealSignupLoadingWorkbook(true);
    setMealSignupWorkbookError(null);
    try {
      const tabName = tabNameOverride || mealSignupTargetTabName || "OCT 2026";
      const info = await callGas<MealSignupWorkbookInfo>(
        "getMealSignupWorkbookInfo",
        clean,
        tabName
      );
      setMealSignupWorkbookInfo(info);
      setMealSignupWorkbookError(null);
    } catch (err: any) {
      console.warn("checkTargetWorkbook error:", err);
      setMealSignupWorkbookInfo(null);
      setMealSignupWorkbookError(
        err.message || "Could not find or access spreadsheet with this URL or ID."
      );
    } finally {
      setMealSignupLoadingWorkbook(false);
    }
  };

  const handleExecuteMealSignupExport = async () => {
    if (!mealSignupSchedule || mealSignupSchedule.length === 0) {
      showToast("No meal dates found in selected source schedule.", "error");
      return;
    }

    setMealSignupLoadingExport(true);
    try {
      const res = await callGas<MealSignupExportResult>(
        "exportToMealSignupWorkbook",
        mealSignupTargetWorkbookId,
        mealSignupSchedule,
        {
          monthTabName: mealSignupTargetTabName.trim() || deriveMonthTabName(mealSignupSchedule),
          backupExisting: mealSignupBackupExisting,
          hideOlderMonths: mealSignupHideOlder,
          keepTemplateHidden: true,
          customDeadlines: mealSignupCustomDeadlines,
          customDayLabels: mealSignupCustomDayLabels,
        }
      );

      setMealSignupExportResult(res);
      const scheduledMonth = intakeData?.mealDates?.[0]?.dateKey?.slice(0, 7);
      if (scheduledMonth === surveyFormMonthKey) {
        setSurveyFormMonthStatus("CLOSED");
      }
      if (intakeData) {
        setIntakeData({ ...intakeData, monthStatus: "CLOSED" });
      }
      showToast(res.message || "Common Meal Sign-Up tab created successfully!");
      setTimeout(() => {
        mealSignupModalBodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      }, 100);
    } catch (err: any) {
      console.error("handleExecuteMealSignupExport error:", err);
      showToast("Failed to generate Sign-Up Sheet: " + err.message, "error");
    } finally {
      setMealSignupLoadingExport(false);
    }
  };

  const handleOpenSurveyFormGenerator = async (targetMonth?: string) => {
    let defaultMonth = targetMonth || surveyFormMonthKey;
    if (!defaultMonth) {
      const now = new Date();
      let nextM = now.getMonth() + 2; // e.g. Aug (7) -> Oct (9) or Nov
      let nextY = now.getFullYear();
      if (nextM > 12) {
        nextM -= 12;
        nextY += 1;
      }
      defaultMonth = `${nextY}-${String(nextM).padStart(2, "0")}`;
    }

    setSurveyFormMonthKey(defaultMonth);
    setSurveyFormResult(null);
    setSurveyFormCopiedLink(false);
    loadSurveyFormDatesPreview(defaultMonth);
    navigateToView("form-generator", { month: defaultMonth });
  };

  const handleClearSurveyFormResult = useCallback(() => {
    setSurveyFormResult(null);
  }, []);

  const loadSurveyFormDatesPreview = async (monthKey: string) => {
    setSurveyFormLoadingDates(true);
    setSurveyFormResult(null);
    setSurveyFormExistingSurvey(null);
    setSurveyFormCopiedLink(false);
    try {
      const res = await callGas<SurveyFormDatesPreviewResult>(
        "getSurveyFormDatesPreview",
        monthKey
      );

      if (res) {
        if (res.status) setSurveyFormMonthStatus(res.status);
        if (Array.isArray(res.dates)) {
          setSurveyFormTitle(res.defaultTitle);
          setSurveyFormDates(res.dates);
        }
        if (res.existingSurvey) {
          setSurveyFormExistingSurvey(res.existingSurvey);
        } else {
          setSurveyFormExistingSurvey(null);
        }
      }
    } catch (err: any) {
      console.warn("loadSurveyFormDatesPreview error:", err);
      showToast("Notice: " + err.message, "error");
    } finally {
      setSurveyFormLoadingDates(false);
    }
  };

  const handleSaveMonthDatesAndOpen = async (targetMonthOverride?: string) => {
    const activeDates = surveyFormDates.filter((d) => d.included);
    if (activeDates.length === 0) {
      showToast("Please include at least one meal date.", "error");
      return;
    }

    const targetMonth = (
      targetMonthOverride ||
      surveyFormMonthKey ||
      (activeDates[0]?.dateKey ? activeDates[0].dateKey.slice(0, 7) : "2026-11")
    ).trim();

    setSurveyFormSavingDates(true);
    try {
      const res = await callGas<SaveMonthDatesResult>("saveMonthDatesAndOpen", {
        monthKey: targetMonth,
        title: surveyFormTitle.trim(),
        dates: surveyFormDates,
        status: "OPEN",
      });
      setSurveyFormMonthKey(targetMonth);
      setSurveyFormMonthStatus("OPEN");
      if (intakeData) {
        setIntakeData({ ...intakeData, monthStatus: "OPEN" });
      }
      showToast(res.message || "Meal dates saved and sign-ups opened successfully!");
    } catch (err: any) {
      console.error("handleSaveMonthDatesAndOpen error:", err);
      showToast("Failed to save dates: " + err.message, "error");
    } finally {
      setSurveyFormSavingDates(false);
    }
  };

  const handleSaveDraftDates = async (targetMonthOverride?: string) => {
    const activeDates = surveyFormDates.filter((d) => d.included);
    if (activeDates.length === 0) {
      showToast("Please include at least one meal date.", "error");
      return;
    }

    const targetMonth = (
      targetMonthOverride ||
      surveyFormMonthKey ||
      (activeDates[0]?.dateKey ? activeDates[0].dateKey.slice(0, 7) : "2026-11")
    ).trim();

    // Draft dates preserve OPEN if currently OPEN; otherwise (CLOSED or NOT_OPEN), set/keep NOT_OPEN (Draft)
    const targetStatus: MonthStatus = surveyFormMonthStatus === "OPEN" ? "OPEN" : "NOT_OPEN";

    setSurveyFormSavingDates(true);
    try {
      const res = await callGas<SaveMonthDatesResult>("saveMonthDatesAndOpen", {
        monthKey: targetMonth,
        title: surveyFormTitle.trim(),
        dates: surveyFormDates,
        status: targetStatus,
      });
      setSurveyFormMonthKey(targetMonth);
      setSurveyFormMonthStatus(res.status || targetStatus);
      showToast(res.message || "Meal dates draft saved successfully!");
    } catch (err: any) {
      console.error("handleSaveDraftDates error:", err);
      showToast("Failed to save draft dates: " + err.message, "error");
    } finally {
      setSurveyFormSavingDates(false);
    }
  };

  const handleSetMonthStatus = async (status: MonthStatus, targetMonthOverride?: string) => {
    const targetMonth = (
      targetMonthOverride ||
      (appView === "form-generator" ? surveyFormMonthKey : undefined) ||
      intakeData?.mealDates?.[0]?.dateKey?.slice(0, 7) ||
      surveyFormMonthKey ||
      "2026-11"
    ).trim();
    try {
      const res = await callGas<SetMonthStatusResult>("setMonthStatus", targetMonth, status);
      if (targetMonth === surveyFormMonthKey) {
        setSurveyFormMonthStatus(status);
      }
      if (intakeData && targetMonth === intakeData?.mealDates?.[0]?.dateKey?.slice(0, 7)) {
        setIntakeData({ ...intakeData, monthStatus: status });
      }
      showToast(res.message || `Sign-up status set to ${status}.`);
    } catch (err: any) {
      showToast("Failed to update status: " + err.message, "error");
    }
  };

  const handleExecuteCreateSurveyForm = async (
    confirmedOverwrite?: boolean,
    targetMonthOverride?: string
  ) => {
    const activeDates = surveyFormDates.filter((d) => d.included);
    if (activeDates.length === 0) {
      showToast("Please include at least one meal date.", "error");
      return;
    }

    const targetMonth = (
      targetMonthOverride ||
      surveyFormMonthKey ||
      (activeDates[0]?.dateKey ? activeDates[0].dateKey.slice(0, 7) : "2026-11")
    ).trim();

    if (surveyFormExistingSurvey?.exists) {
      if (!surveyFormExistingSurvey.canOverwrite) {
        showToast(
          `Cannot overwrite: Survey already has ${surveyFormExistingSurvey.responseCount} responses. Generating a new form is blocked.`,
          "error"
        );
        return;
      }
      if (!confirmedOverwrite) {
        setShowOverwriteSurveyModal(true);
        return;
      }
    }

    setSurveyFormLoadingCreate(true);
    setSurveyFormResult(null);
    try {
      const res = await callGas<CreateSurveyFormResult>("createMonthlySurveyForm", {
        monthKey: targetMonth,
        title: surveyFormTitle.trim(),
        folderId:
          surveyFormFolderId.trim() || driveFolderId.trim() || "1miNkXw-7co1ncAMZvaRJYUZXkFT07R4o",
        dates: surveyFormDates,
        allowOverwrite: confirmedOverwrite || false,
      });

      setSurveyFormMonthKey(targetMonth);
      setSurveyFormResult(res);
      setSurveyFormMonthStatus("OPEN");
      if (res.spreadsheetId) {
        setSurveyFormExistingSurvey({
          exists: true,
          spreadsheetId: res.spreadsheetId,
          spreadsheetName: `${res.formTitle || targetMonth} (Responses)`,
          spreadsheetUrl: res.spreadsheetUrl || "",
          responseCount: 0,
          canOverwrite: true,
        });
      }
      if (intakeData) {
        setIntakeData({ ...intakeData, monthStatus: "OPEN" });
      }
      showToast(res.message || "Google Form & Response Sheet created successfully!");
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }, 100);
    } catch (err: any) {
      console.error("handleExecuteCreateSurveyForm error:", err);
      showToast("Failed to create Google Form: " + err.message, "error");
    } finally {
      setSurveyFormLoadingCreate(false);
    }
  };

  const handleCopySurveyLink = (url: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
    setSurveyFormCopiedLink(true);
    showToast("Public survey link copied to clipboard!");
    setTimeout(() => setSurveyFormCopiedLink(false), 3000);
  };

  const handleAddCustomSurveyDate = (customDate?: SurveyFormDateConfig) => {
    if (customDate) {
      setSurveyFormDates((prev) => {
        const existingIdx = prev.findIndex((d) => d.dateKey === customDate.dateKey);
        let next: SurveyFormDateConfig[];
        if (existingIdx >= 0) {
          next = prev.map((d, i) => (i === existingIdx ? customDate : d));
        } else {
          next = [...prev, customDate];
        }
        next.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
        return next;
      });
      return;
    }

    // Fallback: Pick next unused day in monthKey, compute exact day of week and label
    const m = surveyFormMonthKey.match(/^(\d{4})[-_](\d{1,2})$/);
    if (!m) return;
    const year = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    const daysInMonth = new Date(year, month, 0).getDate();
    const existing = new Set(surveyFormDates.map((d) => d.dateKey));
    let chosenDay = 1;
    for (let day = 1; day <= daysInMonth; day++) {
      const key = `${surveyFormMonthKey}-${String(day).padStart(2, "0")}`;
      if (!existing.has(key)) {
        chosenDay = day;
        break;
      }
    }
    const dateKey = `${surveyFormMonthKey}-${String(chosenDay).padStart(2, "0")}`;
    const { dayOfWeek, dateLabel } = formatSurveyDateLabel(dateKey, "DINNER");
    const newDate: SurveyFormDateConfig = {
      dateKey,
      dateLabel,
      dayOfWeek,
      mealType: "DINNER",
      included: true,
    };
    setSurveyFormDates((prev) => {
      const next = [...prev, newDate];
      next.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
      return next;
    });
  };

  const handleOpenManualSurveyModal = (memberName?: string) => {
    setManualSurveyTargetMember(memberName || null);
    setShowManualSurveyModal(true);
  };

  const handleSubmitManualSurveyResponse = async (payload: ManualSurveyResponsePayload) => {
    const targetId = intakeData?.sheetId || sheetInput;
    if (!targetId) {
      showToast("Please select or load a survey response sheet first.", "error");
      return;
    }
    setManualSurveySaving(true);
    try {
      const res = await callGas<any>("appendManualSurveyResponse", targetId, payload, isDevMode);
      if (res && res.success) {
        if (res.updatedIntake) {
          setIntakeData(res.updatedIntake);
        } else if (res.response) {
          setIntakeData((prev) => {
            if (!prev) return prev;
            const existingIdx = prev.responses.findIndex(
              (r) => r.name.toLowerCase() === res.response.name.toLowerCase()
            );
            const nextResponses = [...prev.responses];
            if (existingIdx >= 0) {
              nextResponses[existingIdx] = res.response;
            } else {
              nextResponses.push(res.response);
            }
            const nextMissing = prev.audit.missingMembers.filter(
              (m) => m.name.toLowerCase() !== res.response.name.toLowerCase()
            );
            return {
              ...prev,
              responses: nextResponses,
              audit: {
                ...prev.audit,
                missingMembers: nextMissing,
                respondentCount: nextResponses.length,
              },
            };
          });
        }
        setShowManualSurveyModal(false);
        showToast(`✨ Saved survey availability for ${payload.memberName}!`);
      } else {
        showToast(res?.message || "Failed to save manual survey response.", "error");
      }
    } catch (err: any) {
      console.error("Error saving manual survey response:", err);
      showToast("Failed to save survey response: " + err.message, "error");
    } finally {
      setManualSurveySaving(false);
    }
  };

  const handleExecuteSwap = (
    sourceDateKey: string,
    sourceRole: Role,
    sourceMemberName: string,
    targetDateKey: string,
    targetRole: Role,
    targetMemberName: string
  ) => {
    if (!solverResult || !intakeData) return;

    const newSchedule = solverResult.schedule.map((day) => {
      const newCooks = [...day.cooks];
      const newCleaners = [...day.cleaners];

      // Replace on source day
      if (day.dateKey === sourceDateKey) {
        if (sourceRole === "COOK") {
          const idx = newCooks.indexOf(sourceMemberName);
          if (idx >= 0) newCooks[idx] = targetMemberName;
        } else {
          const idx = newCleaners.indexOf(sourceMemberName);
          if (idx >= 0) newCleaners[idx] = targetMemberName;
        }
      }

      // Replace on target day
      if (day.dateKey === targetDateKey) {
        if (targetRole === "COOK") {
          const idx = newCooks.indexOf(targetMemberName);
          if (idx >= 0) newCooks[idx] = sourceMemberName;
        } else {
          const idx = newCleaners.indexOf(targetMemberName);
          if (idx >= 0) newCleaners[idx] = sourceMemberName;
        }
      }

      return {
        ...day,
        cooks: newCooks,
        cleaners: newCleaners,
        unfilledCooks: Math.max(0, day.targetCookCount - newCooks.length),
        unfilledCleaners: Math.max(0, day.targetCleanCount - newCleaners.length),
      };
    });

    const newStats = computeMemberQuotaStats(newSchedule, intakeData.responses);
    const newUnfilled = newSchedule.reduce(
      (sum, d) => sum + d.unfilledCooks + d.unfilledCleaners,
      0
    );

    setSolverResult({
      ...solverResult,
      schedule: newSchedule,
      memberStats: newStats,
      unfilledSlotsCount: newUnfilled,
    });
    setSwapModal(null);
    showToast(`Swapped ${sourceMemberName} and ${targetMemberName} successfully!`);
  };

  const [driveSheets, setDriveSheets] = useState<any[]>([]);
  const [sheetSelectMode, setSheetSelectMode] = useState<string>("");
  const [exportedResult, setExportedResult] = useState<{
    success: boolean;
    sheetName: string;
    url?: string;
    message: string;
  } | null>(null);

  const [_selectedPreset, setSelectedPreset] = useState<string>("standard");

  const DEFAULT_ANNOUNCEMENT_TO =
    "Vancouver Cohousing Residents <vancoho-residents@googlegroups.com>";
  const DEFAULT_ANNOUNCEMENT_CC =
    "Ben Ernst <ben@earnesticecream.com>, Fabrice Retiere <fabrulous@gmail.com>, Patricia Fahrni <pfahrni@shaw.ca>";
  const DEV_TEST_EMAIL = "coordinator-test@example.com";

  // Global Settings state
  const [announcementTo, setAnnouncementTo] = useState<string>(DEFAULT_ANNOUNCEMENT_TO);
  const [announcementCc, setAnnouncementCc] = useState<string>(DEFAULT_ANNOUNCEMENT_CC);

  // Helper to format subject line in Brenda's standard format: "MEAL SCHEDULE - Month 1 - Month 31 - Please Note Your Dates"
  const formatDefaultSubject = (dates?: MealDate[] | DaySchedule[]) => {
    const list = dates || solverResult?.schedule || intakeData?.mealDates;
    if (list && list.length > 0) {
      for (const item of list) {
        const dObj = parseDateFromLabelOrKey(item.dateLabel, item.dateKey);
        if (dObj && !isNaN(dObj.getTime())) {
          const monthName = dObj.toLocaleString("en-US", { month: "long" });
          const year = dObj.getFullYear();
          const lastDayOfMonth = new Date(year, dObj.getMonth() + 1, 0).getDate();
          return `MEAL SCHEDULE - ${monthName} 1 - ${monthName} ${lastDayOfMonth} - Please Note Your Dates`;
        }
      }
    }
    return "MEAL SCHEDULE - October 1 - October 31 - Please Note Your Dates";
  };

  // Email Dispatch States
  const [emailTo, setEmailTo] = useState(
    isGasEnvironment() ? DEFAULT_ANNOUNCEMENT_TO : DEV_TEST_EMAIL
  );
  const [emailCc, setEmailCc] = useState(DEFAULT_ANNOUNCEMENT_CC);
  const [emailSubject, setEmailSubject] = useState(formatDefaultSubject());
  const isEmailSubjectDirty = useRef(false);
  const [customEmailBody, setCustomEmailBody] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailDispatchInfo, setEmailDispatchInfo] = useState<EmailDispatchInfo | null>(null);
  const [showResendConfirmModal, setShowResendConfirmModal] = useState<boolean>(false);
  const [emailDeliveryResult, setEmailDeliveryResult] = useState<{
    success: boolean;
    mode: "send" | "draft";
    message: string;
    recipient: string;
  } | null>(null);

  const applyLoadedSettings = (settings?: AppSettings) => {
    if (!settings) return;
    if (settings.announcementTo) {
      setAnnouncementTo(settings.announcementTo);
      setEmailTo(settings.announcementTo);
    }
    if (settings.announcementCc) {
      setAnnouncementCc(settings.announcementCc);
      setEmailCc(settings.announcementCc);
    }
    if (settings.cookPolicy) {
      setCookPolicy(settings.cookPolicy);
    }
    if (typeof settings.defaultCleanQuota === "number") {
      setDefaultCleanQuota(settings.defaultCleanQuota);
    }
    if (typeof settings.autoCancelDeficitDates === "boolean") {
      setAutoCancelDeficitDates(settings.autoCancelDeficitDates);
    }
    if (settings.signupWorkbookId) {
      setMealSignupTargetWorkbookId(settings.signupWorkbookId);
    }
    if (typeof settings.betaWebSignupEnabled === "boolean") {
      setBetaWebSignupEnabled(settings.betaWebSignupEnabled);
    }
  };

  // Synchronize default email subject whenever survey or schedule changes
  useEffect(() => {
    if (!isEmailSubjectDirty.current) {
      const sub = formatDefaultSubject();
      if (sub) {
        setEmailSubject(sub);
      }
    }
  }, [intakeData?.mealDates, solverResult?.schedule]);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const renderToast = () => {
    if (!notification) return null;
    return (
      <Toast
        message={notification.msg}
        type={notification.type === "error" ? "error" : "success"}
        onClose={() => setNotification(null)}
      />
    );
  };

  const fetchDriveSheets = async () => {
    try {
      const list = await callGas<any[]>("listAvailableDriveSheets", driveFolderId);
      if (Array.isArray(list) && list.length > 0) {
        setDriveSheets(list);
      }
    } catch (err) {
      console.warn("Could not fetch Drive sheets:", err);
    }
  };

  const liveSheetsList = useMemo(() => {
    if (isDevMode) {
      return [];
    }
    const list = driveSheets.filter(
      (s) =>
        s.folderCategory === "live" ||
        s.folderName?.includes("Monthly") ||
        s.folderName?.includes("Live") ||
        s.folderName?.includes("01_Live")
    );

    return [...list].sort((a, b) =>
      b.name.localeCompare(a.name, undefined, { numeric: true, sensitivity: "base" })
    );
  }, [driveSheets, isDevMode]);

  const devSheetsList = useMemo(() => {
    if (!isDevMode) {
      return [];
    }
    const list = driveSheets.filter(
      (s) =>
        s.folderCategory === "dev" ||
        s.folderName?.includes("Dev") ||
        s.folderName?.includes("02_Dev") ||
        s.name?.includes("Test Scenario")
    );
    const baseList =
      list.length > 0
        ? list
        : [
            {
              id: "test-sheet-standard",
              name: "Test Scenario 1 - Standard Healthy (30 responses, 0 unfilled)",
            },
            {
              id: "test-sheet-holiday",
              name: "Test Scenario 2 - Holiday Desertion (Oct 11-12 shortage)",
            },
            {
              id: "test-sheet-deficit",
              name: "Test Scenario 3 - Quota Shortfall (Cook quota deficit)",
            },
            {
              id: "test-sheet-conflict",
              name: "Test Scenario 4 - High Conflict (8 entangled rules)",
            },
            {
              id: "test-sheet-single",
              name: "Test Scenario 5 - Single Respondent (Tyler live test)",
            },
            {
              id: "test-sheet-saved",
              name: "Test Scenario 6 - Existing Saved Schedule (Resume in Step 3)",
            },
          ];

    return [...baseList].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
    );
  }, [driveSheets, isDevMode]);

  const handleSelectSheetOption = async (optionValue: string) => {
    setSheetSelectMode(optionValue);
    if (optionValue === "custom") {
      return;
    }
    setSheetInput(optionValue);
    const matched = driveSheets.find((s) => s.id === optionValue);
    if (matched && matched.id.startsWith("test-sheet-")) {
      setEmailTo(DEV_TEST_EMAIL);
      const key = matched.id.replace("test-sheet-", "");
      const presetKey =
        key === "holiday"
          ? "holiday_shortage"
          : key === "deficit"
            ? "quota_deficit"
            : key === "conflict"
              ? "high_conflict"
              : key === "single"
                ? "single_respondent"
                : key === "saved"
                  ? "saved_schedule"
                  : "standard";
      await handleSelectPreset(presetKey);
    } else {
      delete intakeCacheRef.current[optionValue];
      setEmailTo(announcementTo || DEFAULT_ANNOUNCEMENT_TO);
      await fetchIntake(optionValue, undefined, true);
    }
  };

  const handleSelectPreset = async (presetKey: string) => {
    setSelectedPreset(presetKey);
    setEmailTo(DEV_TEST_EMAIL);
    setLoading(true);
    try {
      const data = await callGas<IntakePayload>("loadMockPreset", presetKey);
      setIntakeData(data);
      setExceptions(data.exceptions || []);
      setMembers(data.members || []);
      if (data.settings) {
        applyLoadedSettings(data.settings);
      }
      setEmailDispatchInfo(data.emailDispatchInfo || null);
      isEmailSubjectDirty.current = false;
      setEmailSubject(formatDefaultSubject(data.mealDates));
      setSolverResult(null);
      showToast(`Loaded test scenario: ${presetKey}`);
      if (currentStep === 3) {
        const res = await callGas<ScheduleOutput>(
          "solveSchedule",
          data.mealDates,
          data.responses,
          data.exceptions || [],
          { cookPolicy, maxCleanPerMember: defaultCleanQuota, autoCancelDeficitDates }
        );
        setSolverResult(res);
      }
    } catch (err: any) {
      showToast(`Error: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  // Initial Load & URL Hash / Browser History Synchronization
  const fetchIntake = async (sheetId?: string, masterId?: string, forceRefresh = false) => {
    const targetSheet = sheetId || sheetInput;
    if (!targetSheet || targetSheet.trim() === "") {
      return;
    }

    // Fast-path: Check in-memory cache for instant 0ms survey switching (only if responses exist)
    if (
      !forceRefresh &&
      intakeCacheRef.current[targetSheet] &&
      intakeCacheRef.current[targetSheet].responses &&
      intakeCacheRef.current[targetSheet].responses.length > 0
    ) {
      const cached = intakeCacheRef.current[targetSheet];
      setIntakeData(cached);
      setExceptions(cached.exceptions || []);
      setMembers(cached.members || []);
      if (cached.settings) {
        applyLoadedSettings(cached.settings);
      }
      if (cached.monthStatus) {
        setSurveyFormMonthStatus(cached.monthStatus);
      }
      setEmailDispatchInfo(cached.emailDispatchInfo || null);
      isEmailSubjectDirty.current = false;
      setEmailSubject(formatDefaultSubject(cached.mealDates));
      if (!targetSheet.startsWith("test-sheet-")) {
        setEmailTo(cached.settings?.announcementTo || announcementTo || DEFAULT_ANNOUNCEMENT_TO);
        if (cached.settings?.announcementCc) {
          setEmailCc(cached.settings.announcementCc);
        }
      }
      showToast(
        `Loaded ${cached.responses.length} survey responses across ${cached.mealDates.length} meals.`
      );
      return;
    }

    if (forceRefresh) {
      delete intakeCacheRef.current[targetSheet];
    }

    setLoading(true);
    try {
      const data = await callGas<IntakePayload>(
        "getIntakeData",
        targetSheet,
        masterId || masterSheetInput,
        forceRefresh ? undefined : members && members.length > 0 ? members : undefined,
        forceRefresh ? undefined : exceptions && exceptions.length > 0 ? exceptions : undefined
      );
      // Only cache if responses were returned
      if (data && data.responses && data.responses.length > 0) {
        intakeCacheRef.current[targetSheet] = data;
      }
      setIntakeData(data);
      setExceptions(data.exceptions || []);
      setMembers(data.members || []);
      if (data.settings) {
        applyLoadedSettings(data.settings);
      }
      if (data.monthStatus) {
        setSurveyFormMonthStatus(data.monthStatus);
      }
      setEmailDispatchInfo(data.emailDispatchInfo || null);
      isEmailSubjectDirty.current = false;
      setEmailSubject(formatDefaultSubject(data.mealDates));
      if (!targetSheet.startsWith("test-sheet-")) {
        setEmailTo(data.settings?.announcementTo || announcementTo || DEFAULT_ANNOUNCEMENT_TO);
        if (data.settings?.announcementCc) {
          setEmailCc(data.settings.announcementCc);
        }
      }
      showToast(
        `Loaded ${data.responses.length} survey responses across ${data.mealDates.length} meals.`
      );
    } catch (err: any) {
      console.error(err);
      showToast(`Failed to load survey: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleProvisionDrive = async () => {
    setProvisioning(true);
    try {
      const res = await callGas("setupDriveWorkspace", driveFolderId);
      setProvisionResult(res);
      if (res.liveMasterSheetUrl) {
        setMasterSheetInput(res.liveMasterSheetUrl);
      }
      showToast("Google Drive workspace & test scenario sheets successfully provisioned!");
      await fetchDriveSheets();
    } catch (err: any) {
      showToast(`Provisioning failed: ${err.message}`, "error");
    } finally {
      setProvisioning(false);
    }
  };

  const handleCreateLaunchers = async () => {
    setProvisioning(true);
    try {
      await callGas("createWebAppLinkLaunchers", driveFolderId);
      showToast("App launcher documents and HTML shortcuts created in your Google Drive folders!");
      await fetchDriveSheets();
    } catch (err: any) {
      showToast(`Launcher creation failed: ${err.message}`, "error");
    } finally {
      setProvisioning(false);
    }
  };

  useEffect(() => {
    document.title = "Community Cook Team App";
    const svgIcon = `data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20100%20100'%3E%3Cdefs%3E%3ClinearGradient%20id='g'%20x1='0%25'%20y1='100%25'%20x2='100%25'%20y2='0%25'%3E%3Cstop%20offset='0%25'%20stop-color='%23f59e0b'/%3E%3Cstop%20offset='50%25'%20stop-color='%23f97316'/%3E%3Cstop%20offset='100%25'%20stop-color='%23f43f5e'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect%20width='100'%20height='100'%20rx='26'%20fill='url(%23g)'/%3E%3Cg%20transform='translate(22,%2022)%20scale(2.333)'%20stroke='%23ffffff'%20stroke-width='2.2'%20stroke-linecap='round'%20stroke-linejoin='round'%20fill='none'%3E%3Cpath%20d='M3%202v7c0%201.1.9%202%202%202h4a2%202%200%200%200%202-2V2'/%3E%3Cpath%20d='M7%202v20'/%3E%3Cpath%20d='M21%2015V2a5%205%200%200%200-5%205v6c0%201.1.9%202%202%202h3Zm0%200v7'/%3E%3C/g%3E%3C/svg%3E`;
    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.type = "image/svg+xml";
    link.href = svgIcon;

    setInGas(isGasEnvironment());
    const init = async () => {
      // 1. Check for server-injected bootstrap data (0ms instant initial hydration in GAS)
      let bootstrapped = false;
      const bootstrapEl = document.getElementById("bootstrap-data");
      if (bootstrapEl && bootstrapEl.textContent) {
        try {
          const raw = bootstrapEl.textContent.trim();
          if (raw && raw.startsWith("{") && raw !== "{}") {
            const boot = JSON.parse(raw);
            if (boot && boot.userInfo) {
              const deployUrl = boot.deploymentUrl || boot.userInfo.deploymentUrl;
              if (deployUrl) setDeploymentUrl(deployUrl);
              const devMode =
                typeof boot.userInfo.isDevMode === "boolean"
                  ? boot.userInfo.isDevMode
                  : !isGasEnvironment();
              setIsDevMode(devMode);
              if (boot.registry) {
                if (boot.registry.settings) {
                  applyLoadedSettings(boot.registry.settings);
                }
                if (devMode) {
                  setEmailTo(DEV_TEST_EMAIL);
                } else {
                  setEmailTo(boot.registry.settings?.announcementTo || DEFAULT_ANNOUNCEMENT_TO);
                  if (boot.registry.settings?.announcementCc) {
                    setEmailCc(boot.registry.settings.announcementCc);
                  }
                }
                if (Array.isArray(boot.registry.members) && boot.registry.members.length > 0) {
                  setMembers(boot.registry.members);
                  setExceptions(boot.registry.exceptions || []);
                }
              } else {
                if (devMode) {
                  setEmailTo(DEV_TEST_EMAIL);
                } else {
                  setEmailTo(DEFAULT_ANNOUNCEMENT_TO);
                }
              }
              if (
                boot.driveSheets &&
                Array.isArray(boot.driveSheets) &&
                boot.driveSheets.length > 0
              ) {
                setDriveSheets(boot.driveSheets);
              }
              if (
                boot.publicSchedule &&
                Array.isArray(boot.publicSchedule) &&
                boot.publicSchedule.length > 0
              ) {
                setPublicSchedule(boot.publicSchedule);
              }
              if (boot.publicMonthTitle) {
                setPublicMonthTitle(boot.publicMonthTitle);
              }
              if (boot.publicMonthKey) {
                setPublicMonthKey(boot.publicMonthKey);
              }
              if (
                boot.availableMonths &&
                Array.isArray(boot.availableMonths) &&
                boot.availableMonths.length > 0
              ) {
                setPublicAvailableMonths(boot.availableMonths);
              }
              bootstrapped = true;
              setInitialLoading(false);
            }
          }
        } catch (bootErr) {
          console.warn("Bootstrap hydration failed, falling back to RPC:", bootErr);
        }
      }

      // If bootstrap data was not present (e.g. Vite dev or direct fallback), run RPCs
      if (!bootstrapped) {
        try {
          const info = await callGas<any>("getUserInfo");
          if (info && info.deploymentUrl) {
            setDeploymentUrl(info.deploymentUrl);
          }
          const devMode =
            info && typeof info.isDevMode === "boolean" ? info.isDevMode : !isGasEnvironment();
          setIsDevMode(devMode);

          const regData = await callGas<any>("getMasterRegistryData", devMode);
          if (regData) {
            if (regData.settings) {
              applyLoadedSettings(regData.settings);
            }
            if (devMode) {
              setEmailTo(DEV_TEST_EMAIL);
            } else {
              setEmailTo(regData.settings?.announcementTo || DEFAULT_ANNOUNCEMENT_TO);
              if (regData.settings?.announcementCc) {
                setEmailCc(regData.settings.announcementCc);
              }
            }
            if (Array.isArray(regData.members) && regData.members.length > 0) {
              setMembers(regData.members);
              setExceptions(regData.exceptions || []);
            }
          } else {
            if (devMode) {
              setEmailTo(DEV_TEST_EMAIL);
            } else {
              setEmailTo(DEFAULT_ANNOUNCEMENT_TO);
            }
          }

          await fetchDriveSheets();
        } catch (err) {
          console.warn("Init error:", err);
        } finally {
          setInitialLoading(false);
        }
      }
    };
    init();

    const initialView = getAppViewFromUrl();
    if (initialView === "coordinator") {
      const initialStep = parseStepFromHash();
      setCurrentStepState(initialStep);
    } else if (initialView === "form-generator") {
      const p = getAppUrlParams();
      const m = p.get("month") || surveyFormMonthKey || "2026-11";
      setSurveyFormMonthKey(m);
      loadSurveyFormDatesPreview(m);
    }

    // URL Sanitization on mount: strip internal system parameters and corrupted hashes
    if (typeof window !== "undefined") {
      try {
        const url = new URL(window.location.href);
        let urlChanged = false;
        for (const sp of SYSTEM_QUERY_PARAMS) {
          if (url.searchParams.has(sp)) {
            url.searchParams.delete(sp);
            urlChanged = true;
          }
        }
        if (initialView === "coordinator") {
          const step = parseStepFromHash();
          if (url.hash !== `#step-${step}`) {
            url.hash = `#step-${step}`;
            urlChanged = true;
          }
        } else {
          // Resident, survey, form-generator, or portal view should never have a hash
          if (url.hash) {
            url.hash = "";
            urlChanged = true;
          }
        }
        if (urlChanged) {
          window.history.replaceState({ view: initialView }, "", url.toString());
        }
      } catch (e) {
        console.warn("URL sanitization error:", e);
      }
    }

    if (typeof (window as any).google !== "undefined" && (window as any).google?.script?.history) {
      try {
        const cleanParams = getAppUrlParams();
        const gasParams = toGasParamsObject(cleanParams);
        const gasHash = initialView === "coordinator" ? `step-${parseStepFromHash()}` : "";
        (window as any).google.script.history.replace({ view: initialView }, gasParams, gasHash);
      } catch (e) {
        console.warn("GAS history initial replace error:", e);
      }
    }

    // Listen for browser Back & Forward button presses
    const handlePopState = (e: Event) => {
      const targetView = getAppViewFromUrl();
      setAppView(targetView);

      const params = getAppUrlParams();
      const monthParam = params.get("month");
      if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
        setPublicMonthKey(monthParam);
        setSurveyFormMonthKey(monthParam);
        if (targetView === "resident") {
          fetchPublicSchedule(monthParam);
        } else if (targetView === "form-generator") {
          loadSurveyFormDatesPreview(monthParam);
        }
      }
      const memberParam = params.get("m") || params.get("name") || params.get("user");
      if (memberParam !== null) {
        setUrlMemberName(memberParam || "");
      }

      if (targetView === "coordinator") {
        const popState = (e as PopStateEvent).state;
        if (popState && typeof popState.step === "number" && [1, 2, 3, 4].includes(popState.step)) {
          setCurrentStepState(popState.step as 1 | 2 | 3 | 4);
        } else {
          const step = parseStepFromHash();
          setCurrentStepState(step);
        }
      }
    };

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("hashchange", handlePopState);

    if (typeof (window as any).google !== "undefined" && (window as any).google?.script?.history) {
      try {
        (window as any).google.script.history.setChangeHandler((e: any) => {
          const rawParams = new URLSearchParams();
          if (e.location?.parameters && Object.keys(e.location.parameters).length > 0) {
            for (const [k, v] of Object.entries(e.location.parameters)) {
              if (Array.isArray(v)) {
                rawParams.set(k, v[0] || "");
              } else if (typeof v === "string") {
                rawParams.set(k, v);
              }
            }
          }
          const params = filterCleanUrlParams(rawParams);
          const hasCleanParams = Array.from(params.keys()).length > 0;
          // If no clean parameters, hash, or state were provided in history event, preserve active view
          if (!hasCleanParams && !e.location?.hash && !e.state?.view) {
            return;
          }

          const explicitViewParam = params.get("view") || params.get("mode");
          let targetView: AppView | null = null;
          if (e.state?.view) {
            targetView = e.state.view as AppView;
          } else if (
            explicitViewParam ||
            (e.location?.hash && /(?:#|^)step-[1-4]/.test(e.location.hash))
          ) {
            targetView = getAppViewFromUrl(params, e.location?.hash || "");
          }

          if (targetView) {
            setAppView(targetView);
          }

          const monthParam = params.get("month");
          if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
            setPublicMonthKey(monthParam);
            setSurveyFormMonthKey(monthParam);
            if (targetView === "resident") {
              fetchPublicSchedule(monthParam);
            } else if (targetView === "form-generator") {
              loadSurveyFormDatesPreview(monthParam);
            }
          }
          const memberParam = params.get("m") || params.get("name") || params.get("user");
          if (memberParam !== null) {
            setUrlMemberName(memberParam || "");
          }

          if (targetView === "coordinator") {
            const raw =
              e.state?.step ||
              (e.location?.hash ? e.location.hash.replace("#step-", "").replace("step-", "") : "");
            const parsed = parseInt(raw, 10);
            if ([1, 2, 3, 4].includes(parsed)) {
              setCurrentStepState(parsed as 1 | 2 | 3 | 4);
            }
          }
        });
      } catch (err) {
        console.warn("GAS setChangeHandler failed:", err);
      }
    }

    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("hashchange", handlePopState);
    };
  }, []);

  // Auto-scroll to top whenever step changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentStep]);

  // Auto-solve when entering Step 3 if no result exists yet
  useEffect(() => {
    if (currentStep === 3 && !solverResult && intakeData && !loading) {
      handleRunSolver();
    }
  }, [currentStep, solverResult, intakeData]);

  // Auto-scroll to selected day in Modal 3 (Member Inspector) if opened from schedule badge
  useEffect(() => {
    if (selectedQuotaMember && selectedQuotaFocusDateKey) {
      const timer = setTimeout(() => {
        const el = document.getElementById(`quota-modal-day-${selectedQuotaFocusDateKey}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [selectedQuotaMember, selectedQuotaFocusDateKey]);

  // Global Escape key listener to dismiss open modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedNearCompleteDateKey) setSelectedNearCompleteDateKey(null);
        else if (selectedSlotToFill) setSelectedSlotToFill(null);
        else if (swapModal) setSwapModal(null);
        else if (selectedQuotaMember) {
          setSelectedQuotaMember(null);
          setSelectedQuotaFocusDateKey(null);
        } else if (showAddRuleModal) {
          setShowAddRuleModal(false);
          setModalContextNote(null);
        } else if (showWhitelistModal) {
          setShowWhitelistModal(false);
          setEditingWhitelistRule(null);
        } else if (showOverwriteSurveyModal) {
          setShowOverwriteSurveyModal(false);
        } else if (showMealSignupModal) setShowMealSignupModal(false);
        else if (showReportsModal) setShowReportsModal(false);
        else if (showMemberModal) setShowMemberModal(false);
        else if (showSettingsModal) setShowSettingsModal(false);
        else if (showResendConfirmModal) setShowResendConfirmModal(false);
        else if (showMainMenu) setShowMainMenu(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedNearCompleteDateKey,
    selectedSlotToFill,
    swapModal,
    selectedQuotaMember,
    showAddRuleModal,
    showWhitelistModal,
    showOverwriteSurveyModal,
    showMealSignupModal,
    showReportsModal,
    showMemberModal,
    showSettingsModal,
    showResendConfirmModal,
    showMainMenu,
  ]);

  // Handle Mark Inactive on Audit Screen
  const handleMarkInactive = async (memberName: string) => {
    setUpdatingMemberName(memberName);
    try {
      const updatedMembers = await callGas<Member[]>(
        "setMemberActiveStatus",
        memberName,
        false,
        masterSheetInput,
        isDevMode
      );
      intakeCacheRef.current = {};
      const newMembers =
        Array.isArray(updatedMembers) && updatedMembers.length > 0
          ? updatedMembers
          : members.map((m) =>
              m.name.toLowerCase() === memberName.toLowerCase() ? { ...m, active: false } : m
            );

      setMembers(newMembers);
      if (intakeData) {
        const updatedMissing = intakeData.audit.missingMembers.filter(
          (m) => m.name.toLowerCase() !== memberName.toLowerCase()
        );
        setIntakeData({
          ...intakeData,
          audit: {
            ...intakeData.audit,
            missingMembers: updatedMissing,
            totalActiveMembers: newMembers.filter((m) => m.active).length,
          },
          members: newMembers,
        });
      }
      showToast(`Marked ${memberName} as inactive.`);
    } catch (err: any) {
      showToast(`Error: ${err.message}`, "error");
    } finally {
      setUpdatingMemberName(null);
    }
  };

  // Handle Member Toggle
  const handleToggleMember = async (name: string, currentActive: boolean) => {
    setUpdatingMemberName(name);
    try {
      const updatedMembers = await callGas<Member[]>(
        "setMemberActiveStatus",
        name,
        !currentActive,
        masterSheetInput,
        isDevMode
      );
      intakeCacheRef.current = {};
      const newMembers =
        Array.isArray(updatedMembers) && updatedMembers.length > 0
          ? updatedMembers
          : members.map((m) =>
              m.name.toLowerCase() === name.toLowerCase() ? { ...m, active: !currentActive } : m
            );

      setMembers(newMembers);
      if (intakeData) {
        const updatedMissing = newMembers.filter(
          (m) =>
            m.active &&
            !intakeData.responses.some((r) => r.name.toLowerCase() === m.name.toLowerCase())
        );
        setIntakeData({
          ...intakeData,
          audit: {
            ...intakeData.audit,
            missingMembers: updatedMissing,
            totalActiveMembers: newMembers.filter((m) => m.active).length,
          },
          members: newMembers,
        });
      }
      showToast(`Updated ${name} status to ${!currentActive ? "Active" : "Inactive"}.`);
    } catch (err: any) {
      showToast(`Error: ${err.message}`, "error");
    } finally {
      setUpdatingMemberName(null);
    }
  };

  // Add Member
  const handleAddMember = async (
    e?: React.FormEvent,
    nameOverride?: string,
    emailOverride?: string
  ) => {
    if (e) e.preventDefault();
    const nameToAdd = (nameOverride || newMemberName).trim();
    const emailToAdd = (emailOverride || newMemberEmail).trim();
    if (!nameToAdd) return;
    const parsedAliases = extractAliases(newMemberAliases);
    const newM: Member = {
      name: nameToAdd,
      google_email: emailToAdd || "",
      active: true,
      last_active_survey: new Date().toISOString().slice(0, 7),
      aliases: parsedAliases.length > 0 ? parsedAliases : undefined,
    };
    try {
      const updated = await callGas<Member[]>(
        "addCommunityMember",
        newM,
        masterSheetInput,
        isDevMode
      );
      intakeCacheRef.current = {};
      const newMembers =
        Array.isArray(updated) && updated.length > 0 ? updated : [...members, newM];
      setMembers(newMembers);
      if (intakeData) {
        const updatedUnrecognized = intakeData.audit.unrecognizedRespondents.filter(
          (u) => u.toLowerCase() !== nameToAdd.toLowerCase()
        );
        setIntakeData({
          ...intakeData,
          members: newMembers,
          audit: {
            ...intakeData.audit,
            unrecognizedRespondents: updatedUnrecognized,
            totalActiveMembers: newMembers.filter((m) => m.active).length,
          },
        });
      }
      setNewMemberName("");
      setNewMemberEmail("");
      setNewMemberAliases("");
      showToast(`Added ${newM.name} to community registry.`);
    } catch (err: any) {
      showToast(`Failed to add member: ${err.message}`, "error");
    }
  };

  // Save Edited Member
  const handleSaveEditedMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember || !editingMember.name.trim()) return;

    setIsSavingMember(true);
    try {
      const parsedEmails = extractEmails(editingMember.emails);
      const parsedAliases = extractAliases(editingMember.aliases);

      const updatedM: Member = {
        name: editingMember.name.trim(),
        google_email: parsedEmails.join(", "),
        active: editingMember.active,
        aliases: parsedAliases.length > 0 ? parsedAliases : undefined,
        alternate_emails: parsedEmails.length > 1 ? parsedEmails.slice(1) : undefined,
      };

      const updatedMembers = await callGas<Member[]>(
        "updateCommunityMember",
        editingMember.originalName,
        updatedM,
        masterSheetInput,
        isDevMode
      );
      intakeCacheRef.current = {};
      const newMembers =
        Array.isArray(updatedMembers) && updatedMembers.length > 0
          ? updatedMembers
          : members.map((m) =>
              m.name.toLowerCase() === editingMember.originalName.toLowerCase() ? updatedM : m
            );

      setMembers(newMembers);

      if (intakeData) {
        const updatedResponses = intakeData.responses.map((r) =>
          r.name.toLowerCase() === editingMember.originalName.toLowerCase()
            ? { ...r, name: updatedM.name }
            : r
        );
        setIntakeData({
          ...intakeData,
          responses: updatedResponses,
          members: newMembers,
          audit: {
            ...intakeData.audit,
            totalActiveMembers: newMembers.filter((m) => m.active).length,
          },
        });
      }

      showToast(`✨ Updated profile for ${updatedM.name}.`);
      setEditingMember(null);
    } catch (err: any) {
      showToast(`Failed to update member: ${err.message}`, "error");
    } finally {
      setIsSavingMember(false);
    }
  };

  // Link Nickname / Alias to Existing Member
  const handleLinkMemberAlias = async (
    canonicalName: string,
    aliasName: string,
    aliasEmail?: string
  ) => {
    if (!canonicalName || !aliasName) return;
    setLinkingAliasFor(aliasName);
    try {
      const updated = await callGas<Member[]>(
        "linkMemberAlias",
        canonicalName,
        aliasName,
        aliasEmail,
        masterSheetInput,
        isDevMode
      );
      intakeCacheRef.current = {};
      const newMembers =
        Array.isArray(updated) && updated.length > 0
          ? updated
          : members.map((m) => {
              if (m.name.toLowerCase() === canonicalName.toLowerCase()) {
                const currentAliases = m.aliases || [];
                const updatedAliases = currentAliases.includes(aliasName)
                  ? currentAliases
                  : [...currentAliases, aliasName];
                return { ...m, aliases: updatedAliases };
              }
              return m;
            });

      setMembers(newMembers);

      if (intakeData) {
        const updatedResponses = intakeData.responses.map((r) =>
          r.name.toLowerCase() === aliasName.toLowerCase() ? { ...r, name: canonicalName } : r
        );
        const updatedUnrecognized = intakeData.audit.unrecognizedRespondents.filter(
          (u) => u.toLowerCase() !== aliasName.toLowerCase()
        );
        setIntakeData({
          ...intakeData,
          responses: updatedResponses,
          audit: {
            ...intakeData.audit,
            unrecognizedRespondents: updatedUnrecognized,
          },
          members: newMembers,
        });
      }

      showToast(`✨ Linked "${aliasName}" as an alias for ${canonicalName}!`);
    } catch (err: any) {
      showToast(`Failed to link alias: ${err.message}`, "error");
    } finally {
      setLinkingAliasFor(null);
    }
  };

  const parsedBulkMembers = useMemo(() => {
    return parseAndDisambiguateGoogleGroupRoster(bulkImportText);
  }, [bulkImportText]);

  const handleBulkImportSave = async (mode: "replace" | "merge") => {
    if (parsedBulkMembers.length === 0) return;
    setBulkImportSaving(true);
    try {
      let finalMembers: Member[] = [];
      if (mode === "replace") {
        finalMembers = parsedBulkMembers.map((p) => ({
          name: p.name,
          google_email: p.google_email,
          active: p.active,
          last_active_survey: new Date().toISOString().slice(0, 7),
        }));
      } else {
        // Merge with existing
        const existingNames = new Set(members.map((m) => m.name.toLowerCase()));
        const toAdd = parsedBulkMembers
          .filter((p) => !existingNames.has(p.name.toLowerCase()))
          .map((p) => ({
            name: p.name,
            google_email: p.google_email,
            active: p.active,
            last_active_survey: new Date().toISOString().slice(0, 7),
          }));
        finalMembers = [...members, ...toAdd];
      }

      await callGas("bulkSaveCommunityMembers", finalMembers, masterSheetInput, isDevMode);
      intakeCacheRef.current = {};
      setMembers(finalMembers);
      if (intakeData) {
        setIntakeData({ ...intakeData, members: finalMembers });
      }
      showToast(
        mode === "replace"
          ? `Master Registry replaced with ${finalMembers.length} community members!`
          : `Merged ${parsedBulkMembers.length} members into Master Registry!`
      );
      setBulkImportText("");
      setShowBulkImport(false);
    } catch (err: any) {
      showToast(`Failed to save members: ${err.message}`, "error");
    } finally {
      setBulkImportSaving(false);
    }
  };

  // Rule Management
  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRule.person_a) {
      showToast("Please select Person A", "error");
      return;
    }
    const isEdit = !!newRule.id;
    const rule: ExceptionRule = {
      id: newRule.id || `RULE-${Date.now().toString().slice(-4)}`,
      person_a: newRule.person_a,
      person_b: newRule.person_b || undefined,
      rule_type: newRule.rule_type as RuleType,
      is_hard_rule: newRule.is_hard_rule ?? true,
      notes: newRule.notes || "",
    };

    try {
      const updated = await callGas<ExceptionRule[]>(
        "saveExceptionRule",
        rule,
        masterSheetInput,
        isDevMode
      );
      intakeCacheRef.current = {};
      setExceptions(updated);
      setShowAddRuleModal(false);
      setNewRule({
        rule_type: "NOT_SAME_TEAM",
        is_hard_rule: true,
        person_a: "",
        person_b: "",
        notes: "",
      });
      setModalContextNote(null);
      showToast(isEdit ? "Exception rule updated!" : "Exception rule added!");
    } catch (err: any) {
      showToast(`Failed to save rule: ${err.message}`, "error");
    }
  };

  const handleOpenAddRuleForMember = (memberName: string, note?: string) => {
    setNewRule({
      rule_type: "NOT_SAME_TEAM",
      is_hard_rule: true,
      person_a: memberName,
      person_b: "",
      notes: note || "",
    });
    setModalContextNote(note || null);
    setShowAddRuleModal(true);
  };

  const handleOpenAddWhitelistRule = () => {
    setEditingWhitelistRule(null);
    setShowWhitelistModal(true);
  };

  const handleSaveWhitelistRule = async (rule: ExceptionRule) => {
    const isEdit = !!rule.id;
    try {
      const updated = await callGas<ExceptionRule[]>(
        "saveExceptionRule",
        rule,
        masterSheetInput,
        isDevMode
      );
      intakeCacheRef.current = {};
      setExceptions(updated);
      setShowWhitelistModal(false);
      setEditingWhitelistRule(null);
      showToast(isEdit ? "Mentor whitelist rule updated!" : "Mentor whitelist rule added!");
    } catch (err: any) {
      showToast(`Failed to save whitelist rule: ${err.message}`, "error");
    }
  };

  const handleOpenEditRule = (rule: ExceptionRule) => {
    if (rule.rule_type === "REQUIRE_ONE_OF_TEAM") {
      setEditingWhitelistRule(rule);
      setShowWhitelistModal(true);
      return;
    }
    // Look up note for person_a
    const resp = intakeData?.responses.find(
      (r) => r.name.toLowerCase() === rule.person_a.toLowerCase()
    );
    setNewRule({
      id: rule.id,
      rule_type: rule.rule_type,
      is_hard_rule: rule.is_hard_rule,
      person_a: rule.person_a,
      person_b: rule.person_b || "",
      notes: rule.notes || "",
    });
    setModalContextNote(resp?.specialInstructions || null);
    setShowAddRuleModal(true);
  };

  const handleOpenAddGenericRule = () => {
    setNewRule({
      rule_type: "NOT_SAME_TEAM",
      is_hard_rule: true,
      person_a: "",
      person_b: "",
      notes: "",
    });
    setModalContextNote(null);
    setShowAddRuleModal(true);
  };

  const membersRequiringAttention = useMemo(() => {
    if (!intakeData) return [];
    const map = new Map<
      string,
      {
        name: string;
        specialInstructions?: string;
        canCookCleanSameDay: boolean;
        cookQuota: number;
        rules: ExceptionRule[];
      }
    >();

    // 1. Process survey responses with special notes or same day preference
    for (const resp of intakeData.responses) {
      const hasNote =
        resp.specialInstructions &&
        resp.specialInstructions.trim() !== "" &&
        !["nope", "none", "n/a", "no", "nothing", "nope.", "none."].includes(
          resp.specialInstructions.trim().toLowerCase()
        );

      if (hasNote || resp.canCookCleanSameDay) {
        map.set(resp.name.toLowerCase(), {
          name: resp.name,
          specialInstructions: hasNote ? resp.specialInstructions : undefined,
          canCookCleanSameDay: resp.canCookCleanSameDay,
          cookQuota: resp.cookQuota,
          rules: [],
        });
      }
    }

    // 2. Add members who have existing rules configured
    for (const rule of exceptions) {
      const keyA = rule.person_a.toLowerCase();
      if (!map.has(keyA)) {
        const resp = intakeData.responses.find((r) => r.name.toLowerCase() === keyA);
        map.set(keyA, {
          name: rule.person_a,
          specialInstructions: resp?.specialInstructions,
          canCookCleanSameDay: resp?.canCookCleanSameDay ?? false,
          cookQuota: resp?.cookQuota ?? 1,
          rules: [],
        });
      }
      map.get(keyA)!.rules.push(rule);

      // Person B is only a separate individual member for 1-to-1 pairwise rules
      // (not for whitelist pools like REQUIRE_ONE_OF_TEAM or single-person rules like PREF_SAME_DAY)
      if (
        rule.person_b &&
        rule.rule_type !== "REQUIRE_ONE_OF_TEAM" &&
        rule.rule_type !== "PREF_SAME_DAY"
      ) {
        const keyB = rule.person_b.toLowerCase();
        if (!map.has(keyB)) {
          const resp = intakeData.responses.find((r) => r.name.toLowerCase() === keyB);
          map.set(keyB, {
            name: rule.person_b,
            specialInstructions: resp?.specialInstructions,
            canCookCleanSameDay: resp?.canCookCleanSameDay ?? false,
            cookQuota: resp?.cookQuota ?? 1,
            rules: [],
          });
        }
        const bRules = map.get(keyB)!.rules;
        if (!bRules.some((r) => r.id === rule.id)) {
          bRules.push(rule);
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
  }, [intakeData, exceptions]);

  const handleDeleteRule = async (id: string) => {
    try {
      const updated = await callGas<ExceptionRule[]>(
        "deleteExceptionRule",
        id,
        masterSheetInput,
        isDevMode
      );
      intakeCacheRef.current = {};
      setExceptions(updated);
      showToast("Rule removed.");
    } catch (err: any) {
      showToast(`Error: ${err.message}`, "error");
    }
  };

  const checkAssignmentConflict = (
    memberName: string,
    role: Role,
    day: DaySchedule
  ): string | null => {
    const currentCooks = day.cooks;
    const currentCleaners = day.cleaners;

    for (const rule of exceptions) {
      if (!rule.is_hard_rule) continue;
      const pA = rule.person_a;
      const pB = rule.person_b;
      if (!pB) continue;

      if (rule.rule_type === "NOT_SAME_DAY") {
        if (memberName === pA && (currentCooks.includes(pB) || currentCleaners.includes(pB))) {
          return `Hard rule: NOT_SAME_DAY with ${pB}`;
        }
        if (memberName === pB && (currentCooks.includes(pA) || currentCleaners.includes(pA))) {
          return `Hard rule: NOT_SAME_DAY with ${pA}`;
        }
      }

      if (rule.rule_type === "NOT_SAME_TEAM") {
        const team = role === "COOK" ? currentCooks : currentCleaners;
        if (memberName === pA && team.includes(pB)) {
          return `Hard rule: NOT_SAME_TEAM with ${pB}`;
        }
        if (memberName === pB && team.includes(pA)) {
          return `Hard rule: NOT_SAME_TEAM with ${pA}`;
        }
      }
    }
    return null;
  };

  const handleAddExtraShift = (dateKey: string, memberName: string, role: Role) => {
    if (!solverResult) return;
    const updatedSchedule = solverResult.schedule.map((day) => {
      if (day.dateKey === dateKey) {
        const isBrunch = day.mealType === "BRUNCH";
        let targetCooks = day.targetCookCount;
        let targetCleaners = day.targetCleanCount;
        let specialNote = day.specialNote;

        // If this date had 0 target slots or was marked as NO COMMUNITY MEAL, activate the meal!
        if (targetCooks === 0 && targetCleaners === 0) {
          targetCooks = isBrunch ? 2 : 3;
          targetCleaners = isBrunch ? 2 : 3;
          if (specialNote === "NO COMMUNITY MEAL") {
            specialNote = undefined;
          }
        }

        let newCooks = day.cooks;
        let newCleaners = day.cleaners;

        if (role === "COOK") {
          if (!day.cooks.includes(memberName)) {
            newCooks = [...day.cooks, memberName];
          }
        } else {
          if (!day.cleaners.includes(memberName)) {
            newCleaners = [...day.cleaners, memberName];
          }
        }

        // Check if this is a 2-cook willing dinner
        let isTwoPersonDinnerWilling = false;
        if (!isBrunch && newCooks.length === 2) {
          const allWilling = newCooks.every((cookName) => {
            const r = intakeData?.responses.find(
              (resp) => resp.name.toLowerCase() === cookName.toLowerCase()
            );
            return isWillingTwoPersonDinner(r?.cookTeamSizePref);
          });
          if (allWilling) {
            targetCooks = 2;
            isTwoPersonDinnerWilling = true;
          }
        }

        const unfilledCooks = Math.max(0, targetCooks - newCooks.length);
        const unfilledCleaners = Math.max(0, targetCleaners - newCleaners.length);

        return {
          ...day,
          specialNote,
          cooks: newCooks,
          cleaners: newCleaners,
          targetCookCount: targetCooks,
          targetCleanCount: targetCleaners,
          isTwoPersonDinnerWilling,
          unfilledCooks,
          unfilledCleaners,
        };
      }
      return day;
    });

    const updatedStats = { ...solverResult.memberStats };
    if (updatedStats[memberName]) {
      const stat = { ...updatedStats[memberName] };
      if (role === "COOK") stat.assignedCooks++;
      else stat.assignedCleans++;
      stat.totalAssigned++;
      updatedStats[memberName] = stat;
    }

    const newUnfilledCount = updatedSchedule.reduce(
      (acc, d) => acc + d.unfilledCooks + d.unfilledCleaners,
      0
    );

    setSolverResult({
      ...solverResult,
      schedule: updatedSchedule,
      memberStats: updatedStats,
      unfilledSlotsCount: newUnfilledCount,
    });

    showToast(
      `Added ${memberName} as extra ${role === "COOK" ? "cook" : "cleaner"} on ${dateKey}!`
    );
  };

  const handleRemoveShift = (dateKey: string, memberName: string, role: Role) => {
    if (!solverResult) return;
    const updatedSchedule = solverResult.schedule.map((day) => {
      if (day.dateKey === dateKey) {
        const isBrunch = day.mealType === "BRUNCH";
        const newCooks = role === "COOK" ? day.cooks.filter((c) => c !== memberName) : day.cooks;
        const newCleaners =
          role === "CLEAN" ? day.cleaners.filter((c) => c !== memberName) : day.cleaners;

        let targetCooks = day.targetCookCount;
        let targetCleaners = day.targetCleanCount;
        let isTwoPersonDinnerWilling = false;

        if (
          newCooks.length === 0 &&
          newCleaners.length === 0 &&
          day.specialNote === "NO COMMUNITY MEAL"
        ) {
          targetCooks = 0;
          targetCleaners = 0;
        } else {
          if (!isBrunch && newCooks.length === 2) {
            const allWilling = newCooks.every((cookName) => {
              const r = intakeData?.responses.find(
                (resp) => resp.name.toLowerCase() === cookName.toLowerCase()
              );
              return isWillingTwoPersonDinner(r?.cookTeamSizePref);
            });
            if (allWilling) {
              targetCooks = 2;
              isTwoPersonDinnerWilling = true;
            } else {
              targetCooks = 3;
            }
          } else {
            targetCooks = isBrunch ? 2 : 3;
          }
          targetCleaners = isBrunch ? 2 : 3;
        }

        const unfilledCooks = Math.max(0, targetCooks - newCooks.length);
        const unfilledCleaners = Math.max(0, targetCleaners - newCleaners.length);

        return {
          ...day,
          cooks: newCooks,
          cleaners: newCleaners,
          targetCookCount: targetCooks,
          targetCleanCount: targetCleaners,
          isTwoPersonDinnerWilling,
          unfilledCooks,
          unfilledCleaners,
        };
      }
      return day;
    });

    const updatedStats = { ...solverResult.memberStats };
    if (updatedStats[memberName]) {
      const stat = { ...updatedStats[memberName] };
      if (role === "COOK") stat.assignedCooks = Math.max(0, stat.assignedCooks - 1);
      else stat.assignedCleans = Math.max(0, stat.assignedCleans - 1);
      stat.totalAssigned = stat.assignedCooks + stat.assignedCleans;
      updatedStats[memberName] = stat;
    }

    const newUnfilledCount = updatedSchedule.reduce(
      (acc, d) => acc + d.unfilledCooks + d.unfilledCleaners,
      0
    );

    setSolverResult({
      ...solverResult,
      schedule: updatedSchedule,
      memberStats: updatedStats,
      unfilledSlotsCount: newUnfilledCount,
    });

    showToast(`Removed ${memberName} from ${dateKey}.`);
  };

  const handleCancelMeal = (dateKey: string) => {
    if (!solverResult) return;
    const targetDay = solverResult.schedule.find((d) => d.dateKey === dateKey);
    if (!targetDay) return;

    // Release volunteers
    const updatedStats = { ...solverResult.memberStats };
    for (const cook of targetDay.cooks) {
      if (updatedStats[cook]) {
        const stat = { ...updatedStats[cook] };
        stat.assignedCooks = Math.max(0, stat.assignedCooks - 1);
        stat.totalAssigned = stat.assignedCooks + stat.assignedCleans;
        updatedStats[cook] = stat;
      }
    }
    for (const cleaner of targetDay.cleaners) {
      if (updatedStats[cleaner]) {
        const stat = { ...updatedStats[cleaner] };
        stat.assignedCleans = Math.max(0, stat.assignedCleans - 1);
        stat.totalAssigned = stat.assignedCooks + stat.assignedCleans;
        updatedStats[cleaner] = stat;
      }
    }

    const updatedSchedule = solverResult.schedule.map((day) => {
      if (day.dateKey === dateKey) {
        return {
          ...day,
          specialNote: "NO COMMUNITY MEAL",
          cooks: [],
          cleaners: [],
          targetCookCount: 0,
          targetCleanCount: 0,
          isTwoPersonDinnerWilling: false,
          unfilledCooks: 0,
          unfilledCleaners: 0,
        };
      }
      return day;
    });

    // Update intakeData.mealDates so re-running solver respects cancellation
    if (intakeData) {
      const updatedMealDates = intakeData.mealDates.map((md) => {
        if (md.dateKey === dateKey || md.dateLabel === targetDay.dateLabel) {
          return {
            ...md,
            targetCookCount: 0,
            targetCleanCount: 0,
            specialNote: "NO COMMUNITY MEAL",
          };
        }
        return md;
      });
      setIntakeData({ ...intakeData, mealDates: updatedMealDates });
    }

    const newUnfilledCount = updatedSchedule.reduce(
      (acc, d) => acc + d.unfilledCooks + d.unfilledCleaners,
      0
    );

    setSolverResult({
      ...solverResult,
      schedule: updatedSchedule,
      memberStats: updatedStats,
      unfilledSlotsCount: newUnfilledCount,
    });

    showToast(`Cancelled meal on ${targetDay.dateLabel}. Volunteers released.`);
  };

  const handleRestoreMeal = (dateKey: string) => {
    if (!solverResult) return;
    const targetDay = solverResult.schedule.find((d) => d.dateKey === dateKey);
    if (!targetDay) return;

    const isBrunch = targetDay.mealType === "BRUNCH";
    const targetCount = isBrunch ? 2 : 3;

    const updatedSchedule = solverResult.schedule.map((day) => {
      if (day.dateKey === dateKey) {
        return {
          ...day,
          specialNote: undefined,
          targetCookCount: targetCount,
          targetCleanCount: targetCount,
          unfilledCooks: Math.max(0, targetCount - day.cooks.length),
          unfilledCleaners: Math.max(0, targetCount - day.cleaners.length),
        };
      }
      return day;
    });

    // Update intakeData.mealDates so re-running solver schedules this date
    if (intakeData) {
      const updatedMealDates = intakeData.mealDates.map((md) => {
        if (md.dateKey === dateKey || md.dateLabel === targetDay.dateLabel) {
          return {
            ...md,
            targetCookCount: targetCount,
            targetCleanCount: targetCount,
            specialNote: undefined,
          };
        }
        return md;
      });
      setIntakeData({ ...intakeData, mealDates: updatedMealDates });
    }

    const newUnfilledCount = updatedSchedule.reduce(
      (acc, d) => acc + d.unfilledCooks + d.unfilledCleaners,
      0
    );

    const updatedOpportunities = (solverResult.nearCompleteOpportunities || []).filter(
      (o) => o.dateKey !== dateKey
    );

    setSolverResult({
      ...solverResult,
      schedule: updatedSchedule,
      unfilledSlotsCount: newUnfilledCount,
      nearCompleteOpportunities: updatedOpportunities,
    });

    showToast(`Restored ${targetDay.dateLabel} into active schedule.`);
  };

  const handleRestoreWithSelectedVolunteers = (
    dateKey: string,
    cooks: string[],
    cleaners: string[]
  ) => {
    if (!solverResult) return;
    const targetDay = solverResult.schedule.find((d) => d.dateKey === dateKey);
    if (!targetDay) return;

    const isBrunch = targetDay.mealType === "BRUNCH";
    let targetCooks = isBrunch ? 2 : 3;
    const targetCleaners = isBrunch ? 2 : 3;

    // Check 2-cook willingness
    let isTwoPersonDinnerWilling = false;
    if (!isBrunch && cooks.length === 2) {
      const allWilling = cooks.every((cookName) => {
        const r = intakeData?.responses.find(
          (resp) => resp.name.toLowerCase() === cookName.toLowerCase()
        );
        return isWillingTwoPersonDinner(r?.cookTeamSizePref);
      });
      if (allWilling) {
        targetCooks = 2;
        isTwoPersonDinnerWilling = true;
      }
    }

    const unfilledCooks = Math.max(0, targetCooks - cooks.length);
    const unfilledCleaners = Math.max(0, targetCleaners - cleaners.length);

    const updatedSchedule = solverResult.schedule.map((day) => {
      if (day.dateKey === dateKey) {
        return {
          ...day,
          specialNote: undefined,
          isCancelled: false,
          cancellationReason: undefined,
          cooks: [...cooks],
          cleaners: [...cleaners],
          targetCookCount: targetCooks,
          targetCleanCount: targetCleaners,
          isTwoPersonDinnerWilling,
          unfilledCooks,
          unfilledCleaners,
        };
      }
      return day;
    });

    // Update stats for all assigned members
    const updatedStats = { ...solverResult.memberStats };
    cooks.forEach((c) => {
      if (updatedStats[c]) {
        updatedStats[c] = {
          ...updatedStats[c],
          assignedCooks: updatedStats[c].assignedCooks + 1,
          totalAssigned: updatedStats[c].totalAssigned + 1,
        };
      }
    });
    cleaners.forEach((cl) => {
      if (updatedStats[cl]) {
        updatedStats[cl] = {
          ...updatedStats[cl],
          assignedCleans: updatedStats[cl].assignedCleans + 1,
          totalAssigned: updatedStats[cl].totalAssigned + 1,
        };
      }
    });

    // Update intakeData.mealDates so re-running solver schedules this date
    if (intakeData) {
      const updatedMealDates = intakeData.mealDates.map((md) => {
        if (md.dateKey === dateKey || md.dateLabel === targetDay.dateLabel) {
          return {
            ...md,
            targetCookCount: targetCooks,
            targetCleanCount: targetCleaners,
            specialNote: undefined,
          };
        }
        return md;
      });
      setIntakeData({ ...intakeData, mealDates: updatedMealDates });
    }

    const newUnfilledCount = updatedSchedule.reduce(
      (acc, d) => acc + d.unfilledCooks + d.unfilledCleaners,
      0
    );

    const updatedOpportunities = (solverResult.nearCompleteOpportunities || []).filter(
      (o) => o.dateKey !== dateKey
    );

    setSolverResult({
      ...solverResult,
      schedule: updatedSchedule,
      memberStats: updatedStats,
      unfilledSlotsCount: newUnfilledCount,
      nearCompleteOpportunities: updatedOpportunities,
    });

    const totalAssigned = cooks.length + cleaners.length;
    if (totalAssigned > 0) {
      showToast(
        `Restored ${targetDay.dateLabel} with ${cooks.length} cook(s) & ${cleaners.length} cleaner(s) assigned!`
      );
    } else {
      showToast(`Restored ${targetDay.dateLabel} into active schedule.`);
    }
  };

  // Run Solver
  const handleRunSolver = async (policyToUse?: CookTeamPolicy | any) => {
    if (!intakeData) return;
    setLoading(true);
    try {
      const activePolicy: CookTeamPolicy =
        typeof policyToUse === "string" &&
        ["ADAPTIVE_3_OR_2", "DINNER_3_BRUNCH_2", "TWO_REGARDLESS"].includes(policyToUse)
          ? (policyToUse as CookTeamPolicy)
          : cookPolicy;

      const res = await callGas<ScheduleOutput>(
        "solveSchedule",
        intakeData.mealDates,
        intakeData.responses,
        exceptions,
        {
          cookPolicy: activePolicy,
          maxCleanPerMember: Number(defaultCleanQuota) || 1,
          autoCancelDeficitDates,
        }
      );
      setSolverResult(res);
      goToStep(3);
      showToast(`Schedule generated in ${res.solveTimeMs}ms!`);
    } catch (err: any) {
      showToast(`Solver error: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  // Load Saved Schedule from existing tab
  const handleLoadExistingSchedule = async () => {
    if (!sheetInput) return;
    setLoading(true);
    try {
      const res = await callGas<ScheduleOutput>(
        "loadExistingScheduleFromSheet",
        sheetInput,
        intakeData?.existingScheduleTab?.name
      );

      // Recompute member stats using real survey responses (availability & quotas) if available
      if (intakeData?.responses && intakeData.responses.length > 0 && res.schedule) {
        res.memberStats = computeMemberQuotaStats(res.schedule, intakeData.responses);
      }

      setSolverResult(res);
      isEmailSubjectDirty.current = false;
      if (res.schedule) {
        setEmailSubject(formatDefaultSubject(res.schedule));
      }
      goToStep(3);
      showToast(
        `Loaded saved schedule tab "${intakeData?.existingScheduleTab?.name || "Schedule"}"!`
      );
    } catch (err: any) {
      showToast(`Failed to load saved schedule: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  // Export to Sheet
  const handleExportSheet = async (resultToExport?: ScheduleOutput) => {
    const activeResult = resultToExport || solverResult;
    if (!activeResult) return;
    setLoading(true);
    try {
      const res = await callGas<{
        success: boolean;
        sheetName: string;
        url?: string;
        message: string;
      }>("exportScheduleToSheet", sheetInput, activeResult);
      setExportedResult(res);
      const scheduledMonth = intakeData?.mealDates?.[0]?.dateKey?.slice(0, 7);
      if (scheduledMonth === surveyFormMonthKey) {
        setSurveyFormMonthStatus("CLOSED");
      }
      if (intakeData) {
        setIntakeData({ ...intakeData, monthStatus: "CLOSED" });
      }
      showToast(res.message);
    } catch (err: any) {
      showToast(`Export failed: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  // Helper to format clean date headings matching Brenda's announcement format: "Sun Sept 6 - Dinner"
  const formatEmailDateHeader = (d: DaySchedule) => {
    let dayOfWeek = "";
    let monthName = "";
    let dayNum = "";
    const isBrunch = d.mealType === "BRUNCH";
    const typeStr = isBrunch ? "Brunch" : "Dinner";

    const parsed = parseDateFromLabelOrKey(d.dateLabel, d.dateKey);
    if (parsed && !isNaN(parsed.getTime())) {
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "June",
        "July",
        "Aug",
        "Sept",
        "Oct",
        "Nov",
        "Dec",
      ];
      dayOfWeek = days[parsed.getDay()];
      monthName = months[parsed.getMonth()];
      dayNum = String(parsed.getDate());
    }

    let headerBase = "";
    if (dayOfWeek && monthName && dayNum) {
      headerBase = `${dayOfWeek} ${monthName} ${dayNum} - ${typeStr}`;
    } else {
      let label = d.dateLabel.trim();
      const lowerLabel = label.toLowerCase();
      if (!lowerLabel.includes("brunch") && !lowerLabel.includes("dinner")) {
        label = `${label} - ${typeStr}`;
      }
      headerBase = label;
    }

    // Clean specialNote: discard if it's "BRUNCH"/"DINNER", "NO COMMUNITY MEAL", auto-cancel notes, or already present in label
    let note = d.specialNote?.trim();
    if (note) {
      note = note
        .replace(/\(?\s*auto-cancelled[^)]*\)?/gi, "")
        .replace(/\(?\s*volunteer deficit[^)]*\)?/gi, "")
        .replace(/\bno community meal\b/gi, "")
        .replace(/^[\s\-–—:]+|[\s\-–—:]+$/g, "")
        .trim();

      const lowerNote = note.toLowerCase();
      if (
        !note ||
        lowerNote === "brunch" ||
        lowerNote === "dinner" ||
        headerBase.toLowerCase().includes(lowerNote)
      ) {
        note = undefined;
      }
    }

    if (note) {
      headerBase = `${headerBase} (${note})`;
    }

    return headerBase;
  };

  // Generate Email Summary Text
  const generateEmailText = () => {
    if (customEmailBody !== null) return customEmailBody;
    if (!solverResult) return "";

    const monthKey = (() => {
      if (solverResult?.schedule?.length) {
        for (const d of solverResult.schedule) {
          if (d.dateKey && /^\d{4}-\d{2}/.test(d.dateKey)) {
            return d.dateKey.slice(0, 7);
          }
          const parsed = parseDateFromLabelOrKey(d.dateLabel, d.dateKey);
          if (parsed && !isNaN(parsed.getTime())) {
            return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`;
          }
        }
      }
      return "";
    })();

    const webAppBaseUrl = getPublicWebAppUrl(deploymentUrl);
    const calendarLink = webAppBaseUrl
      ? `${webAppBaseUrl}?view=schedule${monthKey ? `&month=${monthKey}` : ""}`
      : "";

    let text =
      "Hi precious friends & neighbours,\n\nHere is the community cook and clean team schedule for next month:\n";
    if (calendarLink) {
      text += `View your shifts & add to phone calendar: ${calendarLink}\n\n`;
    } else {
      text += "\n";
    }
    for (const d of solverResult.schedule) {
      const isNoMeal = Boolean(
        d.isNoMeal ||
        (d.targetCookCount === 0 &&
          d.targetCleanCount === 0 &&
          d.cooks.length === 0 &&
          d.cleaners.length === 0) ||
        (d.specialNote &&
          /no community meal|no meal|auto-cancelled|volunteer deficit/i.test(d.specialNote) &&
          d.cooks.length === 0 &&
          d.cleaners.length === 0)
      );

      text += `${formatEmailDateHeader(d)}\n`;
      if (isNoMeal) {
        text += `NO COMMUNITY MEAL\n\n`;
      } else {
        if (d.cooks.length > 0) {
          text += `${d.cooks.join("\n")}\n`;
        } else {
          text += `(Need Volunteers)\n`;
        }
        text += `\n`;
        const cleanersList = d.cleaners.length > 0 ? d.cleaners.join(", ") : "(Need Volunteers)";
        text += `Cleaning: ${cleanersList}\n\n`;
      }
    }
    text += "Thank you all for making our meals happen!\n\nBest,\nBrenda";
    return text;
  };

  const handleCopyEmail = () => {
    const text = generateEmailText();
    navigator.clipboard.writeText(text);
    showToast("Email announcement copied to clipboard!");
  };

  // Send or Draft Email via Gmail
  const handleSendGmail = async (mode: "send" | "draft", skipWarning = false) => {
    if (!solverResult) return;
    const bodyToSend = generateEmailText();

    if (!emailTo.trim()) {
      showToast("Please provide a recipient or listserv email address.", "error");
      return;
    }

    // If an email has already been sent for this schedule and this is a send action, ask for confirmation first
    if (mode === "send" && emailDispatchInfo?.alreadySent && !skipWarning) {
      setShowResendConfirmModal(true);
      return;
    }

    setShowResendConfirmModal(false);
    setSendingEmail(true);

    const targetMonthKey =
      solverResult.schedule.length > 0 && solverResult.schedule[0].dateKey
        ? solverResult.schedule[0].dateKey.slice(0, 7)
        : undefined;

    try {
      const res = await callGas<EmailResult>("sendScheduleEmail", {
        to: emailTo.trim(),
        cc: emailCc.trim() || undefined,
        subject: emailSubject.trim() || formatDefaultSubject(),
        body: bodyToSend,
        mode,
        spreadsheetId: sheetInput,
        monthKey: targetMonthKey,
      });

      if (res.emailDispatchInfo) {
        setEmailDispatchInfo(res.emailDispatchInfo);
      } else if (mode === "send") {
        setEmailDispatchInfo({
          alreadySent: true,
          sentAt: new Date().toISOString(),
          to: emailTo.trim(),
          subject: emailSubject.trim() || formatDefaultSubject(),
          monthKey: targetMonthKey,
        });
      }

      setEmailDeliveryResult({
        success: res.success,
        mode: res.mode,
        message: res.message,
        recipient: emailTo.trim(),
      });
      showToast(res.message);
    } catch (err: any) {
      showToast(`Email error: ${err.message}`, "error");
    } finally {
      setSendingEmail(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 select-none relative overflow-hidden font-sans">
        {/* Background gradient decorative glow */}
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-orange-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-sm w-full text-center space-y-6 animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-500 flex items-center justify-center text-white shadow-xl shadow-orange-500/30 mx-auto animate-pulse">
            <Utensils className="w-8 h-8" />
          </div>

          <div className="space-y-1.5">
            <h1 className="text-xl font-extrabold text-white tracking-tight">Community Meals</h1>
            <p className="text-xs text-orange-400 font-semibold tracking-wider uppercase">
              Cook Team Planning Tool
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div className="bg-gradient-to-r from-orange-500 to-amber-400 h-1.5 rounded-full animate-progress" />
            </div>
            <p className="text-xs text-slate-400 flex items-center justify-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-orange-400" />
              <span>Connecting to Google Drive & loading surveys...</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (appView === "portal") {
    return (
      <>
        <PortalLandingView
          communityName={intakeData?.settings?.communityName || "Vancouver Cohousing"}
          monthTitle={publicMonthTitle}
          onSelectCoordinator={() => navigateToView("coordinator", { step: 1 })}
          onSelectResident={() => navigateToView("resident")}
          onSelectFormGenerator={() => handleOpenSurveyFormGenerator()}
        />
        {renderToast()}
      </>
    );
  }

  if (appView === "resident") {
    const params = getAppUrlParams();
    const initialName = urlMemberName || params.get("name") || params.get("user") || undefined;
    return (
      <>
        <ResidentScheduleView
          schedule={publicSchedule.length > 0 ? publicSchedule : solverResult?.schedule || []}
          members={members}
          monthTitle={publicMonthTitle}
          monthKey={publicMonthKey}
          availableMonths={publicAvailableMonths}
          communityName={intakeData?.settings?.communityName || "Vancouver Cohousing"}
          onSelectMonth={handleSelectPublicMonth}
          onSelectMember={(name) => setUrlMemberName(name)}
          initialMemberName={initialName}
          isLoading={loadingPublicSchedule}
          onBackToHome={() => navigateToView("portal")}
          onOpenCoordinator={() => navigateToView("coordinator", { step: 1 })}
        />
        {renderToast()}
      </>
    );
  }

  if (appView === "form-generator") {
    return (
      <>
        <SurveyFormGeneratorView
          monthKey={surveyFormMonthKey}
          setMonthKey={(mKey) => {
            setSurveyFormMonthKey(mKey);
            setSurveyFormResult(null);
            setSurveyFormExistingSurvey(null);
            navigateToView("form-generator", { month: mKey, replace: true });
          }}
          onClearFormResult={handleClearSurveyFormResult}
          loadDatesPreview={loadSurveyFormDatesPreview}
          formTitle={surveyFormTitle}
          setFormTitle={setSurveyFormTitle}
          folderId={surveyFormFolderId}
          setFolderId={setSurveyFormFolderId}
          dates={surveyFormDates}
          setDates={setSurveyFormDates}
          loadingDates={surveyFormLoadingDates}
          loadingCreate={surveyFormLoadingCreate}
          formResult={surveyFormResult}
          copiedLink={surveyFormCopiedLink}
          onCopyLink={handleCopySurveyLink}
          onAddCustomDate={handleAddCustomSurveyDate}
          onExecuteCreateForm={(targetMonth) => handleExecuteCreateSurveyForm(false, targetMonth)}
          members={members}
          coordinatorEmail={emailTo}
          spreadsheetId={sheetInput}
          driveSheets={driveSheets}
          monthStatus={surveyFormMonthStatus}
          existingSurvey={surveyFormExistingSurvey}
          onSaveDraftDates={(targetMonth) => handleSaveDraftDates(targetMonth)}
          onSaveDatesAndOpen={(targetMonth) => handleSaveMonthDatesAndOpen(targetMonth)}
          savingDates={surveyFormSavingDates}
          onSetMonthStatus={handleSetMonthStatus}
          deploymentUrl={deploymentUrl}
          onBackToHome={() => navigateToView("portal")}
          onOpenCoordinator={() => navigateToView("coordinator", { step: currentStep })}
          onOpenSchedule={() => navigateToView("resident", { month: surveyFormMonthKey })}
          onToast={showToast}
        />
        {showOverwriteSurveyModal && surveyFormExistingSurvey && (
          <OverwriteSurveyConfirmModal
            show={showOverwriteSurveyModal}
            onClose={() => setShowOverwriteSurveyModal(false)}
            onConfirm={() => {
              setShowOverwriteSurveyModal(false);
              handleExecuteCreateSurveyForm(true, surveyFormMonthKey);
            }}
            monthKey={surveyFormMonthKey}
            existingSurvey={surveyFormExistingSurvey}
            loading={surveyFormLoadingCreate}
          />
        )}
        {renderToast()}
      </>
    );
  }

  if (appView === "survey") {
    const params = getAppUrlParams();
    const initialName =
      urlMemberName || params.get("m") || params.get("name") || params.get("user") || undefined;
    const initialMonth = params.get("month") || publicMonthKey || surveyFormMonthKey || "2026-11";
    const initialSheet = params.get("sheetId") || sheetInput || undefined;

    return (
      <>
        <WebSurveySignupView
          monthKey={initialMonth}
          initialMemberName={initialName}
          spreadsheetId={initialSheet}
          members={members}
          mealDates={intakeData?.mealDates || []}
          existingResponses={intakeData?.responses || []}
          communityName={intakeData?.settings?.communityName || "Vancouver Cohousing"}
          onBackToHome={() => navigateToView("portal")}
          onNavigateToSchedule={(month) => navigateToView("resident", { month })}
        />
        {renderToast()}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col font-sans transition-colors">
      {/* Top Header */}
      <TopHeader
        communityName="Coordinator Hub"
        viewBadge={
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/60 text-orange-800 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
            Coordinator
          </span>
        }
        onBackToHome={() => navigateToView("portal")}
      >
        {/* Hamburger Menu Navigation */}
        <div className="relative" id="header-menu-container">
          <button
            onClick={() => setShowMainMenu(!showMainMenu)}
            className={`inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 min-h-[42px] rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer border shadow-2xs ${
              showMainMenu
                ? "bg-slate-900 text-white border-slate-900 shadow-md dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100"
                : "bg-slate-100 hover:bg-slate-200 text-slate-800 hover:text-slate-950 border-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 dark:hover:text-white dark:border-slate-700"
            }`}
            title="Menu Options & Community Tools"
            aria-label="Open Navigation Menu"
            aria-expanded={showMainMenu}
            aria-haspopup="true"
          >
            {showMainMenu ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5 text-slate-800 dark:text-slate-200" />
            )}
            <span className="font-bold">Menu</span>
          </button>

          {/* Floating Dropdown Menu */}
          {showMainMenu && (
            <div
              role="menu"
              aria-label="Community Tools Menu"
              className="absolute right-0 mt-2 w-72 sm:w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
            >
              <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <p className="text-xs font-extrabold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Community Tools
                </p>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                  {members.filter((m) => m.active).length} Active Members
                </span>
              </div>

              <div className="py-1">
                <button
                  role="menuitem"
                  onClick={() => {
                    setShowMainMenu(false);
                    handleOpenSurveyFormGenerator();
                  }}
                  className="w-full px-4 py-3 min-h-[44px] flex items-center gap-3 hover:bg-orange-50 dark:hover:bg-orange-950/30 text-left transition-colors group cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-950/60 text-orange-800 dark:text-orange-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-orange-950 dark:group-hover:text-orange-300">
                      Survey Form Generator
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      Google Form &amp; sign-up builder
                    </div>
                  </div>
                </button>

                <button
                  role="menuitem"
                  onClick={() => {
                    setShowMainMenu(false);
                    setShowMealSignupModal(true);
                    initMealSignupModal();
                  }}
                  className="w-full px-4 py-3 min-h-[44px] flex items-center gap-3 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-left transition-colors group cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <ClipboardList className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-emerald-950 dark:group-hover:text-emerald-300">
                      Meal Sign-Up Generator
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      Rose&apos;s workbook publish tool
                    </div>
                  </div>
                </button>

                <button
                  role="menuitem"
                  onClick={() => {
                    setShowMainMenu(false);
                    setShowReportsModal(true);
                    scanReportMonths();
                  }}
                  className="w-full px-4 py-3 min-h-[44px] flex items-center gap-3 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-left transition-colors group cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-950 dark:group-hover:text-indigo-300">
                      Community Reports
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      Multi-month equity & history
                    </div>
                  </div>
                </button>

                <button
                  role="menuitem"
                  onClick={() => {
                    setShowMainMenu(false);
                    setShowMemberModal(true);
                  }}
                  className="w-full px-4 py-3 min-h-[44px] flex items-center gap-3 hover:bg-sky-50 dark:hover:bg-sky-950/30 text-left transition-colors group cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-xl bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-sky-950 dark:group-hover:text-sky-300 flex items-center justify-between">
                      <span>Member Directory</span>
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      Registry & active resident roster
                    </div>
                  </div>
                </button>

                <button
                  role="menuitem"
                  onClick={() => {
                    setShowMainMenu(false);
                    setShowSettingsModal(true);
                  }}
                  className="w-full px-4 py-3 min-h-[44px] flex items-center gap-3 hover:bg-amber-50 dark:hover:bg-amber-950/30 text-left transition-colors group cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Settings className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-amber-950 dark:group-hover:text-amber-300">
                      Settings & Database
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      Solver policy & Google Drive links
                    </div>
                  </div>
                </button>
              </div>

              <div className="px-4 py-3 mt-1 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/50 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                <span className="font-semibold text-slate-600 dark:text-slate-400">
                  Environment
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                    inGas
                      ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                      : "bg-amber-100 dark:bg-amber-950/60 text-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${inGas ? "bg-emerald-600 animate-pulse" : "bg-amber-600"}`}
                  />
                  {inGas ? "GAS Host Live" : "Local Mock Mode"}
                </span>
              </div>
            </div>
          )}
        </div>
      </TopHeader>

      {/* Toast Notification */}
      {renderToast()}

      {/* Step Wizard Navigation Bar */}
      <div
        className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-2xs transition-colors"
        role="navigation"
        aria-label="Wizard Steps"
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 sm:py-2.5 flex items-center justify-between gap-2 sm:gap-4">
          <nav className="flex items-center gap-1 sm:gap-2 md:gap-3" aria-label="Progress">
            {[
              { step: 1, title: "Intake & Audit", shortTitle: "Intake", icon: Users },
              { step: 2, title: "Notes & Rules", shortTitle: "Rules", icon: Settings },
              { step: 3, title: "Solve & Review", shortTitle: "Solve", icon: Calendar },
              { step: 4, title: "Publish & Email", shortTitle: "Publish", icon: Mail },
            ].map((item, idx, arr) => {
              const isActive = currentStep === item.step;
              const isDone = currentStep > item.step;

              return (
                <React.Fragment key={item.step}>
                  <button
                    onClick={() => goToStep(item.step as any)}
                    aria-current={isActive ? "step" : undefined}
                    aria-label={`Step ${item.step}: ${item.title}`}
                    title={`Step ${item.step}: ${item.title}`}
                    className={`min-h-[40px] sm:min-h-[42px] inline-flex items-center gap-1.5 sm:gap-2.5 px-2.5 sm:px-3.5 md:px-4 rounded-xl text-xs sm:text-sm font-bold border transition-all shrink-0 select-none cursor-pointer ${
                      isActive
                        ? "bg-orange-600 text-white border-orange-600 shadow-sm shadow-orange-600/25"
                        : isDone
                          ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60"
                          : "bg-transparent text-slate-600 dark:text-slate-400 border-transparent hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                        isActive
                          ? "bg-white text-orange-700 shadow-2xs"
                          : isDone
                            ? "bg-emerald-700 text-white"
                            : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {isDone ? <CheckCircle2 className="w-4 h-4" /> : item.step}
                    </span>
                    <span className="hidden md:inline">{item.title}</span>
                    <span className="hidden sm:inline md:hidden">{item.shortTitle}</span>
                  </button>

                  {idx < arr.length - 1 && (
                    <ChevronRight
                      aria-hidden="true"
                      className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 transition-colors ${
                        currentStep > item.step
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-slate-300 dark:text-slate-700"
                      }`}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </nav>

          <button
            onClick={() => fetchIntake(sheetInput, undefined, true)}
            disabled={loading}
            className="min-h-[40px] sm:min-h-[42px] inline-flex items-center gap-2 px-3 sm:px-3.5 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs sm:text-sm font-bold shrink-0 transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer disabled:opacity-50"
            title="Refresh Survey Data"
            aria-label="Refresh survey response data from Google Sheets"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-orange-600" : ""}`} />
            <span className="hidden sm:inline">Refresh Data</span>
          </button>
        </div>
      </div>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full space-y-6">
        {currentStep === 1 && (
          <Step1IntakeAudit
            sheetInput={sheetInput}
            setSheetInput={setSheetInput}
            sheetSelectMode={sheetSelectMode}
            handleSelectSheetOption={handleSelectSheetOption}
            fetchIntake={fetchIntake}
            loading={loading}
            isDevMode={isDevMode}
            liveSheetsList={liveSheetsList}
            devSheetsList={devSheetsList}
            intakeData={intakeData}
            members={members}
            handleLoadExistingSchedule={handleLoadExistingSchedule}
            linkingAliasFor={linkingAliasFor}
            selectedCanonicalLinkMap={selectedCanonicalLinkMap}
            setSelectedCanonicalLinkMap={setSelectedCanonicalLinkMap}
            handleLinkMemberAlias={handleLinkMemberAlias}
            handleAddMember={handleAddMember}
            updatingMemberName={updatingMemberName}
            handleMarkInactive={handleMarkInactive}
            handleOpenManualSurveyModal={handleOpenManualSurveyModal}
            goToStep={goToStep}
            onToggleMonthStatus={(newStatus) => {
              const intakeMonth = intakeData?.mealDates?.[0]?.dateKey?.slice(0, 7);
              handleSetMonthStatus(newStatus, intakeMonth);
            }}
          />
        )}

        {currentStep === 2 && intakeData && (
          <Step2NotesRules
            membersRequiringAttention={membersRequiringAttention}
            handleOpenAddGenericRule={handleOpenAddGenericRule}
            handleOpenAddWhitelistRule={handleOpenAddWhitelistRule}
            handleOpenAddRuleForMember={handleOpenAddRuleForMember}
            handleOpenEditRule={handleOpenEditRule}
            handleDeleteRule={handleDeleteRule}
            goToStep={goToStep}
            handleRunSolver={handleRunSolver}
            loading={loading}
          />
        )}

        {currentStep === 3 && (
          <Step3SolveReview
            solverResult={solverResult}
            loading={loading}
            intakeData={intakeData}
            showNonParticipatingQuota={showNonParticipatingQuota}
            setShowNonParticipatingQuota={setShowNonParticipatingQuota}
            handleRunSolver={handleRunSolver}
            handleCancelMeal={handleCancelMeal}
            handleRestoreMeal={handleRestoreMeal}
            setSelectedNearCompleteDateKey={setSelectedNearCompleteDateKey}
            setSelectedQuotaMember={setSelectedQuotaMember}
            setSelectedQuotaFocusDateKey={setSelectedQuotaFocusDateKey}
            setSelectedSlotToFill={setSelectedSlotToFill}
            goToStep={goToStep}
          />
        )}

        {currentStep === 4 && solverResult && (
          <Step4PublishEmail
            solverResult={solverResult}
            exportedResult={exportedResult}
            sheetInput={sheetInput}
            loading={loading}
            handleExportSheet={handleExportSheet}
            handleCopyEmail={handleCopyEmail}
            handleSendGmail={handleSendGmail}
            sendingEmail={sendingEmail}
            emailDispatchInfo={emailDispatchInfo}
            emailDeliveryResult={emailDeliveryResult}
            emailTo={emailTo}
            setEmailTo={setEmailTo}
            emailCc={emailCc}
            setEmailCc={setEmailCc}
            DEFAULT_ANNOUNCEMENT_TO={announcementTo}
            DEFAULT_ANNOUNCEMENT_CC={announcementCc}
            DEV_TEST_EMAIL={DEV_TEST_EMAIL}
            emailSubject={emailSubject}
            setEmailSubject={setEmailSubject}
            isEmailSubjectDirty={isEmailSubjectDirty}
            customEmailBody={customEmailBody}
            setCustomEmailBody={setCustomEmailBody}
            generateEmailText={generateEmailText}
            goToStep={goToStep}
            parseDateFromLabelOrKey={parseDateFromLabelOrKey}
          />
        )}
      </main>

      {/* Modals */}
      <MemberDirectoryModal
        show={showMemberModal}
        onClose={() => setShowMemberModal(false)}
        members={members}
        showBulkImport={showBulkImport}
        setShowBulkImport={setShowBulkImport}
        bulkImportText={bulkImportText}
        setBulkImportText={setBulkImportText}
        parsedBulkMembers={parsedBulkMembers}
        bulkImportSaving={bulkImportSaving}
        handleBulkImportSave={handleBulkImportSave}
        newMemberName={newMemberName}
        setNewMemberName={setNewMemberName}
        newMemberEmail={newMemberEmail}
        setNewMemberEmail={setNewMemberEmail}
        newMemberAliases={newMemberAliases}
        setNewMemberAliases={setNewMemberAliases}
        handleAddMember={handleAddMember}
        memberFilter={memberFilter}
        setMemberFilter={setMemberFilter}
        memberSearchQuery={memberSearchQuery}
        setMemberSearchQuery={setMemberSearchQuery}
        updatingMemberName={updatingMemberName}
        editingMember={editingMember}
        setEditingMember={setEditingMember}
        handleSaveEditedMember={handleSaveEditedMember}
        isSavingMember={isSavingMember}
        handleToggleMember={handleToggleMember}
      />

      <RuleConfigModal
        show={showAddRuleModal}
        onClose={() => setShowAddRuleModal(false)}
        newRule={newRule}
        setNewRule={setNewRule}
        modalContextNote={modalContextNote}
        members={members}
        handleSaveRule={handleSaveRule}
      />

      <WhitelistRuleModal
        show={showWhitelistModal}
        onClose={() => {
          setShowWhitelistModal(false);
          setEditingWhitelistRule(null);
        }}
        ruleToEdit={editingWhitelistRule}
        members={members}
        onSaveRule={handleSaveWhitelistRule}
      />

      <MemberCalendarInspectorModal
        selectedQuotaMember={selectedQuotaMember}
        onClose={() => setSelectedQuotaMember(null)}
        solverResult={solverResult}
        intakeData={intakeData}
        selectedQuotaFocusDateKey={selectedQuotaFocusDateKey}
        checkAssignmentConflict={checkAssignmentConflict}
        handleAddExtraShift={handleAddExtraShift}
        handleRemoveShift={handleRemoveShift}
      />

      <FillMissingSlotModal
        selectedSlotToFill={selectedSlotToFill}
        onClose={() => setSelectedSlotToFill(null)}
        solverResult={solverResult}
        intakeData={intakeData}
        checkAssignmentConflict={checkAssignmentConflict}
        handleAddExtraShift={handleAddExtraShift}
      />

      <GlobalSettingsModal
        show={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        cookPolicy={cookPolicy}
        setCookPolicy={setCookPolicy}
        defaultCleanQuota={defaultCleanQuota}
        setDefaultCleanQuota={setDefaultCleanQuota}
        autoCancelDeficitDates={autoCancelDeficitDates}
        setAutoCancelDeficitDates={setAutoCancelDeficitDates}
        announcementTo={announcementTo}
        setAnnouncementTo={setAnnouncementTo}
        announcementCc={announcementCc}
        setAnnouncementCc={setAnnouncementCc}
        DEFAULT_ANNOUNCEMENT_TO={DEFAULT_ANNOUNCEMENT_TO}
        DEFAULT_ANNOUNCEMENT_CC={DEFAULT_ANNOUNCEMENT_CC}
        masterSheetInput={masterSheetInput}
        setMasterSheetInput={setMasterSheetInput}
        signupWorkbookId={mealSignupTargetWorkbookId}
        setSignupWorkbookId={setMealSignupTargetWorkbookId}
        driveFolderId={driveFolderId}
        setDriveFolderId={setDriveFolderId}
        handleCreateLaunchers={handleCreateLaunchers}
        handleProvisionDrive={handleProvisionDrive}
        provisioning={provisioning}
        provisionResult={provisionResult}
        betaWebSignupEnabled={betaWebSignupEnabled}
        setBetaWebSignupEnabled={setBetaWebSignupEnabled}
        onSaveAndRecalculate={async () => {
          setShowSettingsModal(false);
          try {
            await callGas(
              "saveMasterSettings",
              {
                announcementTo,
                announcementCc,
                cookPolicy,
                defaultCleanQuota,
                autoCancelDeficitDates,
                signupWorkbookId: mealSignupTargetWorkbookId,
                betaWebSignupEnabled,
              },
              masterSheetInput
            );
            showToast("Settings saved to Master Community Registry!");
          } catch (e: any) {
            console.warn("Could not save settings to master registry:", e);
          }
          handleRunSolver();
        }}
      />

      <SwapShiftsModal
        swapModal={swapModal}
        onClose={() => setSwapModal(null)}
        solverResult={solverResult}
        intakeData={intakeData}
        swapSearchText={swapSearchText}
        setSwapSearchText={setSwapSearchText}
        handleExecuteSwap={handleExecuteSwap}
      />

      <CommunityReportsModal
        show={showReportsModal}
        onClose={() => setShowReportsModal(false)}
        availableReportMonths={availableReportMonths}
        selectedReportMonths={selectedReportMonths}
        setSelectedReportMonths={setSelectedReportMonths}
        loadingReport={loadingReport}
        communityReport={communityReport}
        reportSearch={reportSearch}
        setReportSearch={setReportSearch}
        reportSort={reportSort}
        setReportSort={setReportSort}
        fetchCommunityReports={fetchCommunityReports}
      />

      <MealSignupGeneratorModal
        show={showMealSignupModal}
        onClose={() => setShowMealSignupModal(false)}
        mealSignupModalBodyRef={mealSignupModalBodyRef}
        mealSignupExportResult={mealSignupExportResult}
        mealSignupSchedule={mealSignupSchedule}
        mealSignupSourceSheet={mealSignupSourceSheet}
        setMealSignupSourceSheet={setMealSignupSourceSheet}
        initMealSignupModal={initMealSignupModal}
        solverResult={solverResult}
        liveSheetsList={liveSheetsList}
        devSheetsList={devSheetsList}
        mealSignupTargetWorkbookId={mealSignupTargetWorkbookId}
        setMealSignupTargetWorkbookId={setMealSignupTargetWorkbookId}
        checkTargetWorkbook={checkTargetWorkbook}
        mealSignupWorkbookError={mealSignupWorkbookError}
        mealSignupWorkbookInfo={mealSignupWorkbookInfo}
        mealSignupLoadingWorkbook={mealSignupLoadingWorkbook}
        mealSignupTargetTabName={mealSignupTargetTabName}
        setMealSignupTargetTabName={setMealSignupTargetTabName}
        mealSignupBackupExisting={mealSignupBackupExisting}
        setMealSignupBackupExisting={setMealSignupBackupExisting}
        mealSignupHideOlder={mealSignupHideOlder}
        setMealSignupHideOlder={setMealSignupHideOlder}
        mealSignupLoadingInfo={mealSignupLoadingInfo}
        mealSignupCustomDeadlines={mealSignupCustomDeadlines}
        setMealSignupCustomDeadlines={setMealSignupCustomDeadlines}
        mealSignupCustomDayLabels={mealSignupCustomDayLabels}
        setMealSignupCustomDayLabels={setMealSignupCustomDayLabels}
        handleExecuteMealSignupExport={handleExecuteMealSignupExport}
        mealSignupLoadingExport={mealSignupLoadingExport}
      />

      {showOverwriteSurveyModal && surveyFormExistingSurvey && (
        <OverwriteSurveyConfirmModal
          show={showOverwriteSurveyModal}
          onClose={() => setShowOverwriteSurveyModal(false)}
          onConfirm={() => {
            setShowOverwriteSurveyModal(false);
            handleExecuteCreateSurveyForm(true);
          }}
          monthKey={surveyFormMonthKey}
          existingSurvey={surveyFormExistingSurvey}
          loading={surveyFormLoadingCreate}
        />
      )}

      <NearCompleteOpportunityModal
        selectedNearCompleteDateKey={selectedNearCompleteDateKey}
        onClose={() => setSelectedNearCompleteDateKey(null)}
        solverResult={solverResult}
        recoverySelectedCooks={recoverySelectedCooks}
        setRecoverySelectedCooks={setRecoverySelectedCooks}
        recoverySelectedCleaners={recoverySelectedCleaners}
        setRecoverySelectedCleaners={setRecoverySelectedCleaners}
        handleRestoreWithSelectedVolunteers={handleRestoreWithSelectedVolunteers}
      />

      <ResendConfirmModal
        show={showResendConfirmModal}
        onClose={() => setShowResendConfirmModal(false)}
        onConfirm={() => handleSendGmail("send", true)}
        emailDispatchInfo={emailDispatchInfo}
        emailTo={emailTo}
      />

      <ManualSurveyResponseModal
        isOpen={showManualSurveyModal}
        onClose={() => setShowManualSurveyModal(false)}
        intakeData={intakeData}
        members={members}
        initialMemberName={manualSurveyTargetMember}
        onSubmit={handleSubmitManualSurveyResponse}
        loading={manualSurveySaving}
      />

      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-3.5 text-center text-xs text-slate-500 dark:text-slate-400 transition-colors">
        Community Cook Team App • Built for Community Meal Coordinators • Google Apps Script & React
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}

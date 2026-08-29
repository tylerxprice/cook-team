import React, { useState, useEffect, useMemo } from "react";
import {
  Utensils,
  Sparkles,
  Users,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Settings,
  Plus,
  Trash2,
  Pencil,
  Copy,
  Download,
  RefreshCw,
  Clock,
  Mail,
  ShieldCheck,
  UserX,
  UserCheck,
  ChevronRight,
  ExternalLink,
  Info,
  MessageSquare,
  UserPlus,
  Search,
  XCircle,
  Folder,
  FileSpreadsheet,
  Send,
  FileText,
} from "lucide-react";
import { callGas, isGasEnvironment } from "./utils/gas";
import {
  IntakePayload,
  MealDate,
  SurveyResponse,
  ExceptionRule,
  Member,
  ScheduleOutput,
  CookTeamPolicy,
  RuleType,
  Role,
} from "../server/types";

function getOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("UI Error Caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6 font-sans">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-xl border border-rose-200 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-slate-900">Application Error</h2>
            <p className="text-xs text-slate-600">
              An unexpected error occurred during rendering. Here are the details:
            </p>
            <p className="text-xs text-rose-700 font-mono bg-rose-50 p-3 rounded-lg text-left break-all border border-rose-200">
              {this.state.error?.message || "Unknown error"}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function MainApp() {
  const [inGas, setInGas] = useState(false);
  const [isDevMode, setIsDevMode] = useState<boolean>(!isGasEnvironment());
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStepState] = useState<1 | 2 | 3 | 4>(1);
  const [notification, setNotification] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // Synchronize wizard navigation with browser history (Back / Forward buttons)
  const goToStep = (step: 1 | 2 | 3 | 4, replace = false) => {
    setCurrentStepState(step);
    const hash = `#step-${step}`;
    if (window.location.hash !== hash) {
      if (replace) {
        window.history.replaceState({ step }, "", hash);
      } else {
        window.history.pushState({ step }, "", hash);
      }
    }
    window.scrollTo({ top: 0, behavior: "smooth" });

    // Auto-export when navigating to Step 4 if a schedule is generated
    if (step === 4 && solverResult) {
      handleExportSheet(solverResult);
    }
  };

  const [sheetInput, setSheetInput] = useState("");

  // Core Data States
  const [intakeData, setIntakeData] = useState<IntakePayload | null>(null);
  const [exceptions, setExceptions] = useState<ExceptionRule[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [cookPolicy, setCookPolicy] = useState<CookTeamPolicy>("ADAPTIVE_3_OR_2");
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
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [showAddRuleModal, setShowAddRuleModal] = useState(false);
  const [modalContextNote, setModalContextNote] = useState<string | null>(null);
  const [selectedQuotaMember, setSelectedQuotaMember] = useState<string | null>(null);
  const [selectedSlotToFill, setSelectedSlotToFill] = useState<{ dateKey: string; dateLabel: string; role: Role } | null>(null);
  const [newRule, setNewRule] = useState<Partial<ExceptionRule>>({
    rule_type: "NOT_SAME_TEAM",
    is_hard_rule: true,
    person_a: "",
    person_b: "",
    notes: "",
  });

  const [driveSheets, setDriveSheets] = useState<any[]>([]);
  const [sheetSelectMode, setSheetSelectMode] = useState<string>("");
  const [exportedResult, setExportedResult] = useState<{ success: boolean; sheetName: string; url?: string; message: string } | null>(null);

  const [selectedPreset, setSelectedPreset] = useState<string>("standard");

  const LIVE_LISTSERV_EMAIL = "Vancouver Cohousing Residents <vancoho-residents@googlegroups.com>";
  const DEV_TEST_EMAIL = "tylerxprice@gmail.com";

  // Helper to format subject line in Brenda's standard format: "MEAL SCHEDULE - Month 1 - Month 31 - Please Note Your Dates"
  const formatDefaultSubject = (dates?: MealDate[] | DaySchedule[]) => {
    const list = dates || solverResult?.schedule || intakeData?.mealDates;
    if (list && list.length > 0) {
      const firstDate = list[0].dateKey;
      try {
        const d1 = new Date(`${firstDate}T00:00:00`);
        const monthName = d1.toLocaleString("en-US", { month: "long" });
        const year = d1.getFullYear();
        const lastDayOfMonth = new Date(year, d1.getMonth() + 1, 0).getDate();
        return `MEAL SCHEDULE - ${monthName} 1 - ${monthName} ${lastDayOfMonth} - Please Note Your Dates`;
      } catch (e) {
        // fallback
      }
    }
    return "MEAL SCHEDULE - October 1 - October 31 - Please Note Your Dates";
  };

  // Email Dispatch States
  const [emailTo, setEmailTo] = useState(isGasEnvironment() ? LIVE_LISTSERV_EMAIL : DEV_TEST_EMAIL);
  const [emailSubject, setEmailSubject] = useState("MEAL SCHEDULE - October 1 - October 31 - Please Note Your Dates");
  const [customEmailBody, setCustomEmailBody] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailDeliveryResult, setEmailDeliveryResult] = useState<{
    success: boolean;
    mode: "send" | "draft";
    message: string;
    recipient: string;
  } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
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
      (s) => s.folderCategory === "live" || s.folderName?.includes("Monthly") || s.folderName?.includes("Live") || s.folderName?.includes("01_Live")
    );
    const hasOct = list.some(
      (s) => s.id === "1GHPTpg1Mk8gIUxij1eB-_P4RDmPhfEIMwoVYMMTo5A4" || s.name?.includes("2026-10")
    );
    const merged = !hasOct
      ? [
          {
            id: "1GHPTpg1Mk8gIUxij1eB-_P4RDmPhfEIMwoVYMMTo5A4",
            name: "2026-10 Cook Team Survey (Responses) — Oct 2026 Form",
            folderCategory: "live",
          },
          ...list,
        ]
      : list;

    return [...merged].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
    );
  }, [driveSheets, isDevMode]);

  const devSheetsList = useMemo(() => {
    if (!isDevMode) {
      return [];
    }
    const list = driveSheets.filter(
      (s) => s.folderCategory === "dev" || s.folderName?.includes("Dev") || s.folderName?.includes("02_Dev") || s.name?.includes("Test Scenario")
    );
    const baseList =
      list.length > 0
        ? list
        : [
            { id: "test-sheet-standard", name: "Test Scenario 1 - Standard Healthy (30 responses, 0 unfilled)" },
            { id: "test-sheet-holiday", name: "Test Scenario 2 - Holiday Desertion (Oct 11-12 shortage)" },
            { id: "test-sheet-deficit", name: "Test Scenario 3 - Quota Shortfall (Cook quota deficit)" },
            { id: "test-sheet-conflict", name: "Test Scenario 4 - High Conflict (8 entangled rules)" },
            { id: "test-sheet-single", name: "Test Scenario 5 - Single Respondent (Tyler live test)" },
            { id: "test-sheet-saved", name: "Test Scenario 6 - Existing Saved Schedule (Resume in Step 3)" },
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
      setEmailTo(LIVE_LISTSERV_EMAIL);
      await fetchIntake(optionValue);
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
      setEmailSubject(formatDefaultSubject(data.mealDates));
      setSolverResult(null);
      showToast(`Loaded test scenario: ${presetKey}`);
      if (currentStep === 3) {
        const res = await callGas<ScheduleOutput>(
          "solveSchedule",
          data.mealDates,
          data.responses,
          data.exceptions || [],
          { cookPolicy, maxCleanPerMember: defaultCleanQuota }
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
  const fetchIntake = async (sheetId?: string, masterId?: string) => {
    const targetSheet = sheetId || sheetInput;
    if (!targetSheet || targetSheet.trim() === "") {
      return;
    }
    setLoading(true);
    try {
      const data = await callGas<IntakePayload>(
        "getIntakeData",
        targetSheet,
        masterId || masterSheetInput
      );
      setIntakeData(data);
      setExceptions(data.exceptions || []);
      setMembers(data.members || []);
      setEmailSubject(formatDefaultSubject(data.mealDates));
      if (!targetSheet.startsWith("test-sheet-")) {
        setEmailTo(LIVE_LISTSERV_EMAIL);
      }
      showToast(`Loaded ${data.responses.length} survey responses across ${data.mealDates.length} meals.`);
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

  useEffect(() => {
    setInGas(isGasEnvironment());
    const init = async () => {
      try {
        const info = await callGas<any>("getUserInfo");
        const devMode = info && typeof info.isDevMode === "boolean" ? info.isDevMode : !isGasEnvironment();
        setIsDevMode(devMode);
        if (devMode) {
          setEmailTo(DEV_TEST_EMAIL);
        } else {
          setEmailTo(LIVE_LISTSERV_EMAIL);
        }

        const regData = await callGas<any>("getMasterRegistryData", devMode);
        if (regData && Array.isArray(regData.members) && regData.members.length > 0) {
          setMembers(regData.members);
          setExceptions(regData.exceptions || []);
        }

        await fetchDriveSheets();
      } catch (err) {
        console.warn("Init error:", err);
      } finally {
        setInitialLoading(false);
      }
    };
    init();

    // Check if initial URL has a step hash (e.g. #step-2)
    const parseStepFromHash = (): 1 | 2 | 3 | 4 => {
      const match = window.location.hash.match(/#step-([1-4])/);
      if (match) {
        const parsed = parseInt(match[1], 10);
        if ([1, 2, 3, 4].includes(parsed)) return parsed as 1 | 2 | 3 | 4;
      }
      return 1;
    };

    const initialStep = parseStepFromHash();
    setCurrentStepState(initialStep);
    window.history.replaceState({ step: initialStep }, "", `#step-${initialStep}`);

    // Listen for browser Back & Forward button presses
    const handlePopState = (e: PopStateEvent) => {
      if (e.state && typeof e.state.step === "number" && [1, 2, 3, 4].includes(e.state.step)) {
        setCurrentStepState(e.state.step as 1 | 2 | 3 | 4);
      } else {
        const step = parseStepFromHash();
        setCurrentStepState(step);
      }
    };

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("hashchange", handlePopState);

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

  // Handle Mark Inactive on Audit Screen
  const handleMarkInactive = async (memberName: string) => {
    try {
      await callGas("setMemberActiveStatus", memberName, false);
      if (intakeData) {
        const updatedMissing = intakeData.audit.missingMembers.filter(
          (m) => m.name.toLowerCase() !== memberName.toLowerCase()
        );
        const updatedMembers = members.map((m) =>
          m.name.toLowerCase() === memberName.toLowerCase() ? { ...m, active: false } : m
        );
        setIntakeData({
          ...intakeData,
          audit: { ...intakeData.audit, missingMembers: updatedMissing },
          members: updatedMembers,
        });
        setMembers(updatedMembers);
      }
      showToast(`Marked ${memberName} as inactive.`);
    } catch (err: any) {
      showToast(`Error: ${err.message}`, "error");
    }
  };

  // Handle Member Toggle
  const handleToggleMember = async (name: string, currentActive: boolean) => {
    try {
      await callGas("setMemberActiveStatus", name, !currentActive);
      const updated = members.map((m) =>
        m.name.toLowerCase() === name.toLowerCase() ? { ...m, active: !currentActive } : m
      );
      setMembers(updated);
      showToast(`Updated ${name} status to ${!currentActive ? "Active" : "Inactive"}.`);
    } catch (err: any) {
      showToast(`Error: ${err.message}`, "error");
    }
  };

  // Add Member
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;
    const newM: Member = {
      name: newMemberName.trim(),
      google_email: newMemberEmail.trim() || undefined,
      active: true,
      last_active_survey: new Date().toISOString().slice(0, 7),
    };
    try {
      const updated = await callGas<Member[]>(
        "addCommunityMember",
        newM,
        masterSheetInput
      );
      setMembers(updated);
      setNewMemberName("");
      setNewMemberEmail("");
      showToast(`Added ${newM.name} to community registry.`);
    } catch (err: any) {
      showToast(`Failed to add member: ${err.message}`, "error");
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
      const updated = await callGas<ExceptionRule[]>("saveExceptionRule", rule);
      setExceptions(updated);
      setShowAddRuleModal(false);
      setNewRule({ rule_type: "NOT_SAME_TEAM", is_hard_rule: true, person_a: "", person_b: "", notes: "" });
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

  const handleOpenEditRule = (rule: ExceptionRule) => {
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

      if (rule.person_b) {
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
      if (a.specialInstructions && !b.specialInstructions) return -1;
      if (!a.specialInstructions && b.specialInstructions) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [intakeData, exceptions]);

  const handleDeleteRule = async (id: string) => {
    try {
      const updated = await callGas<ExceptionRule[]>("deleteExceptionRule", id);
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
        if (role === "COOK") {
          if (day.cooks.includes(memberName)) return day;
          return {
            ...day,
            cooks: [...day.cooks, memberName],
            unfilledCooks: Math.max(0, day.unfilledCooks - 1),
          };
        } else {
          if (day.cleaners.includes(memberName)) return day;
          return {
            ...day,
            cleaners: [...day.cleaners, memberName],
            unfilledCleaners: Math.max(0, day.unfilledCleaners - 1),
          };
        }
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

    showToast(`Added ${memberName} as extra ${role === "COOK" ? "cook" : "cleaner"} on ${dateKey}!`);
  };

  const handleRemoveShift = (dateKey: string, memberName: string, role: Role) => {
    if (!solverResult) return;
    const updatedSchedule = solverResult.schedule.map((day) => {
      if (day.dateKey === dateKey) {
        if (role === "COOK") {
          return {
            ...day,
            cooks: day.cooks.filter((c) => c !== memberName),
            unfilledCooks: Math.max(0, day.targetCookCount - (day.cooks.length - 1)),
          };
        } else {
          return {
            ...day,
            cleaners: day.cleaners.filter((c) => c !== memberName),
            unfilledCleaners: Math.max(0, day.targetCleanCount - (day.cleaners.length - 1)),
          };
        }
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
        { cookPolicy: activePolicy, maxCleanPerMember: Number(defaultCleanQuota) || 1 }
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
      setSolverResult(res);
      goToStep(3);
      showToast(`Loaded saved schedule tab "${intakeData?.existingScheduleTab?.name || "Schedule"}"!`);
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
      const res = await callGas<{ success: boolean; sheetName: string; url?: string; message: string }>(
        "exportScheduleToSheet",
        sheetInput,
        activeResult
      );
      setExportedResult(res);
      showToast(res.message);
    } catch (err: any) {
      showToast(`Export failed: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  // Helper to format clean, non-redundant date headings in the email announcement
  const formatEmailDateHeader = (d: DaySchedule) => {
    let label = d.dateLabel.trim();
    const lowerLabel = label.toLowerCase();
    const isBrunch = d.mealType === "BRUNCH" || lowerLabel.includes("brunch");

    // Clean specialNote: discard if it's just "BRUNCH"/"DINNER" or already present in label
    let note = d.specialNote?.trim();
    if (note) {
      const lowerNote = note.toLowerCase();
      if (
        lowerNote === "brunch" ||
        lowerNote === "dinner" ||
        lowerLabel.includes(lowerNote)
      ) {
        note = undefined;
      }
    }

    // Only append (Brunch) or (Dinner) if not already explicitly stated in label
    if (!lowerLabel.includes("brunch") && !lowerLabel.includes("dinner")) {
      const typeStr = isBrunch ? "Brunch" : "Dinner";
      label = `${label} (${typeStr})`;
    }

    if (note) {
      label = `${label} - ${note}`;
    }

    return `📅 ${label}`;
  };

  // Generate Email Summary Text
  const generateEmailText = () => {
    if (customEmailBody !== null) return customEmailBody;
    if (!solverResult) return "";
    let text = "Hi precious friends & neighbours,\n\nHere is the community cook and clean team schedule for next month:\n\n";
    for (const d of solverResult.schedule) {
      text += `${formatEmailDateHeader(d)}\n`;
      text += `  • Cooks: ${d.cooks.join(", ") || "(Need Volunteers)"}\n`;
      text += `  • Cleaners: ${d.cleaners.join(", ") || "(Need Volunteers)"}\n\n`;
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
  const handleSendGmail = async (mode: "send" | "draft") => {
    if (!solverResult) return;
    const bodyToSend = generateEmailText();

    if (!emailTo.trim()) {
      showToast("Please provide a recipient or listserv email address.", "error");
      return;
    }

    setSendingEmail(true);
    try {
      const res = await callGas<{
        success: boolean;
        mode: "send" | "draft";
        message: string;
        recipientCount: number;
      }>("sendScheduleEmail", {
        to: emailTo.trim(),
        subject: emailSubject.trim() || formatDefaultSubject(),
        body: bodyToSend,
        mode,
      });

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
            <h1 className="text-xl font-extrabold text-white tracking-tight">
              Vancouver Cohousing
            </h1>
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-500 flex items-center justify-center text-white shadow-md shadow-orange-500/20">
              <Utensils className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-slate-900">
                Community Cook Team App
              </h1>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            <button
              onClick={() => setShowMemberModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
            >
              <Users className="w-4 h-4 text-slate-500" />
              <span className="hidden md:inline">Member Directory</span>
              <span className="md:hidden">Directory</span> ({members.filter((m) => m.active).length})
            </button>

            <button
              onClick={() => setShowSettingsModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
              title="Global Application & Solver Settings"
            >
              <Settings className="w-4 h-4 text-slate-500" />
              <span>Settings</span>
            </button>

            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                inGas
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-amber-50 text-amber-700 border border-amber-200"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${inGas ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
              {inGas ? "GAS Host Live" : "Local Mock Mode"}
            </span>
          </div>
        </div>
      </header>

      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-16 right-6 z-50 px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 text-xs font-medium text-white transition-all transform animate-in fade-in slide-in-from-top-4 ${
            notification.type === "success" ? "bg-slate-900" : "bg-rose-600"
          }`}
        >
          {notification.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-300" />
          )}
          <span>{notification.msg}</span>
        </div>
      )}

      {/* Step Wizard Navigation Bar */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex items-center justify-between gap-4">
          <nav className="flex items-center gap-1.5 sm:gap-2.5 overflow-x-auto">
            {[
              { step: 1, title: "Intake & Audit", icon: Users },
              { step: 2, title: "Notes & Rules", icon: Settings },
              { step: 3, title: "Solve & Review", icon: Calendar },
              { step: 4, title: "Publish & Email", icon: Mail },
            ].map((item, idx, arr) => {
              const isActive = currentStep === item.step;
              const isDone = currentStep > item.step;

              return (
                <React.Fragment key={item.step}>
                  <button
                    onClick={() => goToStep(item.step as any)}
                    className={`h-9 inline-flex items-center gap-2 px-3.5 rounded-xl text-xs sm:text-sm font-semibold border transition-all shrink-0 select-none ${
                      isActive
                        ? "bg-orange-500 text-white border-orange-500 shadow-sm shadow-orange-500/25"
                        : isDone
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100/80"
                        : "bg-transparent text-slate-500 border-transparent hover:text-slate-900 hover:bg-slate-100"
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 transition-colors ${
                        isActive
                          ? "bg-white text-orange-600 shadow-xs"
                          : isDone
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : item.step}
                    </span>
                    <span>{item.title}</span>
                  </button>

                  {idx < arr.length - 1 && (
                    <ChevronRight
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        currentStep > item.step ? "text-emerald-500" : "text-slate-300"
                      }`}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </nav>

          <button
            onClick={() => fetchIntake()}
            disabled={loading}
            className="h-9 inline-flex items-center gap-1.5 px-3 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg text-xs font-semibold shrink-0 transition-colors border border-transparent"
            title="Refresh Survey Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full space-y-6">
        {/* STEP 1: INTAKE & COMPLETENESS AUDIT */}
        {currentStep === 1 && (
          <div className="space-y-6">
            {/* Sheet Link & Dropdown Selector Card */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    Survey Response Spreadsheet
                  </h2>
                  <p className="text-xs text-slate-500">
                    Select a monthly survey response sheet from Google Drive or choose a test scenario
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {sheetInput && (
                    <a
                      href={sheetInput.startsWith("http") ? sheetInput : `https://docs.google.com/spreadsheets/d/${sheetInput}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors"
                      title="Open spreadsheet in Google Sheets"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open in Sheets</span>
                    </a>
                  )}
                  <button
                    onClick={() => fetchIntake(sheetInput)}
                    disabled={loading || !sheetInput}
                    className="px-4 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                    <span>{loading ? "Loading..." : "Load Sheet"}</span>
                  </button>
                </div>
              </div>

              {/* Sheet Dropdown Selector */}
              <div className="space-y-2">
                <select
                  value={sheetSelectMode}
                  onChange={(e) => handleSelectSheetOption(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 hover:bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 font-medium text-slate-800 transition-colors cursor-pointer"
                >
                  <option value="" disabled>
                    {isDevMode
                      ? "-- Select a Test Scenario to Begin --"
                      : "-- Select a Monthly Survey to Begin --"}
                  </option>
                  {!isDevMode && liveSheetsList.length > 0 && (
                    <optgroup label="📁 Monthly Surveys (01_Live_Production)">
                      {liveSheetsList.map((s) => (
                        <option key={s.id} value={s.id}>
                          📄 {s.name}
                        </option>
                      ))}
                    </optgroup>
                  )}

                  {isDevMode && devSheetsList.length > 0 && (
                    <optgroup label="🧪 Dev / Test Scenarios (02_Dev_and_Testing)">
                      {devSheetsList.map((s) => (
                        <option key={s.id} value={s.id}>
                          🧪 {s.name}
                        </option>
                      ))}
                    </optgroup>
                  )}

                  <optgroup label="🔗 Custom Input">
                    <option value="custom">✏️ Paste Custom Google Sheet URL or ID...</option>
                  </optgroup>
                </select>

                {sheetSelectMode === "custom" && (
                  <div className="pt-2">
                    <input
                      type="text"
                      value={sheetInput}
                      onChange={(e) => setSheetInput(e.target.value)}
                      placeholder="Paste Google Sheet URL or ID..."
                      className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white"
                      autoFocus
                    />
                  </div>
                )}
              </div>
            </div>

            {!intakeData ? (
              <div className="bg-white p-12 rounded-2xl border border-slate-200 shadow-sm text-center space-y-4 max-w-2xl mx-auto my-6">
                <div className="w-14 h-14 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center mx-auto shadow-inner">
                  <FileSpreadsheet className="w-7 h-7" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-slate-900">
                    Select a Survey to Begin Scheduling
                  </h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                    Choose a monthly Google Form response sheet from your Google Drive above, or pick a test scenario to load volunteer availability and start matching cook and clean teams.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Existing Schedule Tab Alert Banner */}
                {intakeData.existingScheduleTab?.exists && (
                  <div className="p-4.5 bg-gradient-to-r from-amber-50 to-orange-50/70 border border-amber-300/90 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-amber-100/80 text-amber-700 border border-amber-300/80 flex items-center justify-center shrink-0">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs sm:text-sm font-bold text-amber-950 flex items-center gap-2 flex-wrap">
                          <span>Finalized Schedule Tab Found:</span>
                          <code className="bg-amber-100/90 border border-amber-300/70 px-2 py-0.5 rounded-lg font-mono text-xs text-amber-900 font-bold">
                            {intakeData.existingScheduleTab.name}
                          </code>
                        </h4>
                        <p className="text-xs text-amber-800/90 mt-0.5">
                          A completed schedule already exists for this survey in your Google Sheet. You can load it to resume review, or continue below to re-solve.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={handleLoadExistingSchedule}
                        disabled={loading}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-bold shadow-sm transition-colors disabled:opacity-50"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Load Saved Schedule & Edit in Step 3</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Quick Metrics */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-xs font-medium text-slate-500">Scheduled Meals</span>
                <p className="text-2xl font-bold text-slate-900 mt-1">{intakeData.mealDates.length}</p>
                <p className="text-xs text-slate-400 mt-0.5">October 2026</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-xs font-medium text-slate-500">Survey Responses</span>
                <p className="text-2xl font-bold text-slate-900 mt-1">{intakeData.responses.length}</p>
                <p className="text-xs text-emerald-600 mt-0.5">Responses parsed</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-xs font-medium text-slate-500">Active Member Registry</span>
                <p className="text-2xl font-bold text-slate-900 mt-1">{intakeData.audit.totalActiveMembers}</p>
                <p className="text-xs text-slate-400 mt-0.5">Total eligible cooks</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-xs font-medium text-slate-500">Missing Active Members</span>
                <p className={`text-2xl font-bold mt-1 ${intakeData.audit.missingMembers.length > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                  {intakeData.audit.missingMembers.length}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">Needs follow-up</p>
              </div>
            </div>

            {/* Auto-Reactivated Badges Banner */}
            {intakeData.audit.reactivatedMembers.length > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-emerald-600 mt-0.5" />
                <div>
                  <h3 className="text-xs font-bold text-emerald-900">
                    Auto-Reactivated Returning Members ({intakeData.audit.reactivatedMembers.length})
                  </h3>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    The following members were previously inactive but submitted survey responses. Their status was automatically updated to <strong>Active</strong>:
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {intakeData.audit.reactivatedMembers.map((m) => (
                      <span key={m.name} className="px-2.5 py-1 bg-white border border-emerald-300 rounded-lg text-xs font-semibold text-emerald-800">
                        ✨ {m.name} ({m.google_email || "No email"})
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Unrecognized Respondents Alert */}
            {intakeData.audit.unrecognizedRespondents.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h3 className="text-xs font-bold text-blue-900">
                    New / Unrecognized Respondents ({intakeData.audit.unrecognizedRespondents.length})
                  </h3>
                  <p className="text-xs text-blue-700 mt-0.5">
                    Submitted a survey response but not found in the master Member registry:
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {intakeData.audit.unrecognizedRespondents.map((name) => (
                      <span key={name} className="px-2.5 py-1 bg-white border border-blue-300 rounded-lg text-xs font-semibold text-blue-800">
                        👤 {name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Completeness Audit (Nag Screen Section) */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Completeness Audit (Missing Active Community Members)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Active members who have not yet submitted their availability survey.
                  </p>
                </div>
                {intakeData.audit.missingMembers.length === 0 && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5" /> All Active Members Responded!
                  </span>
                )}
              </div>

              {intakeData.audit.missingMembers.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {intakeData.audit.missingMembers.map((m) => (
                    <div key={m.name} className="p-4 flex items-center justify-between hover:bg-slate-50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 font-bold flex items-center justify-center text-xs">
                          {m.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-xs sm:text-sm font-bold text-slate-800">{m.name}</p>
                          <p className="text-xs text-slate-400">
                            {m.google_email || "No email"} • Last active: {m.last_active_survey || "Never"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleMarkInactive(m.name)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 rounded-lg text-xs font-semibold border border-slate-200 transition-colors"
                          title="Mark inactive and skip from future nag screens"
                        >
                          <UserX className="w-3.5 h-3.5 text-slate-500" />
                          Mark as Inactive
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 text-xs">
                  ✨ Excellent! Every active community member has submitted their survey.
                </div>
              )}
            </div>

            {/* Next Step Button */}
            <div className="flex justify-end">
              <button
                onClick={() => goToStep(2)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-colors"
              >
                Proceed to Notes & Exception Rules <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>
    )}

        {/* STEP 2: MEMBER NOTES & EXCEPTION RULES (UNIFIED PER-MEMBER VIEW) */}
        {currentStep === 2 && intakeData && (
          <div className="space-y-6">
            {/* Header & Quick Action */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Member Notes & Exception Rules ({membersRequiringAttention.length} Members with Notes or Rules)
                </h2>
                <p className="text-xs text-slate-500">
                  Review respondent special instructions and verify or configure exception rules for each member.
                </p>
              </div>
              <button
                onClick={handleOpenAddGenericRule}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors"
              >
                <Plus className="w-4 h-4" /> Add General Rule
              </button>
            </div>

            {/* Per-Member Cards */}
            <div className="space-y-4">
              {membersRequiringAttention.length > 0 ? (
                membersRequiringAttention.map((item) => (
                  <div
                    key={item.name}
                    className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3 hover:border-orange-200 transition-colors"
                  >
                    {/* Member Header Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-800 font-bold flex items-center justify-center text-sm shadow-sm">
                          {item.name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-900">{item.name}</h3>
                            <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md font-medium">
                              Cook Quota: {item.cookQuota}
                            </span>
                            {item.canCookCleanSameDay && (
                              <span className="text-xs px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full font-semibold border border-emerald-200">
                                ✨ Can Cook & Clean Same Day
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleOpenAddRuleForMember(item.name, item.specialInstructions)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 rounded-lg text-xs font-bold transition-colors self-start sm:self-auto"
                      >
                        <Plus className="w-3.5 h-3.5" /> Encode Rule for {item.name}
                      </button>
                    </div>

                    {/* Member Survey Note (if present) */}
                    {item.specialInstructions && (
                      <div className="bg-amber-50/80 border border-amber-200/90 rounded-xl p-3 flex items-start gap-2.5">
                        <MessageSquare className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
                        <div>
                          <span className="text-xs font-bold text-amber-900">Survey Note from {item.name}:</span>
                          <p className="text-xs text-amber-800 mt-0.5 font-medium italic">
                            "{item.specialInstructions}"
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Associated Active Exception Rules */}
                    <div>
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                        Configured Exception Rules ({item.rules.length})
                      </span>

                      {item.rules.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {item.rules.map((rule) => (
                            <div
                              key={rule.id}
                              className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between"
                            >
                              <div className="flex items-start gap-2">
                                <span
                                  className={`text-xs px-1.5 py-0.5 rounded font-bold uppercase ${
                                    rule.is_hard_rule
                                      ? "bg-rose-100 text-rose-800"
                                      : "bg-blue-100 text-blue-800"
                                  }`}
                                >
                                  {rule.is_hard_rule ? "Hard" : "Soft"}
                                </span>
                                <div>
                                  <p className="text-xs font-bold text-slate-800">
                                    <span className="text-orange-700 font-mono">{rule.rule_type}</span>
                                    {rule.person_b && ` ↔ ${rule.person_a === item.name ? rule.person_b : rule.person_a}`}
                                  </p>
                                  {rule.notes && (
                                    <p className="text-xs text-slate-500 truncate max-w-[200px]">{rule.notes}</p>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleOpenEditRule(rule)}
                                  className="p-1.5 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                                  title="Edit Rule"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteRule(rule.id)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                  title="Delete Rule"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">
                          No exception rule created for this note yet. Click "Encode Rule for {item.name}" above to add one.
                        </p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs">
                  No special notes or active rules for this month. You can proceed directly to solving or click "Add General Rule".
                </div>
              )}
            </div>

            {/* Navigation Buttons */}
            <div className="flex justify-between items-center">
              <button
                onClick={() => goToStep(1)}
                className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900"
              >
                Back to Intake
              </button>
              <button
                onClick={() => handleRunSolver()}
                disabled={loading}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-orange-500/20 transition-all"
              >
                <Sparkles className="w-4 h-4" /> Run Matchmaker Solver
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: SOLVE & REVIEW SCHEDULE */}
        {currentStep === 3 && (
          <div className="space-y-6">
            {/* Unified Step 3 Header & Completeness Bar */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                    !solverResult
                      ? "bg-orange-50 text-orange-600 border border-orange-200"
                      : solverResult.unfilledSlotsCount === 0
                      ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                      : "bg-amber-50 text-amber-600 border border-amber-200"
                  }`}
                >
                  {!solverResult ? (
                    <Calendar className="w-5 h-5" />
                  ) : solverResult.unfilledSlotsCount === 0 ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-sm font-bold text-slate-900">
                      {!solverResult
                        ? "Schedule Review"
                        : solverResult.unfilledSlotsCount === 0
                        ? `All ${solverResult.schedule.length} Monthly Meals Fully Staffed!`
                        : `${solverResult.schedule.filter((d) => d.unfilledCooks > 0 || d.unfilledCleaners > 0).length} of ${solverResult.schedule.length} Meals Need Attention`}
                    </h2>
                    {solverResult && (
                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                          solverResult.unfilledSlotsCount === 0
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {solverResult.schedule.filter((d) => d.unfilledCooks === 0 && d.unfilledCleaners === 0).length} / {solverResult.schedule.length} Confirmed
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {!solverResult
                      ? "Review meal assignments, fill open shifts, and inspect volunteer quotas."
                      : solverResult.unfilledSlotsCount === 0
                      ? "Every dinner and brunch has a complete cook and clean team assigned."
                      : `${solverResult.unfilledSlotsCount} open shift(s) remaining. Click [+ Fill Slot] on any date card to resolve.`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleRunSolver()}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                  <span>Re-Run Solver</span>
                </button>
              </div>
            </div>

            {/* Empty State when solverResult has not run yet */}
            {!solverResult && !loading && (
              <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-4 shadow-sm">
                <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center mx-auto shadow-inner">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Ready to Match Teams</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                    Click the button below to generate optimal, constraint-satisfying cook and clean rosters for all monthly meals.
                  </p>
                </div>
                <button
                  onClick={() => handleRunSolver()}
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-orange-500/20 transition-all"
                >
                  <Sparkles className="w-4 h-4" /> Run Matchmaker Solver
                </button>
              </div>
            )}

            {/* Constraint Violations (if any) */}
            {solverResult && solverResult.violations.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-amber-800 text-xs font-bold">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Soft Preference Violations ({solverResult.violations.length})</span>
                </div>
                <div className="space-y-1">
                  {solverResult.violations.map((v, i) => (
                    <p key={i} className="text-xs text-amber-700">
                      • {v.description}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Visual Schedule Cards */}
            {solverResult && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900">Generated Monthly Shift Roster (13 Meals)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {solverResult.schedule.map((day) => {
                    const hasCookShortage = day.unfilledCooks > 0;
                    const hasCleanShortage = day.unfilledCleaners > 0;
                    const isFullyStaffed = !hasCookShortage && !hasCleanShortage;

                    return (
                      <div
                        key={day.dateKey}
                        className={`rounded-2xl border transition-all flex flex-col justify-between p-4 ${
                          hasCookShortage
                            ? "bg-rose-50/90 border-rose-300 ring-2 ring-rose-400/30 shadow-md shadow-rose-100"
                            : hasCleanShortage
                            ? "bg-amber-50/80 border-amber-300 ring-2 ring-amber-400/30 shadow-sm"
                            : "bg-white border-slate-200/90 shadow-sm hover:shadow-md"
                        }`}
                      >
                        <div>
                          {/* Card Header */}
                          <div className="flex items-start justify-between pb-3 border-b border-slate-200/60">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-900">{day.dateLabel}</span>
                                {hasCookShortage && hasCleanShortage ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-rose-600 text-white rounded-full font-bold shadow-sm">
                                    <AlertTriangle className="w-3 h-3" /> Short {day.unfilledCooks}C & {day.unfilledCleaners}Cl
                                  </span>
                                ) : hasCookShortage ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-rose-600 text-white rounded-full font-bold shadow-sm">
                                    <AlertTriangle className="w-3 h-3" /> Short {day.unfilledCooks} Cook{day.unfilledCooks > 1 ? "s" : ""}
                                  </span>
                                ) : hasCleanShortage ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-amber-600 text-white rounded-full font-bold shadow-sm">
                                    <AlertTriangle className="w-3 h-3" /> Needs {day.unfilledCleaners} Cleaner{day.unfilledCleaners > 1 ? "s" : ""}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold">
                                    ✅ Fully Staffed
                                  </span>
                                )}
                              </div>
                              {day.specialNote && (
                                <p className="text-xs text-amber-700 font-semibold mt-0.5">{day.specialNote}</p>
                              )}
                            </div>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-md font-bold uppercase ${
                                day.mealType === "BRUNCH"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-indigo-50 text-indigo-700"
                              }`}
                            >
                              {day.mealType}
                            </span>
                          </div>

                          {/* Cook Team */}
                          <div className={`mt-3 ${hasCookShortage ? "bg-rose-100/60 border border-rose-200 p-2.5 rounded-xl" : ""}`}>
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="font-bold text-orange-800 flex items-center gap-1">
                                🍳 Cooks ({day.cooks.length})
                              </span>
                              {day.isTwoPersonDinnerWilling && (
                                <span className="text-[11px] px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full font-bold">
                                  👥 2-Cook Team (Willing)
                                </span>
                              )}
                              {hasCookShortage && (
                                <span className="text-xs text-rose-700 font-bold">
                                  ⚠️ {day.unfilledCooks} needed
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {day.cooks.map((name) => (
                                <span
                                  key={name}
                                  className="px-2 py-1 bg-white text-orange-900 border border-orange-200 rounded-lg text-xs font-semibold shadow-xs"
                                >
                                  {name}
                                </span>
                              ))}
                              {Array.from({ length: day.unfilledCooks }).map((_, i) => (
                                <button
                                  key={`empty-cook-${i}`}
                                  onClick={() =>
                                    setSelectedSlotToFill({
                                      dateKey: day.dateKey,
                                      dateLabel: day.dateLabel,
                                      role: "COOK",
                                    })
                                  }
                                  className="px-2 py-1 bg-white hover:bg-rose-50 border-2 border-dashed border-rose-300 hover:border-rose-400 text-rose-600 hover:text-rose-700 rounded-lg text-xs font-bold flex items-center gap-1 shadow-2xs transition-all cursor-pointer group"
                                  title="Click to fill missing cook slot"
                                >
                                  <Plus className="w-3.5 h-3.5 text-rose-500 group-hover:scale-110 transition-transform" />
                                  Fill Missing Cook Slot
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Clean Team */}
                          <div className={`mt-3 ${hasCleanShortage ? "bg-amber-100/60 border border-amber-200 p-2.5 rounded-xl" : ""}`}>
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="font-bold text-sky-800 flex items-center gap-1">
                                🧼 Cleaners ({day.cleaners.length})
                              </span>
                              {hasCleanShortage && (
                                <span className="text-xs text-amber-800 font-bold">
                                  ⚠️ {day.unfilledCleaners} needed
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {day.cleaners.map((name) => (
                                <span
                                  key={name}
                                  className="px-2 py-1 bg-white text-sky-900 border border-sky-200 rounded-lg text-xs font-semibold shadow-xs"
                                >
                                  {name}
                                </span>
                              ))}
                              {Array.from({ length: day.unfilledCleaners }).map((_, i) => (
                                <button
                                  key={`empty-clean-${i}`}
                                  onClick={() =>
                                    setSelectedSlotToFill({
                                      dateKey: day.dateKey,
                                      dateLabel: day.dateLabel,
                                      role: "CLEAN",
                                    })
                                  }
                                  className="px-2 py-1 bg-white hover:bg-amber-50 border-2 border-dashed border-amber-300 hover:border-amber-400 text-amber-700 hover:text-amber-800 rounded-lg text-xs font-bold flex items-center gap-1 shadow-2xs transition-all cursor-pointer group"
                                  title="Click to fill missing cleaner slot"
                                >
                                  <Plus className="w-3.5 h-3.5 text-amber-600 group-hover:scale-110 transition-transform" />
                                  Fill Missing Cleaner Slot
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Member Shift Quota Balance Table */}
            {solverResult && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Member Quota & Shift Distribution Summary</h3>
                    <p className="text-xs text-slate-500">
                      Verify that every community member's requested cook quota is fulfilled and shifts are on complete meals.
                    </p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2.5">Member</th>
                        <th className="px-4 py-2.5">Available Cook Days</th>
                        <th className="px-4 py-2.5">Requested Cooks</th>
                        <th className="px-4 py-2.5">Assigned Cooks</th>
                        <th className="px-4 py-2.5">Available Clean Days</th>
                        <th className="px-4 py-2.5">Requested Cleans</th>
                        <th className="px-4 py-2.5">Assigned Cleans</th>
                        <th className="px-4 py-2.5">Total Shifts</th>
                        <th className="px-4 py-2.5">Fulfillment Status</th>
                        <th className="px-4 py-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {Object.values(solverResult.memberStats).map((stat) => {
                        const isCookShort = stat.assignedCooks < stat.requestedCookQuota;
                        const reqCleans = stat.requestedCleanQuota ?? 1;
                        const isCleanShort = stat.assignedCleans < reqCleans;
                        const isShort = isCookShort || isCleanShort;
                        const totalMealCount = intakeData?.mealDates.length || 13;

                        // Check if any of their assigned shifts are on dates with missing cleaners/cooks
                        const assignedDays = solverResult.schedule.filter(
                          (d) => d.cooks.includes(stat.name) || d.cleaners.includes(stat.name)
                        );
                        const incompleteAssignedDays = assignedDays.filter(
                          (d) => d.unfilledCooks > 0 || d.unfilledCleaners > 0
                        );
                        const hasPendingIncomplete = incompleteAssignedDays.length > 0;
                        const isOversubscribed =
                          stat.assignedCleans > reqCleans ||
                          stat.assignedCooks > stat.requestedCookQuota;

                        return (
                          <tr key={stat.name} className="hover:bg-slate-50">
                            <td className="px-4 py-2 font-bold text-slate-800">{stat.name}</td>
                            <td className="px-4 py-2 font-medium text-slate-700">
                              {stat.availableCookDays}{" "}
                              <span className="text-slate-400 font-normal text-[11px]">
                                / {totalMealCount}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-slate-600">{stat.requestedCookQuota}</td>
                            <td className="px-4 py-2 font-semibold text-orange-600">{stat.assignedCooks}</td>
                            <td className="px-4 py-2 font-medium text-slate-700">
                              {stat.availableCleanDays}{" "}
                              <span className="text-slate-400 font-normal text-[11px]">
                                / {totalMealCount}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-slate-600">{reqCleans}</td>
                            <td className="px-4 py-2 font-semibold text-sky-600">{stat.assignedCleans}</td>
                            <td className="px-4 py-2 font-bold text-slate-900">{stat.totalAssigned}</td>
                            <td className="px-4 py-2">
                              {isOversubscribed ? (
                                <div className="space-y-0.5">
                                  <span className="text-purple-800 bg-purple-50 border border-purple-300 px-2 py-0.5 rounded font-bold inline-block">
                                    ⭐ Oversubscribed ({stat.assignedCooks > stat.requestedCookQuota ? `${stat.assignedCooks}/${stat.requestedCookQuota} Cooks` : ""}{stat.assignedCooks > stat.requestedCookQuota && stat.assignedCleans > reqCleans ? ", " : ""}{stat.assignedCleans > reqCleans ? `${stat.assignedCleans}/${reqCleans} Cleans` : ""})
                                  </span>
                                  {hasPendingIncomplete && (
                                    <p className="text-[10px] text-amber-700 font-medium">
                                      ⚠️ {incompleteAssignedDays.length} shift on incomplete meal
                                    </p>
                                  )}
                                </div>
                              ) : isShort ? (
                                <div className="space-y-0.5">
                                  <span className="text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded font-bold inline-block">
                                    Short ({isCookShort ? `${stat.assignedCooks}/${stat.requestedCookQuota} Cooks` : ""}{isCookShort && isCleanShort ? ", " : ""}{isCleanShort ? `${stat.assignedCleans}/${reqCleans} Cleans` : ""})
                                  </span>
                                  {hasPendingIncomplete && (
                                    <p className="text-[10px] text-amber-700 font-medium">
                                      ⚠️ {incompleteAssignedDays.length} shift on incomplete meal
                                    </p>
                                  )}
                                </div>
                              ) : hasPendingIncomplete ? (
                                <div className="space-y-0.5">
                                  <span className="text-amber-800 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded font-bold inline-block">
                                    ⚠️ Pending ({incompleteAssignedDays.length} on Incomplete Meal{incompleteAssignedDays.length > 1 ? "s" : ""})
                                  </span>
                                  <p className="text-[10px] text-amber-600">
                                    Meal missing cleaner/cook team
                                  </p>
                                </div>
                              ) : (
                                <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-bold inline-block">
                                  ✅ Confirmed Fulfilled
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-right">
                              <button
                                onClick={() => setSelectedQuotaMember(stat.name)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                                  isShort || hasPendingIncomplete
                                    ? "bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
                                    : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                                }`}
                              >
                                <Search className="w-3 h-3" /> {isShort || hasPendingIncomplete ? "Find Dates & Add Extra" : "View Dates"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between items-center">
              <button
                onClick={() => goToStep(2)}
                className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900"
              >
                Back to Notes & Rules
              </button>
              <button
                onClick={() => goToStep(4)}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-orange-500/20 transition-all"
              >
                Proceed to Export & Email <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: EXPORT & PUBLISH */}
        {currentStep === 4 && solverResult && (
          <div className="space-y-6">
            {/* Full-width Horizontal Auto-Publish Status Banner */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-slate-900">
                      Schedule Published to Google Sheets
                    </h3>
                    <span className="text-[11px] font-mono font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                      {exportedResult?.sheetName || "Schedule_2026-10"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    All {solverResult.schedule.length} monthly meal shifts have been automatically published to your spreadsheet tab.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {exportedResult?.url ? (
                  <a
                    href={exportedResult.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open Tab in Sheets</span>
                  </a>
                ) : sheetInput ? (
                  <a
                    href={sheetInput.startsWith("http") ? sheetInput : `https://docs.google.com/spreadsheets/d/${sheetInput}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open in Sheets</span>
                  </a>
                ) : null}
                <button
                  onClick={() => handleExportSheet(solverResult)}
                  disabled={loading}
                  className="inline-flex items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
                  title="Re-write spreadsheet tab"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                  <span>Update Tab</span>
                </button>
              </div>
            </div>

            {/* Full-width Community Announcement & Gmail Dispatch Card */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center shrink-0">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Community Announcement & Gmail Dispatch
                    </h3>
                    <p className="text-xs text-slate-500">
                      Send directly through your connected Gmail account, create a draft in Gmail, or copy formatted text
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={handleCopyEmail}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy Text
                  </button>
                  <button
                    onClick={() => handleSendGmail("draft")}
                    disabled={sendingEmail}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Create Gmail Draft</span>
                  </button>
                  <button
                    onClick={() => handleSendGmail("send")}
                    disabled={sendingEmail}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors disabled:opacity-50"
                  >
                    <Send className={`w-3.5 h-3.5 ${sendingEmail ? "animate-spin" : ""}`} />
                    <span>Send via Gmail</span>
                  </button>
                </div>
              </div>

              {/* Delivery Result Alert Banner */}
              {emailDeliveryResult && (
                <div
                  className={`p-4 rounded-xl border flex items-center justify-between gap-3 animate-fade-in ${
                    emailDeliveryResult.mode === "send"
                      ? "bg-emerald-50 border-emerald-200 text-emerald-950"
                      : "bg-blue-50 border-blue-200 text-blue-950"
                  }`}
                >
                  <div className="flex items-center gap-2.5 text-xs font-medium min-w-0">
                    <CheckCircle2
                      className={`w-4 h-4 shrink-0 ${
                        emailDeliveryResult.mode === "send" ? "text-emerald-600" : "text-blue-600"
                      }`}
                    />
                    <span className="truncate">{emailDeliveryResult.message}</span>
                  </div>
                  <a
                    href="https://mail.google.com"
                    target="_blank"
                    rel="noreferrer"
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 shrink-0 ${
                      emailDeliveryResult.mode === "send"
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                        : "bg-blue-600 hover:bg-blue-700 text-white"
                    }`}
                  >
                    Open Gmail <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              {/* Email Header Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <label className="text-xs font-bold text-slate-700">Recipients / Listserv (To:)</label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEmailTo(LIVE_LISTSERV_EMAIL)}
                        className={`text-[10px] px-2 py-0.5 rounded-md font-semibold transition-colors ${
                          emailTo === LIVE_LISTSERV_EMAIL
                            ? "bg-blue-100 text-blue-800 border border-blue-200"
                            : "text-slate-500 hover:text-blue-700 bg-slate-100"
                        }`}
                      >
                        Vancouver Cohousing Listserv
                      </button>
                      <button
                        type="button"
                        onClick={() => setEmailTo(DEV_TEST_EMAIL)}
                        className={`text-[10px] px-2 py-0.5 rounded-md font-semibold transition-colors ${
                          emailTo === DEV_TEST_EMAIL
                            ? "bg-amber-100 text-amber-800 border border-amber-200"
                            : "text-slate-500 hover:text-amber-700 bg-slate-100"
                        }`}
                      >
                        Dev / Test (Tyler)
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                    placeholder="e.g. Vancouver Cohousing Residents <vancoho-residents@googlegroups.com>"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Subject Line</label>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    placeholder="Subject line..."
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white font-medium"
                  />
                </div>
              </div>

              {/* Email Body Editor */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">Email Announcement Body</label>
                  {customEmailBody !== null && (
                    <button
                      onClick={() => setCustomEmailBody(null)}
                      className="text-[11px] text-orange-600 hover:text-orange-700 font-medium"
                    >
                      Reset to Default Template
                    </button>
                  )}
                </div>
                <textarea
                  value={generateEmailText()}
                  onChange={(e) => setCustomEmailBody(e.target.value)}
                  rows={12}
                  className="w-full p-4 bg-slate-50/70 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 leading-relaxed resize-y select-all"
                />
              </div>
            </div>

            <div className="flex justify-start">
              <button
                onClick={() => goToStep(3)}
                className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900"
              >
                Back to Schedule View
              </button>
            </div>
          </div>
        )}
      </main>

      {/* MODAL 1: MEMBER DIRECTORY & MAINTENANCE */}
      {showMemberModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] shadow-2xl flex flex-col overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Community Member Directory</h3>
                <p className="text-xs text-slate-500">Manage active vs inactive members and roster information</p>
              </div>
              <button
                onClick={() => setShowMemberModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Quick Add Member Form */}
            <form onSubmit={handleAddMember} className="p-4 bg-slate-50 border-b border-slate-200 flex gap-2">
              <input
                type="text"
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                placeholder="Member name (e.g. Maya)"
                className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg flex-1 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              />
              <input
                type="email"
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
                placeholder="Google account email"
                className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg flex-1 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              />
              <button
                type="submit"
                className="px-4 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold"
              >
                + Add
              </button>
            </form>

            {/* Filter Tabs */}
            <div className="px-5 py-2 border-b border-slate-100 flex gap-2 text-xs">
              <button
                onClick={() => setMemberFilter("all")}
                className={`px-3 py-1 rounded-lg font-bold ${memberFilter === "all" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
              >
                All ({members.length})
              </button>
              <button
                onClick={() => setMemberFilter("active")}
                className={`px-3 py-1 rounded-lg font-bold ${memberFilter === "active" ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
              >
                Active ({members.filter((m) => m.active).length})
              </button>
              <button
                onClick={() => setMemberFilter("inactive")}
                className={`px-3 py-1 rounded-lg font-bold ${memberFilter === "inactive" ? "bg-slate-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
              >
                Inactive ({members.filter((m) => !m.active).length})
              </button>
            </div>

            {/* Member List */}
            <div className="divide-y divide-slate-100 overflow-y-auto flex-1 p-2">
              {members
                .filter((m) => {
                  if (memberFilter === "active") return m.active;
                  if (memberFilter === "inactive") return !m.active;
                  return true;
                })
                .map((m) => (
                  <div key={m.name} className="p-3 flex items-center justify-between hover:bg-slate-50 rounded-xl">
                    <div>
                      <p className="text-xs sm:text-sm font-bold text-slate-800">{m.name}</p>
                      <p className="text-xs text-slate-400">
                        {m.google_email || "No email"} • Last active: {m.last_active_survey || "Never"}
                      </p>
                    </div>

                    <button
                      onClick={() => handleToggleMember(m.name, m.active)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                        m.active
                          ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {m.active ? "Active" : "Inactive (Dormant)"}
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD EXCEPTION RULE */}
      {showAddRuleModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {newRule.id ? "Edit Exception Rule" : "Add Exception Rule"}
              </h3>
              <button
                onClick={() => setShowAddRuleModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {/* Display Special Note Context if available */}
            {modalContextNote && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5">
                <MessageSquare className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
                <div>
                  <span className="text-xs font-bold text-amber-900">
                    Survey Request from {newRule.person_a}:
                  </span>
                  <p className="text-xs text-amber-800 mt-0.5 font-medium italic">
                    "{modalContextNote}"
                  </p>
                </div>
              </div>
            )}

            <form onSubmit={handleSaveRule} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Rule Type</label>
                <select
                  value={newRule.rule_type}
                  onChange={(e) => setNewRule({ ...newRule, rule_type: e.target.value as RuleType })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                >
                  <option value="NOT_SAME_TEAM">NOT_SAME_TEAM (Cannot be in same team)</option>
                  <option value="NOT_SAME_DAY">NOT_SAME_DAY (Cannot be scheduled on same date)</option>
                  <option value="SAME_DAY_DIFF_TEAM">SAME_DAY_DIFF_TEAM (Same date, different team)</option>
                  <option value="PAIR_WITH_ROLE">PAIR_WITH_ROLE (Assign together for role)</option>
                  <option value="PREF_SAME_DAY">PREF_SAME_DAY (Allow Cook & Clean on same date)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Person A</label>
                  <select
                    value={newRule.person_a}
                    onChange={(e) => setNewRule({ ...newRule, person_a: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  >
                    <option value="">Select Member...</option>
                    {members.map((m) => (
                      <option key={m.name} value={m.name}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Person B (Optional)</label>
                  <select
                    value={newRule.person_b || ""}
                    onChange={(e) => setNewRule({ ...newRule, person_b: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  >
                    <option value="">Select Member (if paired)...</option>
                    {members.map((m) => (
                      <option key={m.name} value={m.name}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Constraint Strictness</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="strictness"
                      checked={newRule.is_hard_rule === true}
                      onChange={() => setNewRule({ ...newRule, is_hard_rule: true })}
                    />
                    Hard Rule (Strictly enforced)
                  </label>
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="strictness"
                      checked={newRule.is_hard_rule === false}
                      onChange={() => setNewRule({ ...newRule, is_hard_rule: false })}
                    />
                    Soft Preference (Best effort)
                  </label>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Rationale / Notes</label>
                <input
                  type="text"
                  value={newRule.notes || ""}
                  onChange={(e) => setNewRule({ ...newRule, notes: e.target.value })}
                  placeholder="e.g. Roommates, Childcare conflict..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddRuleModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold shadow-sm"
                >
                  {newRule.id ? "Update Rule" : "Save Rule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: VIEW DATES & ASSIGN EXTRA SHIFT */}
      {selectedQuotaMember && solverResult && intakeData && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl p-6 space-y-4 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-orange-600" />
                  Available Dates & Extra Shift Assignment: {selectedQuotaMember}
                </h3>
                {solverResult.memberStats[selectedQuotaMember] && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    Requested Quota:{" "}
                    <strong>{solverResult.memberStats[selectedQuotaMember].requestedCookQuota}</strong> cooks,{" "}
                    <strong>{solverResult.memberStats[selectedQuotaMember].requestedCleanQuota ?? 1}</strong> cleans •
                    Currently Assigned:{" "}
                    <strong>{solverResult.memberStats[selectedQuotaMember].assignedCooks}</strong> cooks,{" "}
                    <strong>{solverResult.memberStats[selectedQuotaMember].assignedCleans}</strong> cleans (
                    {solverResult.memberStats[selectedQuotaMember].totalAssigned} total shifts)
                  </p>
                )}
              </div>
              <button
                onClick={() => setSelectedQuotaMember(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Special Instructions Context if any */}
            {(() => {
              const resp = intakeData.responses.find(
                (r) => r.name.toLowerCase() === selectedQuotaMember.toLowerCase()
              );
              if (!resp?.specialInstructions) return null;
              return (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5">
                  <MessageSquare className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-amber-900">
                      Survey Request from {selectedQuotaMember}:
                    </span>
                    <p className="text-xs text-amber-800 mt-0.5 font-medium italic">
                      "{resp.specialInstructions}"
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Dates List */}
            <div className="overflow-y-auto flex-1 divide-y divide-slate-100 pr-1 space-y-2">
              {solverResult.schedule.map((day) => {
                const resp = intakeData.responses.find(
                  (r) => r.name.toLowerCase() === selectedQuotaMember.toLowerCase()
                );
                const avail = resp?.availability[day.dateLabel] || "UNAVAILABLE";
                const isCook = day.cooks.includes(selectedQuotaMember);
                const isClean = day.cleaners.includes(selectedQuotaMember);

                const cookConflict = !isCook
                  ? checkAssignmentConflict(selectedQuotaMember, "COOK", day)
                  : null;
                const cleanConflict = !isClean
                  ? checkAssignmentConflict(selectedQuotaMember, "CLEAN", day)
                  : null;

                const canCook = avail === "AVAILABLE" || avail === "COOK_ONLY";
                const canClean = avail === "AVAILABLE" || avail === "CLEAN_ONLY";

                return (
                  <div
                    key={day.dateKey}
                    className={`p-3 rounded-xl border transition-colors ${
                      isCook || isClean
                        ? "bg-orange-50/40 border-orange-200"
                        : canCook || canClean
                        ? "bg-white border-slate-200 hover:border-slate-300"
                        : "bg-slate-50/50 border-slate-100 opacity-60"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      {/* Left: Date info & Current roster */}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">{day.dateLabel}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded font-bold uppercase ${
                              day.mealType === "BRUNCH"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-indigo-50 text-indigo-700"
                            }`}
                          >
                            {day.mealType}
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.2 rounded-full font-bold ${
                              avail === "AVAILABLE"
                                ? "bg-emerald-100 text-emerald-800"
                                : avail === "COOK_ONLY"
                                ? "bg-orange-100 text-orange-800"
                                : avail === "CLEAN_ONLY"
                                ? "bg-sky-100 text-sky-800"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            Survey: {avail.replace("_", " ")}
                          </span>
                        </div>

                        {/* Current Assigned Roster */}
                        <div className="text-[11px] text-slate-600 mt-1 space-y-0.5">
                          <p>
                            <span className="font-semibold text-orange-800">🍳 Cooks ({day.cooks.length}):</span>{" "}
                            {day.cooks.join(", ") || "None"}
                          </p>
                          <p>
                            <span className="font-semibold text-sky-800">🧼 Cleaners ({day.cleaners.length}):</span>{" "}
                            {day.cleaners.join(", ") || "None"}
                          </p>
                        </div>

                        {/* Conflict Warnings */}
                        {cookConflict && (
                          <p className="text-[11px] text-rose-600 font-semibold mt-1">
                            ⚠️ Cook Conflict: {cookConflict}
                          </p>
                        )}
                        {cleanConflict && (
                          <p className="text-[11px] text-rose-600 font-semibold mt-1">
                            ⚠️ Clean Conflict: {cleanConflict}
                          </p>
                        )}
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        {isCook ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-orange-700 bg-orange-100 px-2 py-1 rounded-lg">
                              ✅ Assigned Cook
                            </span>
                            <button
                              onClick={() => handleRemoveShift(day.dateKey, selectedQuotaMember, "COOK")}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded"
                              title="Remove cook shift"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                        ) : canCook && !cookConflict ? (
                          <button
                            onClick={() => handleAddExtraShift(day.dateKey, selectedQuotaMember, "COOK")}
                            className="px-2.5 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors"
                          >
                            + Add as Cook ({getOrdinal(day.cooks.length + 1)})
                          </button>
                        ) : null}

                        {isClean ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-sky-700 bg-sky-100 px-2 py-1 rounded-lg">
                              ✅ Assigned Cleaner
                            </span>
                            <button
                              onClick={() => handleRemoveShift(day.dateKey, selectedQuotaMember, "CLEAN")}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded"
                              title="Remove clean shift"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                        ) : canClean && !cleanConflict && !isCook ? (
                          <button
                            onClick={() => handleAddExtraShift(day.dateKey, selectedQuotaMember, "CLEAN")}
                            className="px-2.5 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors"
                          >
                            + Add as Cleaner ({getOrdinal(day.cleaners.length + 1)})
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                onClick={() => setSelectedQuotaMember(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: FILL MISSING SLOT (OVERRIDE / OVERSUBSCRIBE) */}
      {selectedSlotToFill && solverResult && intakeData && (() => {
        const targetDay = solverResult.schedule.find((d) => d.dateKey === selectedSlotToFill.dateKey);
        if (!targetDay) return null;
        const role = selectedSlotToFill.role;
        const isCookRole = role === "COOK";

        // Sort candidates: Available first, then by non-oversubscribed, then lowest total assigned shifts
        const candidateList = intakeData.responses
          .map((resp) => {
            const avail = resp.availability[selectedSlotToFill.dateLabel] || "UNAVAILABLE";
            const stat = solverResult.memberStats[resp.name];
            const isAlreadyCook = targetDay.cooks.includes(resp.name);
            const isAlreadyClean = targetDay.cleaners.includes(resp.name);
            const conflict = checkAssignmentConflict(resp.name, role, targetDay);

            const isAvailableForRole = isCookRole
              ? avail === "AVAILABLE" || avail === "COOK_ONLY"
              : avail === "AVAILABLE" || avail === "CLEAN_ONLY";

            const assignedCount = isCookRole ? stat?.assignedCooks || 0 : stat?.assignedCleans || 0;
            const quota = isCookRole
              ? stat?.requestedCookQuota || 1
              : stat?.requestedCleanQuota ?? 1;
            const isOversubscribed = assignedCount >= quota;

            return {
              resp,
              stat,
              avail,
              isAvailableForRole,
              isAlreadyCook,
              isAlreadyClean,
              conflict,
              assignedCount,
              quota,
              isOversubscribed,
            };
          })
          .sort((a, b) => {
            // Available first
            if (a.isAvailableForRole && !b.isAvailableForRole) return -1;
            if (!a.isAvailableForRole && b.isAvailableForRole) return 1;
            // Non-oversubscribed first
            if (!a.isOversubscribed && b.isOversubscribed) return -1;
            if (a.isOversubscribed && !b.isOversubscribed) return 1;
            return (a.stat?.totalAssigned || 0) - (b.stat?.totalAssigned || 0);
          });

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl p-6 space-y-4 max-h-[90vh] flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <UserPlus className={`w-5 h-5 ${isCookRole ? "text-orange-600" : "text-sky-600"}`} />
                    Fill Missing {isCookRole ? "Cook" : "Cleaner"} Slot
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    <strong>{selectedSlotToFill.dateLabel}</strong> ({targetDay.mealType}) • Current Team:{" "}
                    {isCookRole
                      ? `Cooks: ${targetDay.cooks.join(", ") || "None"}`
                      : `Cleaners: ${targetDay.cleaners.join(", ") || "None"}`}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedSlotToFill(null)}
                  className="text-slate-400 hover:text-slate-600 text-lg font-bold"
                >
                  ✕
                </button>
              </div>

              {/* Informational Callout */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600">
                💡 Select a community member below to fill this slot. Members who have already fulfilled their requested quota will be marked as <strong>Oversubscribed</strong> in the distribution summary.
              </div>

              {/* Candidate List */}
              <div className="overflow-y-auto flex-1 divide-y divide-slate-100 pr-1 space-y-2">
                {candidateList.map((item) => {
                  const {
                    resp,
                    stat,
                    avail,
                    isAvailableForRole,
                    isAlreadyCook,
                    isAlreadyClean,
                    conflict,
                    assignedCount,
                    quota,
                    isOversubscribed,
                  } = item;
                  const alreadyAssignedOnRole = isCookRole ? isAlreadyCook : isAlreadyClean;

                  return (
                    <div
                      key={resp.name}
                      className={`p-3 rounded-xl border transition-colors ${
                        alreadyAssignedOnRole
                          ? "bg-slate-50 border-slate-200 opacity-60"
                          : isAvailableForRole && !conflict
                          ? "bg-white border-slate-200 hover:border-slate-300"
                          : "bg-slate-50/50 border-slate-100 opacity-60"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        {/* Left: Member info */}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">{resp.name}</span>
                            <span
                              className={`text-[10px] px-2 py-0.2 rounded-full font-bold ${
                                avail === "AVAILABLE"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : avail === "COOK_ONLY"
                                  ? "bg-orange-100 text-orange-800"
                                  : avail === "CLEAN_ONLY"
                                  ? "bg-sky-100 text-sky-800"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              Survey: {avail.replace("_", " ")}
                            </span>
                            {isOversubscribed ? (
                              <span className="text-[10px] px-2 py-0.2 rounded-full font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                ⚠️ Oversubscribes ({assignedCount}/{quota} shifts)
                              </span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.2 rounded-full font-bold bg-blue-50 text-blue-700">
                                Has Quota ({assignedCount}/{quota})
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-3">
                            <span>
                              Total shifts: <strong>{stat?.totalAssigned || 0}</strong>
                            </span>
                            <span>
                              Cooks: <strong>{stat?.assignedCooks || 0}</strong>
                            </span>
                            <span>
                              Cleans: <strong>{stat?.assignedCleans || 0}</strong>
                            </span>
                            {resp.canCookCleanSameDay && (
                              <span className="text-emerald-600 font-semibold">✓ Same-day willing</span>
                            )}
                          </div>

                          {resp.specialInstructions && (
                            <p className="text-[11px] text-amber-700 italic mt-0.5">
                              "{resp.specialInstructions}"
                            </p>
                          )}

                          {conflict && (
                            <p className="text-[11px] text-rose-600 font-semibold mt-1">
                              ⚠️ Conflict: {conflict}
                            </p>
                          )}
                        </div>

                        {/* Right: Action */}
                        <div className="shrink-0">
                          {alreadyAssignedOnRole ? (
                            <span className="text-xs text-slate-400 font-semibold">
                              Already Assigned
                            </span>
                          ) : conflict ? (
                            <span className="text-xs text-rose-500 font-semibold">
                              Blocked by Rule
                            </span>
                          ) : (
                            <button
                              onClick={() => {
                                handleAddExtraShift(selectedSlotToFill.dateKey, resp.name, role);
                                setSelectedSlotToFill(null);
                              }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-colors ${
                                isCookRole
                                  ? "bg-orange-600 hover:bg-orange-700 text-white"
                                  : "bg-sky-600 hover:bg-sky-700 text-white"
                              }`}
                            >
                              + Assign {resp.name}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="flex justify-end pt-3 border-t border-slate-100">
                <button
                  onClick={() => setSelectedSlotToFill(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL 5: GLOBAL APPLICATION & SOLVER SETTINGS */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center">
                  <Settings className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Global Application & Solver Settings</h3>
                  <p className="text-xs text-slate-500">Configure sizing policies, default quotas, and solver behavior</p>
                </div>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Settings Form Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* 1. Cook Team Sizing Policy */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Utensils className="w-3.5 h-3.5 text-orange-600" />
                  Cook Team Sizing Policy
                </label>
                <p className="text-slate-500 text-[11px]">
                  Controls target cook team sizes and dynamic flexibility on tight dates.
                </p>

                <div className="space-y-2 pt-1">
                  {[
                    {
                      id: "ADAPTIVE_3_OR_2",
                      title: "Adaptive Sizing (Recommended / Default)",
                      desc: "Target 3 cooks on Dinners & 2 on Brunches. Dynamically accepts 2 cooks on Dinner without errors if all assigned cooks agreed to 2 in the survey.",
                      badge: "Default",
                    },
                    {
                      id: "DINNER_3_BRUNCH_2",
                      title: "Strict 3 Dinner / 2 Brunch",
                      desc: "Strictly requires 3 cooks on every Dinner and 2 on every Brunch, flagging unfilled slots if 3 cooks cannot be scheduled.",
                    },
                    {
                      id: "TWO_REGARDLESS",
                      title: "Strict 2 Cooks Regardless",
                      desc: "Always schedules exactly 2 cooks for all Dinners and Brunches.",
                    },
                  ].map((opt) => (
                    <label
                      key={opt.id}
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                        cookPolicy === opt.id
                          ? "bg-orange-50/70 border-orange-300 ring-1 ring-orange-400/40"
                          : "bg-white border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="cookPolicy"
                        value={opt.id}
                        checked={cookPolicy === opt.id}
                        onChange={() => setCookPolicy(opt.id as CookTeamPolicy)}
                        className="mt-0.5 text-orange-600 focus:ring-orange-500"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{opt.title}</span>
                          {opt.badge && (
                            <span className="text-[10px] bg-orange-100 text-orange-800 font-bold px-2 py-0.2 rounded-full">
                              {opt.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-slate-500 text-[11px] mt-0.5">{opt.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* 2. Default Clean Shift Quota */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
                  Default Cleaning Shifts per Member (Fallback)
                </label>
                <p className="text-slate-500 text-[11px]">
                  Default monthly cleaning shifts assigned per person when not specified in survey or for legacy responses.
                </p>

                <div className="grid grid-cols-3 gap-2 pt-1">
                  {[
                    { val: 1, label: "1 Shift (Default)" },
                    { val: 2, label: "2 Shifts" },
                    { val: 0, label: "0 (Exempt)" },
                  ].map((item) => (
                    <button
                      key={item.val}
                      type="button"
                      onClick={() => setDefaultCleanQuota(item.val)}
                      className={`py-2 px-3 rounded-xl border text-center font-bold transition-all ${
                        defaultCleanQuota === item.val
                          ? "bg-sky-50 border-sky-300 text-sky-900 ring-1 ring-sky-400/40"
                          : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Team Sizing Targets Summary */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                  Standard Meal Staffing Targets
                </label>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="font-bold text-indigo-900 block text-xs">Dinner Shifts</span>
                    <p className="text-slate-600 text-[11px] mt-0.5">🍳 3 Cooks (or 2 adaptive) • 🧼 3 Cleaners</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="font-bold text-amber-900 block text-xs">Brunch Shifts</span>
                    <p className="text-slate-600 text-[11px] mt-0.5">🍳 2 Cooks • 🧼 2 Cleaners</p>
                  </div>
                </div>
              </div>

              {/* 4. Google Drive Workspace & Master Community Registry */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Folder className="w-3.5 h-3.5 text-emerald-600" />
                  Google Drive Workspace & Master Registry
                </label>
                <p className="text-slate-500 text-[11px]">
                  Link the canonical community roster spreadsheet and provision test spreadsheets in your Drive folder.
                </p>

                <div className="space-y-2">
                  <div>
                    <span className="text-[11px] font-bold text-slate-700 block mb-1">
                      Master Registry Sheet URL or ID:
                    </span>
                    <input
                      type="text"
                      value={masterSheetInput}
                      onChange={(e) => setMasterSheetInput(e.target.value)}
                      placeholder="Leave blank to use default Script Property or paste Sheet URL..."
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    />
                  </div>

                  <div>
                    <span className="text-[11px] font-bold text-slate-700 block mb-1">
                      Target Google Drive Root Folder ID:
                    </span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={driveFolderId}
                        onChange={(e) => setDriveFolderId(e.target.value)}
                        placeholder="Google Drive Folder ID (e.g. 1U0cJqnxCgWn...)"
                        className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                      />
                      <button
                        type="button"
                        onClick={handleProvisionDrive}
                        disabled={provisioning}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50 shrink-0 flex items-center gap-1.5 shadow-sm"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${provisioning ? "animate-spin" : ""}`} />
                        {provisioning ? "Provisioning..." : "Provision Drive Hierarchy"}
                      </button>
                    </div>
                  </div>

                  {provisionResult && (
                    <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl space-y-2 text-[11px]">
                      <div className="flex items-center gap-1.5 text-emerald-800 font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Drive Workspace Ready!
                      </div>
                      <div className="space-y-1 text-slate-700">
                        <p>
                          <strong>Live Master Registry:</strong>{" "}
                          <a
                            href={provisionResult.liveMasterSheetUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-emerald-700 hover:underline inline-flex items-center gap-0.5 font-semibold"
                          >
                            Open Live Sheet <ExternalLink className="w-3 h-3" />
                          </a>
                        </p>
                        <p>
                          <strong>Dev/Test Master Registry:</strong>{" "}
                          <a
                            href={provisionResult.devMasterSheetUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-emerald-700 hover:underline inline-flex items-center gap-0.5 font-semibold"
                          >
                            Open Dev Sheet <ExternalLink className="w-3 h-3" />
                          </a>
                        </p>
                        {provisionResult.testSheets && (
                          <div className="pt-1 border-t border-emerald-200/60">
                            <span className="font-bold text-slate-800 block mb-0.5">
                              Generated Test Scenario Sheets ({provisionResult.testSheets.length}):
                            </span>
                            <ul className="list-disc pl-4 space-y-0.5 text-slate-600">
                              {provisionResult.testSheets.map((ts: any) => (
                                <li key={ts.key}>
                                  <a
                                    href={ts.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-indigo-600 hover:underline inline-flex items-center gap-0.5"
                                  >
                                    {ts.name} <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-4 py-2 text-slate-600 hover:text-slate-900 font-semibold text-xs rounded-xl"
              >
                Cancel
              </button>

              <button
                onClick={async () => {
                  setShowSettingsModal(false);
                  if (intakeData) {
                    await handleRunSolver(cookPolicy);
                    showToast("Settings applied & schedule recalculated!");
                  } else {
                    showToast("Settings saved!");
                  }
                }}
                className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" /> Save & Re-Calculate Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-3.5 text-center text-xs text-slate-400">
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

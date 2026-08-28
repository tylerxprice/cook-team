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
} from "../server/types";

export default function App() {
  const [inGas, setInGas] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [notification, setNotification] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // Spreadsheet URL/ID input
  const [sheetInput, setSheetInput] = useState("1GHPTpg1Mk8gIUxij1eB-_P4RDmPhfEIMwoVYMMTo5A4");

  // Core Data States
  const [intakeData, setIntakeData] = useState<IntakePayload | null>(null);
  const [exceptions, setExceptions] = useState<ExceptionRule[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [cookPolicy, setCookPolicy] = useState<CookTeamPolicy>("DINNER_3_BRUNCH_2");
  const [solverResult, setSolverResult] = useState<ScheduleOutput | null>(null);

  // Modals
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [memberFilter, setMemberFilter] = useState<"all" | "active" | "inactive">("all");
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [showAddRuleModal, setShowAddRuleModal] = useState(false);
  const [modalContextNote, setModalContextNote] = useState<string | null>(null);
  const [newRule, setNewRule] = useState<Partial<ExceptionRule>>({
    rule_type: "NOT_SAME_TEAM",
    is_hard_rule: true,
    person_a: "",
    person_b: "",
    notes: "",
  });

  const [selectedPreset, setSelectedPreset] = useState<string>("standard");

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const handleSelectPreset = async (presetKey: string) => {
    setSelectedPreset(presetKey);
    setLoading(true);
    try {
      const data = await callGas<IntakePayload>("loadMockPreset", presetKey);
      setIntakeData(data);
      setExceptions(data.exceptions || []);
      setMembers(data.members || []);
      setSolverResult(null);
      showToast(`Loaded test scenario: ${presetKey}`);
    } catch (err: any) {
      showToast(`Error: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  // Initial Load
  const fetchIntake = async (sheetId?: string) => {
    setLoading(true);
    try {
      const data = await callGas<IntakePayload>("getIntakeData", sheetId || sheetInput);
      setIntakeData(data);
      setExceptions(data.exceptions || []);
      setMembers(data.members || []);
      showToast(`Loaded ${data.responses.length} survey responses across ${data.mealDates.length} meals.`);
    } catch (err: any) {
      console.error(err);
      showToast(`Failed to load survey: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setInGas(isGasEnvironment());
    fetchIntake();
  }, []);

  // Auto-scroll to top whenever step changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentStep]);

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
      google_email: newMemberEmail.trim(),
      active: true,
      last_active_survey: "2026-10",
    };
    setMembers((prev) => [newM, ...prev]);
    setNewMemberName("");
    setNewMemberEmail("");
    showToast(`Added ${newM.name} to community registry.`);
  };

  // Rule Management
  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRule.person_a) {
      showToast("Please select Person A", "error");
      return;
    }
    const rule: ExceptionRule = {
      id: `RULE-${Date.now().toString().slice(-4)}`,
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
      showToast("Exception rule added!");
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

  // Run Solver
  const handleRunSolver = async () => {
    if (!intakeData) return;
    setLoading(true);
    try {
      const res = await callGas<ScheduleOutput>(
        "solveSchedule",
        intakeData.mealDates,
        intakeData.responses,
        exceptions,
        { cookPolicy, maxCleanPerMember: 1 }
      );
      setSolverResult(res);
      setCurrentStep(3);
      showToast(`Schedule generated in ${res.solveTimeMs}ms!`);
    } catch (err: any) {
      showToast(`Solver error: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  // Export to Sheet
  const handleExportSheet = async () => {
    if (!solverResult) return;
    setLoading(true);
    try {
      const res = await callGas<{ success: boolean; sheetName: string; message: string }>(
        "exportScheduleToSheet",
        sheetInput,
        solverResult
      );
      showToast(res.message);
    } catch (err: any) {
      showToast(`Export failed: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  // Generate Email Summary Text
  const generateEmailText = () => {
    if (!solverResult) return "";
    let text = "Hi Everyone,\n\nHere is the community cook and clean team schedule for next month:\n\n";
    for (const d of solverResult.schedule) {
      text += `📅 ${d.dateLabel} (${d.mealType}${d.specialNote ? ` - ${d.specialNote}` : ""})\n`;
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
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                  CookTeamTool
                </h1>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-orange-100 text-orange-700">
                  Community Meal Scheduler
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Constraint Solver • Google Form Intake • Coordinator Workspace
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowMemberModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
            >
              <Users className="w-4 h-4 text-slate-500" />
              Member Directory ({members.filter((m) => m.active).length} Active)
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
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            <nav className="flex space-x-2 sm:space-x-4">
              {[
                { step: 1, label: "1. Intake & Audit", icon: Users },
                { step: 2, label: "2. Notes & Rules", icon: Settings },
                { step: 3, label: "3. Solve & Review", icon: Calendar },
                { step: 4, label: "4. Publish & Email", icon: Mail },
              ].map((item) => {
                const Icon = item.icon;
                const isActive = currentStep === item.step;
                const isDone = currentStep > item.step;
                return (
                  <button
                    key={item.step}
                    onClick={() => setCurrentStep(item.step as any)}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                      isActive
                        ? "bg-orange-50 text-orange-700 ring-1 ring-orange-400"
                        : isDone
                        ? "text-emerald-700 hover:bg-slate-100"
                        : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? "text-orange-600" : isDone ? "text-emerald-500" : "text-slate-400"}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <button
              onClick={() => fetchIntake()}
              disabled={loading}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg"
              title="Refresh Survey Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full space-y-6">
        {/* STEP 1: INTAKE & COMPLETENESS AUDIT */}
        {currentStep === 1 && intakeData && (
          <div className="space-y-6">
            {/* Sheet Link & Scenario Presets Card */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Survey Response Spreadsheet</h2>
                  <p className="text-xs text-slate-500">Google Form linked sheet ID or URL for next month's survey</p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                  <input
                    type="text"
                    value={sheetInput}
                    onChange={(e) => setSheetInput(e.target.value)}
                    placeholder="Paste Google Sheet URL or ID..."
                    className="px-3 py-1.5 text-xs sm:text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 flex-1 md:w-80"
                  />
                  <button
                    onClick={() => fetchIntake(sheetInput)}
                    disabled={loading}
                    className="px-4 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                  >
                    Load Live Sheet
                  </button>
                </div>
              </div>

              {/* Preset Scenario Selector for Testing */}
              <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70 -mx-5 -mb-5 p-4 rounded-b-2xl">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-orange-600" />
                  <span className="text-xs font-bold text-slate-700">Test Scenarios & Edge Case Presets:</span>
                </div>
                <div className="flex-1 sm:max-w-md">
                  <select
                    value={selectedPreset}
                    onChange={(e) => handleSelectPreset(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 font-medium text-slate-800"
                  >
                    <option value="standard">🌟 Standard Healthy Community (30 responses, 0 unfilled)</option>
                    <option value="holiday_shortage">🦃 Holiday Desertion (Thanksgiving Oct 11-12 shortage)</option>
                    <option value="quota_deficit">⚠️ Quota Shortfall (Severe cook quota deficit)</option>
                    <option value="high_conflict">🔒 High Conflict Network (8 entangled hard rules)</option>
                    <option value="single_respondent">👤 Single Response (Tyler only — Live Google Sheet)</option>
                  </select>
                </div>
              </div>
            </div>

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
                onClick={() => setCurrentStep(2)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-colors"
              >
                Proceed to Notes & Exception Rules <ChevronRight className="w-4 h-4" />
              </button>
            </div>
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

                              <button
                                onClick={() => handleDeleteRule(rule.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded"
                                title="Delete Rule"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
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
                onClick={() => setCurrentStep(1)}
                className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900"
              >
                Back to Intake
              </button>
              <button
                onClick={handleRunSolver}
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
            {/* Solver Policy & Action Toolbar */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Cook Team Sizing Policy</label>
                  <select
                    value={cookPolicy}
                    onChange={(e) => setCookPolicy(e.target.value as CookTeamPolicy)}
                    className="px-3 py-1.5 text-xs sm:text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-medium"
                  >
                    <option value="DINNER_3_BRUNCH_2">Dinner = 3 Cooks, Brunch = 2 Cooks (Default)</option>
                    <option value="TWO_REGARDLESS">2 Cooks Regardless of Meal Type</option>
                  </select>
                </div>

                <div className="pt-4">
                  <button
                    onClick={handleRunSolver}
                    disabled={loading}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Re-Solve Schedule
                  </button>
                </div>
              </div>

              {solverResult && (
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-xs text-slate-400">Solver Latency</span>
                    <p className="text-xs font-bold text-slate-700">{solverResult.solveTimeMs}ms</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400">Unfilled Slots</span>
                    <p className={`text-xs font-bold ${solverResult.unfilledSlotsCount === 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {solverResult.unfilledSlotsCount}
                    </p>
                  </div>
                </div>
              )}
            </div>

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
                  {solverResult.schedule.map((day) => (
                    <div
                      key={day.dateKey}
                      className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 hover:shadow-md transition-shadow flex flex-col justify-between"
                    >
                      <div>
                        {/* Card Header */}
                        <div className="flex items-start justify-between pb-3 border-b border-slate-100">
                          <div>
                            <span className="text-xs font-bold text-slate-900">{day.dateLabel}</span>
                            {day.specialNote && (
                              <p className="text-xs text-amber-600 font-medium">{day.specialNote}</p>
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
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-bold text-orange-700 flex items-center gap-1">
                              🍳 Cooks ({day.cooks.length})
                            </span>
                            {day.unfilledCooks > 0 && (
                              <span className="text-xs text-rose-600 font-semibold">
                                {day.unfilledCooks} needed
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {day.cooks.map((name) => (
                              <span
                                key={name}
                                className="px-2 py-1 bg-orange-50 text-orange-800 border border-orange-200 rounded-lg text-xs font-medium"
                              >
                                {name}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Clean Team */}
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-bold text-sky-700 flex items-center gap-1">
                              🧼 Cleaners ({day.cleaners.length})
                            </span>
                            {day.unfilledCleaners > 0 && (
                              <span className="text-xs text-rose-600 font-semibold">
                                {day.unfilledCleaners} needed
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {day.cleaners.map((name) => (
                              <span
                                key={name}
                                className="px-2 py-1 bg-sky-50 text-sky-800 border border-sky-200 rounded-lg text-xs font-medium"
                              >
                                {name}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Member Shift Quota Balance Table */}
            {solverResult && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900">Member Quota & Shift Distribution Summary</h3>
                  <p className="text-xs text-slate-500">
                    Verify that every community member's requested cook quota and clean quota are fulfilled.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2.5">Member</th>
                        <th className="px-4 py-2.5">Requested Cooks</th>
                        <th className="px-4 py-2.5">Assigned Cooks</th>
                        <th className="px-4 py-2.5">Assigned Cleans</th>
                        <th className="px-4 py-2.5">Total Shifts</th>
                        <th className="px-4 py-2.5">Quota Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {Object.values(solverResult.memberStats).map((stat) => (
                        <tr key={stat.name} className="hover:bg-slate-50">
                          <td className="px-4 py-2 font-bold text-slate-800">{stat.name}</td>
                          <td className="px-4 py-2 text-slate-600">{stat.requestedCookQuota}</td>
                          <td className="px-4 py-2 font-semibold text-orange-600">{stat.assignedCooks}</td>
                          <td className="px-4 py-2 font-semibold text-sky-600">{stat.assignedCleans}</td>
                          <td className="px-4 py-2 font-bold text-slate-900">{stat.totalAssigned}</td>
                          <td className="px-4 py-2">
                            {stat.assignedCooks >= stat.requestedCookQuota ? (
                              <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-semibold">
                                Fulfilled
                              </span>
                            ) : (
                              <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-semibold">
                                Short ({stat.assignedCooks}/{stat.requestedCookQuota})
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between items-center">
              <button
                onClick={() => setCurrentStep(2)}
                className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900"
              >
                Back to Notes & Rules
              </button>
              <button
                onClick={() => setCurrentStep(4)}
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Google Sheets Export Card */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Download className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Publish to Google Sheets</h3>
                    <p className="text-xs text-slate-500">Writes the final schedule to a new tab</p>
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Click below to write all 13 meal shift assignments directly into tab{" "}
                  <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-emerald-700">Schedule_2026-10</code> in your Google Sheet.
                </p>

                <button
                  onClick={handleExportSheet}
                  disabled={loading}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  <Download className="w-4 h-4" /> Export Schedule Tab
                </button>
              </div>

              {/* Listserv Email Generator Card */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                      <Mail className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Community Listserv Email</h3>
                      <p className="text-xs text-slate-500">Pre-formatted text announcement</p>
                    </div>
                  </div>

                  <button
                    onClick={handleCopyEmail}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy Email
                  </button>
                </div>

                <textarea
                  readOnly
                  value={generateEmailText()}
                  rows={8}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex justify-start">
              <button
                onClick={() => setCurrentStep(3)}
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
              <h3 className="text-base font-bold text-slate-900">Add Exception Rule</h3>
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
                  Save Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-3.5 text-center text-xs text-slate-400">
        CookTeamTool • Built for Community Meal Coordinators • Google Apps Script & React
      </footer>
    </div>
  );
}

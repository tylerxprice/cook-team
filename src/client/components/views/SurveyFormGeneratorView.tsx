import React, { useState, useEffect } from "react";
import {
  FileText,
  CheckCircle2,
  Copy,
  ExternalLink,
  Pencil,
  FileSpreadsheet,
  Folder,
  Settings,
  Sparkles,
  Calendar,
  Plus,
  RefreshCw,
  Trash2,
  Mail,
  Send,
  Check,
  Users,
  AlertCircle,
  Search,
  Clock,
  Lock,
  ChevronLeft,
  ChevronRight,
  Utensils,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import {
  MealType,
  SurveyFormDateConfig,
  CreateSurveyFormResult,
  Member,
  SendBetaInvitesPayload,
  SendBetaInvitesResult,
  MonthStatus,
  ExistingSurveyInfo,
} from "../../../server/types";
import { callGas, getPublicWebAppUrl } from "../../utils/gas";

export interface SurveyFormGeneratorViewProps {
  monthKey: string;
  setMonthKey: (val: string) => void;
  loadDatesPreview: (mKey: string) => void;
  formTitle?: string;
  setFormTitle?: (val: string) => void;
  folderId?: string;
  setFolderId?: (val: string) => void;
  dates: SurveyFormDateConfig[];
  setDates: React.Dispatch<React.SetStateAction<SurveyFormDateConfig[]>>;
  loadingDates: boolean;
  loadingCreate: boolean;
  formResult: CreateSurveyFormResult | null;
  copiedLink: boolean;
  onCopyLink: (url: string) => void;
  onAddCustomDate: () => void;
  onExecuteCreateForm: (targetMonthKey?: string) => void;
  members?: Member[];
  coordinatorEmail?: string;
  spreadsheetId?: string;
  driveSheets?: any[];
  monthStatus?: MonthStatus;
  existingSurvey?: ExistingSurveyInfo | null;
  onSaveDraftDates?: (targetMonthKey?: string) => Promise<void>;
  onSaveDatesAndOpen?: (targetMonthKey?: string) => Promise<void>;
  savingDates?: boolean;
  onSetMonthStatus?: (status: MonthStatus, targetMonth?: string) => Promise<void>;
  deploymentUrl?: string;
  onBackToHome: () => void;
  onOpenCoordinator: () => void;
  onOpenSchedule?: () => void;
  onToast?: (message: string, type?: "success" | "error") => void;
}

export const SurveyFormGeneratorView: React.FC<SurveyFormGeneratorViewProps> = ({
  monthKey,
  setMonthKey,
  loadDatesPreview,
  formTitle: _formTitle = "",
  setFormTitle: _setFormTitle,
  folderId: _folderId,
  setFolderId: _setFolderId,
  dates,
  setDates,
  loadingDates,
  loadingCreate,
  formResult,
  copiedLink,
  onCopyLink,
  onAddCustomDate,
  onExecuteCreateForm,
  members = [],
  coordinatorEmail = "",
  spreadsheetId: _spreadsheetId = "",
  driveSheets = [],
  monthStatus = "NOT_OPEN",
  existingSurvey = null,
  onSaveDraftDates,
  onSaveDatesAndOpen: _onSaveDatesAndOpen,
  savingDates = false,
  onSetMonthStatus,
  deploymentUrl = "",
  onBackToHome,
  onOpenCoordinator,
  onOpenSchedule: _onOpenSchedule,
  onToast: _onToast,
}) => {
  const [activeTab, setActiveTab] = useState<"form" | "beta">("form");
  const [betaSubject, setBetaSubject] = useState<string>(
    `[Community Meals] ${monthKey} Meal Team Sign-Up (Beta)`
  );
  const [betaReplyTo, setBetaReplyTo] = useState<string>(coordinatorEmail);
  const [betaBodyTemplate, setBetaBodyTemplate] = useState<string>(
    `Hi {{name}},\n\nIt's time to set up our community meal teams for {{month}}!\n\nAs part of our beta pilot group testing our new sign-up page, you can submit your meal shift preferences and available dates directly here:\n{{link}}\n\nYour preferences will be saved immediately to our community meal planning system.\n\nQuestions or feedback? Just reply to this email!\n\nWarmly,\nBrenda & Tyler`
  );
  const [selectedBetaMembers, setSelectedBetaMembers] = useState<Set<string>>(() => {
    const s = new Set<string>();
    members.forEach((m) => {
      if (m.is_beta_tester && m.active) s.add(m.name);
    });
    return s;
  });
  const [copiedLinkMember, setCopiedLinkMember] = useState<string | null>(null);
  const [sendingBetaInvites, setSendingBetaInvites] = useState<boolean>(false);
  const [betaDispatchResult, setBetaDispatchResult] = useState<SendBetaInvitesResult | null>(null);
  const [betaSearchFilter, setBetaSearchFilter] = useState<string>("");

  // Safely resolve the response spreadsheet ID specifically for THIS target monthKey
  const activeSpreadsheetId = React.useMemo(() => {
    if (formResult?.spreadsheetId) return formResult.spreadsheetId;
    if (driveSheets && driveSheets.length > 0 && /^\d{4}[-_]\d{2}$/.test(monthKey)) {
      const yyMm = monthKey.length >= 7 ? monthKey.slice(2) : "";
      const match = driveSheets.find((s) => {
        const n = (s.name || "").toLowerCase();
        return n.includes(monthKey.toLowerCase()) || (yyMm && n.includes(yyMm));
      });
      if (match) return match.id;
    }
    return "";
  }, [formResult, driveSheets, monthKey]);

  // Determine if a Google Form & linked response sheet have been created for this month
  const hasGeneratedForm = Boolean(
    existingSurvey?.exists || formResult?.formPublishedUrl || formResult?.spreadsheetUrl
  );

  // Staged flow: when form creation completes, automatically advance to and focus the Beta Web Sign-Ups tab
  const prevLoadingCreateRef = React.useRef(loadingCreate);
  useEffect(() => {
    if (
      prevLoadingCreateRef.current &&
      !loadingCreate &&
      (formResult?.success || existingSurvey?.exists)
    ) {
      setActiveTab("beta");
    }
    prevLoadingCreateRef.current = loadingCreate;
  }, [loadingCreate, formResult, existingSurvey]);

  // If activeTab is on beta but no form exists yet (e.g. user stepped to an unconfigured month), reset to form tab
  useEffect(() => {
    if (!hasGeneratedForm && activeTab === "beta") {
      setActiveTab("form");
    }
  }, [hasGeneratedForm, activeTab]);

  // Step forward or backward by one month
  const stepMonth = (delta: number) => {
    const parts = monthKey.split("-");
    const year = parseInt(parts[0], 10) || new Date().getFullYear();
    const month = parseInt(parts[1], 10) || 1;
    const date = new Date(Date.UTC(year, month - 1 + delta, 1));
    const newYear = date.getUTCFullYear();
    const newMonth = String(date.getUTCMonth() + 1).padStart(2, "0");
    const newKey = `${newYear}-${newMonth}`;
    setMonthKey(newKey);
    loadDatesPreview(newKey);
  };

  // Sync default subject when month changes
  useEffect(() => {
    setBetaSubject(`[Community Meals] ${monthKey} Meal Team Sign-Up (Beta)`);
  }, [monthKey]);

  // Sync default replyTo when coordinatorEmail changes
  useEffect(() => {
    if (coordinatorEmail && !betaReplyTo) setBetaReplyTo(coordinatorEmail);
  }, [coordinatorEmail, betaReplyTo]);

  // Sync selected beta members when members prop updates
  useEffect(() => {
    const s = new Set<string>();
    members.forEach((m) => {
      if (m.is_beta_tester && m.active) s.add(m.name);
    });
    if (s.size > 0) setSelectedBetaMembers(s);
  }, [members]);

  const getPersonalizedLink = (memberName: string) => {
    const baseUrl = getPublicWebAppUrl(deploymentUrl);
    // Only append sheetId if a spreadsheet for THIS target month exists!
    const sheetParam = activeSpreadsheetId
      ? `&sheetId=${encodeURIComponent(activeSpreadsheetId)}`
      : "";
    return `${baseUrl}?view=survey&month=${encodeURIComponent(
      monthKey
    )}&m=${encodeURIComponent(memberName)}${sheetParam}`;
  };

  const handleCopyMemberLink = (memberName: string) => {
    const link = getPersonalizedLink(memberName);
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(link).catch(() => {});
      setCopiedLinkMember(memberName);
      setTimeout(() => setCopiedLinkMember(null), 2500);
    }
  };

  const handleSendBetaInvitations = async () => {
    const testersToSend = members.filter((m) => selectedBetaMembers.has(m.name) && m.google_email);
    if (testersToSend.length === 0) return;

    setSendingBetaInvites(true);
    setBetaDispatchResult(null);

    const payload: SendBetaInvitesPayload = {
      monthKey,
      subject: betaSubject.trim(),
      bodyTemplate: betaBodyTemplate,
      replyTo: betaReplyTo.trim() || undefined,
      recipients: testersToSend.map((m) => ({
        name: m.name,
        email: m.google_email.split(/[,;]/)[0].trim(),
        link: getPersonalizedLink(m.name),
      })),
      spreadsheetId: activeSpreadsheetId || undefined,
    };

    try {
      const res = await callGas<SendBetaInvitesResult>("sendBetaSurveyInvitations", payload);
      setBetaDispatchResult(res);
    } catch (err: any) {
      setBetaDispatchResult({
        success: false,
        dispatchedCount: 0,
        failedCount: testersToSend.length,
        message: err.message || "Failed to dispatch beta invitation emails.",
      });
    } finally {
      setSendingBetaInvites(false);
    }
  };

  const activeDatesCount = dates.filter((d) => d.included).length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Top Navigation Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onBackToHome}
              title="Return to Hub Home"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-500 flex items-center justify-center text-white shadow-md shadow-orange-500/20 hover:scale-105 transition-transform shrink-0 cursor-pointer"
            >
              <Utensils className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  Survey Form Generator
                </h1>
                <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded-full bg-violet-100 text-violet-800 border border-violet-200">
                  Coordinator Tool
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                Prepare meal dates, create Google Forms, or manage beta sign-ups
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenCoordinator}
              className="min-h-[40px] px-3.5 py-1.5 text-xs sm:text-sm font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span>Coordinator Wizard</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full space-y-6">
        {/* Top Control Bar: Target Month & Status (ALWAYS VISIBLE) */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-100 border border-violet-200 flex items-center justify-center shrink-0 text-violet-700">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                  Target Scheduling Month
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <button
                    type="button"
                    onClick={() => stepMonth(-1)}
                    disabled={loadingDates}
                    aria-label="Previous month"
                    title="Previous month"
                    className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <input
                    type="month"
                    value={monthKey}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val) {
                        setMonthKey(val);
                        loadDatesPreview(val);
                      }
                    }}
                    className="min-h-[36px] px-3 py-1 text-sm sm:text-base border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 font-bold text-slate-900 cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() => stepMonth(1)}
                    disabled={loadingDates}
                    aria-label="Next month"
                    title="Next month"
                    className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Status Badges & Action Toggle */}
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              {monthStatus === "OPEN" ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Sign-Ups Open
                </span>
              ) : monthStatus === "CLOSED" ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-purple-900 bg-purple-100 border border-purple-300 rounded-full">
                  <Lock className="w-3.5 h-3.5 text-purple-700" />
                  Closed (Scheduled)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-slate-700 bg-slate-100 border border-slate-300 rounded-full">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  Draft (Not Open)
                </span>
              )}

              {/* Toggles ONLY make sense when a Google Form & response spreadsheet actually exist! */}
              {Boolean(existingSurvey?.exists) && onSetMonthStatus && monthStatus === "OPEN" && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => onSetMonthStatus("CLOSED", monthKey)}
                    className="min-h-[38px] px-3.5 py-1.5 text-xs font-bold text-purple-900 hover:text-purple-950 bg-purple-50 hover:bg-purple-100 border border-purple-300 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    title="Close sign-ups (teams scheduled)"
                  >
                    <Lock className="w-3.5 h-3.5 text-purple-700" />
                    <span>Close Sign-Ups</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetMonthStatus("NOT_OPEN", monthKey)}
                    className="min-h-[38px] px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    title="Return sign-ups to draft mode"
                  >
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>Set to Draft</span>
                  </button>
                </div>
              )}

              {Boolean(existingSurvey?.exists) && onSetMonthStatus && monthStatus === "CLOSED" && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => onSetMonthStatus("NOT_OPEN", monthKey)}
                    className="min-h-[38px] px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    title="Reset status to draft (not scheduled / not open)"
                  >
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>Set to Draft</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetMonthStatus("OPEN", monthKey)}
                    className="min-h-[38px] px-3.5 py-1.5 text-xs font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    title="Reopen sign-ups for existing form"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Reopen Sign-Ups</span>
                  </button>
                </div>
              )}

              {Boolean(existingSurvey?.exists) &&
                onSetMonthStatus &&
                monthStatus === "NOT_OPEN" && (
                  <button
                    type="button"
                    onClick={() => onSetMonthStatus("OPEN", monthKey)}
                    className="min-h-[38px] px-3.5 py-1.5 text-xs font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    title="Open sign-ups for the existing form"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Open Sign-Ups</span>
                  </button>
                )}
            </div>
          </div>
        </div>

        {/* LOADING SPINNERS: Replace entire content below month bar while loading */}
        {loadingDates ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-16 flex flex-col items-center justify-center text-center space-y-4 min-h-[380px] animate-in fade-in duration-150">
            <div className="w-16 h-16 rounded-2xl bg-violet-50 text-violet-600 border border-violet-200 flex items-center justify-center shadow-inner">
              <RefreshCw className="w-8 h-8 animate-spin" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900">
                Loading Configuration for {monthKey}...
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-md">
                Retrieving configured meal dates, calendar day calculations, and Master Sheet
                settings.
              </p>
            </div>
          </div>
        ) : loadingCreate ? (
          <div className="bg-white rounded-2xl border-2 border-violet-200 shadow-sm p-12 sm:p-16 flex flex-col items-center justify-center text-center space-y-5 min-h-[420px] animate-in fade-in duration-200">
            <div className="w-20 h-20 rounded-3xl bg-violet-50 text-violet-700 border-2 border-violet-200 flex items-center justify-center shadow-md shadow-violet-200/50">
              <RefreshCw className="w-10 h-10 animate-spin text-violet-600" />
            </div>
            <div className="space-y-2 max-w-lg">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-violet-100 text-violet-800">
                <Sparkles className="w-3.5 h-3.5 text-violet-600" />
                <span>Google Workspace Automation</span>
              </div>
              <h3 className="text-lg sm:text-xl font-black text-slate-900">
                Generating Google Form &amp; Linked Response Sheet...
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                Building your {monthKey} survey questions, formatting grid rows for{" "}
                {activeDatesCount} meal dates, linking the Google Sheets response workbook, and
                opening sign-ups.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-violet-700 font-semibold bg-violet-50 px-4 py-2.5 rounded-xl border border-violet-200">
              <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
              <span>
                This takes about 5–10 seconds. You&apos;ll be automatically directed to Beta Web
                Sign-Ups next!
              </span>
            </div>
          </div>
        ) : (
          <>
            {/* Tab Switcher: Standard Google Form vs Phase 2 Beta Web Sign-Ups */}
            <div className="flex border-b border-slate-200 bg-slate-100/80 px-4 pt-3 rounded-t-2xl gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("form")}
                className={`min-h-[42px] px-5 py-2.5 font-bold text-xs sm:text-sm rounded-t-xl border-t border-x transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === "form"
                    ? "bg-white border-slate-200 text-violet-900 shadow-xs -mb-[1px]"
                    : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                }`}
              >
                <FileSpreadsheet className="w-4 h-4 text-violet-600" />
                <span>Google Form &amp; Meal Dates (Standard)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (hasGeneratedForm) setActiveTab("beta");
                }}
                disabled={!hasGeneratedForm}
                title={
                  hasGeneratedForm
                    ? "Switch to Phase 2 Beta Web Sign-Ups"
                    : "Stage 2: Available after generating the Google Form & linked sheet"
                }
                className={`min-h-[42px] px-5 py-2.5 font-bold text-xs sm:text-sm rounded-t-xl border-t border-x transition-all flex items-center gap-2 ${
                  !hasGeneratedForm
                    ? "border-transparent text-slate-400 bg-slate-100/50 cursor-not-allowed opacity-60"
                    : activeTab === "beta"
                      ? "bg-white border-slate-200 text-violet-900 shadow-xs -mb-[1px] cursor-pointer"
                      : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 cursor-pointer"
                }`}
              >
                <Mail
                  className={`w-4 h-4 ${hasGeneratedForm ? "text-violet-600" : "text-slate-400"}`}
                />
                <span>Beta Web Sign-Ups (Phase 2)</span>
                {!hasGeneratedForm ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-slate-200 text-slate-600 rounded-full">
                    <Lock className="w-3 h-3 text-slate-500" />
                    <span>Locked</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-[10px] font-black tracking-wider uppercase bg-amber-100 text-amber-800 rounded-full border border-amber-300">
                    Pilot
                  </span>
                )}
              </button>
            </div>

            {/* TAB 1: Google Form & Meal Dates Configuration */}
            {activeTab === "form" && (
              <div className="space-y-6">
                {/* Existing Survey Warning or Notice */}
                {existingSurvey?.exists && (!formResult || !formResult.success) && (
                  <>
                    {!existingSurvey.canOverwrite ? (
                      <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl flex items-start gap-3.5 shadow-2xs">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center shrink-0 text-amber-800">
                          <AlertTriangle className="w-5 h-5 text-amber-700" />
                        </div>
                        <div className="space-y-1 text-xs text-amber-950 flex-1">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-amber-950">
                              Active Survey Exists — Overwriting Disabled (
                              {existingSurvey.responseCount} Responses Received)
                            </h4>
                            <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-amber-200 text-amber-900 border border-amber-300">
                              {existingSurvey.responseCount} responses
                            </span>
                          </div>
                          <p className="text-amber-800 leading-relaxed">
                            A survey response sheet is already active for this month:{" "}
                            <strong className="text-amber-950">
                              {existingSurvey.spreadsheetName}
                            </strong>
                            . Because member availability responses have already been received,
                            generating a new Google Form is disabled to prevent losing existing
                            submissions.
                          </p>
                          {existingSurvey.spreadsheetUrl && (
                            <div className="pt-1.5">
                              <a
                                href={existingSurvey.spreadsheetUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 font-bold text-amber-900 hover:text-amber-950 underline hover:no-underline"
                              >
                                <span>Open Existing Response Spreadsheet ↗</span>
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-2xl flex items-start gap-3 shadow-2xs">
                        <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                        <div className="text-xs text-blue-950 flex-1 space-y-0.5">
                          <div className="flex items-center justify-between">
                            <strong className="font-bold text-blue-900">
                              Existing Survey Sheet Found ({existingSurvey.responseCount} responses)
                            </strong>
                          </div>
                          <p className="text-blue-800">
                            Google Drive already contains{" "}
                            <strong>{existingSurvey.spreadsheetName}</strong>. Clicking
                            &quot;Generate Form&quot; will ask for confirmation before overwriting.
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Success Result Banner */}
                {formResult && formResult.success && (
                  <div className="p-5 bg-emerald-50 border-2 border-emerald-300 rounded-2xl space-y-4 shadow-xs animate-in fade-in duration-200">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-2 text-emerald-950 font-bold text-sm sm:text-base">
                        <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                        <span>{formResult.message}</span>
                      </div>
                      <span className="text-xs font-bold bg-emerald-100 text-emerald-900 px-3 py-1 rounded-full border border-emerald-300 shrink-0">
                        {formResult.totalDates} Dates Included
                      </span>
                    </div>

                    {/* Quick Action Links */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          onCopyLink(formResult.formPrefilledUrl || formResult.formPublishedUrl)
                        }
                        className="min-h-[44px] px-3.5 py-2.5 bg-violet-700 hover:bg-violet-800 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs hover:shadow transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {copiedLink ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                        <span>{copiedLink ? "Link Copied!" : "Copy Form Link (Prefilled)"}</span>
                      </button>

                      <a
                        href={formResult.formPrefilledUrl || formResult.formPublishedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="min-h-[44px] px-3.5 py-2.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs sm:text-sm font-bold rounded-xl shadow-2xs hover:shadow transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <ExternalLink className="w-4 h-4 text-slate-600" />
                        <span>View Live Form ↗</span>
                      </a>

                      <a
                        href={formResult.formEditUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="min-h-[44px] px-3.5 py-2.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs sm:text-sm font-bold rounded-xl shadow-2xs hover:shadow transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Pencil className="w-4 h-4 text-purple-600" />
                        <span>Edit Google Form ↗</span>
                      </a>

                      <a
                        href={formResult.spreadsheetUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="min-h-[44px] px-3.5 py-2.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs sm:text-sm font-bold rounded-xl shadow-2xs hover:shadow transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                        <span>Response Sheet ↗</span>
                      </a>
                    </div>

                    {formResult.folderUrl && (
                      <div className="text-xs text-slate-600 flex items-center gap-1.5 pt-1">
                        <Folder className="w-4 h-4 text-slate-500" />
                        <span>Saved inside Google Drive folder:</span>
                        <a
                          href={formResult.folderUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-violet-700 hover:underline font-bold"
                        >
                          Open Drive Folder ↗
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {/* Interactive Meal Dates Table with Merged Form Title */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-violet-600" />
                        <span>
                          Configure Meal Dates for Survey Grid ({activeDatesCount} active of{" "}
                          {dates.length})
                        </span>
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Toggle meal dates, adjust meal types (Dinner / Brunch), or specify special
                        event notes.
                      </p>
                    </div>
                  </div>

                  {dates.length === 0 ? (
                    <div className="py-12 text-center text-xs sm:text-sm text-slate-500">
                      No dates found for {monthKey}. Please select a valid month.
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                      <table className="w-full text-left text-xs sm:text-sm border-collapse">
                        <thead>
                          <tr className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200">
                            <th scope="col" className="py-3 px-3 w-14 text-center">
                              Include
                            </th>
                            <th scope="col" className="py-3 px-3 w-28">
                              Date
                            </th>
                            <th scope="col" className="py-3 px-3 w-24">
                              Day
                            </th>
                            <th scope="col" className="py-3 px-3 w-32">
                              Meal Type
                            </th>
                            <th scope="col" className="py-3 px-3">
                              Special Event / Note (Optional)
                            </th>
                            <th scope="col" className="py-3 px-3">
                              Survey Grid Row Label Preview
                            </th>
                            <th scope="col" className="py-3 px-3 w-14 text-center"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {dates.map((d, idx) => {
                            let previewLabel = d.dateLabel;
                            if (d.specialNote && d.specialNote.trim()) {
                              previewLabel = `${previewLabel} - ${d.specialNote.trim()}`;
                            }
                            return (
                              <tr
                                key={`date-${d.dateKey}-${idx}`}
                                className={`transition-colors ${
                                  d.included ? "hover:bg-violet-50/30" : "bg-slate-50/50 opacity-60"
                                }`}
                              >
                                <td className="py-2.5 px-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={d.included}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setDates((prev) =>
                                        prev.map((item, i) =>
                                          i === idx ? { ...item, included: checked } : item
                                        )
                                      );
                                    }}
                                    aria-label={`Include date ${d.dateKey}`}
                                    className="w-5 h-5 rounded text-violet-600 focus:ring-violet-500 border-slate-300 cursor-pointer"
                                  />
                                </td>
                                <td className="py-2.5 px-3 font-mono font-medium text-slate-800">
                                  {d.dateKey}
                                </td>
                                <td className="py-2.5 px-3 font-semibold text-slate-900">
                                  {d.dayOfWeek}
                                </td>
                                <td className="py-2.5 px-3">
                                  <select
                                    value={d.mealType}
                                    disabled={!d.included}
                                    aria-label={`Meal type for ${d.dateKey}`}
                                    onChange={(e) => {
                                      const mType = e.target.value as MealType;
                                      const shortName = d.dateLabel.split(" ")[0] || "Nov";
                                      const dayNum = d.dateKey.split("-")[2] || "1";
                                      let newLabel = d.dateLabel;
                                      if (d.dayOfWeek === "Sunday") {
                                        newLabel = `${shortName} ${parseInt(dayNum, 10)} (${
                                          mType === "BRUNCH" ? "Sun, Brunch" : "Sun, Dinner"
                                        })`;
                                      }
                                      setDates((prev) =>
                                        prev.map((item, i) =>
                                          i === idx
                                            ? { ...item, mealType: mType, dateLabel: newLabel }
                                            : item
                                        )
                                      );
                                    }}
                                    className="min-h-[38px] px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500"
                                  >
                                    <option value="DINNER">Dinner</option>
                                    <option value="BRUNCH">Brunch</option>
                                  </select>
                                </td>
                                <td className="py-2.5 px-3">
                                  <input
                                    type="text"
                                    value={d.specialNote || ""}
                                    disabled={!d.included}
                                    aria-label={`Special note for ${d.dateKey}`}
                                    onChange={(e) => {
                                      const note = e.target.value;
                                      setDates((prev) =>
                                        prev.map((item, i) =>
                                          i === idx ? { ...item, specialNote: note } : item
                                        )
                                      );
                                    }}
                                    placeholder="e.g. Thanksgiving, Community Meeting"
                                    className="w-full min-h-[38px] px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 text-slate-900 placeholder:text-slate-400"
                                  />
                                </td>
                                <td className="py-2.5 px-3 text-xs font-medium text-slate-700">
                                  <span className="px-2.5 py-1 bg-slate-100 rounded-lg border border-slate-200">
                                    {previewLabel}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDates((prev) => prev.filter((_, i) => i !== idx));
                                    }}
                                    aria-label={`Remove meal date ${d.dateKey}`}
                                    title={`Remove date ${d.dateKey}`}
                                    className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Action / Control Buttons: Placed AFTER Date Entry */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={onAddCustomDate}
                      className="min-h-[40px] px-3.5 py-1.5 text-xs sm:text-sm font-bold text-violet-800 hover:text-violet-950 bg-violet-50 hover:bg-violet-100 border border-violet-300 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer self-start sm:self-auto"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Custom Date</span>
                    </button>

                    <div className="flex items-center gap-2.5 flex-wrap sm:ml-auto">
                      {/* Save Draft Dates Button */}
                      {onSaveDraftDates && (
                        <button
                          type="button"
                          onClick={() => onSaveDraftDates && onSaveDraftDates(monthKey)}
                          disabled={savingDates || activeDatesCount === 0}
                          className="min-h-[40px] px-4 py-1.5 text-xs sm:text-sm font-bold text-slate-800 hover:text-slate-950 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
                          title="Saves configured meal dates/types/notes to Master Settings without opening sign-ups"
                        >
                          <CheckCircle className="w-4 h-4 text-slate-600" />
                          <span>{savingDates ? "Saving Draft..." : "Save Draft Dates"}</span>
                        </button>
                      )}

                      {/* Generate Form & Open Sign-Ups Button */}
                      <button
                        type="button"
                        onClick={() => onExecuteCreateForm(monthKey)}
                        disabled={
                          loadingCreate ||
                          activeDatesCount === 0 ||
                          existingSurvey?.canOverwrite === false
                        }
                        title={
                          existingSurvey?.canOverwrite === false
                            ? `Generating a new form is blocked because ${existingSurvey.responseCount} responses have already been received.`
                            : undefined
                        }
                        className={`min-h-[40px] px-5 py-1.5 text-xs sm:text-sm font-bold rounded-xl transition-all shadow-xs hover:shadow flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                          existingSurvey?.canOverwrite === false
                            ? "bg-slate-400 text-white cursor-not-allowed"
                            : "bg-violet-700 hover:bg-violet-800 text-white"
                        }`}
                      >
                        {loadingCreate ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Creating Form &amp; Sheet...</span>
                          </>
                        ) : existingSurvey?.canOverwrite === false ? (
                          <>
                            <Lock className="w-4 h-4" />
                            <span>
                              Form Exists ({existingSurvey.responseCount} Responses) — Locked
                            </span>
                          </>
                        ) : (
                          <>
                            <FileText className="w-4 h-4" />
                            <span>Generate Form &amp; Open Sign-Ups</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Persistence information callout */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Settings className="w-4 h-4 text-slate-400" />
                      <span>
                        Meal dates and open status are saved directly into the Master Community
                        Registry (<code>Settings</code> tab: <code>month_dates_{monthKey}</code> and{" "}
                        <code>month_status_{monthKey}</code>).
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Phase 2 Beta Web Sign-Ups */}
            {activeTab === "beta" && (
              <div className="space-y-6">
                {/* Form Creation Success Callout (Stage 1 Completed) */}
                {formResult && formResult.success && (
                  <div className="p-4 bg-emerald-50 border-2 border-emerald-300 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-in fade-in duration-200">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-300">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div className="text-xs sm:text-sm text-emerald-950 font-bold">
                        <div>{formResult.message}</div>
                        <div className="font-normal text-emerald-800 text-xs mt-0.5">
                          Google Form and response spreadsheet are ready with{" "}
                          {formResult.totalDates} dates. You can now invite beta testers below!
                        </div>
                      </div>
                    </div>
                    {formResult.formPublishedUrl && (
                      <a
                        href={formResult.formPrefilledUrl || formResult.formPublishedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-bold text-emerald-900 bg-white hover:bg-emerald-100 border border-emerald-300 px-3.5 py-1.5 rounded-xl shrink-0 flex items-center gap-1.5 shadow-2xs transition-colors self-start sm:self-auto cursor-pointer"
                      >
                        <span>View Form</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                )}

                {/* Beta Overview Banner */}
                <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl flex items-start gap-3.5 shadow-xs">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 border border-amber-200">
                    <Sparkles className="w-5 h-5 text-amber-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-amber-950 flex items-center gap-2">
                      <span>Direct Web Availability Sign-Up (Beta Pilot)</span>
                      <span className="text-[10px] uppercase font-black bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full">
                        Phase 2
                      </span>
                    </h3>
                    <p className="text-xs text-amber-900/80 mt-1 leading-relaxed">
                      Generate personalized survey links for beta testers to submit meal
                      availability and shift preferences directly in the app. Responses are written
                      directly to the <strong>Web Responses</strong> tab and merged automatically
                      with Google Forms during Step 1 Intake.
                    </p>
                  </div>
                </div>

                {/* Dispatch Alert Banner */}
                {betaDispatchResult && (
                  <div
                    className={`p-4 rounded-2xl border-2 flex items-start gap-3 shadow-xs animate-in fade-in duration-200 ${
                      betaDispatchResult.success
                        ? "bg-emerald-50 border-emerald-300 text-emerald-950"
                        : "bg-rose-50 border-rose-300 text-rose-950"
                    }`}
                  >
                    {betaDispatchResult.success ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 text-xs sm:text-sm">
                      <div className="font-bold">{betaDispatchResult.message}</div>
                      {betaDispatchResult.details && betaDispatchResult.details.length > 0 && (
                        <div className="text-xs mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-slate-600">
                          {betaDispatchResult.details.slice(0, 10).map((d, idx) => (
                            <span
                              key={idx}
                              className={`inline-flex items-center gap-1 ${
                                d.success ? "text-emerald-800" : "text-rose-700 font-semibold"
                              }`}
                            >
                              <span>{d.success ? "✓" : "✗"}</span>
                              <span>{d.name}</span>
                              {d.email && (
                                <span className="text-slate-400 font-normal">({d.email})</span>
                              )}
                              {d.error && (
                                <span className="text-rose-600 font-normal">: {d.error}</span>
                              )}
                            </span>
                          ))}
                          {betaDispatchResult.details.length > 10 && (
                            <span className="text-slate-500 font-medium">
                              (+{betaDispatchResult.details.length - 10} more)
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Grid: Left = Beta Testers Roster, Right = Email Template */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left: Beta Testers Roster */}
                  <div className="lg:col-span-7 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          <Users className="w-4 h-4 text-violet-600" />
                          <span>Beta Pilot Testers ({selectedBetaMembers.size} selected)</span>
                        </h3>
                        <p className="text-xs text-slate-500">
                          Active residents tagged as beta testers in the Master Sheet.
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => {
                            const s = new Set<string>();
                            members.forEach((m) => {
                              if (m.is_beta_tester && m.active) s.add(m.name);
                            });
                            setSelectedBetaMembers(s);
                          }}
                          className="px-2.5 py-1 text-xs font-bold text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-lg transition-colors cursor-pointer"
                        >
                          Tagged Only
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const s = new Set<string>();
                            members.forEach((m) => {
                              if (m.active) s.add(m.name);
                            });
                            setSelectedBetaMembers(s);
                          }}
                          className="px-2.5 py-1 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                        >
                          All Active
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedBetaMembers(new Set())}
                          className="px-2.5 py-1 text-xs font-bold text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    {/* Search Bar */}
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Filter members by name..."
                        value={betaSearchFilter}
                        onChange={(e) => setBetaSearchFilter(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                      />
                    </div>

                    {/* Members Table */}
                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs max-h-[460px] overflow-y-auto">
                      <table className="w-full text-left border-collapse text-xs sm:text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold sticky top-0 z-10">
                          <tr>
                            <th className="py-2.5 px-3.5 w-10 text-center">
                              <span className="sr-only">Select</span>
                            </th>
                            <th className="py-2.5 px-3">Member</th>
                            <th className="py-2.5 px-3">Email Address</th>
                            <th className="py-2.5 px-3 text-right">Personal Link</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {members
                            .filter((m) => m.active)
                            .filter((m) =>
                              betaSearchFilter
                                ? m.name.toLowerCase().includes(betaSearchFilter.toLowerCase())
                                : true
                            )
                            .map((m) => {
                              const isSelected = selectedBetaMembers.has(m.name);
                              const isCopied = copiedLinkMember === m.name;
                              const link = getPersonalizedLink(m.name);
                              const hasEmail = Boolean(m.google_email && m.google_email.trim());

                              return (
                                <tr
                                  key={m.name}
                                  className={`hover:bg-slate-50/80 transition-colors ${
                                    isSelected ? "bg-violet-50/40" : ""
                                  }`}
                                >
                                  <td className="py-2.5 px-3.5 text-center">
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={(e) => {
                                        const next = new Set(selectedBetaMembers);
                                        if (e.target.checked) next.add(m.name);
                                        else next.delete(m.name);
                                        setSelectedBetaMembers(next);
                                      }}
                                      className="w-4 h-4 text-violet-600 rounded border-slate-300 focus:ring-violet-500 cursor-pointer"
                                    />
                                  </td>
                                  <td className="py-2.5 px-3 font-semibold text-slate-900">
                                    <div className="flex items-center gap-2">
                                      <span>{m.name}</span>
                                      {m.is_beta_tester && (
                                        <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                                          Beta Tester
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3 text-slate-600">
                                    {hasEmail ? (
                                      <span className="font-mono text-xs">{m.google_email}</span>
                                    ) : (
                                      <span className="text-amber-600 italic text-xs flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3 shrink-0" />
                                        No email
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => handleCopyMemberLink(m.name)}
                                        title="Copy personalized survey link"
                                        className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all flex items-center gap-1 cursor-pointer ${
                                          isCopied
                                            ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                                        }`}
                                      >
                                        {isCopied ? (
                                          <>
                                            <Check className="w-3 h-3 text-emerald-600" />
                                            <span>Copied</span>
                                          </>
                                        ) : (
                                          <>
                                            <Copy className="w-3 h-3 text-slate-500" />
                                            <span>Copy Link</span>
                                          </>
                                        )}
                                      </button>
                                      <a
                                        href={link}
                                        target="_blank"
                                        rel="noreferrer"
                                        title="Preview sign-up page for this member"
                                        className="p-1.5 text-slate-400 hover:text-violet-700 hover:bg-violet-50 rounded-lg transition-colors cursor-pointer"
                                      >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                      </a>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Right: Email Template Composer & Preview */}
                  <div className="lg:col-span-5 space-y-4">
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                            <Mail className="w-4 h-4 text-violet-600" />
                            <span>Email Invitation Template</span>
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Sent directly from your Google Apps Script account.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleSendBetaInvitations}
                          disabled={
                            sendingBetaInvites ||
                            members.filter((m) => selectedBetaMembers.has(m.name) && m.google_email)
                              .length === 0
                          }
                          className="min-h-[38px] px-4 py-1.5 text-xs font-bold text-white bg-violet-700 hover:bg-violet-800 rounded-xl transition-all shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                        >
                          {sendingBetaInvites ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Sending...</span>
                            </>
                          ) : (
                            <>
                              <Send className="w-3.5 h-3.5" />
                              <span>
                                Send Beta Invitations (
                                {
                                  members.filter(
                                    (m) => selectedBetaMembers.has(m.name) && m.google_email
                                  ).length
                                }
                                )
                              </span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Subject */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Email Subject Line:
                        </label>
                        <input
                          type="text"
                          value={betaSubject}
                          onChange={(e) => setBetaSubject(e.target.value)}
                          className="w-full min-h-[40px] px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 font-medium text-slate-900"
                        />
                      </div>

                      {/* Reply-To */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Reply-To Address (Coordinator):
                        </label>
                        <input
                          type="email"
                          value={betaReplyTo}
                          onChange={(e) => setBetaReplyTo(e.target.value)}
                          placeholder="coordinator@example.com"
                          className="w-full min-h-[40px] px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 font-medium text-slate-900"
                        />
                      </div>

                      {/* Message Body Template */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-bold text-slate-700">
                            Message Body Template:
                          </label>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-500 font-medium">Tag:</span>
                            {["{{name}}", "{{link}}", "{{month}}"].map((tag) => (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => setBetaBodyTemplate((prev) => `${prev} ${tag} `)}
                                className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200 rounded cursor-pointer transition-colors"
                              >
                                {tag}
                              </button>
                            ))}
                          </div>
                        </div>
                        <textarea
                          rows={6}
                          value={betaBodyTemplate}
                          onChange={(e) => setBetaBodyTemplate(e.target.value)}
                          className="w-full p-3 text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 text-slate-900 leading-relaxed"
                        />
                      </div>

                      {/* Live Preview Card */}
                      <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                          <span>Email Preview Sample</span>
                          <span className="text-[11px] font-normal text-slate-500">
                            To: {Array.from(selectedBetaMembers)[0] || "Sample Resident"}
                          </span>
                        </div>
                        <div className="p-3 bg-white border border-slate-200 rounded-lg text-xs space-y-2 text-slate-800 whitespace-pre-wrap font-sans max-h-[160px] overflow-y-auto">
                          <div className="font-bold text-slate-900 border-b border-slate-100 pb-1">
                            Subject: {betaSubject}
                          </div>
                          <div className="text-slate-600 leading-relaxed">
                            {betaBodyTemplate
                              .replace(
                                /\{\{name\}\}/g,
                                Array.from(selectedBetaMembers)[0] || "Brenda"
                              )
                              .replace(
                                /\{\{link\}\}/g,
                                getPersonalizedLink(Array.from(selectedBetaMembers)[0] || "Brenda")
                              )
                              .replace(/\{\{month\}\}/g, monthKey)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

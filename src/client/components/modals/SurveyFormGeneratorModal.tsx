import React, { useState } from "react";
import {
  FileText,
  X,
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
} from "lucide-react";
import {
  MealType,
  SurveyFormDateConfig,
  CreateSurveyFormResult,
  Member,
  SendBetaInvitesPayload,
  SendBetaInvitesResult,
  MonthStatus,
} from "../../../server/types";
import { callGas } from "../../utils/gas";

export interface SurveyFormGeneratorModalProps {
  show: boolean;
  onClose: () => void;
  surveyFormModalBodyRef: React.RefObject<HTMLDivElement>;
  surveyFormMonthKey: string;
  setSurveyFormMonthKey: (val: string) => void;
  loadSurveyFormDatesPreview: (mKey: string) => void;
  surveyFormTitle: string;
  setSurveyFormTitle: (val: string) => void;
  surveyFormFolderId: string;
  setSurveyFormFolderId: (val: string) => void;
  surveyFormDates: SurveyFormDateConfig[];
  setSurveyFormDates: React.Dispatch<React.SetStateAction<SurveyFormDateConfig[]>>;
  surveyFormLoadingDates: boolean;
  surveyFormLoadingCreate: boolean;
  surveyFormResult: CreateSurveyFormResult | null;
  surveyFormCopiedLink: boolean;
  handleCopySurveyLink: (url: string) => void;
  handleAddCustomSurveyDate: () => void;
  handleExecuteCreateSurveyForm: () => void;
  members?: Member[];
  coordinatorEmail?: string;
  spreadsheetId?: string;
  monthStatus?: MonthStatus;
  onSaveDatesAndOpen?: () => Promise<void>;
  savingDates?: boolean;
  onSetMonthStatus?: (status: MonthStatus) => Promise<void>;
}

export const SurveyFormGeneratorModal: React.FC<SurveyFormGeneratorModalProps> = ({
  show,
  onClose,
  surveyFormModalBodyRef,
  surveyFormMonthKey,
  setSurveyFormMonthKey,
  loadSurveyFormDatesPreview,
  surveyFormTitle,
  setSurveyFormTitle,
  surveyFormFolderId,
  setSurveyFormFolderId,
  surveyFormDates,
  setSurveyFormDates,
  surveyFormLoadingDates,
  surveyFormLoadingCreate,
  surveyFormResult,
  surveyFormCopiedLink,
  handleCopySurveyLink,
  handleAddCustomSurveyDate,
  handleExecuteCreateSurveyForm,
  members = [],
  coordinatorEmail = "",
  spreadsheetId = "",
  monthStatus = "NOT_OPEN",
  onSaveDatesAndOpen,
  savingDates = false,
  onSetMonthStatus,
}) => {
  const [activeTab, setActiveTab] = useState<"form" | "beta">("form");
  const [betaSubject, setBetaSubject] = useState<string>(
    `[Community Meals] ${surveyFormMonthKey} Meal Team Sign-Up (Beta)`
  );
  const [betaReplyTo, setBetaReplyTo] = useState<string>(coordinatorEmail);
  const [betaBodyTemplate, setBetaBodyTemplate] = useState<string>(
    `Hi {{name}},\n\nIt's time to set up our community meal teams for {{month}}!\n\nAs part of our beta pilot group testing our new sign-up page, you can submit your meal shift preferences and available dates directly here:\n👉 {{link}}\n\nYour preferences will be saved immediately to our community meal planning system.\n\nQuestions or feedback? Just reply to this email!\n\nWarmly,\nBrenda & Tyler`
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

  // Sync default subject when month changes
  React.useEffect(() => {
    setBetaSubject(`[Community Meals] ${surveyFormMonthKey} Meal Team Sign-Up (Beta)`);
  }, [surveyFormMonthKey]);

  // Sync default replyTo when coordinatorEmail changes
  React.useEffect(() => {
    if (coordinatorEmail && !betaReplyTo) setBetaReplyTo(coordinatorEmail);
  }, [coordinatorEmail]);

  // Sync selected beta members when members prop updates
  React.useEffect(() => {
    const s = new Set<string>();
    members.forEach((m) => {
      if (m.is_beta_tester && m.active) s.add(m.name);
    });
    if (s.size > 0) setSelectedBetaMembers(s);
  }, [members]);

  const getPersonalizedLink = (memberName: string) => {
    const baseUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}${window.location.pathname}`
        : "https://script.google.com/macros/s/exec";
    const sheetParam = spreadsheetId ? `&sheetId=${encodeURIComponent(spreadsheetId)}` : "";
    return `${baseUrl}?view=survey&month=${encodeURIComponent(
      surveyFormMonthKey
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
      monthKey: surveyFormMonthKey,
      subject: betaSubject.trim(),
      bodyTemplate: betaBodyTemplate,
      replyTo: betaReplyTo.trim() || undefined,
      recipients: testersToSend.map((m) => ({
        name: m.name,
        email: m.google_email.split(/[,;]/)[0].trim(),
        link: getPersonalizedLink(m.name),
      })),
      spreadsheetId: spreadsheetId || undefined,
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
  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title-survey-form"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-violet-700 via-purple-700 to-indigo-800 text-white flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-white border border-white/20">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h2
                id="modal-title-survey-form"
                className="text-base sm:text-lg font-black tracking-tight"
              >
                Survey Form Generator
              </h2>
              <p className="text-xs text-violet-100 font-medium">
                Brenda&apos;s Workflow • Create next month&apos;s Google Form &amp; Response Sheet
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="min-h-[44px] min-w-[44px] rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 bg-slate-100/80 px-6 pt-3 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("form")}
            className={`min-h-[40px] px-4 py-2 font-bold text-xs sm:text-sm rounded-t-xl border-t border-x transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "form"
                ? "bg-slate-50/50 border-slate-200 text-violet-900 shadow-xs -mb-[1px]"
                : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-violet-600" />
            <span>Google Form (Standard)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("beta")}
            className={`min-h-[40px] px-4 py-2 font-bold text-xs sm:text-sm rounded-t-xl border-t border-x transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "beta"
                ? "bg-slate-50/50 border-slate-200 text-violet-900 shadow-xs -mb-[1px]"
                : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
            }`}
          >
            <Mail className="w-4 h-4 text-violet-600" />
            <span>Beta Web Sign-Ups (Phase 2)</span>
            <span className="px-2 py-0.5 text-[10px] font-black tracking-wider uppercase bg-amber-100 text-amber-800 rounded-full border border-amber-300">
              Pilot
            </span>
          </button>
        </div>

        {/* Modal Body */}
        <div
          ref={surveyFormModalBodyRef}
          className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50"
        >
          {activeTab === "form" && (
            <>
              {/* Success Result Banner */}
              {surveyFormResult && surveyFormResult.success && (
                <div className="p-5 bg-emerald-50 border-2 border-emerald-300 rounded-2xl space-y-4 shadow-xs animate-in fade-in duration-200">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2 text-emerald-950 font-bold text-sm sm:text-base">
                      <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                      <span>{surveyFormResult.message}</span>
                    </div>
                    <span className="text-xs font-bold bg-emerald-100 text-emerald-900 px-3 py-1 rounded-full border border-emerald-300 shrink-0">
                      {surveyFormResult.totalDates} Dates Included
                    </span>
                  </div>

                  {/* Quick Action Buttons */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        handleCopySurveyLink(
                          surveyFormResult.formPrefilledUrl || surveyFormResult.formPublishedUrl
                        )
                      }
                      className="min-h-[44px] px-3.5 py-2.5 bg-violet-700 hover:bg-violet-800 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs hover:shadow transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {surveyFormCopiedLink ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                      <span>
                        {surveyFormCopiedLink
                          ? "Link Copied!"
                          : "Copy Survey Link (Defaults Prefilled)"}
                      </span>
                    </button>

                    <a
                      href={surveyFormResult.formPrefilledUrl || surveyFormResult.formPublishedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="min-h-[44px] px-3.5 py-2.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs sm:text-sm font-bold rounded-xl shadow-2xs hover:shadow transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <ExternalLink className="w-4 h-4 text-slate-600" />
                      <span>View Live Form ↗</span>
                    </a>

                    <a
                      href={surveyFormResult.formEditUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="min-h-[44px] px-3.5 py-2.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs sm:text-sm font-bold rounded-xl shadow-2xs hover:shadow transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Pencil className="w-4 h-4 text-purple-600" />
                      <span>Edit Google Form ↗</span>
                    </a>

                    <a
                      href={surveyFormResult.spreadsheetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="min-h-[44px] px-3.5 py-2.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs sm:text-sm font-bold rounded-xl shadow-2xs hover:shadow transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      <span>Response Sheet ↗</span>
                    </a>
                  </div>

                  {surveyFormResult.folderUrl && (
                    <div className="text-xs text-slate-600 flex items-center gap-1.5 pt-1">
                      <Folder className="w-4 h-4 text-slate-500" />
                      <span>Saved inside Google Drive folder:</span>
                      <a
                        href={surveyFormResult.folderUrl}
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

              {/* Form Settings Card */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <Settings className="w-4 h-4 text-violet-600" />
                    Target Month &amp; Form Title
                  </h3>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {["2026-10", "2026-11", "2026-12", "2027-01"].map((mKey) => (
                      <button
                        key={mKey}
                        type="button"
                        onClick={() => {
                          setSurveyFormMonthKey(mKey);
                          loadSurveyFormDatesPreview(mKey);
                        }}
                        className={`min-h-[38px] px-3 py-1.5 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
                          surveyFormMonthKey === mKey
                            ? "bg-violet-700 text-white shadow-xs"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
                        }`}
                      >
                        {mKey}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <label
                        htmlFor="survey-form-month-key"
                        className="block text-xs sm:text-sm font-bold text-slate-800"
                      >
                        Target Month (YYYY-MM)
                      </label>
                      {monthStatus === "OPEN" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Sign-Ups Open
                        </span>
                      ) : monthStatus === "CLOSED" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-purple-900 bg-purple-100 border border-purple-300 rounded-full">
                          <Lock className="w-3 h-3 text-purple-700" />
                          Closed (Scheduled)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-slate-700 bg-slate-100 border border-slate-300 rounded-full">
                          <Clock className="w-3 h-3 text-slate-500" />
                          Draft (Not Open)
                        </span>
                      )}
                    </div>
                    <input
                      id="survey-form-month-key"
                      type="month"
                      value={surveyFormMonthKey}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSurveyFormMonthKey(val);
                        if (val) loadSurveyFormDatesPreview(val);
                      }}
                      className="w-full min-h-[44px] px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 font-semibold text-slate-900"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="survey-form-title"
                      className="block text-xs sm:text-sm font-bold text-slate-800 mb-1.5"
                    >
                      Google Form Title
                    </label>
                    <input
                      id="survey-form-title"
                      type="text"
                      value={surveyFormTitle}
                      onChange={(e) => setSurveyFormTitle(e.target.value)}
                      placeholder="e.g. 26-11 Nov Meal Team Sign-Up"
                      className="w-full min-h-[44px] px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 font-semibold text-slate-900"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="survey-form-folder-id"
                      className="block text-xs sm:text-sm font-bold text-slate-800 mb-1.5"
                    >
                      Target Google Drive Folder ID
                    </label>
                    <input
                      id="survey-form-folder-id"
                      type="text"
                      value={surveyFormFolderId}
                      onChange={(e) => setSurveyFormFolderId(e.target.value)}
                      placeholder="1miNkXw-7co1ncAMZvaRJYUZXkFT07R4o"
                      className="w-full min-h-[44px] px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 font-mono text-slate-800"
                    />
                  </div>
                </div>
              </div>

              {/* Standard Question Suite Preview Summary */}
              <div className="bg-violet-50/80 border border-violet-200 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-violet-950">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-violet-600 shrink-0" />
                    <span>Standard 8-Question Suite Included</span>
                  </div>
                  <span className="text-xs font-bold text-violet-900 bg-violet-100 border border-violet-200 px-3 py-1 rounded-full">
                    Community Standard
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-slate-700 pt-1">
                  <div className="bg-white p-2.5 rounded-xl border border-violet-200 font-medium shadow-2xs">
                    1. Verified Email (1-Click Consent)
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-violet-200 font-medium shadow-2xs">
                    2. Member Name (Text)
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-violet-200 font-medium shadow-2xs">
                    3. Cook Quota (Prefilled 1)
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-violet-200 font-medium shadow-2xs">
                    4. Clean Quota (Prefilled 1)
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-violet-200 font-medium shadow-2xs">
                    5. Max Total Shifts (Combined Cap)
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-violet-200 font-medium shadow-2xs">
                    6. Cook Team Size (Prefilled 3/2)
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-violet-200 font-medium shadow-2xs">
                    7. Same-Day Shift (Prefilled No)
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-violet-200 font-medium shadow-2xs">
                    8. Date Grid (Prefilled &apos;Not Available&apos;, Required)
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-violet-200 font-medium shadow-2xs">
                    9. Notes &amp; Instructions
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-violet-900 font-medium">
                  <span className="bg-violet-100/70 border border-violet-200/80 px-2 py-0.5 rounded-md">
                    ✓ Allow Response Editing
                  </span>
                  <span className="bg-violet-100/70 border border-violet-200/80 px-2 py-0.5 rounded-md">
                    ✓ Limit to 1 Response
                  </span>
                  <span className="bg-violet-100/70 border border-violet-200/80 px-2 py-0.5 rounded-md">
                    ✓ View Results Summary
                  </span>
                  <span className="bg-violet-100/70 border border-violet-200/80 px-2 py-0.5 rounded-md">
                    ✓ Required Response in Each Row
                  </span>
                  <span className="bg-violet-100/70 border border-violet-200/80 px-2 py-0.5 rounded-md">
                    ✓ All Dates Prefilled &apos;Not Available&apos;
                  </span>
                </div>
              </div>

              {/* Interactive Meal Dates Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden space-y-3 p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-violet-600" />
                      Configure Meal Dates for Survey Grid
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Toggle dates on/off, change meal types, or add special notes (e.g.
                      &apos;Thanksgiving&apos;, &apos;Community Meeting&apos;).
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const allIncluded = surveyFormDates.every((d) => d.included);
                        setSurveyFormDates((prev) =>
                          prev.map((d) => ({ ...d, included: !allIncluded }))
                        );
                      }}
                      className="min-h-[38px] px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-colors cursor-pointer"
                    >
                      {surveyFormDates.every((d) => d.included) ? "Deselect All" : "Select All"}
                    </button>

                    <button
                      type="button"
                      onClick={handleAddCustomSurveyDate}
                      className="min-h-[38px] px-3.5 py-1.5 text-xs font-bold text-violet-800 hover:text-violet-950 bg-violet-50 hover:bg-violet-100 border border-violet-300 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Custom Date</span>
                    </button>

                    {onSaveDatesAndOpen && (
                      <button
                        type="button"
                        onClick={onSaveDatesAndOpen}
                        disabled={
                          savingDates || surveyFormDates.filter((d) => d.included).length === 0
                        }
                        className="min-h-[38px] px-3.5 py-1.5 text-xs font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
                        title="Saves configured meal dates/types/notes and opens sign-ups"
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>
                          {savingDates
                            ? "Saving..."
                            : monthStatus === "OPEN"
                              ? "Save Dates (Open)"
                              : "Save Dates & Open Sign-Ups"}
                        </span>
                      </button>
                    )}
                  </div>
                </div>

                {surveyFormLoadingDates ? (
                  <div className="py-12 flex flex-col items-center justify-center text-slate-500 gap-2">
                    <RefreshCw className="w-6 h-6 animate-spin text-violet-600" />
                    <span className="text-xs sm:text-sm font-medium">
                      Calculating meal dates...
                    </span>
                  </div>
                ) : surveyFormDates.length === 0 ? (
                  <div className="py-8 text-center text-xs sm:text-sm text-slate-500">
                    No dates found for this month. Please select a valid month.
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
                            Special Note (Optional)
                          </th>
                          <th scope="col" className="py-3 px-3">
                            Form Grid Row Label Preview
                          </th>
                          <th scope="col" className="py-3 px-3 w-14 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {surveyFormDates.map((d, idx) => {
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
                                    setSurveyFormDates((prev) =>
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
                                      newLabel = `${shortName} ${parseInt(dayNum, 10)} (${mType === "BRUNCH" ? "Sun, Brunch" : "Sun, Dinner"})`;
                                    }
                                    setSurveyFormDates((prev) =>
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
                                    setSurveyFormDates((prev) =>
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
                                    setSurveyFormDates((prev) => prev.filter((_, i) => i !== idx));
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
              </div>
            </>
          )}

          {activeTab === "beta" && (
            <div className="space-y-6">
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
                    Generate personalized survey links for beta testers to submit meal availability
                    and shift preferences directly in the app. Responses are written directly to the{" "}
                    <strong>Web Responses</strong> tab and merged automatically with Google Forms
                    during Step 1 Intake.
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

              {/* Month Selector Bar */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-violet-600" />
                    <span>Target Survey Month</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Links and invitations will be configured for this scheduling cycle.
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {monthStatus === "OPEN" ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 rounded-xl">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      Sign-Ups Open
                    </span>
                  ) : monthStatus === "CLOSED" ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-purple-900 bg-purple-100 border border-purple-300 rounded-xl">
                      <Lock className="w-3.5 h-3.5 text-purple-700" />
                      Closed (Scheduled)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-slate-700 bg-slate-100 border border-slate-300 rounded-xl">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      Draft (Not Open)
                    </span>
                  )}

                  {onSaveDatesAndOpen && monthStatus !== "OPEN" && (
                    <button
                      type="button"
                      onClick={onSaveDatesAndOpen}
                      disabled={
                        savingDates || surveyFormDates.filter((d) => d.included).length === 0
                      }
                      className="min-h-[42px] px-3.5 py-1.5 text-xs font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
                      title="Open sign-ups for beta testers with configured meal dates"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>{savingDates ? "Opening..." : "Save Dates & Open Sign-Ups"}</span>
                    </button>
                  )}

                  {onSetMonthStatus && monthStatus === "OPEN" && (
                    <button
                      type="button"
                      onClick={() => onSetMonthStatus("CLOSED")}
                      className="min-h-[42px] px-3.5 py-1.5 text-xs font-bold text-purple-800 hover:text-purple-950 bg-purple-50 hover:bg-purple-100 border border-purple-300 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      title="Close sign-ups (teams scheduled)"
                    >
                      <Lock className="w-3.5 h-3.5 text-purple-700" />
                      <span>Close Sign-Ups</span>
                    </button>
                  )}

                  {onSetMonthStatus && monthStatus === "CLOSED" && (
                    <button
                      type="button"
                      onClick={() => onSetMonthStatus("OPEN")}
                      className="min-h-[42px] px-3.5 py-1.5 text-xs font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      title="Reopen sign-ups"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Reopen Sign-Ups</span>
                    </button>
                  )}

                  <input
                    type="month"
                    value={surveyFormMonthKey}
                    onChange={(e) => {
                      if (e.target.value) {
                        setSurveyFormMonthKey(e.target.value);
                        loadSurveyFormDatesPreview(e.target.value);
                      }
                    }}
                    className="min-h-[42px] px-3.5 py-2 text-xs sm:text-sm font-bold bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 text-slate-900"
                  />
                </div>
              </div>

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
                  <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs max-h-[420px] overflow-y-auto">
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
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <Mail className="w-4 h-4 text-violet-600" />
                        <span>Transactional Email Template</span>
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Sent via your Google Apps Script account. Coordinators receive direct
                        replies.
                      </p>
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
                      <span className="text-[11px] text-slate-500 mt-1 block">
                        When beta testers hit &quot;Reply&quot;, their message goes to this address.
                      </span>
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
                        rows={7}
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
                      <div className="p-3 bg-white border border-slate-200 rounded-lg text-xs space-y-2 text-slate-800 whitespace-pre-wrap font-sans">
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
                            .replace(/\{\{month\}\}/g, surveyFormMonthKey)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          {activeTab === "beta" ? (
            <>
              <div className="text-xs sm:text-sm text-slate-600 font-medium flex items-center gap-2">
                <Users className="w-4 h-4 text-violet-600" />
                <span>
                  {members.filter((m) => selectedBetaMembers.has(m.name) && m.google_email).length}{" "}
                  beta recipient(s) ready with valid email
                </span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[44px] px-5 py-2.5 text-xs sm:text-sm font-bold text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded-xl cursor-pointer transition-colors"
                >
                  Close
                </button>

                <button
                  type="button"
                  onClick={handleSendBetaInvitations}
                  disabled={
                    sendingBetaInvites ||
                    members.filter((m) => selectedBetaMembers.has(m.name) && m.google_email)
                      .length === 0
                  }
                  className="min-h-[44px] px-6 py-2.5 text-xs sm:text-sm font-bold text-white bg-violet-700 hover:bg-violet-800 rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {sendingBetaInvites ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Sending Invitation Emails...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>
                        Send Beta Invitations (
                        {
                          members.filter((m) => selectedBetaMembers.has(m.name) && m.google_email)
                            .length
                        }
                        )
                      </span>
                    </>
                  )}
                </button>
              </div>
            </>
          ) : surveyFormResult && surveyFormResult.success ? (
            <>
              <div className="flex items-center gap-2 text-xs sm:text-sm text-emerald-900 font-bold">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>✓ &apos;{surveyFormResult.formTitle}&apos; created and linked!</span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[44px] px-5 py-2.5 text-xs sm:text-sm font-bold text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded-xl cursor-pointer transition-colors"
                >
                  Close
                </button>

                <button
                  type="button"
                  onClick={() => handleCopySurveyLink(surveyFormResult.formPublishedUrl)}
                  className="min-h-[44px] px-4 py-2.5 text-xs sm:text-sm font-bold text-violet-800 bg-violet-100 hover:bg-violet-200 border border-violet-300 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {surveyFormCopiedLink ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  <span>{surveyFormCopiedLink ? "Link Copied!" : "Copy Survey Link"}</span>
                </button>

                <a
                  href={surveyFormResult.formPublishedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="min-h-[44px] px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-violet-700 hover:bg-violet-800 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center gap-2 cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Open Live Survey ↗</span>
                </a>
              </div>
            </>
          ) : (
            <>
              <div className="text-xs sm:text-sm text-slate-600 font-medium">
                {surveyFormDates.filter((d) => d.included).length} of {surveyFormDates.length} meal
                dates selected for inclusion in the Google Form.
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[44px] px-5 py-2.5 text-xs sm:text-sm font-bold text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded-xl cursor-pointer transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleExecuteCreateSurveyForm}
                  disabled={
                    surveyFormLoadingCreate ||
                    surveyFormDates.filter((d) => d.included).length === 0
                  }
                  className="min-h-[44px] px-6 py-2.5 text-xs sm:text-sm font-bold text-white bg-violet-700 hover:bg-violet-800 rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {surveyFormLoadingCreate ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Generating Google Form &amp; Response Sheet...</span>
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4" />
                      <span>Generate Google Form &amp; Response Sheet</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

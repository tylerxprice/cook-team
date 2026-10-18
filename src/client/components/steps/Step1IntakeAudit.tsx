import React, { useState, useMemo } from "react";
import {
  FileSpreadsheet,
  ExternalLink,
  RefreshCw,
  Calendar,
  Sparkles,
  Info,
  UserPlus,
  CheckCircle2,
  UserX,
  ChevronRight,
  ClipboardEdit,
  Users,
  ChevronDown,
  ChevronUp,
  Search,
  Lock,
} from "lucide-react";
import { IntakePayload, Member, MonthStatus } from "../../../server/types";
import { formatLastActiveDisplay } from "../../../server/parser";

export interface Step1IntakeAuditProps {
  sheetInput: string;
  setSheetInput: (val: string) => void;
  sheetSelectMode: string;
  handleSelectSheetOption: (val: string) => void;
  fetchIntake: (sheetIdOrUrl: string, masterId?: string, forceRefresh?: boolean) => void;
  loading: boolean;
  isDevMode: boolean;
  liveSheetsList: { id: string; name: string }[];
  devSheetsList: { id: string; name: string }[];
  intakeData: IntakePayload | null;
  members: Member[];
  handleLoadExistingSchedule: () => void;
  linkingAliasFor: string | null;
  selectedCanonicalLinkMap: Record<string, string>;
  setSelectedCanonicalLinkMap: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  handleLinkMemberAlias: (canonicalName: string, unrecognizedAlias: string, email?: string) => void;
  handleAddMember: (e?: React.FormEvent, directName?: string, directEmail?: string) => void;
  updatingMemberName: string | null;
  handleMarkInactive: (memberName: string) => void;
  handleOpenManualSurveyModal: (memberName?: string) => void;
  goToStep: (step: 1 | 2 | 3 | 4) => void;
  onToggleMonthStatus?: (status: MonthStatus) => void;
}

export const Step1IntakeAudit: React.FC<Step1IntakeAuditProps> = ({
  sheetInput,
  setSheetInput,
  sheetSelectMode,
  handleSelectSheetOption,
  fetchIntake,
  loading,
  isDevMode,
  liveSheetsList,
  devSheetsList,
  intakeData,
  members,
  handleLoadExistingSchedule,
  linkingAliasFor,
  selectedCanonicalLinkMap,
  setSelectedCanonicalLinkMap,
  handleLinkMemberAlias,
  handleAddMember,
  updatingMemberName,
  handleMarkInactive,
  handleOpenManualSurveyModal,
  goToStep,
  onToggleMonthStatus,
}) => {
  const [showSubmittedResponses, setShowSubmittedResponses] = useState(false);
  const [submittedSearch, setSubmittedSearch] = useState("");

  const filteredSubmittedResponses = useMemo(() => {
    if (!intakeData?.responses) return [];
    const sorted = [...intakeData.responses].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );
    const q = submittedSearch.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.email && r.email.toLowerCase().includes(q)) ||
        (r.specialInstructions && r.specialInstructions.toLowerCase().includes(q))
    );
  }, [intakeData?.responses, submittedSearch]);
  return (
    <div className="space-y-6">
      {/* Sheet Link & Dropdown Selector Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              <span>Survey Response Spreadsheet</span>
              {loading && <RefreshCw className="w-4 h-4 text-orange-600 animate-spin shrink-0" />}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
              Select a monthly survey response sheet from Google Drive or choose a test scenario
            </p>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            {intakeData && intakeData.monthStatus && (
              <button
                type="button"
                onClick={() =>
                  onToggleMonthStatus?.(intakeData.monthStatus === "OPEN" ? "CLOSED" : "OPEN")
                }
                className={`min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border transition-colors cursor-pointer shadow-2xs ${
                  intakeData.monthStatus === "OPEN"
                    ? "text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border-emerald-300"
                    : "text-purple-900 bg-purple-50 hover:bg-purple-100 border-purple-300"
                }`}
                title={
                  intakeData.monthStatus === "OPEN"
                    ? "Sign-ups are open. Click to close and freeze submissions."
                    : "Sign-ups are closed. Click to reopen."
                }
              >
                {intakeData.monthStatus === "OPEN" ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    <span>Sign-Ups: Open (Click to Close)</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5 text-purple-700 shrink-0" />
                    <span>Sign-Ups: Closed (Click to Reopen)</span>
                  </>
                )}
              </button>
            )}
            {intakeData && (
              <button
                type="button"
                onClick={() => handleOpenManualSurveyModal()}
                className="min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-bold text-orange-950 bg-orange-50 hover:bg-orange-100 rounded-xl border border-orange-300 transition-colors cursor-pointer shadow-2xs"
                title="Enter survey availability response on behalf of a member"
              >
                <ClipboardEdit className="w-4 h-4 text-orange-600 shrink-0" />
                <span>+ Enter Response</span>
              </button>
            )}
            {sheetInput && (
              <a
                href={
                  sheetInput.startsWith("http")
                    ? sheetInput
                    : `https://docs.google.com/spreadsheets/d/${sheetInput}`
                }
                target="_blank"
                rel="noreferrer"
                className="min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-xl border border-emerald-300 transition-colors"
                title="Open spreadsheet in Google Sheets"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open in Sheets</span>
              </a>
            )}
          </div>
        </div>

        {/* Sheet Dropdown Selector */}
        <div className="space-y-2">
          <label
            htmlFor="survey-sheet-select"
            className="text-xs sm:text-sm font-bold text-slate-800 block"
          >
            Select Survey Sheet to Schedule:
          </label>
          <select
            id="survey-sheet-select"
            value={sheetSelectMode}
            onChange={(e) => handleSelectSheetOption(e.target.value)}
            disabled={loading}
            className="w-full min-h-[44px] px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 hover:bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 font-medium text-slate-900 transition-colors cursor-pointer disabled:opacity-60"
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
              <label
                htmlFor="custom-sheet-url-input"
                className="text-xs font-bold text-slate-700 block mb-1"
              >
                Google Sheet URL or Document ID:
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="custom-sheet-url-input"
                  type="text"
                  value={sheetInput}
                  onChange={(e) => setSheetInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && sheetInput.trim()) {
                      fetchIntake(sheetInput, undefined, true);
                    }
                  }}
                  placeholder="Paste Google Sheet URL or ID and press Enter..."
                  className="w-full min-h-[44px] px-3.5 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => fetchIntake(sheetInput, undefined, true)}
                  disabled={loading || !sheetInput.trim()}
                  className="min-h-[44px] px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs sm:text-sm font-bold transition-colors disabled:opacity-50 shrink-0 cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                  <span>Load</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div
          data-testid="intake-loading-card"
          className="bg-white p-12 sm:p-16 rounded-2xl border border-slate-200 shadow-sm text-center space-y-4 max-w-2xl mx-auto my-6 animate-fade-in"
        >
          <div className="w-14 h-14 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center mx-auto shadow-inner">
            <RefreshCw className="w-7 h-7 animate-spin text-orange-600" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              Loading Survey &amp; Availability Data...
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
              Reading survey responses, verifying meal dates, and running member completeness
              audit...
            </p>
          </div>
        </div>
      ) : !intakeData ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 shadow-sm text-center space-y-4 max-w-2xl mx-auto my-6">
          <div className="w-14 h-14 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center mx-auto shadow-inner">
            <FileSpreadsheet className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              Select a Survey to Begin Scheduling
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
              Choose a monthly Google Form response sheet from your Google Drive above, or pick a
              test scenario to load volunteer availability and start matching cook and clean teams.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Existing Schedule Tab Alert Banner */}
          {intakeData.existingScheduleTab?.exists && (
            <div className="p-5 bg-gradient-to-r from-amber-50 to-orange-50/70 border border-amber-300/90 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-amber-100/80 text-amber-800 border border-amber-300/80 flex items-center justify-center shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs sm:text-sm font-bold text-amber-950 flex items-center gap-2 flex-wrap">
                    <span>Finalized Schedule Tab Found:</span>
                    <code className="bg-amber-100/90 border border-amber-300/70 px-2 py-0.5 rounded-lg font-mono text-xs text-amber-950 font-bold">
                      {intakeData.existingScheduleTab.name}
                    </code>
                  </h4>
                  <p className="text-xs text-amber-900 mt-0.5">
                    A completed schedule already exists for this survey in your Google Sheet. You
                    can load it to resume review, or continue below to re-solve.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleLoadExistingSchedule}
                  disabled={loading}
                  className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2.5 bg-amber-800 hover:bg-amber-900 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Load Saved Schedule &amp; Edit in Step 3</span>
                </button>
              </div>
            </div>
          )}

          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Scheduled Meals
              </span>
              <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 my-1">
                {intakeData.mealDates.length}
              </p>
              <p className="text-xs text-slate-600">Total planned dates</p>
            </div>
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Survey Responses
              </span>
              <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 my-1">
                {intakeData.responses.length}
              </p>
              <p className="text-xs text-emerald-800 font-semibold">Responses parsed</p>
            </div>
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Active Member Registry
              </span>
              <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 my-1">
                {intakeData.audit.totalActiveMembers}
              </p>
              <p className="text-xs text-slate-600">Total eligible cooks</p>
            </div>
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Missing Active Members
              </span>
              <p
                className={`text-2xl sm:text-3xl font-extrabold my-1 ${
                  intakeData.audit.missingMembers.length > 0 ? "text-amber-700" : "text-emerald-800"
                }`}
              >
                {intakeData.audit.missingMembers.length}
              </p>
              <p className="text-xs text-slate-600">Needs follow-up</p>
            </div>
          </div>

          {/* Auto-Reactivated Badges Banner */}
          {intakeData.audit.reactivatedMembers.length > 0 && (
            <div className="bg-emerald-50 border border-emerald-300 p-4 rounded-2xl flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-emerald-700 mt-0.5 shrink-0" />
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-emerald-950">
                  Auto-Reactivated Returning Members ({intakeData.audit.reactivatedMembers.length})
                </h3>
                <p className="text-xs text-emerald-900 mt-0.5">
                  The following members were previously inactive but submitted survey responses.
                  Their status was automatically updated to <strong>Active</strong>:
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {intakeData.audit.reactivatedMembers.map((m) => (
                    <span
                      key={m.name}
                      className="px-2.5 py-1 bg-white border border-emerald-300 rounded-lg text-xs font-bold text-emerald-900"
                    >
                      ✨ {m.name} ({m.google_email || "No email"})
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Unrecognized Respondents Alert */}
          {intakeData.audit.unrecognizedRespondents.length > 0 && (
            <div className="bg-sky-50 border border-sky-300 p-4 sm:p-5 rounded-2xl shadow-sm">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-sky-700 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <h3 className="text-sm sm:text-base font-bold text-sky-950">
                    New / Unrecognized Respondents (
                    {intakeData.audit.unrecognizedRespondents.length})
                  </h3>
                  <p className="text-xs sm:text-sm text-sky-900 mt-0.5">
                    The following submitted a survey response but weren&apos;t automatically matched
                    to a member in the master registry. You can link them as a nickname/alias to an
                    existing member, or add them as a new member.
                  </p>

                  <div className="divide-y divide-sky-200 mt-3 bg-white rounded-xl border border-sky-200 overflow-hidden">
                    {intakeData.audit.unrecognizedRespondents.map((unrecName) => {
                      const resp = intakeData.responses.find(
                        (r) => r.name.toLowerCase() === unrecName.toLowerCase()
                      );
                      const chosenCanonical = selectedCanonicalLinkMap[unrecName] || "";
                      const isLinking = linkingAliasFor === unrecName;

                      return (
                        <div
                          key={unrecName}
                          className="p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-sky-50/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-sky-100 text-sky-900 font-bold flex items-center justify-center text-xs sm:text-sm border border-sky-300">
                              {unrecName.charAt(0)}
                            </div>
                            <div>
                              <p className="text-xs sm:text-sm font-bold text-slate-900">
                                {unrecName}
                              </p>
                              <p className="text-xs text-slate-600">
                                {resp?.email
                                  ? `Email: ${resp.email}`
                                  : "No email submitted with response"}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {/* Link to existing member dropdown */}
                            <div className="flex items-center gap-1.5">
                              <select
                                value={chosenCanonical}
                                onChange={(e) =>
                                  setSelectedCanonicalLinkMap((prev) => ({
                                    ...prev,
                                    [unrecName]: e.target.value,
                                  }))
                                }
                                disabled={isLinking}
                                className="min-h-[40px] px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                                aria-label={`Link ${unrecName} to existing member`}
                              >
                                <option value="">-- Link to existing member --</option>
                                {[...members]
                                  .sort((a, b) =>
                                    a.name.localeCompare(b.name, undefined, {
                                      sensitivity: "base",
                                    })
                                  )
                                  .map((m) => (
                                    <option key={m.name} value={m.name}>
                                      {m.name}{" "}
                                      {m.google_email
                                        ? `(${m.google_email.split(/[,;]/)[0].trim()})`
                                        : ""}
                                    </option>
                                  ))}
                              </select>

                              <button
                                type="button"
                                onClick={() =>
                                  handleLinkMemberAlias(chosenCanonical, unrecName, resp?.email)
                                }
                                disabled={!chosenCanonical || isLinking}
                                className={`min-h-[40px] inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                                  !chosenCanonical || isLinking
                                    ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                                    : "bg-sky-600 hover:bg-sky-700 text-white shadow-xs cursor-pointer"
                                }`}
                              >
                                {isLinking ? (
                                  <>
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    <span>Linking...</span>
                                  </>
                                ) : (
                                  <span>Link Nickname</span>
                                )}
                              </button>
                            </div>

                            {/* Or add as new member */}
                            <button
                              type="button"
                              onClick={() => handleAddMember(undefined, unrecName, resp?.email)}
                              disabled={isLinking}
                              className="min-h-[40px] inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                              title="Add as brand new member to directory"
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                              <span>+ Add New Member</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Completeness Audit (Nag Screen Section) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  Completeness Audit (Missing Active Community Members)
                </h3>
                <p className="text-xs sm:text-sm text-slate-600">
                  Active members who have not yet submitted their availability survey.
                </p>
              </div>
              {intakeData.audit.missingMembers.length === 0 && (
                <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-emerald-900 bg-emerald-100 px-3.5 py-1.5 rounded-full border border-emerald-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" /> All Active Members
                  Responded!
                </span>
              )}
            </div>

            {intakeData.audit.missingMembers.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {intakeData.audit.missingMembers.map((m) => {
                  const isUpdating = updatingMemberName === m.name;
                  return (
                    <div
                      key={m.name}
                      className="p-4 flex items-center justify-between hover:bg-slate-50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-900 font-bold flex items-center justify-center text-xs sm:text-sm border border-amber-300">
                          {m.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-xs sm:text-sm font-bold text-slate-900">{m.name}</p>
                          <p className="text-xs text-slate-600">
                            {m.google_email || "No email"} • Last active:{" "}
                            {formatLastActiveDisplay(m.last_active_survey)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                        <button
                          type="button"
                          onClick={() => handleOpenManualSurveyModal(m.name)}
                          aria-label={`Enter survey availability for ${m.name}`}
                          className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 hover:border-emerald-400 transition-colors cursor-pointer shadow-2xs"
                          title="Enter survey availability for this member"
                        >
                          <ClipboardEdit className="w-4 h-4 text-emerald-700 shrink-0" />
                          <span>+ Enter Availability</span>
                        </button>
                        <button
                          onClick={() => handleMarkInactive(m.name)}
                          disabled={isUpdating}
                          aria-label={`Mark ${m.name} as inactive and remove from missing audits`}
                          className={`min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold border transition-colors ${
                            isUpdating
                              ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-75"
                              : "bg-slate-100 hover:bg-rose-50 hover:text-rose-800 text-slate-700 border-slate-300 hover:border-rose-300 cursor-pointer"
                          }`}
                          title="Mark inactive and skip from future nag screens"
                        >
                          {isUpdating ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin text-orange-600 shrink-0" />
                              <span>Updating...</span>
                            </>
                          ) : (
                            <>
                              <UserX className="w-4 h-4 text-slate-600 shrink-0" />
                              <span>Mark as Inactive</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-600 text-xs sm:text-sm font-medium">
                ✨ Excellent! Every active community member has submitted their survey.
              </div>
            )}
          </div>

          {/* Submitted Survey Responses Collapsible Accordion */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setShowSubmittedResponses((prev) => !prev)}
              className="w-full p-5 text-left flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors cursor-pointer"
              aria-expanded={showSubmittedResponses}
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-900 font-bold flex items-center justify-center text-sm border border-blue-200 shrink-0">
                  <Users className="w-5 h-5 text-blue-800" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                    <span>Submitted Survey Responses</span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-900 border border-blue-200">
                      {intakeData.responses.length}
                    </span>
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                    Click to view or manually edit submitted availability responses
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs sm:text-sm font-bold text-blue-700">
                  {showSubmittedResponses ? "Hide Submitted List" : "Show Submitted List"}
                </span>
                {showSubmittedResponses ? (
                  <ChevronUp className="w-4 h-4 text-blue-700" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-blue-700" />
                )}
              </div>
            </button>

            {showSubmittedResponses && (
              <div className="border-t border-slate-100 p-5 space-y-4 bg-slate-50/40">
                {/* Search Filter Bar */}
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={submittedSearch}
                    onChange={(e) => setSubmittedSearch(e.target.value)}
                    placeholder="Search submitted responses by member name, email, or notes..."
                    className="w-full min-h-[42px] pl-10 pr-4 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                {/* Submitted List Items */}
                {filteredSubmittedResponses.length === 0 ? (
                  <div className="p-8 text-center text-xs sm:text-sm text-slate-500 bg-white rounded-xl border border-slate-200">
                    {submittedSearch
                      ? `No submitted responses match "${submittedSearch}".`
                      : "No survey responses have been submitted yet."}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 bg-white rounded-xl border border-slate-200 overflow-hidden">
                    {filteredSubmittedResponses.map((r) => {
                      const availableCount = Object.values(r.availability || {}).filter(
                        (v) => v === "AVAILABLE" || v === "COOK_ONLY" || v === "CLEAN_ONLY"
                      ).length;

                      return (
                        <div
                          key={r.name}
                          className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-900 font-bold flex items-center justify-center text-xs sm:text-sm border border-blue-200 shrink-0">
                              {r.name.charAt(0)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs sm:text-sm font-bold text-slate-900">
                                  {r.name}
                                </span>
                                <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-orange-50 text-orange-800 border border-orange-200">
                                  🍳 Cook: {r.cookQuota ?? 1}
                                </span>
                                <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-sky-50 text-sky-800 border border-sky-200">
                                  🧼 Clean: {r.cleanQuota ?? 1}
                                </span>
                                {typeof r.maxTotalShifts === "number" &&
                                  r.maxTotalShifts < (r.cookQuota ?? 1) + (r.cleanQuota ?? 1) && (
                                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-950 border border-amber-300">
                                      🎯 Max: {r.maxTotalShifts} Shifts
                                    </span>
                                  )}
                                {r.canCookCleanSameDay && (
                                  <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
                                    Same-Day: {r.sameDayPref === "PREFERRED" ? "Preferred" : "Yes"}
                                  </span>
                                )}
                                <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                  📅 {availableCount} Dates Available
                                </span>
                                {r.source === "web" ? (
                                  <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-violet-100 text-violet-800 border border-violet-200">
                                    🌐 Web App
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                    📋 Google Form
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 mt-1 truncate">
                                {r.email ? `Email: ${r.email}` : "No email attached"}
                                {r.timestamp ? ` • Submitted: ${r.timestamp}` : ""}
                              </p>
                              {r.specialInstructions && (
                                <p className="text-xs text-slate-700 mt-1 italic line-clamp-1 bg-amber-50/70 border border-amber-200/80 px-2 py-1 rounded-lg">
                                  💬 &ldquo;{r.specialInstructions}&rdquo;
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                            <button
                              type="button"
                              onClick={() => handleOpenManualSurveyModal(r.name)}
                              className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-300 transition-colors cursor-pointer shadow-2xs"
                              title={`Modify survey response for ${r.name}`}
                            >
                              <ClipboardEdit className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                              <span>Edit Response</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Next Step Button */}
          <div className="flex justify-end">
            <button
              onClick={() => goToStep(2)}
              className="min-h-[48px] inline-flex items-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-colors cursor-pointer"
            >
              <span>Proceed to Notes &amp; Exception Rules</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
};

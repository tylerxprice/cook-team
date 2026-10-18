import React, { useState, useEffect } from "react";
import {
  Sparkles,
  User,
  CheckCircle2,
  Calendar,
  AlertCircle,
  RefreshCw,
  Home,
  ChevronDown,
  ArrowRight,
  Clock,
  Lock,
  CalendarCheck,
} from "lucide-react";
import {
  Member,
  MealDate,
  AvailabilityStatus,
  SurveyResponse,
  WebSurveyResponsePayload,
  ManualSurveyResponseResult,
  MonthStatus,
  SurveyFormDatesPreviewResult,
} from "../../../server/types";
import { SurveyResponseForm } from "../forms/SurveyResponseForm";
import { callGas } from "../../utils/gas";

export interface WebSurveySignupViewProps {
  monthKey?: string;
  initialMemberName?: string;
  spreadsheetId?: string;
  members: Member[];
  mealDates?: MealDate[];
  existingResponses?: SurveyResponse[];
  onBackToHome?: () => void;
  onNavigateToSchedule?: (month?: string) => void;
  communityName?: string;
}

export const WebSurveySignupView: React.FC<WebSurveySignupViewProps> = ({
  monthKey = "2026-11",
  initialMemberName = "",
  spreadsheetId = "",
  members = [],
  mealDates = [],
  existingResponses = [],
  onBackToHome,
  onNavigateToSchedule,
  communityName = "Vancouver Cohousing",
}) => {
  // Member selection state
  const [selectedMemberName, setSelectedMemberName] = useState<string>(() => {
    if (initialMemberName && initialMemberName.trim()) {
      return initialMemberName.trim();
    }
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("cook_team_member_name");
        if (stored && stored.trim()) return stored.trim();
      } catch {}
    }
    return "";
  });

  const [isChangingMember, setIsChangingMember] = useState<boolean>(!selectedMemberName);
  const [memberSearchQuery, setMemberSearchQuery] = useState<string>("");

  // Form Fields State
  const [email, setEmail] = useState<string>("");
  const [cookQuota, setCookQuota] = useState<number>(1);
  const [cleanQuota, setCleanQuota] = useState<number>(1);
  const [maxTotalShifts, setMaxTotalShifts] = useState<number>(2);
  const [cookTeamSizePref, setCookTeamSizePref] = useState<string>("Dinner = 3, Brunch = 2");
  const [sameDayPref, setSameDayPref] = useState<"NO" | "YES" | "PREFERRED">("NO");
  const [availability, setAvailability] = useState<Record<string, AvailabilityStatus>>({});
  const [specialInstructions, setSpecialInstructions] = useState<string>("");

  const [monthStatus, setMonthStatus] = useState<MonthStatus>("OPEN");
  const [loadingMonthStatus, setLoadingMonthStatus] = useState<boolean>(true);

  // Auto-manage mealDates (fallback to getSurveyFormDatesPreview if not loaded via coordinator intake)
  const [activeMealDates, setActiveMealDates] = useState<MealDate[]>(() => {
    if (mealDates && mealDates.length > 0) return mealDates;
    return [];
  });

  useEffect(() => {
    let cancelled = false;
    setLoadingMonthStatus(true);
    callGas<SurveyFormDatesPreviewResult>("getSurveyFormDatesPreview", monthKey)
      .then((res) => {
        if (!cancelled && res) {
          if (res.status) setMonthStatus(res.status);
          if (Array.isArray(res.dates) && res.dates.length > 0) {
            const mapped: MealDate[] = res.dates
              .filter((d: any) => d.included !== false)
              .map((d: any) => ({
                id: d.dateKey || d.dateLabel,
                dateKey: d.dateKey,
                dateLabel: d.dateLabel,
                dayOfWeek: d.dayOfWeek,
                mealType: d.mealType,
                specialNote: d.specialNote,
                targetCookCount: d.mealType === "BRUNCH" ? 2 : 3,
                targetCleanCount: d.mealType === "BRUNCH" ? 2 : 3,
              }));
            setActiveMealDates(mapped);
          }
        }
      })
      .catch((err) => {
        console.warn("Could not load preview meal dates for web survey:", err);
      })
      .finally(() => {
        if (!cancelled) setLoadingMonthStatus(false);
      });

    return () => {
      cancelled = true;
    };
  }, [monthKey]);

  // Submission & UI States
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmittedSuccess, setIsSubmittedSuccess] = useState<boolean>(false);
  const [hasExistingSubmission, setHasExistingSubmission] = useState<boolean>(false);
  const [existingTimestamp, setExistingTimestamp] = useState<string | null>(null);

  // Month Display Title
  const monthTitle = (() => {
    try {
      const [yearStr, monthStr] = monthKey.split("-");
      const d = new Date(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1, 1);
      return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    } catch {
      return monthKey;
    }
  })();

  // Populate or pre-fill form data when member changes
  const populateForMember = (targetName: string) => {
    setSelectedMemberName(targetName);
    setIsSubmittedSuccess(false);
    setErrorMessage(null);

    if (typeof window !== "undefined" && targetName) {
      try {
        localStorage.setItem("cook_team_member_name", targetName);
      } catch {}
    }

    if (!targetName) {
      setEmail("");
      setCookQuota(1);
      setCleanQuota(1);
      setMaxTotalShifts(2);
      setCookTeamSizePref("Dinner = 3, Brunch = 2");
      setSameDayPref("NO");
      setSpecialInstructions("");
      const initAvail: Record<string, AvailabilityStatus> = {};
      for (const d of activeMealDates) {
        initAvail[d.dateLabel] = "UNAVAILABLE";
      }
      setAvailability(initAvail);
      setHasExistingSubmission(false);
      setExistingTimestamp(null);
      return;
    }

    const matchedMember = members.find((m) => m.name.toLowerCase() === targetName.toLowerCase());
    const existingResp = existingResponses.find(
      (r) => r.name.toLowerCase() === targetName.toLowerCase()
    );

    if (existingResp) {
      const respEmail =
        existingResp.email ||
        (matchedMember?.google_email ? matchedMember.google_email.split(/[,;]/)[0].trim() : "");
      const cq = typeof existingResp.cookQuota === "number" ? existingResp.cookQuota : 1;
      const clq = typeof existingResp.cleanQuota === "number" ? existingResp.cleanQuota : 1;
      const mq =
        typeof existingResp.maxTotalShifts === "number" && existingResp.maxTotalShifts > 0
          ? existingResp.maxTotalShifts
          : cq + clq;

      setEmail(respEmail);
      setCookQuota(cq);
      setCleanQuota(clq);
      setMaxTotalShifts(mq);
      setCookTeamSizePref(existingResp.cookTeamSizePref || "Dinner = 3, Brunch = 2");
      setSameDayPref(existingResp.sameDayPref || (existingResp.canCookCleanSameDay ? "YES" : "NO"));
      setSpecialInstructions(existingResp.specialInstructions || "");
      const initAvail: Record<string, AvailabilityStatus> = {};
      for (const d of activeMealDates) {
        initAvail[d.dateLabel] = existingResp.availability?.[d.dateLabel] || "UNAVAILABLE";
      }
      setAvailability(initAvail);
      setHasExistingSubmission(true);
      setExistingTimestamp(existingResp.timestamp || null);
    } else {
      const primaryEmail = matchedMember?.google_email
        ? matchedMember.google_email.split(/[,;]/)[0].trim()
        : "";
      setEmail(primaryEmail);
      setCookQuota(1);
      setCleanQuota(1);
      setMaxTotalShifts(2);
      setCookTeamSizePref("Dinner = 3, Brunch = 2");
      setSameDayPref("NO");
      setSpecialInstructions("");
      const initAvail: Record<string, AvailabilityStatus> = {};
      for (const d of activeMealDates) {
        initAvail[d.dateLabel] = "UNAVAILABLE";
      }
      setAvailability(initAvail);
      setHasExistingSubmission(false);
      setExistingTimestamp(null);
    }
  };

  // Re-sync availability whenever activeMealDates loads or updates
  useEffect(() => {
    if (activeMealDates.length > 0) {
      setAvailability((prev) => {
        const next = { ...prev };
        let hasChanges = false;
        for (const d of activeMealDates) {
          if (!next[d.dateLabel]) {
            next[d.dateLabel] = "UNAVAILABLE";
            hasChanges = true;
          }
        }
        return hasChanges ? next : prev;
      });
    }
  }, [activeMealDates]);

  useEffect(() => {
    if (selectedMemberName) {
      populateForMember(selectedMemberName);
    }
  }, [selectedMemberName, mealDates, existingResponses]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const nameToSubmit = selectedMemberName.trim();
    if (!nameToSubmit) {
      setErrorMessage("Please select your name to submit your response.");
      return;
    }

    const payload: WebSurveyResponsePayload = {
      monthKey,
      spreadsheetId: spreadsheetId.trim() || undefined,
      memberName: nameToSubmit,
      email: email.trim(),
      cookQuota: Math.max(0, cookQuota),
      cleanQuota: Math.max(0, cleanQuota),
      maxTotalShifts: Math.max(0, maxTotalShifts),
      cookTeamSizePref,
      sameDayPref,
      availability,
      specialInstructions: specialInstructions.trim(),
    };

    setSubmitting(true);
    try {
      await callGas<ManualSurveyResponseResult>("saveWebSurveyResponse", payload);
      setIsSubmittedSuccess(true);
      setHasExistingSubmission(true);
      setExistingTimestamp(new Date().toISOString());
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to save your response. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Filter members list for search
  const filteredMembers = members.filter((m) => {
    if (!memberSearchQuery) return true;
    return (
      m.name.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
      (m.google_email && m.google_email.toLowerCase().includes(memberSearchQuery.toLowerCase()))
    );
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-800 border border-violet-200 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-violet-700" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-black text-slate-900 leading-tight">
                {communityName}
              </h1>
              <p className="text-xs text-violet-700 font-bold">Meal Team Sign-Up • {monthTitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onNavigateToSchedule && (
              <button
                type="button"
                onClick={() => onNavigateToSchedule(monthKey)}
                className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-slate-950 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                title="View finalized shifts for this month"
              >
                <Calendar className="w-4 h-4 text-slate-600" />
                <span className="hidden sm:inline">View Shifts</span>
              </button>
            )}
            {onBackToHome && (
              <button
                type="button"
                onClick={onBackToHome}
                className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                title="Return to Hub Home"
                aria-label="Home"
              >
                <Home className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 space-y-6">
        {/* Celebration / Success Card */}
        {isSubmittedSuccess ? (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-emerald-300 shadow-xl space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-800 border-2 border-emerald-300 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-950 px-3 py-1 rounded-lg border border-emerald-300">
                  Response Recorded!
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 pt-1">
                  Thank you, {selectedMemberName}!
                </h2>
                <p className="text-xs sm:text-sm text-slate-600">
                  Your meal shift availability and preferences for <strong>{monthTitle}</strong>{" "}
                  have been saved to the community planning system.
                </p>
              </div>
            </div>

            {/* Response Summary Pills */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
              <div>
                <span className="text-slate-500 font-medium block">Cook Quota:</span>
                <span className="text-slate-900 font-bold text-sm">
                  {cookQuota} shift{cookQuota === 1 ? "" : "s"}
                </span>
              </div>
              <div>
                <span className="text-slate-500 font-medium block">Clean Quota:</span>
                <span className="text-slate-900 font-bold text-sm">
                  {cleanQuota} shift{cleanQuota === 1 ? "" : "s"}
                </span>
              </div>
              <div>
                <span className="text-slate-500 font-medium block">Max Total:</span>
                <span className="text-slate-900 font-bold text-sm">
                  {maxTotalShifts} shift{maxTotalShifts === 1 ? "" : "s"}
                </span>
              </div>
              <div>
                <span className="text-slate-500 font-medium block">Same Day:</span>
                <span className="text-slate-900 font-bold text-sm">
                  {sameDayPref === "PREFERRED" ? "Preferred" : sameDayPref === "YES" ? "Yes" : "No"}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsSubmittedSuccess(false)}
                className="w-full sm:w-auto min-h-[44px] px-5 py-2 text-xs sm:text-sm font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl transition-colors cursor-pointer"
              >
                Edit Response
              </button>

              {onNavigateToSchedule && (
                <button
                  type="button"
                  onClick={() => onNavigateToSchedule(monthKey)}
                  className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-violet-700 hover:bg-violet-800 text-white font-bold rounded-xl text-xs sm:text-sm shadow-sm transition-colors cursor-pointer"
                >
                  <span>View Shifts Schedule</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ) : loadingMonthStatus ? (
          <div className="bg-white rounded-3xl p-12 border border-slate-200 shadow-sm text-center space-y-4">
            <RefreshCw className="w-8 h-8 text-violet-600 animate-spin mx-auto" />
            <p className="text-sm font-semibold text-slate-600">
              Loading sign-up form for {monthTitle}...
            </p>
          </div>
        ) : monthStatus === "NOT_OPEN" ? (
          /* Sign-Ups Not Open Yet View */
          <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200 shadow-sm text-center space-y-6 animate-in fade-in duration-200">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto shadow-2xs">
              <Clock className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider bg-slate-100 text-slate-700 rounded-full border border-slate-200">
                Sign-Ups Not Open Yet
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 pt-1">
                Sign-Ups For {monthTitle} Have Not Opened Yet
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
                Meal dates and shift preferences for {monthTitle} have not been configured by
                Community Meal Coordinator Brenda yet. Once the coordinator sets up the dates and
                opens sign-ups, you will be able to submit your availability here.
              </p>
            </div>

            {selectedMemberName && (
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-medium border border-slate-200">
                <span>
                  Signed in as: <strong>{selectedMemberName}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setIsChangingMember(true)}
                  className="text-violet-700 hover:text-violet-900 font-bold ml-1 cursor-pointer"
                >
                  (Switch)
                </button>
              </div>
            )}

            {isChangingMember && (
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl max-w-md mx-auto space-y-3 text-left">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="not-open-member-search"
                    className="text-xs font-bold text-slate-700"
                  >
                    Switch community member:
                  </label>
                  {selectedMemberName && (
                    <button
                      type="button"
                      onClick={() => setIsChangingMember(false)}
                      className="text-xs text-slate-500 hover:text-slate-800 font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                </div>
                <input
                  id="not-open-member-search"
                  type="text"
                  value={memberSearchQuery}
                  onChange={(e) => setMemberSearchQuery(e.target.value)}
                  placeholder="Search name..."
                  className="w-full min-h-[38px] px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl"
                />
                <div className="grid grid-cols-2 gap-1.5 max-h-[160px] overflow-y-auto">
                  {filteredMembers.map((m) => (
                    <button
                      key={m.name}
                      type="button"
                      onClick={() => {
                        populateForMember(m.name);
                        setIsChangingMember(false);
                      }}
                      className="text-left px-2.5 py-1.5 text-xs font-bold rounded-lg border bg-white hover:bg-violet-50 text-slate-800 border-slate-200 truncate cursor-pointer"
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              {onNavigateToSchedule && (
                <button
                  type="button"
                  onClick={() => onNavigateToSchedule()}
                  className="w-full sm:w-auto px-6 py-2.5 text-xs sm:text-sm font-bold text-white bg-violet-700 hover:bg-violet-800 rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Calendar className="w-4 h-4" />
                  <span>View Latest Published Shifts Schedule</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Main Survey Form Container */
          <div className="bg-white rounded-3xl p-5 sm:p-8 border border-slate-200 shadow-sm space-y-6">
            {/* Closed Banner if Teams Scheduled */}
            {monthStatus === "CLOSED" && (
              <div className="bg-amber-50/90 border-2 border-amber-300 rounded-2xl p-4 sm:p-5 text-slate-900 space-y-3 shadow-xs">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center shrink-0 text-amber-700 mt-0.5">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider bg-amber-200 text-amber-950 rounded-full border border-amber-300">
                        Sign-Ups Closed
                      </span>
                      <span className="text-xs font-bold text-amber-800">
                        Teams Have Been Scheduled
                      </span>
                    </div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 mt-1">
                      Cook &amp; Clean Teams for {monthTitle} Are Finalized
                    </h3>
                    <p className="text-xs text-slate-700 mt-1 leading-relaxed">
                      Availability submissions for this month are now closed because the monthly
                      schedule has already been generated.
                      {hasExistingSubmission
                        ? " Your submitted availability is displayed below in read-only mode."
                        : " No availability was recorded for this member before closing."}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-amber-200/80">
                  {onNavigateToSchedule && (
                    <button
                      type="button"
                      onClick={() => onNavigateToSchedule(monthKey)}
                      className="px-4 py-2 text-xs font-bold text-white bg-violet-700 hover:bg-violet-800 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <CalendarCheck className="w-4 h-4" />
                      <span>View Published Shifts Schedule →</span>
                    </button>
                  )}
                  <span className="text-xs text-slate-500 italic">
                    Need to swap a shift? Please contact your Community Meal Coordinator directly.
                  </span>
                </div>
              </div>
            )}

            {/* Resident Greeting & Member Switcher */}
            <div className="bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-violet-600 text-white flex items-center justify-center font-black text-lg shadow-xs shrink-0">
                  {selectedMemberName ? (
                    selectedMemberName.slice(0, 1).toUpperCase()
                  ) : (
                    <User className="w-6 h-6" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-violet-900 bg-violet-100 border border-violet-300 px-2.5 py-0.5 rounded-lg">
                      Community Member
                    </span>
                    {monthStatus === "OPEN" ? (
                      <span className="text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-lg flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Sign-Ups Open
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-lg flex items-center gap-1">
                        <Lock className="w-3 h-3 text-amber-600" />
                        Locked (Scheduled)
                      </span>
                    )}
                    {hasExistingSubmission && (
                      <span className="text-xs font-semibold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-lg">
                        Previously Submitted
                      </span>
                    )}
                  </div>
                  <h2 className="text-lg sm:text-xl font-black text-slate-900 mt-0.5">
                    {selectedMemberName
                      ? `Hi, ${selectedMemberName}!`
                      : "Welcome! Please choose your name:"}
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsChangingMember(!isChangingMember)}
                className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-violet-900 bg-white hover:bg-violet-100/60 border border-violet-300 rounded-xl transition-colors cursor-pointer self-start sm:self-center"
              >
                <span>{selectedMemberName ? "Switch Person" : "Select Name"}</span>
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>

            {/* In-Place Member Selector Drawer */}
            {isChangingMember && (
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-3 animate-in fade-in duration-150">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="survey-member-search-input"
                    className="text-xs font-bold text-slate-700"
                  >
                    Choose who is filling out this survey:
                  </label>
                  {selectedMemberName && (
                    <button
                      type="button"
                      onClick={() => setIsChangingMember(false)}
                      className="text-xs text-slate-500 hover:text-slate-800 font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                </div>

                <input
                  id="survey-member-search-input"
                  type="text"
                  value={memberSearchQuery}
                  onChange={(e) => setMemberSearchQuery(e.target.value)}
                  placeholder="Search community member name..."
                  className="w-full min-h-[40px] px-3.5 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                />

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-[220px] overflow-y-auto p-1">
                  {filteredMembers.map((m) => {
                    const isSelected = selectedMemberName.toLowerCase() === m.name.toLowerCase();
                    return (
                      <button
                        key={m.name}
                        type="button"
                        onClick={() => {
                          populateForMember(m.name);
                          setIsChangingMember(false);
                          setMemberSearchQuery("");
                        }}
                        className={`min-h-[40px] px-3 py-2 text-xs font-bold rounded-xl border text-left truncate transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-violet-700 text-white border-violet-800 shadow-xs"
                            : "bg-white hover:bg-violet-50 text-slate-800 border-slate-200"
                        }`}
                      >
                        {m.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Notice if Pre-filling from Previous Response */}
            {hasExistingSubmission && (
              <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs sm:text-sm text-blue-900 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>
                    {monthStatus === "CLOSED"
                      ? "Your recorded responses are shown below in read-only mode."
                      : "Your current responses are loaded below. You can update any answers and re-save anytime!"}
                  </span>
                </div>
                {existingTimestamp && (
                  <span className="text-[11px] text-blue-700 font-mono shrink-0 hidden sm:inline">
                    Last saved: {new Date(existingTimestamp).toLocaleDateString()}
                  </span>
                )}
              </div>
            )}

            {/* Error Message Alert */}
            {errorMessage && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs sm:text-sm text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* The Shared Availability & Preference Controls */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <SurveyResponseForm
                mealDates={activeMealDates}
                cookQuota={cookQuota}
                setCookQuota={setCookQuota}
                cleanQuota={cleanQuota}
                setCleanQuota={setCleanQuota}
                maxTotalShifts={maxTotalShifts}
                setMaxTotalShifts={setMaxTotalShifts}
                cookTeamSizePref={cookTeamSizePref}
                setCookTeamSizePref={setCookTeamSizePref}
                sameDayPref={sameDayPref}
                setSameDayPref={setSameDayPref}
                availability={availability}
                setAvailability={setAvailability}
                specialInstructions={specialInstructions}
                setSpecialInstructions={setSpecialInstructions}
                disabled={submitting || monthStatus === "CLOSED"}
                accentColor="violet"
              />

              {/* Submit Button */}
              <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                <p className="text-xs text-slate-500">
                  {monthStatus === "CLOSED"
                    ? "Sign-ups are closed because monthly teams are already scheduled."
                    : "Submitting will safely record your response in the community response sheet."}
                </p>

                <button
                  type="submit"
                  disabled={submitting || !selectedMemberName || monthStatus === "CLOSED"}
                  className="w-full sm:w-auto min-h-[48px] inline-flex items-center justify-center gap-2 px-8 py-3 bg-violet-700 hover:bg-violet-800 disabled:opacity-50 text-white font-bold rounded-xl text-sm shadow-sm transition-colors cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Saving Response...</span>
                    </>
                  ) : monthStatus === "CLOSED" ? (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>Sign-Ups Closed (Schedule Published)</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        {hasExistingSubmission
                          ? "Update My Availability"
                          : "Submit My Availability"}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
};

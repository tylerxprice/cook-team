import React, { useState, useEffect } from "react";
import {
  User,
  CheckCircle2,
  Calendar,
  AlertCircle,
  ChevronDown,
  Clock,
  Lock,
  ArrowLeft,
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
import { TopHeader } from "../common/TopHeader";
import { LoadingSpinner } from "../common/LoadingSpinner";
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
  onNavigateToSchedule: _onNavigateToSchedule,
  communityName = "Vancouver Cohousing",
}) => {
  const isLockedMember = Boolean(initialMemberName && initialMemberName.trim());

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

  const isSignupsOpen = monthStatus === "OPEN" || monthStatus === "SIGN_UPS_OPEN";
  const isNotOpenYet = monthStatus === "NOT_OPEN" || monthStatus === "STAGING_DATES";
  const isClosed = !isSignupsOpen && !isNotOpenYet;

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

    const SYSTEM_PARAMS = [
      "createoauthdialog",
      "createOAuthDialog",
      "authuser",
      "usp",
      "gclid",
      "gad_source",
    ];
    if (typeof window !== "undefined") {
      try {
        if (targetName) {
          localStorage.setItem("cook_team_member_name", targetName);
        }
      } catch {}
      const url = new URL(window.location.href);
      SYSTEM_PARAMS.forEach((p) => url.searchParams.delete(p));
      url.searchParams.set("view", "survey");
      if (monthKey) url.searchParams.set("month", monthKey);
      if (targetName) {
        url.searchParams.set("m", targetName);
      } else {
        url.searchParams.delete("m");
      }
      url.hash = "";
      window.history.replaceState({ view: "survey", member: targetName }, "", url.toString());
    }
    if (typeof (window as any).google !== "undefined" && (window as any).google?.script?.history) {
      try {
        const gasParams: Record<string, string> = {
          view: "survey",
        };
        if (monthKey) gasParams.month = monthKey;
        if (targetName) gasParams.m = targetName;
        (window as any).google.script.history.replace(
          { view: "survey", member: targetName },
          gasParams,
          ""
        );
      } catch (err) {
        console.warn("GAS history replace failed:", err);
      }
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-16 font-sans transition-colors">
      {/* Top Navigation Bar - Standard CoHo CookTeam Header */}
      <TopHeader
        communityName={communityName}
        onBackToHome={onBackToHome}
        viewBadge={
          <span className="px-3 py-1 text-xs font-black uppercase tracking-wider rounded-xl bg-orange-100 dark:bg-orange-950/60 text-orange-950 dark:text-orange-300 border border-orange-300 dark:border-orange-800 inline-flex items-center gap-1.5 shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-orange-700 dark:text-orange-400" />
            <span>{monthTitle} Sign-Up</span>
          </span>
        }
      >
        {onBackToHome && (
          <button
            type="button"
            onClick={onBackToHome}
            className="min-h-[38px] px-3.5 py-1.5 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 shadow-2xs"
            title="Return to Hub Home"
          >
            <ArrowLeft className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span className="hidden sm:inline">Hub Home</span>
          </button>
        )}
      </TopHeader>

      {/* Main Content Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 space-y-6">
        {/* Celebration / Success Card */}
        {isSubmittedSuccess ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border-2 border-emerald-300 dark:border-emerald-800 shadow-xl space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-2 border-emerald-300 dark:border-emerald-800 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/60 text-emerald-950 dark:text-emerald-300 px-3 py-1 rounded-lg border border-emerald-300 dark:border-emerald-800">
                  Response Recorded!
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white pt-1">
                  Thank you, {selectedMemberName}!
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                  Your meal shift availability and preferences for <strong>{monthTitle}</strong>{" "}
                  have been saved to the community planning system.
                </p>
              </div>
            </div>

            {/* Response Summary Pills */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs">
              <div>
                <span className="text-slate-500 dark:text-slate-400 font-medium block">
                  Cook Quota:
                </span>
                <span className="text-slate-900 dark:text-white font-bold text-sm">
                  {cookQuota} shift{cookQuota === 1 ? "" : "s"}
                </span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 font-medium block">
                  Clean Quota:
                </span>
                <span className="text-slate-900 dark:text-white font-bold text-sm">
                  {cleanQuota} shift{cleanQuota === 1 ? "" : "s"}
                </span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 font-medium block">
                  Max Total:
                </span>
                <span className="text-slate-900 dark:text-white font-bold text-sm">
                  {maxTotalShifts} shift{maxTotalShifts === 1 ? "" : "s"}
                </span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 font-medium block">
                  Same Day:
                </span>
                <span className="text-slate-900 dark:text-white font-bold text-sm">
                  {sameDayPref === "PREFERRED" ? "Preferred" : sameDayPref === "YES" ? "Yes" : "No"}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsSubmittedSuccess(false)}
                className="w-full sm:w-auto min-h-[44px] px-5 py-2 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-xl transition-colors cursor-pointer"
              >
                Edit Response
              </button>

              {onBackToHome && (
                <button
                  type="button"
                  onClick={onBackToHome}
                  className="w-full sm:w-auto min-h-[44px] px-5 py-2 text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  Return to Hub Home
                </button>
              )}
            </div>
          </div>
        ) : loadingMonthStatus ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 border border-slate-200 dark:border-slate-800 shadow-sm text-center space-y-4">
            <LoadingSpinner size="lg" color="orange" className="mx-auto" />
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
              Loading sign-up form for {monthTitle}...
            </p>
          </div>
        ) : isNotOpenYet ? (
          /* Sign-Ups Not Open Yet View */
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-10 border border-slate-200 dark:border-slate-800 shadow-sm text-center space-y-6 animate-in fade-in duration-200">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 flex items-center justify-center mx-auto shadow-2xs">
              <Clock className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full border border-slate-200 dark:border-slate-700">
                Sign-Ups Not Open Yet
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white pt-1">
                Sign-Ups For {monthTitle} Have Not Opened Yet
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
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
                {isLockedMember ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-200/80 px-2 py-0.5 rounded-md ml-1">
                    <Lock className="w-3 h-3 text-slate-500" />
                    Personal Link
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsChangingMember(true)}
                    className="text-orange-600 hover:text-orange-800 dark:text-orange-400 dark:hover:text-orange-300 font-bold ml-1 cursor-pointer"
                  >
                    (Switch)
                  </button>
                )}
              </div>
            )}

            {!isLockedMember && isChangingMember && (
              <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl max-w-md mx-auto space-y-3 text-left">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="not-open-member-search"
                    className="text-xs font-bold text-slate-700 dark:text-slate-300"
                  >
                    Switch community member:
                  </label>
                  {selectedMemberName && (
                    <button
                      type="button"
                      onClick={() => setIsChangingMember(false)}
                      className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-bold cursor-pointer"
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
                  className="w-full min-h-[38px] px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
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
                      className="text-left px-2.5 py-1.5 text-xs font-bold rounded-lg border bg-white dark:bg-slate-900 hover:bg-orange-50 dark:hover:bg-orange-950/40 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 truncate cursor-pointer transition-colors"
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {onBackToHome && (
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={onBackToHome}
                  className="w-full sm:w-auto px-6 py-2.5 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer border border-slate-200 dark:border-slate-700"
                >
                  <ArrowLeft className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  <span>Return to Hub Home</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Main Survey Form Container */
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            {/* Closed Banner if Teams Scheduled */}
            {isClosed && (
              <div className="bg-amber-50/90 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-800 rounded-2xl p-4 sm:p-5 text-slate-900 dark:text-slate-100 space-y-3 shadow-xs">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/60 border border-amber-300 dark:border-amber-700 flex items-center justify-center shrink-0 text-amber-700 dark:text-amber-300 mt-0.5">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider bg-amber-200 dark:bg-amber-900/80 text-amber-950 dark:text-amber-200 rounded-full border border-amber-300 dark:border-amber-700">
                        Sign-Ups Closed
                      </span>
                      <span className="text-xs font-bold text-amber-800 dark:text-amber-300">
                        Teams Have Been Scheduled
                      </span>
                    </div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white mt-1">
                      Cook &amp; Clean Teams for {monthTitle} Are Finalized
                    </h3>
                    <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">
                      Availability submissions for this month are now closed because the monthly
                      schedule has already been generated.
                      {hasExistingSubmission
                        ? " Your submitted availability is displayed below in read-only mode."
                        : " No availability was recorded for this member before closing."}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-amber-200/80 dark:border-amber-800/80">
                  <span className="text-xs text-slate-600 dark:text-slate-400 italic">
                    Need to swap a shift? Please contact your Community Meal Coordinator directly.
                  </span>
                  {onBackToHome && (
                    <button
                      type="button"
                      onClick={onBackToHome}
                      className="px-3.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-amber-100/80 hover:bg-amber-200 dark:bg-amber-900/50 dark:hover:bg-amber-900/80 border border-amber-300 dark:border-amber-700 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                      <span>Return to Hub Home</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Resident Greeting & Member Switcher */}
            <div className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-slate-900 dark:bg-orange-600 text-white flex items-center justify-center font-black text-lg shadow-xs shrink-0">
                  {selectedMemberName ? (
                    selectedMemberName.slice(0, 1).toUpperCase()
                  ) : (
                    <User className="w-6 h-6" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-0.5 rounded-lg">
                      Community Member
                    </span>
                    <span className="text-xs font-black text-orange-950 dark:text-orange-300 bg-orange-100 dark:bg-orange-950/60 border border-orange-300 dark:border-orange-800 px-2.5 py-0.5 rounded-lg shadow-2xs">
                      Meal Team Sign-Up • {monthTitle}
                    </span>
                    {isSignupsOpen ? (
                      <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 px-2 py-0.5 rounded-lg flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Sign-Ups Open
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 px-2 py-0.5 rounded-lg flex items-center gap-1">
                        <Lock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                        Locked (Scheduled)
                      </span>
                    )}
                    {hasExistingSubmission && (
                      <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 px-2 py-0.5 rounded-lg">
                        Previously Submitted
                      </span>
                    )}
                  </div>
                  <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mt-1">
                    {selectedMemberName
                      ? `Hi, ${selectedMemberName}! Meal Team Sign-Up for ${monthTitle}`
                      : `Welcome! Please choose your name for ${monthTitle} Meal Team Sign-Up:`}
                  </h2>
                </div>
              </div>

              {isLockedMember ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold self-start sm:self-center shadow-2xs">
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                  <span>Personal Link</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsChangingMember(!isChangingMember)}
                  className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-xl transition-colors cursor-pointer self-start sm:self-center"
                >
                  <span>{selectedMemberName ? "Switch Person" : "Select Name"}</span>
                  <ChevronDown className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* In-Place Member Selector Drawer */}
            {!isLockedMember && isChangingMember && (
              <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl space-y-3 animate-in fade-in duration-150">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="survey-member-search-input"
                    className="text-xs font-bold text-slate-700 dark:text-slate-300"
                  >
                    Choose who is filling out this survey:
                  </label>
                  {selectedMemberName && (
                    <button
                      type="button"
                      onClick={() => setIsChangingMember(false)}
                      className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-bold cursor-pointer"
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
                  className="w-full min-h-[40px] px-3.5 py-2 text-xs sm:text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
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
                            ? "bg-orange-600 text-white border-orange-700 shadow-xs"
                            : "bg-white dark:bg-slate-900 hover:bg-orange-50 dark:hover:bg-orange-950/40 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700"
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
              <div className="p-3.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl text-xs sm:text-sm text-blue-900 dark:text-blue-200 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span>
                    {isClosed
                      ? "Your recorded responses are shown below in read-only mode."
                      : "Your current responses are loaded below. You can update any answers and re-save anytime!"}
                  </span>
                </div>
                {existingTimestamp && (
                  <span className="text-[11px] text-blue-700 dark:text-blue-300 font-mono shrink-0 hidden sm:inline">
                    Last saved: {new Date(existingTimestamp).toLocaleDateString()}
                  </span>
                )}
              </div>
            )}

            {/* Error Message Alert */}
            {errorMessage && (
              <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs sm:text-sm text-rose-800 dark:text-rose-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* The Shared Availability & Preference Controls */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <SurveyResponseForm
                monthKey={monthKey}
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
                disabled={submitting || isClosed}
                accentColor="orange"
              />

              {/* Submit Button */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isClosed
                    ? "Sign-ups are closed because monthly teams are already scheduled."
                    : "Submitting will safely record your response in the community response sheet."}
                </p>

                <button
                  type="submit"
                  disabled={submitting || !selectedMemberName || isClosed}
                  className="w-full sm:w-auto min-h-[48px] inline-flex items-center justify-center gap-2 px-8 py-3 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm shadow-sm transition-colors cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <LoadingSpinner size="sm" color="white" />
                      <span>Saving Response...</span>
                    </>
                  ) : isClosed ? (
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

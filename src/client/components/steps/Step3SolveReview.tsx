import React from "react";
import {
  Calendar,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Plus,
  Search,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import {
  ScheduleOutput,
  IntakePayload,
  MemberQuotaStat,
  DaySchedule,
  ConstraintViolation,
  NearCompleteMealOpportunity,
  ExceptionRule,
} from "../../../server/types";
import { formatDisplayDateLabel } from "../../utils/formatters";

interface Step3SolveReviewProps {
  solverResult: ScheduleOutput | null;
  loading: boolean;
  intakeData: IntakePayload | null;
  exceptions?: ExceptionRule[];
  showNonParticipatingQuota: boolean;
  setShowNonParticipatingQuota: React.Dispatch<React.SetStateAction<boolean>>;
  handleRunSolver: () => void;
  handleLoadExistingSchedule?: () => void;
  handleSaveTeamsAndProceed?: () => Promise<void>;
  savingTeams?: boolean;
  handleCancelMeal: (dateKey: string) => void;
  handleRestoreMeal: (dateKey: string) => void;
  setSelectedNearCompleteDateKey: (dateKey: string | null) => void;
  setSelectedQuotaMember: (name: string | null) => void;
  setSelectedQuotaFocusDateKey: (dateKey: string | null) => void;
  setSelectedSlotToFill: (
    slot: {
      dateKey: string;
      dateLabel: string;
      role: "COOK" | "CLEAN";
    } | null
  ) => void;
  goToStep: (step: 1 | 2 | 3 | 4) => void;
  sheetInput?: string;
}

export const Step3SolveReview: React.FC<Step3SolveReviewProps> = ({
  solverResult,
  loading,
  intakeData,
  exceptions,
  showNonParticipatingQuota,
  setShowNonParticipatingQuota,
  handleRunSolver,
  handleLoadExistingSchedule,
  handleSaveTeamsAndProceed,
  savingTeams = false,
  handleCancelMeal,
  handleRestoreMeal,
  setSelectedNearCompleteDateKey,
  setSelectedQuotaMember,
  setSelectedQuotaFocusDateKey,
  setSelectedSlotToFill,
  goToStep,
  sheetInput = "",
}) => {
  const [showOverwriteModal, setShowOverwriteModal] = React.useState<boolean>(false);

  const sheetUrl = React.useMemo(() => {
    if (!sheetInput) return "";
    return sheetInput.startsWith("http")
      ? sheetInput
      : `https://docs.google.com/spreadsheets/d/${sheetInput}/edit`;
  }, [sheetInput]);

  const requestRunSolver = () => {
    if (intakeData?.existingScheduleTab?.exists) {
      setShowOverwriteModal(true);
    } else {
      handleRunSolver();
    }
  };
  const totalPlannedDates = solverResult ? solverResult.schedule.length : 0;
  const activeMeals = solverResult
    ? solverResult.schedule.filter((d: DaySchedule) => d.targetCookCount > 0 && !d.isNoMeal)
    : [];
  const cancelledDates = solverResult
    ? solverResult.schedule.filter((d: DaySchedule) => d.targetCookCount === 0 || d.isNoMeal)
    : [];
  const staffedActiveMeals = activeMeals.filter(
    (d: DaySchedule) => d.unfilledCooks === 0 && d.unfilledCleaners === 0
  );
  const needyActiveMeals = activeMeals.filter(
    (d: DaySchedule) => d.unfilledCooks > 0 || d.unfilledCleaners > 0
  );

  const isAllPlannedStaffed =
    solverResult && cancelledDates.length === 0 && solverResult.unfilledSlotsCount === 0;
  const isAllActiveStaffed = solverResult && solverResult.unfilledSlotsCount === 0;

  let headlineTitle = "Schedule Review";
  if (solverResult) {
    if (isAllPlannedStaffed) {
      headlineTitle = `All ${totalPlannedDates} Planned Meals Fully Staffed!`;
    } else if (isAllActiveStaffed) {
      headlineTitle = `${activeMeals.length} of ${totalPlannedDates} Planned Meals Staffed (${cancelledDates.length} Cancelled)`;
    } else if (cancelledDates.length > 0) {
      headlineTitle = `${staffedActiveMeals.length} of ${totalPlannedDates} Planned Meals Staffed (${needyActiveMeals.length} Need Attention, ${cancelledDates.length} Cancelled)`;
    } else {
      headlineTitle = `${needyActiveMeals.length} of ${totalPlannedDates} Scheduled Meals Need Attention`;
    }
  }

  let subtitleText = "Review meal assignments, fill open shifts, and inspect volunteer quotas.";
  if (solverResult) {
    if (isAllPlannedStaffed) {
      subtitleText = "Every planned dinner and brunch has a complete cook and clean team assigned.";
    } else if (isAllActiveStaffed) {
      subtitleText = `${activeMeals.length} active meals are 100% complete. ${cancelledDates.length} date(s) were cancelled to prevent understaffed meals (click 'Restore Date' on any cancelled card to re-open).`;
    } else {
      subtitleText = `${solverResult.unfilledSlotsCount} open shift(s) remaining across ${needyActiveMeals.length} meal(s). Click [+ Fill Slot] on any date card to resolve.`;
    }
  }

  return (
    <div className="space-y-6">
      {/* Unified Step 3 Header & Completeness Bar */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
        <div className="flex items-center gap-3.5">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
              !solverResult
                ? "bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800"
                : isAllActiveStaffed
                  ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                  : "bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
            }`}
          >
            {!solverResult ? (
              <Calendar className="w-5 h-5" />
            ) : isAllActiveStaffed ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-700 dark:text-emerald-400" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-amber-800 dark:text-amber-400" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                {headlineTitle}
              </h2>
              {solverResult && (
                <span
                  className={`text-xs font-bold px-3 py-1 rounded-full ${
                    isAllActiveStaffed
                      ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-950 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800"
                      : "bg-amber-100 dark:bg-amber-950/60 text-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-800"
                  }`}
                >
                  {staffedActiveMeals.length} / {activeMeals.length} Active Confirmed
                </span>
              )}
              {cancelledDates.length > 0 && (
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700">
                  {cancelledDates.length} Dates Cancelled (No Meal)
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
              {subtitleText}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {intakeData?.existingScheduleTab?.exists && !solverResult && handleLoadExistingSchedule && (
            <button
              type="button"
              onClick={() => handleLoadExistingSchedule()}
              disabled={loading}
              className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Load Saved Schedule</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => requestRunSolver()}
            disabled={loading}
            className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span>{solverResult ? "Re-Run Solver" : "Run Solver"}</span>
          </button>
        </div>
      </div>

      {/* Empty State when solverResult has not run yet */}
      {!solverResult && !loading && intakeData?.existingScheduleTab?.exists && (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 p-8 sm:p-10 rounded-2xl border border-emerald-300 dark:border-emerald-800 text-center space-y-4 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 text-xs font-bold mb-2">
              Finalized Schedule Tab Found
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center justify-center gap-2 flex-wrap">
              <span>Schedule</span>
              {sheetUrl ? (
                <a
                  href={sheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  title="Open schedule tab in Google Sheets"
                  className="font-mono text-emerald-800 dark:text-emerald-300 hover:underline inline-flex items-center gap-1"
                >
                  <span>&quot;{intakeData.existingScheduleTab.name}&quot;</span>
                  <ExternalLink className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                </a>
              ) : (
                <span>&quot;{intakeData.existingScheduleTab.name}&quot;</span>
              )}
              <span>Detected</span>
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto mt-1">
              A published or previously generated schedule roster exists in this spreadsheet.
              You can load this existing schedule to inspect and make manual adjustments, or run the matchmaker solver to generate a fresh roster.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            {handleLoadExistingSchedule && (
              <button
                type="button"
                onClick={() => handleLoadExistingSchedule()}
                disabled={loading}
                className="w-full sm:w-auto min-h-[48px] inline-flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" /> Load Finalized Schedule Tab
              </button>
            )}
            <button
              type="button"
              onClick={() => requestRunSolver()}
              disabled={loading}
              className="w-full sm:w-auto min-h-[48px] inline-flex items-center justify-center gap-2 px-6 py-3 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-orange-600 dark:text-orange-400" /> Run Matchmaker Solver
            </button>
          </div>
        </div>
      )}

      {!solverResult && !loading && !intakeData?.existingScheduleTab?.exists && (
        <div className="bg-white dark:bg-slate-900 p-12 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-4 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-400 flex items-center justify-center mx-auto shadow-inner">
            <Sparkles className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Ready to Match Teams
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-sm mx-auto mt-1">
              Click the button below to generate optimal, constraint-satisfying cook and clean
              rosters for all monthly meals.
            </p>
          </div>
          <button
            type="button"
            onClick={() => requestRunSolver()}
            disabled={loading}
            className="min-h-[48px] inline-flex items-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-orange-600/20 transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4" /> Run Matchmaker Solver
          </button>
        </div>
      )}

      {/* Constraint Violations (if any) */}
      {solverResult && solverResult.violations.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 p-5 rounded-2xl space-y-2">
          <div className="flex items-center gap-2 text-amber-950 dark:text-amber-200 text-xs sm:text-sm font-bold">
            <AlertTriangle className="w-4 h-4 text-amber-800 dark:text-amber-400" />
            <span>Soft Preference Violations ({solverResult.violations.length})</span>
          </div>
          <div className="space-y-1">
            {solverResult.violations.map((v: ConstraintViolation, i: number) => (
              <p key={i} className="text-xs text-amber-900 dark:text-amber-300 font-medium">
                • {v.description}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Visual Schedule Cards */}
      {solverResult && (
        <div className="space-y-4">
          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
            Generated Monthly Shift Roster ({solverResult.schedule.length} Dates)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {solverResult.schedule.map((day: DaySchedule) => {
              const isNoMeal =
                (day.targetCookCount === 0 &&
                  day.targetCleanCount === 0 &&
                  day.cooks.length === 0 &&
                  day.cleaners.length === 0) ||
                (Boolean(day.specialNote && day.specialNote.includes("NO COMMUNITY MEAL")) &&
                  day.cooks.length === 0 &&
                  day.cleaners.length === 0);
              const isAutoCancelled =
                isNoMeal &&
                Boolean(
                  day.specialNote &&
                  (day.specialNote.includes("Auto-Cancelled") ||
                    day.specialNote.includes("Volunteer Deficit"))
                );
              const hasGenuineNote =
                day.specialNote && !day.specialNote.includes("NO COMMUNITY MEAL");
              const hasCookShortage = !isNoMeal && day.unfilledCooks > 0;
              const hasCleanShortage = !isNoMeal && day.unfilledCleaners > 0;

              return (
                <div
                  key={day.dateKey}
                  className={`rounded-2xl border transition-all flex flex-col justify-between p-5 space-y-4 ${
                    isNoMeal
                      ? "bg-slate-50/90 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 opacity-85"
                      : hasCookShortage
                        ? "bg-rose-50/95 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800 ring-2 ring-rose-400/40 shadow-md"
                        : hasCleanShortage
                          ? "bg-amber-50/95 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 ring-2 ring-amber-400/40 shadow-sm"
                          : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md"
                  }`}
                >
                  <div>
                    {/* Card Header */}
                    <div className="flex items-start justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                            {formatDisplayDateLabel(day.dateLabel)}
                          </span>
                          {isNoMeal ? (
                            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full font-bold border border-slate-300 dark:border-slate-700">
                              {isAutoCancelled
                                ? "⚪ Auto-Cancelled (Volunteer Shortage)"
                                : "⚪ Meal Cancelled"}
                            </span>
                          ) : hasCookShortage && hasCleanShortage ? (
                            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 bg-rose-700 dark:bg-rose-800 text-white rounded-full font-bold shadow-sm">
                              <AlertTriangle className="w-3.5 h-3.5" /> Short {day.unfilledCooks}C
                              &amp; {day.unfilledCleaners}Cl
                            </span>
                          ) : hasCookShortage ? (
                            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 bg-rose-700 dark:bg-rose-800 text-white rounded-full font-bold shadow-sm">
                              <AlertTriangle className="w-3.5 h-3.5" /> Short {day.unfilledCooks}{" "}
                              Cook{day.unfilledCooks > 1 ? "s" : ""}
                            </span>
                          ) : hasCleanShortage ? (
                            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 bg-amber-700 dark:bg-amber-800 text-white rounded-full font-bold shadow-sm">
                              <AlertTriangle className="w-3.5 h-3.5" /> Needs {day.unfilledCleaners}{" "}
                              Cleaner
                              {day.unfilledCleaners > 1 ? "s" : ""}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-950 dark:text-emerald-200 rounded-full font-bold border border-emerald-300 dark:border-emerald-800">
                              ✅ Fully Staffed
                            </span>
                          )}
                        </div>
                        {hasGenuineNote && (
                          <p className="text-xs text-amber-900 dark:text-amber-400 font-bold mt-1">
                            📌 {day.specialNote}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-md font-bold uppercase ${
                            isNoMeal
                              ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                              : day.mealType === "BRUNCH"
                                ? "bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800"
                                : "bg-indigo-100 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800"
                          }`}
                        >
                          {day.mealType}
                        </span>
                        {!isNoMeal && (
                          <button
                            onClick={() => handleCancelMeal(day.dateKey)}
                            className="min-h-[36px] text-xs text-slate-600 dark:text-slate-400 hover:text-rose-700 dark:hover:text-rose-400 px-2 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 font-bold transition-all cursor-pointer border border-transparent hover:border-rose-200 dark:hover:border-rose-800"
                            title="Cancel this community meal date and release volunteers"
                          >
                            Cancel Meal
                          </button>
                        )}
                      </div>
                    </div>

                    {isNoMeal ? (
                      <div className="py-2 text-center space-y-3">
                        {(() => {
                          const opp = solverResult?.nearCompleteOpportunities?.find(
                            (o: NearCompleteMealOpportunity) => o.dateKey === day.dateKey
                          );
                          return (
                            <>
                              {opp ? (
                                <div className="bg-amber-50/90 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl p-3 text-xs sm:text-sm text-amber-950 dark:text-amber-200 font-medium space-y-1">
                                  <p>
                                    💡 <strong>{opp.availableCooks.length} Cooks</strong> &amp;{" "}
                                    <strong>{opp.availableCleaners.length} Cleaners</strong>{" "}
                                    available in survey
                                  </p>
                                  <p className="text-xs text-amber-900 dark:text-amber-300 font-semibold">
                                    Short{" "}
                                    {opp.missingCooksCount > 0
                                      ? `${opp.missingCooksCount} cook${opp.missingCooksCount > 1 ? "s" : ""}`
                                      : ""}
                                    {opp.missingCooksCount > 0 && opp.missingCleanersCount > 0
                                      ? " and "
                                      : ""}
                                    {opp.missingCleanersCount > 0
                                      ? `${opp.missingCleanersCount} cleaner${opp.missingCleanersCount > 1 ? "s" : ""}`
                                      : ""}{" "}
                                    to reach target team size.
                                  </p>
                                </div>
                              ) : (
                                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium italic">
                                  No volunteers assigned for this date.
                                </p>
                              )}
                              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                                {opp && (
                                  <button
                                    type="button"
                                    onClick={() => setSelectedNearCompleteDateKey(day.dateKey)}
                                    className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/40 dark:hover:bg-amber-900/60 text-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-700 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                                    title="View volunteer candidates to recover this meal"
                                  >
                                    <span>💡 Explore Recovery</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleRestoreMeal(day.dateKey)}
                                  className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                                >
                                  <Plus className="w-4 h-4" />
                                  <span>+ Restore Meal</span>
                                </button>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    ) : (
                      <>
                        {/* Cook Team */}
                        <div
                          className={`mt-3.5 ${hasCookShortage ? "bg-rose-100/70 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 p-3 rounded-xl" : ""}`}
                        >
                          <div className="flex items-center justify-between text-xs sm:text-sm mb-1.5">
                            <span className="font-bold text-orange-950 dark:text-orange-300 flex items-center gap-1">
                              🍳 Cooks ({day.cooks.length})
                            </span>
                            {day.isTwoPersonDinnerWilling && (
                              <span className="text-xs px-2.5 py-0.5 bg-blue-50 dark:bg-blue-950/50 text-blue-900 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-full font-bold">
                                👥 2-Cook Team (Willing)
                              </span>
                            )}
                            {hasCookShortage && (
                              <span className="text-xs text-rose-800 dark:text-rose-400 font-bold">
                                ⚠️ {day.unfilledCooks} needed
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2 mt-1.5">
                            {day.cooks.map((name: string, cIdx: number) => {
                              const isHelper =
                                day.extraCookHelpers?.includes(name) ||
                                exceptions?.some(
                                  (r) =>
                                    r.rule_type === "EXTRA_HELPER" &&
                                    r.person_a.toLowerCase() === name.toLowerCase() &&
                                    (!r.target_role_a ||
                                      r.target_role_a === "ANY" ||
                                      r.target_role_a === "COOK")
                                );
                              return (
                                <button
                                  type="button"
                                  key={`cook-${name}-${cIdx}`}
                                  onClick={() => {
                                    setSelectedQuotaMember(name);
                                    setSelectedQuotaFocusDateKey(day.dateKey);
                                  }}
                                  className="min-h-[38px] inline-flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-orange-50 dark:hover:bg-orange-950/40 text-orange-950 dark:text-orange-200 border border-orange-300 dark:border-orange-800/80 hover:border-orange-400 rounded-xl text-xs sm:text-sm font-bold shadow-2xs transition-all cursor-pointer group"
                                  title={
                                    isHelper
                                      ? `${name} is assigned as an extra helper on this team`
                                      : `Click to view ${name}'s availability and shifts`
                                  }
                                >
                                  <span>{name}</span>
                                  {isHelper && (
                                    <span
                                      className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800 shadow-2xs"
                                      title="Assigned as extra helper to full team"
                                    >
                                      🤝 Helper
                                    </span>
                                  )}
                                  <Search className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400 group-hover:scale-110 transition-transform" />
                                </button>
                              );
                            })}
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
                                className="min-h-[38px] px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 border-2 border-dashed border-rose-400 dark:border-rose-700 hover:border-rose-500 text-rose-800 dark:text-rose-300 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer group"
                                title="Click to fill missing cook slot"
                              >
                                <Plus className="w-4 h-4 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform" />
                                <span>Fill Missing Cook Slot</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Clean Team */}
                        <div
                          className={`mt-3.5 ${hasCleanShortage ? "bg-amber-100/70 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 p-3 rounded-xl" : ""}`}
                        >
                          <div className="flex items-center justify-between text-xs sm:text-sm mb-1.5">
                            <span className="font-bold text-sky-950 dark:text-sky-300 flex items-center gap-1">
                              🧼 Cleaners ({day.cleaners.length})
                            </span>
                            {hasCleanShortage && (
                              <span className="text-xs text-amber-900 dark:text-amber-400 font-bold">
                                ⚠️ {day.unfilledCleaners} needed
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2 mt-1.5">
                            {day.cleaners.map((name: string, clIdx: number) => {
                              const isHelper =
                                day.extraCleanHelpers?.includes(name) ||
                                exceptions?.some(
                                  (r) =>
                                    r.rule_type === "EXTRA_HELPER" &&
                                    r.person_a.toLowerCase() === name.toLowerCase() &&
                                    (r.target_role_a === "ANY" || r.target_role_a === "CLEAN")
                                );
                              return (
                                <button
                                  type="button"
                                  key={`clean-${name}-${clIdx}`}
                                  onClick={() => {
                                    setSelectedQuotaMember(name);
                                    setSelectedQuotaFocusDateKey(day.dateKey);
                                  }}
                                  className="min-h-[38px] inline-flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-sky-950/40 text-sky-950 dark:text-sky-200 border border-sky-300 dark:border-sky-800/80 hover:border-sky-400 rounded-xl text-xs sm:text-sm font-bold shadow-2xs transition-all cursor-pointer group"
                                  title={
                                    isHelper
                                      ? `${name} is assigned as an extra helper on this team`
                                      : `Click to view ${name}'s availability and shifts`
                                  }
                                >
                                  <span>{name}</span>
                                  {isHelper && (
                                    <span
                                      className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-sky-100 dark:bg-sky-950/60 text-sky-900 dark:text-sky-200 border border-sky-300 dark:border-sky-800 shadow-2xs"
                                      title="Assigned as extra helper to full team"
                                    >
                                      🤝 Helper
                                    </span>
                                  )}
                                  <Search className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 group-hover:scale-110 transition-transform" />
                                </button>
                              );
                            })}
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
                                className="min-h-[38px] px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/40 border-2 border-dashed border-amber-400 dark:border-amber-700 hover:border-amber-500 text-amber-900 dark:text-amber-300 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer group"
                                title="Click to fill missing cleaner slot"
                              >
                                <Plus className="w-4 h-4 text-amber-700 dark:text-amber-400 group-hover:scale-110 transition-transform" />
                                <span>Fill Missing Cleaner Slot</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Member Shift Quota Balance Table */}
      {solverResult && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Member Quota &amp; Shift Distribution Summary
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                Verify that every community member's requested cook quota is fulfilled and shifts
                are on complete meals.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 uppercase font-bold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Member
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Available Cook Days
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Requested Cooks
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Assigned Cooks
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Available Clean Days
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Requested Cleans
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Assigned Cleans
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Total Shifts
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Fulfillment Status
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {(() => {
                  const allStats: MemberQuotaStat[] = Object.values(solverResult.memberStats);

                  const isNotPart = (stat: MemberQuotaStat) => {
                    const reqCleans = stat.requestedCleanQuota ?? 1;
                    return (
                      stat.totalAssigned === 0 &&
                      ((stat.requestedCookQuota === 0 && reqCleans === 0) ||
                        (stat.availableCookDays === 0 && stat.availableCleanDays === 0))
                    );
                  };

                  const participatingList = allStats
                    .filter((s: MemberQuotaStat) => !isNotPart(s))
                    .sort((a: MemberQuotaStat, b: MemberQuotaStat) =>
                      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
                    );

                  const nonParticipatingList = allStats
                    .filter((s: MemberQuotaStat) => isNotPart(s))
                    .sort((a: MemberQuotaStat, b: MemberQuotaStat) =>
                      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
                    );

                  const renderStatRow = (stat: MemberQuotaStat, isMuted = false) => {
                    const reqCleans = stat.requestedCleanQuota ?? 1;
                    const reqMaxTotal =
                      typeof stat.requestedMaxTotalShifts === "number" &&
                      stat.requestedMaxTotalShifts > 0
                        ? stat.requestedMaxTotalShifts
                        : stat.requestedCookQuota + reqCleans;
                    const hasExplicitMaxCap = reqMaxTotal < stat.requestedCookQuota + reqCleans;
                    const isTotalCapMet = stat.totalAssigned >= reqMaxTotal;

                    const isCleanShort = !isTotalCapMet && stat.assignedCleans < reqCleans;
                    const isCookShort =
                      !isTotalCapMet && stat.assignedCooks < stat.requestedCookQuota;
                    const isShort = !isTotalCapMet && (isCookShort || isCleanShort);
                    const totalMealCount = intakeData?.mealDates.length || 13;
                    const notPart = isNotPart(stat);

                    // Check if any of their assigned shifts are on dates with missing cleaners/cooks
                    const assignedDays = solverResult.schedule.filter(
                      (d: DaySchedule) =>
                        d.cooks.includes(stat.name) || d.cleaners.includes(stat.name)
                    );
                    const incompleteAssignedDays = assignedDays.filter(
                      (d: DaySchedule) => d.unfilledCooks > 0 || d.unfilledCleaners > 0
                    );
                    const hasPendingIncomplete = incompleteAssignedDays.length > 0;
                    const isOversubscribed =
                      stat.totalAssigned > reqMaxTotal ||
                      stat.assignedCleans > reqCleans ||
                      stat.assignedCooks > stat.requestedCookQuota;

                    return (
                      <tr
                        key={stat.name}
                        className={`hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors ${isMuted ? "bg-slate-50/50 dark:bg-slate-800/20 text-slate-600 dark:text-slate-400" : ""}`}
                      >
                        <th scope="row" className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                          <div className="flex items-center gap-1.5">
                            <span>{stat.name}</span>
                            {exceptions?.some(
                              (r) =>
                                r.rule_type === "EXTRA_HELPER" &&
                                r.person_a.toLowerCase() === stat.name.toLowerCase()
                            ) && (
                              <span
                                className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800 shadow-2xs"
                                title="Configured as an extra helper (assigned only to full teams)"
                              >
                                🤝 Helper
                              </span>
                            )}
                          </div>
                        </th>
                        <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">
                          {stat.availableCookDays}{" "}
                          <span className="text-slate-500 dark:text-slate-400 font-normal text-xs">
                            / {totalMealCount}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-semibold">
                          {stat.requestedCookQuota}
                        </td>
                        <td className="px-4 py-3 font-bold text-orange-700 dark:text-orange-400">
                          {stat.assignedCooks}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">
                          {stat.availableCleanDays}{" "}
                          <span className="text-slate-500 dark:text-slate-400 font-normal text-xs">
                            / {totalMealCount}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-semibold">{reqCleans}</td>
                        <td className="px-4 py-3 font-bold text-sky-700 dark:text-sky-400">{stat.assignedCleans}</td>
                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                          {stat.totalAssigned}
                          {hasExplicitMaxCap && (
                            <span className="text-[11px] text-amber-900 dark:text-amber-400 font-semibold block">
                              (Cap: {reqMaxTotal})
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isOversubscribed ? (
                            <div className="space-y-1">
                              <span className="text-amber-950 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 px-2.5 py-0.5 rounded-lg font-bold inline-block text-xs">
                                ⭐ Oversubscribed (
                                {stat.assignedCooks > stat.requestedCookQuota
                                  ? `${stat.assignedCooks}/${stat.requestedCookQuota} Cooks`
                                  : ""}
                                {stat.assignedCooks > stat.requestedCookQuota &&
                                stat.assignedCleans > reqCleans
                                  ? ", "
                                  : ""}
                                {stat.assignedCleans > reqCleans
                                  ? `${stat.assignedCleans}/${reqCleans} Cleans`
                                  : ""}
                                {stat.totalAssigned > reqMaxTotal &&
                                !(stat.assignedCooks > stat.requestedCookQuota) &&
                                !(stat.assignedCleans > reqCleans)
                                  ? `${stat.totalAssigned}/${reqMaxTotal} Total`
                                  : ""}
                                )
                              </span>
                              {hasPendingIncomplete && (
                                <p className="text-xs text-amber-900 dark:text-amber-400 font-bold">
                                  ⚠️ {incompleteAssignedDays.length} shift on incomplete meal
                                </p>
                              )}
                            </div>
                          ) : notPart ? (
                            <span className="text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-2.5 py-0.5 rounded-lg font-semibold inline-block text-xs">
                              ⚪ Not Participating
                            </span>
                          ) : isShort ? (
                            <div className="space-y-1">
                              <span className="text-rose-950 dark:text-rose-200 bg-rose-100 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 px-2.5 py-0.5 rounded-lg font-bold inline-block text-xs">
                                Short (
                                {isCookShort
                                  ? `${stat.assignedCooks}/${stat.requestedCookQuota} Cooks`
                                  : ""}
                                {isCookShort && isCleanShort ? ", " : ""}
                                {isCleanShort ? `${stat.assignedCleans}/${reqCleans} Cleans` : ""})
                              </span>
                              {hasPendingIncomplete && (
                                <p className="text-xs text-amber-900 dark:text-amber-400 font-bold">
                                  ⚠️ {incompleteAssignedDays.length} shift on incomplete meal
                                </p>
                              )}
                            </div>
                          ) : hasPendingIncomplete ? (
                            <div className="space-y-1">
                              <span className="text-amber-950 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 px-2.5 py-0.5 rounded-lg font-bold inline-block text-xs">
                                ⚠️ Pending ({incompleteAssignedDays.length} on Incomplete Meal
                                {incompleteAssignedDays.length > 1 ? "s" : ""})
                              </span>
                              <p className="text-xs text-amber-900 dark:text-amber-400 font-semibold">
                                Meal missing cleaner/cook team
                              </p>
                            </div>
                          ) : hasExplicitMaxCap && isTotalCapMet ? (
                            <span className="text-emerald-950 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 px-2.5 py-0.5 rounded-lg font-bold inline-block text-xs">
                              🎯 Cap Met ({stat.totalAssigned}/{reqMaxTotal})
                            </span>
                          ) : (
                            <span className="text-emerald-950 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 px-2.5 py-0.5 rounded-lg font-bold inline-block text-xs">
                              ✅ Staffed ({stat.assignedCooks}C + {stat.assignedCleans}Cl)
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => {
                              setSelectedQuotaMember(stat.name);
                              setSelectedQuotaFocusDateKey(null);
                            }}
                            aria-label={`Inspect shifts for ${stat.name}`}
                            className={`min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
                              isShort || hasPendingIncomplete
                                ? "bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
                                : "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700"
                            }`}
                          >
                            <Search className="w-3.5 h-3.5" />
                            <span>
                              {isShort || hasPendingIncomplete
                                ? "Find Dates & Add Extra"
                                : "View Dates"}
                            </span>
                          </button>
                        </td>
                      </tr>
                    );
                  };

                  return (
                    <>
                      {participatingList.map((s: MemberQuotaStat) => renderStatRow(s, false))}

                      {nonParticipatingList.length > 0 && (
                        <>
                          <tr className="bg-slate-100/80 dark:bg-slate-800/60 border-t border-b border-slate-200 dark:border-slate-700">
                            <td colSpan={10} className="p-0">
                              <button
                                type="button"
                                onClick={() =>
                                  setShowNonParticipatingQuota(!showNonParticipatingQuota)
                                }
                                className="w-full min-h-[44px] px-4 py-3 flex items-center justify-between text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-700/60 transition-colors cursor-pointer"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-600 dark:text-slate-400 font-mono text-xs">
                                    {showNonParticipatingQuota ? "▼" : "▶"}
                                  </span>
                                  <span>
                                    Non-Participating Members ({nonParticipatingList.length})
                                  </span>
                                  <span className="text-xs font-normal text-slate-600 dark:text-slate-400">
                                    (0 requested shifts or 0 available dates this month)
                                  </span>
                                </div>
                                <span className="text-xs sm:text-sm text-indigo-700 dark:text-indigo-400 font-bold hover:underline">
                                  {showNonParticipatingQuota
                                    ? "Click to collapse"
                                    : "Click to view members"}
                                </span>
                              </button>
                            </td>
                          </tr>

                          {showNonParticipatingQuota &&
                            nonParticipatingList.map((s: MemberQuotaStat) =>
                              renderStatRow(s, true)
                            )}
                        </>
                      )}
                    </>
                  );
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Overwrite Guard Confirmation Modal */}
      {showOverwriteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  Finalized Schedule Exists
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                  <span>Tab:</span>
                  {sheetUrl ? (
                    <a
                      href={sheetUrl}
                      target="_blank"
                      rel="noreferrer"
                      title="Open schedule tab in Google Sheets"
                      className="font-mono text-orange-600 dark:text-orange-400 hover:underline inline-flex items-center gap-1 font-bold"
                    >
                      <span>{intakeData?.existingScheduleTab?.name || "Schedule"}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                      {intakeData?.existingScheduleTab?.name || "Schedule"}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              A saved schedule already exists for this month in your spreadsheet. Running the solver
              will generate a new roster from scratch and replace your current draft. Do you want to
              proceed?
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowOverwriteModal(false)}
                className="min-h-[42px] px-4 py-2 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowOverwriteModal(false);
                  handleRunSolver();
                }}
                className="min-h-[42px] px-5 py-2 text-xs sm:text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Proceed &amp; Re-run Solver
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
        <button
          onClick={() => goToStep(2)}
          className="min-h-[48px] px-5 py-2.5 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer w-full sm:w-auto"
        >
          ← Back to Notes &amp; Rules
        </button>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
          <button
            type="button"
            onClick={() => goToStep(4)}
            className="min-h-[48px] px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            title="Proceed to email announcement without re-saving schedule tab"
          >
            <span>Proceed Without Saving</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (handleSaveTeamsAndProceed) {
                handleSaveTeamsAndProceed();
              } else {
                goToStep(4);
              }
            }}
            disabled={savingTeams || loading}
            className="min-h-[48px] inline-flex items-center justify-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-orange-600/20 transition-all cursor-pointer w-full sm:w-auto"
          >
            {savingTeams ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Saving Teams to Sheet...</span>
              </>
            ) : (
              <>
                <span>💾 Save Teams to Sheet &amp; Proceed to Email</span>
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

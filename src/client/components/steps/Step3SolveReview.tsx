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
} from "lucide-react";
import {
  ScheduleOutput,
  IntakePayload,
  MemberQuotaStat,
  DaySchedule,
  ConstraintViolation,
  NearCompleteMealOpportunity,
} from "../../../server/types";
import { formatDisplayDateLabel } from "../../utils/formatters";

interface Step3SolveReviewProps {
  solverResult: ScheduleOutput | null;
  loading: boolean;
  intakeData: IntakePayload | null;
  showNonParticipatingQuota: boolean;
  setShowNonParticipatingQuota: React.Dispatch<React.SetStateAction<boolean>>;
  handleRunSolver: () => void;
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
}

export const Step3SolveReview: React.FC<Step3SolveReviewProps> = ({
  solverResult,
  loading,
  intakeData,
  showNonParticipatingQuota,
  setShowNonParticipatingQuota,
  handleRunSolver,
  handleCancelMeal,
  handleRestoreMeal,
  setSelectedNearCompleteDateKey,
  setSelectedQuotaMember,
  setSelectedQuotaFocusDateKey,
  setSelectedSlotToFill,
  goToStep,
}) => {
  return (
    <div className="space-y-6">
      {/* Unified Step 3 Header & Completeness Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
              !solverResult
                ? "bg-orange-50 text-orange-700 border border-orange-200"
                : solverResult.unfilledSlotsCount === 0
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                  : "bg-amber-100 text-amber-900 border border-amber-300"
            }`}
          >
            {!solverResult ? (
              <Calendar className="w-5 h-5" />
            ) : solverResult.unfilledSlotsCount === 0 ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-700" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-amber-800" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                {!solverResult
                  ? "Schedule Review"
                  : solverResult.unfilledSlotsCount === 0
                    ? `All ${solverResult.schedule.filter((d: DaySchedule) => d.targetCookCount > 0).length} Scheduled Meals Fully Staffed!`
                    : `${solverResult.schedule.filter((d: DaySchedule) => d.targetCookCount > 0 && (d.unfilledCooks > 0 || d.unfilledCleaners > 0)).length} of ${solverResult.schedule.filter((d: DaySchedule) => d.targetCookCount > 0).length} Scheduled Meals Need Attention`}
              </h2>
              {solverResult && (
                <span
                  className={`text-xs font-bold px-3 py-1 rounded-full ${
                    solverResult.unfilledSlotsCount === 0
                      ? "bg-emerald-100 text-emerald-950 border border-emerald-300"
                      : "bg-amber-100 text-amber-950 border border-amber-300"
                  }`}
                >
                  {
                    solverResult.schedule.filter(
                      (d: DaySchedule) =>
                        d.targetCookCount > 0 && d.unfilledCooks === 0 && d.unfilledCleaners === 0
                    ).length
                  }{" "}
                  / {solverResult.schedule.filter((d: DaySchedule) => d.targetCookCount > 0).length}{" "}
                  Confirmed
                </span>
              )}
              {solverResult &&
                solverResult.schedule.some((d: DaySchedule) => d.targetCookCount === 0) && (
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-800 border border-slate-300">
                    {
                      solverResult.schedule.filter((d: DaySchedule) => d.targetCookCount === 0)
                        .length
                    }{" "}
                    Dates Cancelled (No Meal)
                  </span>
                )}
            </div>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              {!solverResult
                ? "Review meal assignments, fill open shifts, and inspect volunteer quotas."
                : solverResult.unfilledSlotsCount === 0
                  ? solverResult.schedule.some((d: DaySchedule) => d.targetCookCount === 0)
                    ? `Optimal schedule: All active meals are 100% complete (${solverResult.schedule.filter((d: DaySchedule) => d.targetCookCount === 0).length} deficit date(s) cancelled to concentrate volunteer supply).`
                    : "Every dinner and brunch has a complete cook and clean team assigned."
                  : `${solverResult.unfilledSlotsCount} open shift(s) remaining. Click [+ Fill Slot] on any date card to resolve.`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => handleRunSolver()}
            disabled={loading}
            className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span>Re-Run Solver</span>
          </button>
        </div>
      </div>

      {/* Empty State when solverResult has not run yet */}
      {!solverResult && !loading && (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-4 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-orange-100 text-orange-700 flex items-center justify-center mx-auto shadow-inner">
            <Sparkles className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900">Ready to Match Teams</h3>
            <p className="text-xs sm:text-sm text-slate-600 max-w-sm mx-auto mt-1">
              Click the button below to generate optimal, constraint-satisfying cook and clean
              rosters for all monthly meals.
            </p>
          </div>
          <button
            onClick={() => handleRunSolver()}
            disabled={loading}
            className="min-h-[48px] inline-flex items-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-orange-600/20 transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4" /> Run Matchmaker Solver
          </button>
        </div>
      )}

      {/* Constraint Violations (if any) */}
      {solverResult && solverResult.violations.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 p-5 rounded-2xl space-y-2">
          <div className="flex items-center gap-2 text-amber-950 text-xs sm:text-sm font-bold">
            <AlertTriangle className="w-4 h-4 text-amber-800" />
            <span>Soft Preference Violations ({solverResult.violations.length})</span>
          </div>
          <div className="space-y-1">
            {solverResult.violations.map((v: ConstraintViolation, i: number) => (
              <p key={i} className="text-xs text-amber-900 font-medium">
                • {v.description}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Visual Schedule Cards */}
      {solverResult && (
        <div className="space-y-4">
          <h3 className="text-sm sm:text-base font-bold text-slate-900">
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
                      ? "bg-slate-50/90 border-slate-200 opacity-85"
                      : hasCookShortage
                        ? "bg-rose-50/95 border-rose-300 ring-2 ring-rose-400/40 shadow-md"
                        : hasCleanShortage
                          ? "bg-amber-50/95 border-amber-300 ring-2 ring-amber-400/40 shadow-sm"
                          : "bg-white border-slate-200 shadow-sm hover:shadow-md"
                  }`}
                >
                  <div>
                    {/* Card Header */}
                    <div className="flex items-start justify-between pb-3 border-b border-slate-200">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm sm:text-base font-bold text-slate-900">
                            {formatDisplayDateLabel(day.dateLabel)}
                          </span>
                          {isNoMeal ? (
                            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 bg-slate-100 text-slate-700 rounded-full font-bold border border-slate-300">
                              {isAutoCancelled
                                ? "⚪ Auto-Cancelled (Volunteer Shortage)"
                                : "⚪ Meal Cancelled"}
                            </span>
                          ) : hasCookShortage && hasCleanShortage ? (
                            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 bg-rose-700 text-white rounded-full font-bold shadow-sm">
                              <AlertTriangle className="w-3.5 h-3.5" /> Short {day.unfilledCooks}C
                              &amp; {day.unfilledCleaners}Cl
                            </span>
                          ) : hasCookShortage ? (
                            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 bg-rose-700 text-white rounded-full font-bold shadow-sm">
                              <AlertTriangle className="w-3.5 h-3.5" /> Short {day.unfilledCooks}{" "}
                              Cook{day.unfilledCooks > 1 ? "s" : ""}
                            </span>
                          ) : hasCleanShortage ? (
                            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 bg-amber-700 text-white rounded-full font-bold shadow-sm">
                              <AlertTriangle className="w-3.5 h-3.5" /> Needs {day.unfilledCleaners}{" "}
                              Cleaner
                              {day.unfilledCleaners > 1 ? "s" : ""}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 bg-emerald-100 text-emerald-950 rounded-full font-bold border border-emerald-300">
                              ✅ Fully Staffed
                            </span>
                          )}
                        </div>
                        {hasGenuineNote && (
                          <p className="text-xs text-amber-900 font-bold mt-1">
                            📌 {day.specialNote}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-md font-bold uppercase ${
                            isNoMeal
                              ? "bg-slate-100 text-slate-600 border border-slate-200"
                              : day.mealType === "BRUNCH"
                                ? "bg-amber-100 text-amber-900 border border-amber-300"
                                : "bg-indigo-100 text-indigo-900 border border-indigo-200"
                          }`}
                        >
                          {day.mealType}
                        </span>
                        {!isNoMeal && (
                          <button
                            onClick={() => handleCancelMeal(day.dateKey)}
                            className="min-h-[36px] text-xs text-slate-600 hover:text-rose-700 px-2 py-1 rounded-lg hover:bg-rose-50 font-bold transition-all cursor-pointer border border-transparent hover:border-rose-200"
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
                                <div className="bg-amber-50/90 border border-amber-300 rounded-xl p-3 text-xs sm:text-sm text-amber-950 font-medium space-y-1">
                                  <p>
                                    💡 <strong>{opp.availableCooks.length} Cooks</strong> &amp;{" "}
                                    <strong>{opp.availableCleaners.length} Cleaners</strong>{" "}
                                    available in survey
                                  </p>
                                  <p className="text-xs text-amber-900 font-semibold">
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
                                <p className="text-xs sm:text-sm text-slate-500 font-medium italic">
                                  No volunteers assigned for this date.
                                </p>
                              )}
                              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                                {opp && (
                                  <button
                                    type="button"
                                    onClick={() => setSelectedNearCompleteDateKey(day.dateKey)}
                                    className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
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
                          className={`mt-3.5 ${hasCookShortage ? "bg-rose-100/70 border border-rose-300 p-3 rounded-xl" : ""}`}
                        >
                          <div className="flex items-center justify-between text-xs sm:text-sm mb-1.5">
                            <span className="font-bold text-orange-950 flex items-center gap-1">
                              🍳 Cooks ({day.cooks.length})
                            </span>
                            {day.isTwoPersonDinnerWilling && (
                              <span className="text-xs px-2.5 py-0.5 bg-blue-50 text-blue-900 border border-blue-200 rounded-full font-bold">
                                👥 2-Cook Team (Willing)
                              </span>
                            )}
                            {hasCookShortage && (
                              <span className="text-xs text-rose-800 font-bold">
                                ⚠️ {day.unfilledCooks} needed
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2 mt-1.5">
                            {day.cooks.map((name: string, cIdx: number) => (
                              <button
                                type="button"
                                key={`cook-${name}-${cIdx}`}
                                onClick={() => {
                                  setSelectedQuotaMember(name);
                                  setSelectedQuotaFocusDateKey(day.dateKey);
                                }}
                                className="min-h-[38px] inline-flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-orange-50 text-orange-950 border border-orange-300 hover:border-orange-400 rounded-xl text-xs sm:text-sm font-bold shadow-2xs transition-all cursor-pointer group"
                                title={`Click to view ${name}'s availability and shifts`}
                              >
                                <span>{name}</span>
                                <Search className="w-3.5 h-3.5 text-orange-600 group-hover:scale-110 transition-transform" />
                              </button>
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
                                className="min-h-[38px] px-3 py-1.5 bg-white hover:bg-rose-50 border-2 border-dashed border-rose-400 hover:border-rose-500 text-rose-800 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer group"
                                title="Click to fill missing cook slot"
                              >
                                <Plus className="w-4 h-4 text-rose-600 group-hover:scale-110 transition-transform" />
                                <span>Fill Missing Cook Slot</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Clean Team */}
                        <div
                          className={`mt-3.5 ${hasCleanShortage ? "bg-amber-100/70 border border-amber-300 p-3 rounded-xl" : ""}`}
                        >
                          <div className="flex items-center justify-between text-xs sm:text-sm mb-1.5">
                            <span className="font-bold text-sky-950 flex items-center gap-1">
                              🧼 Cleaners ({day.cleaners.length})
                            </span>
                            {hasCleanShortage && (
                              <span className="text-xs text-amber-900 font-bold">
                                ⚠️ {day.unfilledCleaners} needed
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2 mt-1.5">
                            {day.cleaners.map((name: string, clIdx: number) => (
                              <button
                                type="button"
                                key={`clean-${name}-${clIdx}`}
                                onClick={() => {
                                  setSelectedQuotaMember(name);
                                  setSelectedQuotaFocusDateKey(day.dateKey);
                                }}
                                className="min-h-[38px] inline-flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-sky-50 text-sky-950 border border-sky-300 hover:border-sky-400 rounded-xl text-xs sm:text-sm font-bold shadow-2xs transition-all cursor-pointer group"
                                title={`Click to view ${name}'s availability and shifts`}
                              >
                                <span>{name}</span>
                                <Search className="w-3.5 h-3.5 text-sky-600 group-hover:scale-110 transition-transform" />
                              </button>
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
                                className="min-h-[38px] px-3 py-1.5 bg-white hover:bg-amber-50 border-2 border-dashed border-amber-400 hover:border-amber-500 text-amber-900 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer group"
                                title="Click to fill missing cleaner slot"
                              >
                                <Plus className="w-4 h-4 text-amber-700 group-hover:scale-110 transition-transform" />
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
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Member Quota &amp; Shift Distribution Summary
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                Verify that every community member's requested cook quota is fulfilled and shifts
                are on complete meals.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-700 uppercase font-bold border-b border-slate-200">
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
              <tbody className="divide-y divide-slate-100">
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
                    const isCleanShort = stat.assignedCleans < reqCleans;
                    const isCookShort = stat.assignedCooks < stat.requestedCookQuota;
                    const isShort = isCookShort || isCleanShort;
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
                      stat.assignedCleans > reqCleans ||
                      stat.assignedCooks > stat.requestedCookQuota;

                    return (
                      <tr
                        key={stat.name}
                        className={`hover:bg-slate-50 transition-colors ${isMuted ? "bg-slate-50/50 text-slate-600" : ""}`}
                      >
                        <th scope="row" className="px-4 py-3 font-bold text-slate-900">
                          {stat.name}
                        </th>
                        <td className="px-4 py-3 font-semibold text-slate-800">
                          {stat.availableCookDays}{" "}
                          <span className="text-slate-500 font-normal text-xs">
                            / {totalMealCount}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700 font-semibold">
                          {stat.requestedCookQuota}
                        </td>
                        <td className="px-4 py-3 font-bold text-orange-700">
                          {stat.assignedCooks}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-800">
                          {stat.availableCleanDays}{" "}
                          <span className="text-slate-500 font-normal text-xs">
                            / {totalMealCount}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700 font-semibold">{reqCleans}</td>
                        <td className="px-4 py-3 font-bold text-sky-700">{stat.assignedCleans}</td>
                        <td className="px-4 py-3 font-bold text-slate-900">{stat.totalAssigned}</td>
                        <td className="px-4 py-3">
                          {isOversubscribed ? (
                            <div className="space-y-1">
                              <span className="text-purple-950 bg-purple-100 border border-purple-300 px-2.5 py-0.5 rounded-lg font-bold inline-block text-xs">
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
                                )
                              </span>
                              {hasPendingIncomplete && (
                                <p className="text-xs text-amber-900 font-bold">
                                  ⚠️ {incompleteAssignedDays.length} shift on incomplete meal
                                </p>
                              )}
                            </div>
                          ) : notPart ? (
                            <span className="text-slate-700 bg-slate-100 border border-slate-300 px-2.5 py-0.5 rounded-lg font-semibold inline-block text-xs">
                              ⚪ Not Participating
                            </span>
                          ) : isShort ? (
                            <div className="space-y-1">
                              <span className="text-rose-950 bg-rose-100 border border-rose-300 px-2.5 py-0.5 rounded-lg font-bold inline-block text-xs">
                                Short (
                                {isCookShort
                                  ? `${stat.assignedCooks}/${stat.requestedCookQuota} Cooks`
                                  : ""}
                                {isCookShort && isCleanShort ? ", " : ""}
                                {isCleanShort ? `${stat.assignedCleans}/${reqCleans} Cleans` : ""})
                              </span>
                              {hasPendingIncomplete && (
                                <p className="text-xs text-amber-900 font-bold">
                                  ⚠️ {incompleteAssignedDays.length} shift on incomplete meal
                                </p>
                              )}
                            </div>
                          ) : hasPendingIncomplete ? (
                            <div className="space-y-1">
                              <span className="text-amber-950 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-lg font-bold inline-block text-xs">
                                ⚠️ Pending ({incompleteAssignedDays.length} on Incomplete Meal
                                {incompleteAssignedDays.length > 1 ? "s" : ""})
                              </span>
                              <p className="text-xs text-amber-900 font-semibold">
                                Meal missing cleaner/cook team
                              </p>
                            </div>
                          ) : (
                            <span className="text-emerald-950 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-lg font-bold inline-block text-xs">
                              ✅ Confirmed Fulfilled
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
                                : "bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300"
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
                          <tr className="bg-slate-100/80 border-t border-b border-slate-200">
                            <td colSpan={10} className="p-0">
                              <button
                                type="button"
                                onClick={() =>
                                  setShowNonParticipatingQuota(!showNonParticipatingQuota)
                                }
                                className="w-full min-h-[44px] px-4 py-3 flex items-center justify-between text-xs sm:text-sm font-bold text-slate-800 hover:bg-slate-200/70 transition-colors cursor-pointer"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-600 font-mono text-xs">
                                    {showNonParticipatingQuota ? "▼" : "▶"}
                                  </span>
                                  <span>
                                    Non-Participating Members ({nonParticipatingList.length})
                                  </span>
                                  <span className="text-xs font-normal text-slate-600">
                                    (0 requested shifts or 0 available dates this month)
                                  </span>
                                </div>
                                <span className="text-xs sm:text-sm text-indigo-700 font-bold hover:underline">
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

      {/* Navigation Buttons */}
      <div className="flex justify-between items-center">
        <button
          onClick={() => goToStep(2)}
          className="min-h-[48px] px-5 py-2.5 text-xs sm:text-sm font-bold text-slate-700 hover:text-slate-950 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
        >
          ← Back to Notes &amp; Rules
        </button>
        <button
          onClick={() => goToStep(4)}
          className="min-h-[48px] inline-flex items-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-orange-600/20 transition-all cursor-pointer"
        >
          <span>Proceed to Export &amp; Email</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

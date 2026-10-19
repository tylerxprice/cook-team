import React from "react";
import { UserPlus, X, MessageSquare, XCircle } from "lucide-react";
import { DaySchedule, IntakePayload, Role, ScheduleOutput } from "../../../server/types";
import {
  getMemberAvailabilityForDate,
  isWillingTwoPersonDinner,
} from "../../../server/scheduleParser";
import { getOrdinal, formatDisplayDateLabel } from "../../utils/formatters";

export interface MemberCalendarInspectorModalProps {
  selectedQuotaMember: string | null;
  onClose: () => void;
  solverResult: ScheduleOutput | null;
  intakeData: IntakePayload | null;
  selectedQuotaFocusDateKey: string | null;
  checkAssignmentConflict: (memberName: string, role: Role, day: DaySchedule) => string | null;
  handleAddExtraShift: (dateKey: string, memberName: string, role: Role) => void;
  handleRemoveShift: (dateKey: string, memberName: string, role: Role) => void;
}

export const MemberCalendarInspectorModal: React.FC<MemberCalendarInspectorModalProps> = ({
  selectedQuotaMember,
  onClose,
  solverResult,
  intakeData,
  selectedQuotaFocusDateKey,
  checkAssignmentConflict,
  handleAddExtraShift,
  handleRemoveShift,
}) => {
  if (!selectedQuotaMember || !solverResult || !intakeData) return null;

  const resp = intakeData.responses.find(
    (r) => r.name.toLowerCase() === selectedQuotaMember.toLowerCase()
  );
  const is2PersonWilling = isWillingTwoPersonDinner(resp?.cookTeamSizePref);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title-member-calendar"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full shadow-2xl p-6 space-y-4 max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-800">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div>
            <h3
              id="modal-title-member-calendar"
              className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2"
            >
              <UserPlus className="w-5 h-5 text-orange-600" />
              Available Dates &amp; Extra Shift Assignment: {selectedQuotaMember}
            </h3>
            {solverResult.memberStats[selectedQuotaMember] && (
              <p className="text-xs text-slate-700 dark:text-slate-300 mt-1">
                Requested Quota:{" "}
                <strong className="text-slate-900 dark:text-white">
                  {solverResult.memberStats[selectedQuotaMember].requestedCookQuota}
                </strong>{" "}
                cooks,{" "}
                <strong className="text-slate-900 dark:text-white">
                  {solverResult.memberStats[selectedQuotaMember].requestedCleanQuota ?? 1}
                </strong>{" "}
                cleans • Currently Assigned:{" "}
                <strong className="text-slate-900 dark:text-white">
                  {solverResult.memberStats[selectedQuotaMember].assignedCooks}
                </strong>{" "}
                cooks,{" "}
                <strong className="text-slate-900 dark:text-white">
                  {solverResult.memberStats[selectedQuotaMember].assignedCleans}
                </strong>{" "}
                cleans ({solverResult.memberStats[selectedQuotaMember].totalAssigned} total shifts)
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {is2PersonWilling ? (
                <span className="text-xs px-2.5 py-1 rounded-lg font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-950 dark:text-blue-200 border border-blue-300 dark:border-blue-800">
                  👥 2-Person Cook Team: Willing ({resp?.cookTeamSizePref || "2 for either"})
                </span>
              ) : (
                <span className="text-xs px-2.5 py-1 rounded-lg font-semibold bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-600">
                  🍳 Cook Team Pref: {resp?.cookTeamSizePref || "Dinner = 3, Brunch = 2"}
                </span>
              )}
              {resp?.canCookCleanSameDay && (
                <span className="text-xs px-2.5 py-1 rounded-lg font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-950 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800">
                  ✓ Same-Day Cook &amp; Clean: Willing
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Special Instructions Context if any */}
        {resp?.specialInstructions && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl p-3.5 flex items-start gap-2.5">
            <MessageSquare className="w-4 h-4 text-amber-800 dark:text-amber-400 mt-0.5 shrink-0" />
            <div>
              <span className="text-xs font-bold text-amber-950 dark:text-amber-200">
                Survey Request from {selectedQuotaMember}:
              </span>
              <p className="text-xs text-amber-900 dark:text-amber-300 mt-0.5 font-medium italic">
                &quot;{resp.specialInstructions}&quot;
              </p>
            </div>
          </div>
        )}

        {/* Dates List */}
        <div className="overflow-y-auto flex-1 divide-y divide-slate-100 dark:divide-slate-800 pr-1 space-y-2">
          {solverResult.schedule.map((day) => {
            const isFocusedDay = selectedQuotaFocusDateKey === day.dateKey;
            const avail = getMemberAvailabilityForDate(resp, day.dateLabel);
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
                id={`quota-modal-day-${day.dateKey}`}
                className={`p-3.5 rounded-xl border transition-all ${
                  isFocusedDay
                    ? "ring-2 ring-orange-500 ring-offset-2 bg-amber-50 dark:bg-amber-950/40 border-amber-400 dark:border-amber-700 shadow-md"
                    : isCook || isClean
                      ? "bg-orange-50/50 dark:bg-orange-950/30 border-orange-300 dark:border-orange-800"
                      : canCook || canClean
                        ? "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                        : "bg-slate-50/50 dark:bg-slate-800/20 border-slate-200 dark:border-slate-800 opacity-60"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  {/* Left: Date info & Current roster */}
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                        {formatDisplayDateLabel(day.dateLabel)}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-lg font-bold uppercase border ${
                          day.mealType === "BRUNCH"
                            ? "bg-amber-100 dark:bg-amber-950/60 text-amber-950 dark:text-amber-200 border-amber-300 dark:border-amber-800"
                            : "bg-indigo-100 dark:bg-indigo-950/60 text-indigo-950 dark:text-indigo-200 border-indigo-300 dark:border-indigo-800"
                        }`}
                      >
                        {day.mealType}
                      </span>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                          avail === "AVAILABLE"
                            ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-950 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800"
                            : avail === "COOK_ONLY"
                              ? "bg-orange-100 dark:bg-orange-950/60 text-orange-950 dark:text-orange-200 border-orange-300 dark:border-orange-800"
                              : avail === "CLEAN_ONLY"
                                ? "bg-sky-100 dark:bg-sky-950/60 text-sky-950 dark:text-sky-200 border-sky-300 dark:border-sky-800"
                                : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600"
                        }`}
                      >
                        Survey: {avail.replace("_", " ")}
                      </span>
                      {isFocusedDay && (
                        <span className="text-xs bg-orange-700 text-white font-bold px-2.5 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                          📍 Selected Day
                        </span>
                      )}
                    </div>

                    {/* Current Assigned Roster */}
                    <div className="text-xs text-slate-700 dark:text-slate-300 mt-1.5 space-y-0.5">
                      <p>
                        <span className="font-bold text-orange-900 dark:text-orange-300">
                          🍳 Cooks ({day.cooks.length}):
                        </span>{" "}
                        {day.cooks.join(", ") || "None"}
                      </p>
                      <p>
                        <span className="font-bold text-sky-900 dark:text-sky-300">
                          🧼 Cleaners ({day.cleaners.length}):
                        </span>{" "}
                        {day.cleaners.join(", ") || "None"}
                      </p>
                    </div>

                    {/* Conflict Warnings */}
                    {cookConflict && (
                      <p className="text-xs text-rose-800 dark:text-rose-400 font-bold mt-1">
                        ⚠️ Cook Conflict: {cookConflict}
                      </p>
                    )}
                    {cleanConflict && (
                      <p className="text-xs text-rose-800 dark:text-rose-400 font-bold mt-1">
                        ⚠️ Clean Conflict: {cleanConflict}
                      </p>
                    )}
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {isCook ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-orange-950 dark:text-orange-200 bg-orange-100 dark:bg-orange-950/60 border border-orange-300 dark:border-orange-800 px-2.5 py-1.5 rounded-xl">
                          ✅ Assigned Cook
                        </span>
                        <button
                          onClick={() =>
                            handleRemoveShift(day.dateKey, selectedQuotaMember, "COOK")
                          }
                          aria-label={`Remove cook shift on ${day.dateLabel}`}
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:text-rose-700 dark:hover:text-rose-400 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                          title="Remove cook shift"
                        >
                          <XCircle className="w-5 h-5" />
                        </button>
                      </div>
                    ) : canCook && !cookConflict ? (
                      <button
                        onClick={() =>
                          handleAddExtraShift(day.dateKey, selectedQuotaMember, "COOK")
                        }
                        className="min-h-[44px] px-3.5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                      >
                        + Add as Cook ({getOrdinal(day.cooks.length + 1)})
                      </button>
                    ) : null}

                    {isClean ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-sky-950 dark:text-sky-200 bg-sky-100 dark:bg-sky-950/60 border border-sky-300 dark:border-sky-800 px-2.5 py-1.5 rounded-xl">
                          ✅ Assigned Cleaner
                        </span>
                        <button
                          onClick={() =>
                            handleRemoveShift(day.dateKey, selectedQuotaMember, "CLEAN")
                          }
                          aria-label={`Remove clean shift on ${day.dateLabel}`}
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:text-rose-700 dark:hover:text-rose-400 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                          title="Remove clean shift"
                        >
                          <XCircle className="w-5 h-5" />
                        </button>
                      </div>
                    ) : canClean && !cleanConflict && !isCook ? (
                      <button
                        onClick={() =>
                          handleAddExtraShift(day.dateKey, selectedQuotaMember, "CLEAN")
                        }
                        className="min-h-[44px] px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
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
        <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={onClose}
            className="min-h-[44px] px-6 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs cursor-pointer transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

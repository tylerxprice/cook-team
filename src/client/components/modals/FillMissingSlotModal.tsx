import React from "react";
import { UserPlus, X } from "lucide-react";
import { DaySchedule, IntakePayload, Role, ScheduleOutput } from "../../../server/types";
import {
  getMemberAvailabilityForDate,
  isWillingTwoPersonDinner,
} from "../../../server/scheduleParser";
import { formatDisplayDateLabel } from "../../utils/formatters";

export interface FillMissingSlotModalProps {
  selectedSlotToFill: {
    dateKey: string;
    dateLabel: string;
    role: Role;
  } | null;
  onClose: () => void;
  solverResult: ScheduleOutput | null;
  intakeData: IntakePayload | null;
  checkAssignmentConflict: (memberName: string, role: Role, day: DaySchedule) => string | null;
  handleAddExtraShift: (dateKey: string, memberName: string, role: Role) => void;
}

export const FillMissingSlotModal: React.FC<FillMissingSlotModalProps> = ({
  selectedSlotToFill,
  onClose,
  solverResult,
  intakeData,
  checkAssignmentConflict,
  handleAddExtraShift,
}) => {
  if (!selectedSlotToFill || !solverResult || !intakeData) return null;

  const targetDay = solverResult.schedule.find((d) => d.dateKey === selectedSlotToFill.dateKey);
  if (!targetDay) return null;
  const role = selectedSlotToFill.role;
  const isCookRole = role === "COOK";

  // Sort candidates: Available first, then by non-oversubscribed, then lowest total assigned shifts
  const candidateList = intakeData.responses
    .map((resp) => {
      const avail = getMemberAvailabilityForDate(resp, selectedSlotToFill.dateLabel);
      const stat = solverResult.memberStats[resp.name];
      const isAlreadyCook = targetDay.cooks.includes(resp.name);
      const isAlreadyClean = targetDay.cleaners.includes(resp.name);
      const conflict = checkAssignmentConflict(resp.name, role, targetDay);

      const isAvailableForRole = isCookRole
        ? avail === "AVAILABLE" || avail === "COOK_ONLY"
        : avail === "AVAILABLE" || avail === "CLEAN_ONLY";

      const assignedCount = isCookRole ? stat?.assignedCooks || 0 : stat?.assignedCleans || 0;
      const quota = isCookRole ? stat?.requestedCookQuota || 1 : (stat?.requestedCleanQuota ?? 1);
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
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title-fill-slot"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl p-6 space-y-4 max-h-[90vh] flex flex-col border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h3
              id="modal-title-fill-slot"
              className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2"
            >
              <UserPlus className={`w-5 h-5 ${isCookRole ? "text-orange-600" : "text-sky-600"}`} />
              Fill Missing {isCookRole ? "Cook" : "Cleaner"} Slot
            </h3>
            <p className="text-xs text-slate-700 mt-1">
              <strong className="text-slate-900">
                {formatDisplayDateLabel(selectedSlotToFill.dateLabel)}
              </strong>{" "}
              ({targetDay.mealType}) • Current Team:{" "}
              {isCookRole
                ? `Cooks: ${targetDay.cooks.join(", ") || "None"}`
                : `Cleaners: ${targetDay.cleaners.join(", ") || "None"}`}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informational Callout */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-700 font-medium">
          💡 Select a community member below to fill this slot. Members who have already fulfilled
          their requested quota will be marked as <strong>Oversubscribed</strong> in the
          distribution summary.
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
                className={`p-3.5 rounded-xl border transition-colors ${
                  alreadyAssignedOnRole
                    ? "bg-slate-50 border-slate-200 opacity-60"
                    : isAvailableForRole && !conflict
                      ? "bg-white border-slate-200 hover:border-slate-300 shadow-2xs"
                      : "bg-slate-50/50 border-slate-200 opacity-60"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  {/* Left: Member info */}
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs sm:text-sm font-bold text-slate-900">
                        {resp.name}
                      </span>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                          avail === "AVAILABLE"
                            ? "bg-emerald-100 text-emerald-950 border-emerald-300"
                            : avail === "COOK_ONLY"
                              ? "bg-orange-100 text-orange-950 border-orange-300"
                              : avail === "CLEAN_ONLY"
                                ? "bg-sky-100 text-sky-950 border-sky-300"
                                : "bg-slate-100 text-slate-700 border-slate-300"
                        }`}
                      >
                        Survey: {avail.replace("_", " ")}
                      </span>
                      {isCookRole &&
                        (isWillingTwoPersonDinner(resp.cookTeamSizePref) ? (
                          <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-blue-100 text-blue-950 border border-blue-300">
                            👥 2-Cook Team OK ({resp.cookTeamSizePref})
                          </span>
                        ) : (
                          <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                            Pref: {resp.cookTeamSizePref || "Dinner = 3, Brunch = 2"}
                          </span>
                        ))}
                      {isOversubscribed ? (
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-purple-100 text-purple-950 border border-purple-300">
                          ⚠️ Oversubscribes ({assignedCount}/{quota} shifts)
                        </span>
                      ) : (
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-blue-50 text-blue-900 border border-blue-200">
                          Has Quota ({assignedCount}/{quota})
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-700 mt-1.5 flex items-center gap-3">
                      <span>
                        Total shifts:{" "}
                        <strong className="text-slate-900">{stat?.totalAssigned || 0}</strong>
                      </span>
                      <span>
                        Cooks:{" "}
                        <strong className="text-slate-900">{stat?.assignedCooks || 0}</strong>
                      </span>
                      <span>
                        Cleans:{" "}
                        <strong className="text-slate-900">{stat?.assignedCleans || 0}</strong>
                      </span>
                      {resp.canCookCleanSameDay && (
                        <span className="text-emerald-800 font-bold">✓ Same-day willing</span>
                      )}
                    </div>

                    {resp.specialInstructions && (
                      <p className="text-xs text-amber-900 font-medium italic mt-1">
                        &quot;{resp.specialInstructions}&quot;
                      </p>
                    )}

                    {conflict && (
                      <p className="text-xs text-rose-800 font-bold mt-1">
                        ⚠️ Conflict: {conflict}
                      </p>
                    )}
                  </div>

                  {/* Right: Action */}
                  <div className="shrink-0">
                    {alreadyAssignedOnRole ? (
                      <span className="text-xs text-slate-500 font-bold">Already Assigned</span>
                    ) : conflict ? (
                      <span className="text-xs text-rose-700 font-bold">Blocked by Rule</span>
                    ) : (
                      <button
                        onClick={() => {
                          handleAddExtraShift(selectedSlotToFill.dateKey, resp.name, role);
                          onClose();
                        }}
                        className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer ${
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
        <div className="flex justify-end pt-3 border-t border-slate-200">
          <button
            onClick={onClose}
            className="min-h-[44px] px-5 py-2 text-xs sm:text-sm font-bold text-slate-700 hover:text-slate-950 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

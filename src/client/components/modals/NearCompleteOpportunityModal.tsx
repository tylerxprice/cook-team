import React from "react";
import { X, Check, Plus } from "lucide-react";
import { ScheduleOutput } from "../../../server/types";
import { formatDisplayDateLabel } from "../../utils/formatters";

export interface NearCompleteOpportunityModalProps {
  selectedNearCompleteDateKey: string | null;
  onClose: () => void;
  solverResult: ScheduleOutput | null;
  recoverySelectedCooks: string[];
  setRecoverySelectedCooks: React.Dispatch<React.SetStateAction<string[]>>;
  recoverySelectedCleaners: string[];
  setRecoverySelectedCleaners: React.Dispatch<React.SetStateAction<string[]>>;
  handleRestoreWithSelectedVolunteers: (
    dateKey: string,
    cooks: string[],
    cleaners: string[]
  ) => void;
}

export const NearCompleteOpportunityModal: React.FC<NearCompleteOpportunityModalProps> = ({
  selectedNearCompleteDateKey,
  onClose,
  solverResult,
  recoverySelectedCooks,
  setRecoverySelectedCooks,
  recoverySelectedCleaners,
  setRecoverySelectedCleaners,
  handleRestoreWithSelectedVolunteers,
}) => {
  if (!selectedNearCompleteDateKey || !solverResult) return null;

  const opp = solverResult.nearCompleteOpportunities?.find(
    (o) => o.dateKey === selectedNearCompleteDateKey
  );
  if (!opp) return null;

  const targetCooks = opp.targetCookCount || (opp.mealType === "BRUNCH" ? 2 : 3);
  const targetCleans = opp.targetCleanCount || (opp.mealType === "BRUNCH" ? 2 : 3);

  const cookCandidates = (opp.candidateVolunteersToAsk || []).filter((c) =>
    c.availableRoles.includes("COOK")
  );
  const cleanCandidates = (opp.candidateVolunteersToAsk || []).filter((c) =>
    c.availableRoles.includes("CLEAN")
  );

  const sortedCookCandidates = [...cookCandidates].sort((a, b) => {
    const aAssigned = solverResult.memberStats?.[a.name]?.assignedCooks ?? a.assignedCooks ?? 0;
    const aQuota = a.requestedCookQuota ?? 1;
    const aCan = aAssigned < aQuota;

    const bAssigned = solverResult.memberStats?.[b.name]?.assignedCooks ?? b.assignedCooks ?? 0;
    const bQuota = b.requestedCookQuota ?? 1;
    const bCan = bAssigned < bQuota;

    if (aCan && !bCan) return -1;
    if (!aCan && bCan) return 1;
    return a.name.localeCompare(b.name);
  });

  const sortedCleanCandidates = [...cleanCandidates].sort((a, b) => {
    const aAssigned = solverResult.memberStats?.[a.name]?.assignedCleans ?? a.assignedCleans ?? 0;
    const aQuota = a.requestedCleanQuota ?? 1;
    const aCan = aAssigned < aQuota;

    const bAssigned = solverResult.memberStats?.[b.name]?.assignedCleans ?? b.assignedCleans ?? 0;
    const bQuota = b.requestedCleanQuota ?? 1;
    const bCan = bAssigned < bQuota;

    if (aCan && !bCan) return -1;
    if (!aCan && bCan) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title-meal-recovery"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-amber-50/80 via-orange-50/50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 border border-amber-300 text-amber-900 flex items-center justify-center font-bold text-lg shadow-xs">
              💡
            </div>
            <div>
              <h3
                id="modal-title-meal-recovery"
                className="text-base sm:text-lg font-bold text-slate-900"
              >
                Meal Recovery Opportunity
              </h3>
              <p className="text-xs font-bold text-amber-950 flex items-center gap-2 mt-0.5">
                <span>{formatDisplayDateLabel(opp.dateLabel)}</span>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase border ${
                    opp.mealType === "BRUNCH"
                      ? "bg-amber-100 text-amber-900 border-amber-300"
                      : "bg-indigo-100 text-indigo-900 border-indigo-300"
                  }`}
                >
                  {opp.mealType}
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* 3-Column Capacity & Gap Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-center text-xs sm:text-sm">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 shadow-2xs">
              <p className="text-xs text-slate-600 font-bold uppercase">Required Team Size</p>
              <p className="font-extrabold text-slate-900 text-sm mt-0.5">
                {targetCooks} Cooks • {targetCleans} Cleaners
              </p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 shadow-2xs">
              <p className="text-xs text-slate-600 font-bold uppercase">Available in Survey</p>
              <p className="font-extrabold text-slate-900 text-sm mt-0.5">
                {opp.availableCooks.length} Cooks • {opp.availableCleaners.length} Cleaners
              </p>
            </div>
            <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3 shadow-2xs">
              <p className="text-xs text-amber-900 font-bold uppercase">Recruitment Gap</p>
              <p className="font-extrabold text-amber-950 text-sm mt-0.5">
                {opp.missingCooksCount > 0
                  ? `Short ${opp.missingCooksCount} Cook${opp.missingCooksCount > 1 ? "s" : ""}`
                  : "0 cooks needed"}
                {opp.missingCooksCount > 0 && opp.missingCleanersCount > 0 ? " & " : ""}
                {opp.missingCleanersCount > 0
                  ? `Short ${opp.missingCleanersCount} Cleaner${opp.missingCleanersCount > 1 ? "s" : ""}`
                  : opp.missingCooksCount === 0
                    ? "0 cleaners needed"
                    : ""}
              </p>
            </div>
          </div>

          {/* Cook Candidates Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs sm:text-sm font-bold text-orange-950 uppercase tracking-wider flex items-center gap-1.5">
                🍳 Select Cooks to Assign ({sortedCookCandidates.length} Available)
              </h4>
              <span className="text-xs text-orange-950 font-bold">
                {recoverySelectedCooks.length} of {targetCooks} selected
              </span>
            </div>
            {sortedCookCandidates.length > 0 ? (
              <div className="space-y-2 max-h-52 overflow-y-auto p-2 bg-orange-50/40 border border-orange-200 rounded-xl divide-y divide-orange-100">
                {sortedCookCandidates.map((cand) => {
                  const liveCooksAssigned =
                    solverResult.memberStats?.[cand.name]?.assignedCooks ?? cand.assignedCooks ?? 0;
                  const liveCookQuota = cand.requestedCookQuota ?? 1;
                  const hasRemainingCookQuota = liveCooksAssigned < liveCookQuota;
                  const isSelected = recoverySelectedCooks.includes(cand.name);
                  return (
                    <div
                      key={`cook-${cand.name}`}
                      role="checkbox"
                      aria-checked={isSelected}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === " " || e.key === "Enter") {
                          e.preventDefault();
                          if (isSelected) {
                            setRecoverySelectedCooks(
                              recoverySelectedCooks.filter((n) => n !== cand.name)
                            );
                          } else {
                            setRecoverySelectedCooks([...recoverySelectedCooks, cand.name]);
                          }
                        }
                      }}
                      onClick={() => {
                        if (isSelected) {
                          setRecoverySelectedCooks(
                            recoverySelectedCooks.filter((n) => n !== cand.name)
                          );
                        } else {
                          setRecoverySelectedCooks([...recoverySelectedCooks, cand.name]);
                        }
                      }}
                      className={`min-h-[48px] pt-2 first:pt-0 p-2.5 rounded-xl cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs sm:text-sm ${
                        isSelected
                          ? "bg-orange-100 border border-orange-400 shadow-2xs font-semibold"
                          : "bg-white border border-orange-200 hover:border-orange-300 hover:bg-orange-50/60"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                            isSelected
                              ? "bg-orange-600 border-orange-600 text-white"
                              : "border-slate-300 bg-white"
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                        <div>
                          <span className="font-bold text-slate-900">{cand.name}</span>
                          {cand.specialInstructions && (
                            <p className="text-xs text-amber-900 font-medium italic mt-0.5">
                              &quot;{cand.specialInstructions}&quot;
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 pl-7 sm:pl-0">
                        {hasRemainingCookQuota ? (
                          <span className="text-xs font-bold text-emerald-900 bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-lg">
                            ✨ Can Cook ({liveCooksAssigned}/{liveCookQuota} assigned)
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-orange-950 bg-orange-100 border border-orange-300 px-2.5 py-1 rounded-lg">
                            ⚡ At Quota ({liveCooksAssigned}/{liveCookQuota} assigned)
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-600 italic text-center">
                No members marked cooking availability on this date.
              </div>
            )}
          </div>

          {/* Clean Candidates Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs sm:text-sm font-bold text-sky-950 uppercase tracking-wider flex items-center gap-1.5">
                🧼 Select Cleaners to Assign ({sortedCleanCandidates.length} Available)
              </h4>
              <span className="text-xs text-sky-950 font-bold">
                {recoverySelectedCleaners.length} of {targetCleans} selected
              </span>
            </div>
            {sortedCleanCandidates.length > 0 ? (
              <div className="space-y-2 max-h-52 overflow-y-auto p-2 bg-sky-50/40 border border-sky-200 rounded-xl divide-y divide-sky-100">
                {sortedCleanCandidates.map((cand) => {
                  const liveCleansAssigned =
                    solverResult.memberStats?.[cand.name]?.assignedCleans ??
                    cand.assignedCleans ??
                    0;
                  const liveCleanQuota = cand.requestedCleanQuota ?? 1;
                  const hasRemainingCleanQuota = liveCleansAssigned < liveCleanQuota;
                  const isSelected = recoverySelectedCleaners.includes(cand.name);
                  return (
                    <div
                      key={`clean-${cand.name}`}
                      role="checkbox"
                      aria-checked={isSelected}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === " " || e.key === "Enter") {
                          e.preventDefault();
                          if (isSelected) {
                            setRecoverySelectedCleaners(
                              recoverySelectedCleaners.filter((n) => n !== cand.name)
                            );
                          } else {
                            setRecoverySelectedCleaners([...recoverySelectedCleaners, cand.name]);
                          }
                        }
                      }}
                      onClick={() => {
                        if (isSelected) {
                          setRecoverySelectedCleaners(
                            recoverySelectedCleaners.filter((n) => n !== cand.name)
                          );
                        } else {
                          setRecoverySelectedCleaners([...recoverySelectedCleaners, cand.name]);
                        }
                      }}
                      className={`min-h-[48px] pt-2 first:pt-0 p-2.5 rounded-xl cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs sm:text-sm ${
                        isSelected
                          ? "bg-sky-100 border border-sky-400 shadow-2xs font-semibold"
                          : "bg-white border border-sky-200 hover:border-sky-300 hover:bg-sky-50/60"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                            isSelected
                              ? "bg-sky-600 border-sky-600 text-white"
                              : "border-slate-300 bg-white"
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                        <div>
                          <span className="font-bold text-slate-900">{cand.name}</span>
                          {cand.specialInstructions && (
                            <p className="text-xs text-amber-900 font-medium italic mt-0.5">
                              &quot;{cand.specialInstructions}&quot;
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 pl-7 sm:pl-0">
                        {hasRemainingCleanQuota ? (
                          <span className="text-xs font-bold text-emerald-900 bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-lg">
                            ✨ Can Clean ({liveCleansAssigned}/{liveCleanQuota} assigned)
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-sky-950 bg-sky-100 border border-sky-300 px-2.5 py-1 rounded-lg">
                            ⚡ At Quota ({liveCleansAssigned}/{liveCleanQuota} assigned)
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-600 italic text-center">
                No members marked cleaning availability on this date.
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-5 py-2.5 text-xs sm:text-sm font-bold text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded-xl cursor-pointer transition-colors"
          >
            Close
          </button>

          <button
            type="button"
            onClick={() => {
              handleRestoreWithSelectedVolunteers(
                opp.dateKey,
                recoverySelectedCooks,
                recoverySelectedCleaners
              );
              onClose();
            }}
            className="min-h-[44px] px-6 py-2.5 text-xs sm:text-sm font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>
              {recoverySelectedCooks.length + recoverySelectedCleaners.length > 0
                ? `+ Add Back & Assign (${recoverySelectedCooks.length} cook${recoverySelectedCooks.length === 1 ? "" : "s"}, ${recoverySelectedCleaners.length} clean${recoverySelectedCleaners.length === 1 ? "" : "s"})`
                : "+ Add Back into Schedule"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useEffect } from "react";
import { X, Check, Plus, AlertTriangle } from "lucide-react";
import {
  ScheduleOutput,
  CandidateVolunteer,
  MemberQuotaStat,
  SurveyResponse,
  IntakePayload,
} from "../../../server/types";
import { formatDisplayDateLabel } from "../../utils/formatters";

export interface NearCompleteOpportunityModalProps {
  selectedNearCompleteDateKey: string | null;
  onClose: () => void;
  solverResult: ScheduleOutput | null;
  intakeData?: IntakePayload | null;
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

export interface CandidateCapacity {
  assignedCooks: number;
  cookQuota: number;
  assignedCleans: number;
  cleanQuota: number;
  totalAssigned: number;
  maxTotal: number;
  hasExplicitMaxCap: boolean;
  isTotalCapMet: boolean;
  isCookCapMet: boolean;
  isCleanCapMet: boolean;
  canCook: boolean;
  canClean: boolean;
  isOversubscribed: boolean;
}

export function computeMemberCapacity(
  cand: CandidateVolunteer,
  solverResult: ScheduleOutput | null,
  intakeData?: IntakePayload | null
): CandidateCapacity {
  const stat: MemberQuotaStat | undefined = solverResult?.memberStats?.[cand.name];
  const resp: SurveyResponse | undefined = intakeData?.responses?.find(
    (r: SurveyResponse) => r.name.toLowerCase() === cand.name.toLowerCase()
  );

  const assignedCooks = stat?.assignedCooks ?? cand.assignedCooks ?? 0;
  const cookQuota = stat?.requestedCookQuota ?? cand.requestedCookQuota ?? resp?.cookQuota ?? 1;

  const assignedCleans = stat?.assignedCleans ?? cand.assignedCleans ?? 0;
  const cleanQuota = stat?.requestedCleanQuota ?? cand.requestedCleanQuota ?? resp?.cleanQuota ?? 1;

  const totalAssigned = stat?.totalAssigned ?? (assignedCooks + assignedCleans);

  const rawMax =
    (typeof stat?.requestedMaxTotalShifts === "number" && stat.requestedMaxTotalShifts > 0
      ? stat.requestedMaxTotalShifts
      : undefined) ??
    (typeof cand.requestedMaxTotalShifts === "number" && cand.requestedMaxTotalShifts > 0
      ? cand.requestedMaxTotalShifts
      : undefined) ??
    (typeof cand.maxTotalShifts === "number" && cand.maxTotalShifts > 0
      ? cand.maxTotalShifts
      : undefined) ??
    (typeof resp?.maxTotalShifts === "number" && resp.maxTotalShifts > 0
      ? resp.maxTotalShifts
      : undefined);

  const maxTotal = typeof rawMax === "number" && rawMax > 0 ? rawMax : cookQuota + cleanQuota;
  const hasExplicitMaxCap = maxTotal < cookQuota + cleanQuota;

  const isTotalCapMet = totalAssigned >= maxTotal;
  const isCookCapMet = assignedCooks >= cookQuota;
  const isCleanCapMet = assignedCleans >= cleanQuota;
  const isOversubscribed =
    totalAssigned > maxTotal || assignedCooks > cookQuota || assignedCleans > cleanQuota;

  // A member can safely take a cook/clean shift IF they haven't met that role's quota AND haven't met their combined shift limit
  const canCook = !isCookCapMet && !isTotalCapMet;
  const canClean = !isCleanCapMet && !isTotalCapMet;

  return {
    assignedCooks,
    cookQuota,
    assignedCleans,
    cleanQuota,
    totalAssigned,
    maxTotal,
    hasExplicitMaxCap,
    isTotalCapMet,
    isCookCapMet,
    isCleanCapMet,
    canCook,
    canClean,
    isOversubscribed,
  };
}

export const NearCompleteOpportunityModal: React.FC<NearCompleteOpportunityModalProps> = ({
  selectedNearCompleteDateKey,
  onClose,
  solverResult,
  intakeData,
  recoverySelectedCooks,
  setRecoverySelectedCooks,
  recoverySelectedCleaners,
  setRecoverySelectedCleaners,
  handleRestoreWithSelectedVolunteers,
}) => {
  const opp = solverResult?.nearCompleteOpportunities?.find(
    (o) => o.dateKey === selectedNearCompleteDateKey
  );

  const targetCooks = opp?.targetCookCount || (opp?.mealType === "BRUNCH" ? 2 : 3);
  const targetCleans = opp?.targetCleanCount || (opp?.mealType === "BRUNCH" ? 2 : 3);

  const cookCandidates = (opp?.candidateVolunteersToAsk || []).filter((c) =>
    c.availableRoles.includes("COOK")
  );
  const cleanCandidates = (opp?.candidateVolunteersToAsk || []).filter((c) =>
    c.availableRoles.includes("CLEAN")
  );

  const sortedCookCandidates = [...cookCandidates].sort((a, b) => {
    const capA = computeMemberCapacity(a, solverResult, intakeData);
    const capB = computeMemberCapacity(b, solverResult, intakeData);

    // Candidates who can cook without exceeding limits come first
    if (capA.canCook && !capB.canCook) return -1;
    if (!capA.canCook && capB.canCook) return 1;

    // Next: lowest total assigned shifts (fair-share)
    if (capA.totalAssigned !== capB.totalAssigned) {
      return capA.totalAssigned - capB.totalAssigned;
    }

    return a.name.localeCompare(b.name);
  });

  const sortedCleanCandidates = [...cleanCandidates].sort((a, b) => {
    const capA = computeMemberCapacity(a, solverResult, intakeData);
    const capB = computeMemberCapacity(b, solverResult, intakeData);

    // Candidates who can clean without exceeding limits come first
    if (capA.canClean && !capB.canClean) return -1;
    if (!capA.canClean && capB.canClean) return 1;

    // Next: lowest total assigned shifts (fair-share)
    if (capA.totalAssigned !== capB.totalAssigned) {
      return capA.totalAssigned - capB.totalAssigned;
    }

    return a.name.localeCompare(b.name);
  });

  // Pre-select candidates when modal opens for a new dateKey (ONLY candidates with remaining capacity)
  useEffect(() => {
    if (!selectedNearCompleteDateKey || !solverResult) return;

    // 1. Pre-select cooks who actually have capacity under cook quota AND combined max shift limit
    const initialCooks: string[] = [];
    for (const cand of sortedCookCandidates) {
      if (initialCooks.length >= targetCooks) break;
      const cap = computeMemberCapacity(cand, solverResult, intakeData);
      if (cap.canCook) {
        initialCooks.push(cand.name);
      }
    }

    // 2. Pre-select cleaners who actually have capacity under clean quota AND combined max shift limit,
    // taking into account if they were already pre-selected as a cook on this recovery date
    const initialCleans: string[] = [];
    for (const cand of sortedCleanCandidates) {
      if (initialCleans.length >= targetCleans) break;
      const cap = computeMemberCapacity(cand, solverResult, intakeData);
      const isAlsoCook = initialCooks.includes(cand.name);
      const effectiveTotalAssigned = cap.totalAssigned + (isAlsoCook ? 1 : 0);
      const canCleanWithoutOversubscribing =
        !cap.isCleanCapMet && effectiveTotalAssigned < cap.maxTotal;

      if (canCleanWithoutOversubscribing) {
        initialCleans.push(cand.name);
      }
    }

    setRecoverySelectedCooks(initialCooks);
    setRecoverySelectedCleaners(initialCleans);
  }, [selectedNearCompleteDateKey]);

  const handleToggleCook = (name: string) => {
    if (recoverySelectedCooks.includes(name)) {
      setRecoverySelectedCooks(recoverySelectedCooks.filter((n) => n !== name));
    } else {
      if (recoverySelectedCooks.length < targetCooks) {
        setRecoverySelectedCooks([...recoverySelectedCooks, name]);
      }
    }
  };

  const handleToggleCleaner = (name: string) => {
    if (recoverySelectedCleaners.includes(name)) {
      setRecoverySelectedCleaners(recoverySelectedCleaners.filter((n) => n !== name));
    } else {
      if (recoverySelectedCleaners.length < targetCleans) {
        setRecoverySelectedCleaners([...recoverySelectedCleaners, name]);
      }
    }
  };

  const renderCookBadge = (cand: CandidateVolunteer) => {
    const cap = computeMemberCapacity(cand, solverResult, intakeData);

    if (cap.isOversubscribed) {
      return (
        <span className="text-xs font-bold text-rose-950 dark:text-rose-200 bg-rose-100 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 px-2.5 py-1 rounded-lg">
          ⚠️ Oversubscribed ({cap.totalAssigned}/{cap.maxTotal} shifts)
        </span>
      );
    }
    if (cap.isTotalCapMet) {
      return (
        <span className="text-xs font-bold text-amber-950 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 px-2.5 py-1 rounded-lg">
          {cap.isCookCapMet
            ? `⚡ At Quota (${cap.assignedCooks}/${cap.cookQuota} cooks • ${cap.totalAssigned}/${cap.maxTotal} total)`
            : `⚠️ At Max Total (${cap.totalAssigned}/${cap.maxTotal} total • ${cap.assignedCooks}/${cap.cookQuota} cooks)`}
        </span>
      );
    }
    if (cap.isCookCapMet) {
      return (
        <span className="text-xs font-bold text-orange-950 dark:text-orange-200 bg-orange-100/80 dark:bg-orange-950/60 border border-orange-300 dark:border-orange-800 px-2.5 py-1 rounded-lg">
          ⚡ At Cook Quota ({cap.assignedCooks}/${cap.cookQuota} cooks • ${cap.totalAssigned}/${cap.maxTotal} total)
        </span>
      );
    }
    return (
      <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 px-2.5 py-1 rounded-lg">
        ✨ Can Cook ({cap.assignedCooks}/${cap.cookQuota} assigned
        {cap.hasExplicitMaxCap || cap.totalAssigned > 0
          ? ` • ${cap.totalAssigned}/${cap.maxTotal} total`
          : ""}
        )
      </span>
    );
  };

  const renderCleanBadge = (cand: CandidateVolunteer) => {
    const cap = computeMemberCapacity(cand, solverResult, intakeData);

    if (cap.isOversubscribed) {
      return (
        <span className="text-xs font-bold text-rose-950 dark:text-rose-200 bg-rose-100 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 px-2.5 py-1 rounded-lg">
          ⚠️ Oversubscribed ({cap.totalAssigned}/{cap.maxTotal} shifts)
        </span>
      );
    }
    if (cap.isTotalCapMet) {
      return (
        <span className="text-xs font-bold text-amber-950 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 px-2.5 py-1 rounded-lg">
          {cap.isCleanCapMet
            ? `⚡ At Quota (${cap.assignedCleans}/${cap.cleanQuota} cleans • ${cap.totalAssigned}/${cap.maxTotal} total)`
            : `⚠️ At Max Total (${cap.totalAssigned}/${cap.maxTotal} total • ${cap.assignedCleans}/${cap.cleanQuota} cleans)`}
        </span>
      );
    }
    if (cap.isCleanCapMet) {
      return (
        <span className="text-xs font-bold text-sky-950 dark:text-sky-200 bg-sky-100/80 dark:bg-sky-950/60 border border-sky-300 dark:border-sky-800 px-2.5 py-1 rounded-lg">
          ⚡ At Clean Quota ({cap.assignedCleans}/${cap.cleanQuota} cleans • ${cap.totalAssigned}/${cap.maxTotal} total)
        </span>
      );
    }
    return (
      <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 px-2.5 py-1 rounded-lg">
        ✨ Can Clean ({cap.assignedCleans}/${cap.cleanQuota} assigned
        {cap.hasExplicitMaxCap || cap.totalAssigned > 0
          ? ` • ${cap.totalAssigned}/${cap.maxTotal} total`
          : ""}
        )
      </span>
    );
  };

  if (!selectedNearCompleteDateKey || !solverResult || !opp) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title-meal-recovery"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full max-h-[90vh] shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-amber-50/80 via-orange-50/50 to-white dark:from-amber-950/30 dark:via-orange-950/20 dark:to-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex items-center justify-center font-bold text-lg shadow-xs">
              💡
            </div>
            <div>
              <h3
                id="modal-title-meal-recovery"
                className="text-base sm:text-lg font-bold text-slate-900 dark:text-white"
              >
                Meal Recovery Opportunity
              </h3>
              <p className="text-xs font-bold text-amber-950 dark:text-amber-200 flex items-center gap-2 mt-0.5">
                <span>{formatDisplayDateLabel(opp.dateLabel)}</span>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase border ${
                    opp.mealType === "BRUNCH"
                      ? "bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-800"
                      : "bg-indigo-100 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200 border-indigo-300 dark:border-indigo-800"
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
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* Compact Capacity & Gap Breakdown Strip */}
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs shadow-2xs">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 dark:text-slate-400 font-semibold uppercase text-[11px] tracking-wide">
                Required:
              </span>
              <span className="font-extrabold text-slate-800 dark:text-slate-200">
                {targetCooks} Cooks • {targetCleans} Cleaners
              </span>
            </div>
            <div className="hidden sm:block text-slate-300 dark:text-slate-600 font-bold">•</div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 dark:text-slate-400 font-semibold uppercase text-[11px] tracking-wide">
                Available:
              </span>
              <span className="font-extrabold text-slate-800 dark:text-slate-200">
                {opp.availableCooks.length} Cooks • {opp.availableCleaners.length} Cleaners
              </span>
            </div>
            <div className="hidden sm:block text-slate-300 dark:text-slate-600 font-bold">•</div>
            <div className="flex items-center gap-1.5">
              <span className="text-amber-800 dark:text-amber-400 font-semibold uppercase text-[11px] tracking-wide">
                Gap:
              </span>
              <span className="font-extrabold text-amber-950 dark:text-amber-200">
                {opp.missingCooksCount > 0
                  ? `Short ${opp.missingCooksCount} Cook${opp.missingCooksCount > 1 ? "s" : ""}`
                  : "0 cooks needed"}
                {opp.missingCooksCount > 0 && opp.missingCleanersCount > 0 ? " & " : ""}
                {opp.missingCleanersCount > 0
                  ? `Short ${opp.missingCleanersCount} Cleaner${opp.missingCleanersCount > 1 ? "s" : ""}`
                  : opp.missingCooksCount === 0
                    ? "0 cleaners needed"
                    : ""}
              </span>
            </div>
          </div>

          {/* Cook Candidates Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs sm:text-sm font-bold text-orange-950 dark:text-orange-200 uppercase tracking-wider flex items-center gap-1.5">
                🍳 Select Cooks to Assign ({sortedCookCandidates.length} Available)
              </h4>
              <span
                className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                  recoverySelectedCooks.length === targetCooks
                    ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800"
                    : recoverySelectedCooks.length > 0
                      ? "bg-orange-100 dark:bg-orange-950/60 text-orange-800 dark:text-orange-200 border-orange-300 dark:border-orange-800"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700"
                }`}
              >
                {recoverySelectedCooks.length} of {targetCooks} selected
              </span>
            </div>
            {sortedCookCandidates.length > 0 ? (
              <div className="space-y-2 max-h-52 overflow-y-auto p-2 bg-orange-50/40 dark:bg-slate-800/40 border border-orange-200 dark:border-orange-900/40 rounded-xl divide-y divide-orange-100 dark:divide-slate-800">
                {sortedCookCandidates.map((cand) => {
                  const cap = computeMemberCapacity(cand, solverResult, intakeData);
                  const isSelected = recoverySelectedCooks.includes(cand.name);
                  const isSelectedClean = recoverySelectedCleaners.includes(cand.name);
                  const pendingTotal =
                    cap.totalAssigned + (isSelected ? 1 : 0) + (isSelectedClean ? 1 : 0);
                  const wouldOversubscribe =
                    pendingTotal > cap.maxTotal ||
                    (isSelected && cap.assignedCooks + 1 > cap.cookQuota);

                  return (
                    <div
                      key={`cook-${cand.name}`}
                      role="checkbox"
                      aria-checked={isSelected}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === " " || e.key === "Enter") {
                          e.preventDefault();
                          handleToggleCook(cand.name);
                        }
                      }}
                      onClick={() => handleToggleCook(cand.name)}
                      className={`min-h-[48px] pt-2 first:pt-0 p-2.5 rounded-xl cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs sm:text-sm ${
                        isSelected
                          ? "bg-orange-50/90 dark:bg-orange-950/40 border-2 border-orange-500 shadow-xs ring-1 ring-orange-400 font-semibold"
                          : "bg-white dark:bg-slate-800/80 border border-orange-200 dark:border-slate-700 hover:border-orange-300 dark:hover:border-slate-600 hover:bg-orange-50/60 dark:hover:bg-slate-800"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                            isSelected
                              ? "bg-orange-600 border-orange-600 text-white shadow-2xs"
                              : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`font-bold ${
                                isSelected
                                  ? "text-orange-950 dark:text-orange-200 font-extrabold"
                                  : "text-slate-900 dark:text-slate-100"
                              }`}
                            >
                              {cand.name}
                            </span>
                            {isSelected && (
                              <span className="text-[10px] font-extrabold text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-950/60 border border-orange-300 dark:border-orange-800 px-2 py-0.5 rounded-full shadow-2xs">
                                ✓ Selected
                              </span>
                            )}
                            {isSelected && wouldOversubscribe && (
                              <span className="text-[10px] font-extrabold text-amber-900 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/80 border border-amber-400 dark:border-amber-700 px-2 py-0.5 rounded-full shadow-2xs">
                                ⚠️ Oversubscribes ({pendingTotal}/{cap.maxTotal} total)
                              </span>
                            )}
                          </div>
                          {cand.specialInstructions && (
                            <p className="text-xs text-amber-900 dark:text-amber-300 font-medium italic mt-0.5">
                              &quot;{cand.specialInstructions}&quot;
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 pl-7 sm:pl-0">
                        {renderCookBadge(cand)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-600 dark:text-slate-400 italic text-center">
                No members marked cooking availability on this date.
              </div>
            )}
          </div>

          {/* Clean Candidates Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs sm:text-sm font-bold text-sky-950 dark:text-sky-200 uppercase tracking-wider flex items-center gap-1.5">
                🧼 Select Cleaners to Assign ({sortedCleanCandidates.length} Available)
              </h4>
              <span
                className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                  recoverySelectedCleaners.length === targetCleans
                    ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800"
                    : recoverySelectedCleaners.length > 0
                      ? "bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-200 border-sky-300 dark:border-sky-800"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700"
                }`}
              >
                {recoverySelectedCleaners.length} of {targetCleans} selected
              </span>
            </div>
            {sortedCleanCandidates.length > 0 ? (
              <div className="space-y-2 max-h-52 overflow-y-auto p-2 bg-sky-50/40 dark:bg-slate-800/40 border border-sky-200 dark:border-sky-900/40 rounded-xl divide-y divide-sky-100 dark:divide-slate-800">
                {sortedCleanCandidates.map((cand) => {
                  const cap = computeMemberCapacity(cand, solverResult, intakeData);
                  const isSelected = recoverySelectedCleaners.includes(cand.name);
                  const isSelectedCook = recoverySelectedCooks.includes(cand.name);
                  const pendingTotal =
                    cap.totalAssigned + (isSelected ? 1 : 0) + (isSelectedCook ? 1 : 0);
                  const wouldOversubscribe =
                    pendingTotal > cap.maxTotal ||
                    (isSelected && cap.assignedCleans + 1 > cap.cleanQuota);

                  return (
                    <div
                      key={`clean-${cand.name}`}
                      role="checkbox"
                      aria-checked={isSelected}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === " " || e.key === "Enter") {
                          e.preventDefault();
                          handleToggleCleaner(cand.name);
                        }
                      }}
                      onClick={() => handleToggleCleaner(cand.name)}
                      className={`min-h-[48px] pt-2 first:pt-0 p-2.5 rounded-xl cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs sm:text-sm ${
                        isSelected
                          ? "bg-sky-50/90 dark:bg-sky-950/40 border-2 border-sky-500 shadow-xs ring-1 ring-sky-400 font-semibold"
                          : "bg-white dark:bg-slate-800/80 border border-sky-200 dark:border-slate-700 hover:border-sky-300 dark:hover:border-slate-600 hover:bg-sky-50/60 dark:hover:bg-slate-800"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                            isSelected
                              ? "bg-sky-600 border-sky-600 text-white shadow-2xs"
                              : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`font-bold ${
                                isSelected
                                  ? "text-sky-950 dark:text-sky-200 font-extrabold"
                                  : "text-slate-900 dark:text-slate-100"
                              }`}
                            >
                              {cand.name}
                            </span>
                            {isSelected && (
                              <span className="text-[10px] font-extrabold text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-950/60 border border-sky-300 dark:border-sky-800 px-2 py-0.5 rounded-full shadow-2xs">
                                ✓ Selected
                              </span>
                            )}
                            {isSelected && wouldOversubscribe && (
                              <span className="text-[10px] font-extrabold text-amber-900 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/80 border border-amber-400 dark:border-amber-700 px-2 py-0.5 rounded-full shadow-2xs">
                                ⚠️ Oversubscribes ({pendingTotal}/{cap.maxTotal} total)
                              </span>
                            )}
                          </div>
                          {cand.specialInstructions && (
                            <p className="text-xs text-amber-900 dark:text-amber-300 font-medium italic mt-0.5">
                              &quot;{cand.specialInstructions}&quot;
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 pl-7 sm:pl-0">
                        {renderCleanBadge(cand)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-600 dark:text-slate-400 italic text-center">
                No members marked cleaning availability on this date.
              </div>
            )}
          </div>
        </div>

        {/* Global Oversubscription Notice if Any Selected Volunteer Would Exceed Quotas */}
        {(() => {
          const oversubscribedList: string[] = [];
          recoverySelectedCooks.forEach((name) => {
            const cand = sortedCookCandidates.find((c) => c.name === name);
            if (!cand) return;
            const cap = computeMemberCapacity(cand, solverResult, intakeData);
            const alsoClean = recoverySelectedCleaners.includes(name);
            const pending = cap.totalAssigned + 1 + (alsoClean ? 1 : 0);
            if (pending > cap.maxTotal || cap.assignedCooks + 1 > cap.cookQuota) {
              oversubscribedList.push(name);
            }
          });
          recoverySelectedCleaners.forEach((name) => {
            if (oversubscribedList.includes(name)) return;
            const cand = sortedCleanCandidates.find((c) => c.name === name);
            if (!cand) return;
            const cap = computeMemberCapacity(cand, solverResult, intakeData);
            const alsoCook = recoverySelectedCooks.includes(name);
            const pending = cap.totalAssigned + 1 + (alsoCook ? 1 : 0);
            if (pending > cap.maxTotal || cap.assignedCleans + 1 > cap.cleanQuota) {
              oversubscribedList.push(name);
            }
          });

          if (oversubscribedList.length === 0) return null;

          return (
            <div className="mx-6 mb-3 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl text-xs text-amber-950 dark:text-amber-200 flex items-start gap-2 shadow-2xs">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold">Manual Assignment Notice:</strong>{" "}
                {oversubscribedList.join(", ")} will be oversubscribed beyond requested limits (
                {oversubscribedList.length === 1 ? "this volunteer has" : "these volunteers have"}{" "}
                reached their max total shifts or role quota).
              </div>
            </div>
          );
        })()}

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-5 py-2.5 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl cursor-pointer transition-colors"
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
                ? `+ Add Back & Assign (${recoverySelectedCooks.length} cook${
                    recoverySelectedCooks.length === 1 ? "" : "s"
                  }, ${recoverySelectedCleaners.length} clean${
                    recoverySelectedCleaners.length === 1 ? "" : "s"
                  })`
                : "+ Add Back into Schedule"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

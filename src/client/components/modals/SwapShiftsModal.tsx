import React from "react";
import { ArrowLeftRight, X, Search } from "lucide-react";
import { IntakePayload, Role, ScheduleOutput } from "../../../server/types";
import { getMemberAvailabilityForDate } from "../../../server/scheduleParser";

export interface SwapShiftsModalProps {
  swapModal: {
    isOpen: boolean;
    sourceDateKey: string;
    sourceRole: Role;
    sourceMemberName: string;
  } | null;
  onClose: () => void;
  solverResult: ScheduleOutput | null;
  intakeData: IntakePayload | null;
  swapSearchText: string;
  setSwapSearchText: (val: string) => void;
  handleExecuteSwap: (
    sourceDateKey: string,
    sourceRole: Role,
    sourceMemberName: string,
    targetDateKey: string,
    targetRole: Role,
    targetMemberName: string
  ) => void;
}

export const SwapShiftsModal: React.FC<SwapShiftsModalProps> = ({
  swapModal,
  onClose,
  solverResult,
  intakeData,
  swapSearchText,
  setSwapSearchText,
  handleExecuteSwap,
}) => {
  if (!swapModal || !swapModal.isOpen || !solverResult || !intakeData) return null;

  const sourceDay = solverResult.schedule.find((d) => d.dateKey === swapModal.sourceDateKey);
  const sourceResp = intakeData.responses.find(
    (r) => r.name.toLowerCase() === swapModal.sourceMemberName.toLowerCase()
  );

  // Collect all candidates across schedule
  const candidates: {
    targetDateKey: string;
    targetDateLabel: string;
    targetRole: Role;
    targetMemberName: string;
    isSameRole: boolean;
    sourceAvailOnTarget: string;
    targetAvailOnSource: string;
    isPerfectMatch: boolean;
  }[] = [];

  for (const day of solverResult.schedule) {
    // Skip cancelled
    if (day.targetCookCount === 0 && day.targetCleanCount === 0) continue;

    // Target cooks
    for (const cookName of day.cooks) {
      if (cookName === swapModal.sourceMemberName) continue;
      if (
        swapSearchText &&
        !cookName.toLowerCase().includes(swapSearchText.toLowerCase()) &&
        !day.dateLabel.toLowerCase().includes(swapSearchText.toLowerCase())
      )
        continue;

      const targetResp = intakeData.responses.find(
        (r) => r.name.toLowerCase() === cookName.toLowerCase()
      );
      const sourceAvail =
        (sourceResp ? getMemberAvailabilityForDate(sourceResp, day.dateLabel) : "AVAILABLE") ||
        "UNAVAILABLE";
      const targetAvail =
        (targetResp && sourceDay
          ? getMemberAvailabilityForDate(targetResp, sourceDay.dateLabel)
          : "AVAILABLE") || "UNAVAILABLE";

      const isPerfect =
        (sourceAvail === "AVAILABLE" ||
          (swapModal.sourceRole === "COOK"
            ? sourceAvail === "COOK_ONLY"
            : sourceAvail === "CLEAN_ONLY")) &&
        (targetAvail === "AVAILABLE" || targetAvail === "COOK_ONLY");

      candidates.push({
        targetDateKey: day.dateKey,
        targetDateLabel: day.dateLabel,
        targetRole: "COOK",
        targetMemberName: cookName,
        isSameRole: swapModal.sourceRole === "COOK",
        sourceAvailOnTarget: sourceAvail,
        targetAvailOnSource: targetAvail,
        isPerfectMatch: isPerfect,
      });
    }

    // Target cleaners
    for (const cleanName of day.cleaners) {
      if (cleanName === swapModal.sourceMemberName) continue;
      if (
        swapSearchText &&
        !cleanName.toLowerCase().includes(swapSearchText.toLowerCase()) &&
        !day.dateLabel.toLowerCase().includes(swapSearchText.toLowerCase())
      )
        continue;

      const targetResp = intakeData.responses.find(
        (r) => r.name.toLowerCase() === cleanName.toLowerCase()
      );
      const sourceAvail =
        (sourceResp ? getMemberAvailabilityForDate(sourceResp, day.dateLabel) : "AVAILABLE") ||
        "UNAVAILABLE";
      const targetAvail =
        (targetResp && sourceDay
          ? getMemberAvailabilityForDate(targetResp, sourceDay.dateLabel)
          : "AVAILABLE") || "UNAVAILABLE";

      const isPerfect =
        (sourceAvail === "AVAILABLE" ||
          (swapModal.sourceRole === "COOK"
            ? sourceAvail === "COOK_ONLY"
            : sourceAvail === "CLEAN_ONLY")) &&
        (targetAvail === "AVAILABLE" || targetAvail === "CLEAN_ONLY");

      candidates.push({
        targetDateKey: day.dateKey,
        targetDateLabel: day.dateLabel,
        targetRole: "CLEAN",
        targetMemberName: cleanName,
        isSameRole: swapModal.sourceRole === "CLEAN",
        sourceAvailOnTarget: sourceAvail,
        targetAvailOnSource: targetAvail,
        isPerfectMatch: isPerfect,
      });
    }
  }

  // Sort: perfect matches first, then same role, then date
  candidates.sort((a, b) => {
    if (a.isPerfectMatch !== b.isPerfectMatch) return a.isPerfectMatch ? -1 : 1;
    if (a.isSameRole !== b.isSameRole) return a.isSameRole ? -1 : 1;
    return a.targetDateLabel.localeCompare(b.targetDateLabel);
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title-swap"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center font-bold border border-orange-200">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <div>
              <h3 id="modal-title-swap" className="text-base sm:text-lg font-bold text-slate-900">
                Swap Shift for {swapModal.sourceMemberName}
              </h3>
              <p className="text-xs text-slate-700 mt-0.5">
                Currently assigned as {swapModal.sourceRole === "COOK" ? "🍳 Cook" : "🧼 Cleaner"}{" "}
                on{" "}
                <span className="font-bold text-slate-900">
                  {
                    solverResult.schedule.find((d) => d.dateKey === swapModal.sourceDateKey)
                      ?.dateLabel
                  }
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Search */}
        <div className="p-3 bg-slate-50 border-b border-slate-200">
          <div className="relative">
            <label htmlFor="swap-search-filter-input" className="sr-only">
              Filter members or dates to swap with
            </label>
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              id="swap-search-filter-input"
              type="text"
              placeholder="Filter candidate members or dates to swap with..."
              value={swapSearchText}
              onChange={(e) => setSwapSearchText(e.target.value)}
              className="w-full min-h-[44px] pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-slate-900 font-medium placeholder:text-slate-500"
            />
          </div>
        </div>

        {/* Candidate shifts list */}
        <div className="p-5 overflow-y-auto flex-1 space-y-2.5">
          {candidates.length === 0 ? (
            <div className="py-8 text-center text-slate-600 text-xs sm:text-sm font-medium">
              No matching scheduled members found to swap with.
            </div>
          ) : (
            candidates.map((cand, idx) => (
              <div
                key={`${cand.targetDateKey}-${cand.targetRole}-${cand.targetMemberName}-${idx}`}
                className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                  cand.isPerfectMatch
                    ? "bg-emerald-50 border-emerald-300 hover:bg-emerald-100/70 shadow-2xs"
                    : "bg-white border-slate-200 hover:bg-slate-50"
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs sm:text-sm text-slate-900">
                      {cand.targetMemberName}
                    </span>
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-lg border ${
                        cand.targetRole === "COOK"
                          ? "bg-orange-100 text-orange-950 border-orange-300"
                          : "bg-sky-100 text-sky-950 border-sky-300"
                      }`}
                    >
                      {cand.targetRole === "COOK" ? "🍳 Cook" : "🧼 Cleaner"}
                    </span>
                    <span className="text-xs font-semibold text-slate-700">
                      {cand.targetDateLabel}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs">
                    <span
                      className={`inline-flex items-center gap-1 font-semibold ${
                        cand.sourceAvailOnTarget === "AVAILABLE" ||
                        (typeof cand.sourceAvailOnTarget === "string" &&
                          cand.sourceAvailOnTarget.includes(swapModal.sourceRole))
                          ? "text-emerald-800"
                          : "text-amber-900"
                      }`}
                    >
                      {swapModal.sourceMemberName} on {cand.targetDateLabel}:{" "}
                      <strong>{cand.sourceAvailOnTarget}</strong>
                    </span>
                    <span className="text-slate-400">•</span>
                    <span
                      className={`inline-flex items-center gap-1 font-semibold ${
                        cand.targetAvailOnSource === "AVAILABLE" ||
                        (typeof cand.targetAvailOnSource === "string" &&
                          cand.targetAvailOnSource.includes(cand.targetRole))
                          ? "text-emerald-800"
                          : "text-amber-900"
                      }`}
                    >
                      {cand.targetMemberName} on {sourceDay?.dateLabel}:{" "}
                      <strong>{cand.targetAvailOnSource}</strong>
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    handleExecuteSwap(
                      swapModal.sourceDateKey,
                      swapModal.sourceRole,
                      swapModal.sourceMemberName,
                      cand.targetDateKey,
                      cand.targetRole,
                      cand.targetMemberName
                    )
                  }
                  className={`min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer ${
                    cand.isPerfectMatch
                      ? "bg-emerald-700 hover:bg-emerald-800 text-white"
                      : "bg-orange-600 hover:bg-orange-700 text-white"
                  }`}
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  Swap Shifts
                </button>
              </div>
            ))
          )}
        </div>

        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-5 py-2 text-xs sm:text-sm font-bold text-slate-700 hover:text-slate-950 bg-white border border-slate-300 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

import React from "react";
import {
  Calendar,
  ClipboardList,
  CheckCircle2,
  Users,
  Send,
  Lock,
  RefreshCw,
} from "lucide-react";
import { MonthStatus } from "../../../server/types";

export interface MonthLifecycleTrackerProps {
  monthKey: string;
  monthStatus?: MonthStatus;
  datesCount?: number;
  responsesCount?: number;
  onToggleSignups?: (close: boolean) => void;
  className?: string;
}

const STAGES: {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  icon: React.FC<{ className?: string }>;
}[] = [
  {
    id: "staging",
    label: "1. Staging Dates",
    shortLabel: "Staging",
    description: "Meal dates configured",
    icon: Calendar,
  },
  {
    id: "signups",
    label: "2. Sign-ups Open",
    shortLabel: "Sign-ups Open",
    description: "Accepting submissions",
    icon: ClipboardList,
  },
  {
    id: "responses",
    label: "3. Responses Received",
    shortLabel: "Responses",
    description: "Sign-ups closed, ready to solve",
    icon: Users,
  },
  {
    id: "teams",
    label: "4. Teams Ready",
    shortLabel: "Teams Ready",
    description: "Roster solved & sheet saved",
    icon: CheckCircle2,
  },
  {
    id: "broadcast",
    label: "5. Email Sent",
    shortLabel: "Email Sent",
    description: "Broadcast live to community",
    icon: Send,
  },
];

export function getStageIndex(status?: MonthStatus): number {
  switch (status) {
    case "STAGING_DATES":
    case "NOT_OPEN":
      return 0;
    case "SIGN_UPS_OPEN":
    case "OPEN":
      return 1;
    case "RESPONSES_RECEIVED":
      return 2;
    case "TEAMS_READY":
      return 3;
    case "EMAIL_SENT":
    case "CLOSED":
      return 4;
    default:
      return 1;
  }
}

export const MonthLifecycleTracker: React.FC<MonthLifecycleTrackerProps> = ({
  monthKey,
  monthStatus = "SIGN_UPS_OPEN",
  datesCount,
  responsesCount,
  onToggleSignups,
  className = "",
}) => {
  const currentStageIndex = getStageIndex(monthStatus);

  const monthDisplayName = React.useMemo(() => {
    try {
      const [y, m] = monthKey.split(/[-_]/);
      const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
      return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    } catch {
      return monthKey;
    }
  }, [monthKey]);

  return (
    <div
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3 ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-xs font-black uppercase tracking-wider bg-orange-100 dark:bg-orange-950/60 text-orange-950 dark:text-orange-300 px-2.5 py-0.5 rounded-lg border border-orange-200 dark:border-orange-800">
            {monthDisplayName}
          </span>
          <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
            Lifecycle Progress:
          </span>
          <span className="text-xs font-black text-slate-900 dark:text-white">
            {STAGES[currentStageIndex]?.label}
          </span>
        </div>

        {/* Status Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {datesCount !== undefined && datesCount > 0 && (
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
              {datesCount} Meal Dates
            </span>
          )}
          {responsesCount !== undefined && responsesCount > 0 && (
            <span className="text-[11px] font-bold text-blue-900 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 rounded-lg border border-blue-200 dark:border-blue-800">
              {responsesCount} Responses
            </span>
          )}

          {onToggleSignups && (currentStageIndex === 1 || currentStageIndex === 2) && (
            <button
              type="button"
              onClick={() => onToggleSignups(currentStageIndex === 1)}
              className={`min-h-[34px] px-3 py-1 text-xs font-bold rounded-xl border transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                currentStageIndex === 1
                  ? "bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 text-amber-950 dark:text-amber-200 border-amber-300 dark:border-amber-800"
                  : "bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 text-emerald-950 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800"
              }`}
            >
              {currentStageIndex === 1 ? (
                <>
                  <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Close Sign-ups</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Re-open Sign-ups</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* 5-Stage Stepper Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
        {STAGES.map((stage, idx) => {
          const Icon = stage.icon;
          const isCompleted = idx < currentStageIndex;
          const isCurrent = idx === currentStageIndex;

          return (
            <div
              key={stage.id}
              className={`p-2.5 rounded-xl border transition-all flex flex-col justify-between ${
                isCurrent
                  ? "bg-orange-50/90 dark:bg-orange-950/40 border-orange-400 dark:border-orange-600 ring-2 ring-orange-500/20 shadow-xs"
                  : isCompleted
                    ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200"
                    : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-60 text-slate-500 dark:text-slate-400"
              }`}
            >
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                    isCurrent
                      ? "bg-orange-600 text-white shadow-2xs"
                      : isCompleted
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <Icon className="w-3.5 h-3.5" />
                  )}
                </div>
                {isCurrent && (
                  <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                )}
              </div>
              <div>
                <p
                  className={`text-xs font-bold leading-tight ${
                    isCurrent
                      ? "text-orange-950 dark:text-orange-200"
                      : isCompleted
                        ? "text-emerald-950 dark:text-emerald-200"
                        : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {stage.shortLabel}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5 hidden sm:block truncate">
                  {stage.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

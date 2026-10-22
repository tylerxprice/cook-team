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
  activeStage?: 1 | 2 | 3 | 4 | 5;
  onSelectStage?: (stage: 1 | 2 | 3 | 4 | 5) => void;
  datesCount?: number;
  responsesCount?: number;
  onToggleSignups?: (close: boolean) => void;
  hideHeader?: boolean;
  className?: string;
}

const STAGES: {
  stage: 1 | 2 | 3 | 4 | 5;
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  icon: React.FC<{ className?: string }>;
}[] = [
  {
    stage: 1,
    id: "staging",
    label: "1. Staging Dates",
    shortLabel: "1. Staging Dates",
    description: "Meal dates configured",
    icon: Calendar,
  },
  {
    stage: 2,
    id: "signups",
    label: "2. Intake & Audit",
    shortLabel: "2. Intake & Audit",
    description: "Responses & missing audit",
    icon: ClipboardList,
  },
  {
    stage: 3,
    id: "responses",
    label: "3. Notes & Rules",
    shortLabel: "3. Notes & Rules",
    description: "Special notes & rules",
    icon: Users,
  },
  {
    stage: 4,
    id: "teams",
    label: "4. Solve & Review",
    shortLabel: "4. Solve & Review",
    description: "Matchmaker & schedule",
    icon: CheckCircle2,
  },
  {
    stage: 5,
    id: "broadcast",
    label: "5. Publish & Email",
    shortLabel: "5. Publish & Email",
    description: "Save sheet & announce",
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
  activeStage,
  onSelectStage,
  datesCount,
  responsesCount,
  onToggleSignups,
  hideHeader = false,
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
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 sm:p-4 shadow-xs space-y-3 ${className}`}
    >
      {!hideHeader && (
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
      )}

      {/* 5-Stage Stepper Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {STAGES.map((stage, idx) => {
          const Icon = stage.icon;
          const isCompleted = idx < currentStageIndex;
          const isCurrentLifecycle = idx === currentStageIndex;
          const isSelected = activeStage ? activeStage === stage.stage : isCurrentLifecycle;

          const innerContent = (
            <>
              <div className="flex items-center justify-between gap-1 mb-1.5 w-full">
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                    isSelected
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
                {isCurrentLifecycle && (
                  <span
                    className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"
                    title="Active month stage"
                  />
                )}
              </div>
              <div className="w-full text-left">
                <p
                  className={`text-xs font-bold leading-tight ${
                    isSelected
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
            </>
          );

          if (onSelectStage) {
            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => onSelectStage(stage.stage)}
                aria-current={isSelected ? "step" : undefined}
                className={`p-2.5 rounded-xl border transition-all flex flex-col justify-between text-left cursor-pointer group ${
                  isSelected
                    ? "bg-orange-50/90 dark:bg-orange-950/40 border-orange-400 dark:border-orange-600 ring-2 ring-orange-500/30 shadow-xs"
                    : isCompleted
                      ? "bg-emerald-50/50 hover:bg-emerald-50 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200"
                      : "bg-slate-50 hover:bg-slate-100/80 dark:bg-slate-800/40 dark:hover:bg-slate-800/80 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400"
                }`}
              >
                {innerContent}
              </button>
            );
          }

          return (
            <div
              key={stage.id}
              className={`p-2.5 rounded-xl border transition-all flex flex-col justify-between ${
                isSelected
                  ? "bg-orange-50/90 dark:bg-orange-950/40 border-orange-400 dark:border-orange-600 ring-2 ring-orange-500/20 shadow-xs"
                  : isCompleted
                    ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200"
                    : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-60 text-slate-500 dark:text-slate-400"
              }`}
            >
              {innerContent}
            </div>
          );
        })}
      </div>
    </div>
  );
};

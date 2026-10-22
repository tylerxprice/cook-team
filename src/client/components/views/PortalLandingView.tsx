import React from "react";
import { Calendar, Sparkles, ArrowRight, Shield, FileText, Utensils } from "lucide-react";
import { TopHeader } from "../common/TopHeader";
import { MonthStatus } from "../../../server/types";

export interface PortalLandingViewProps {
  communityName?: string;
  onSelectCoordinator: (step?: 1 | 2 | 3 | 4) => void;
  onSelectResident: (month?: string) => void;
  onSelectFormGenerator?: (month?: string) => void;
  monthTitle?: string;
  activeMonthKey?: string;
  activeMonthStatus?: MonthStatus;
  activeMonthDatesCount?: number;
  activeMonthResponseCount?: number;
}

export const PortalLandingView: React.FC<PortalLandingViewProps> = ({
  communityName = "Vancouver Cohousing",
  onSelectCoordinator,
  onSelectResident,
  onSelectFormGenerator,
  monthTitle: _monthTitle = "Community Meals",
  activeMonthKey,
  activeMonthStatus = "SIGN_UPS_OPEN",
  activeMonthDatesCount,
  activeMonthResponseCount,
}) => {
  const activeMonthDisplayName = React.useMemo(() => {
    if (!activeMonthKey) return "";
    try {
      const [y, m] = activeMonthKey.split(/[-_]/);
      const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
      return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    } catch {
      return activeMonthKey;
    }
  }, [activeMonthKey]);

  const { statusLabel, statusBadgeClass, statusDescription, resumeButtonLabel, handleQuickResume } =
    React.useMemo(() => {
      switch (activeMonthStatus) {
        case "STAGING_DATES":
        case "NOT_OPEN":
          return {
            statusLabel: "Staging Dates",
            statusBadgeClass:
              "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700",
            statusDescription:
              activeMonthDatesCount !== undefined
                ? `${activeMonthDatesCount} meal dates drafted. Form not yet launched.`
                : "Meal dates drafted in generator.",
            resumeButtonLabel: "Resume Staging Dates",
            handleQuickResume: () => onSelectFormGenerator?.(activeMonthKey),
          };
        case "SIGN_UPS_OPEN":
        case "OPEN":
          return {
            statusLabel: "Sign-ups Open",
            statusBadgeClass:
              "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-950 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800",
            statusDescription:
              activeMonthResponseCount !== undefined
                ? `${activeMonthResponseCount} responses received so far. Accepting submissions.`
                : "Form is live and accepting submissions from residents.",
            resumeButtonLabel: "View Survey & Responses",
            handleQuickResume: () => onSelectCoordinator(1),
          };
        case "RESPONSES_RECEIVED":
          return {
            statusLabel: "Responses Received",
            statusBadgeClass:
              "bg-blue-100 dark:bg-blue-950/60 text-blue-950 dark:text-blue-200 border-blue-300 dark:border-blue-800",
            statusDescription:
              activeMonthResponseCount !== undefined
                ? `${activeMonthResponseCount} submissions locked. Ready to solve teams.`
                : "Sign-ups closed. Ready for matchmaker solver.",
            resumeButtonLabel: "Solve & Review Teams",
            handleQuickResume: () => onSelectCoordinator(2),
          };
        case "TEAMS_READY":
          return {
            statusLabel: "Teams Ready",
            statusBadgeClass:
              "bg-purple-100 dark:bg-purple-950/60 text-purple-950 dark:text-purple-200 border-purple-300 dark:border-purple-800",
            statusDescription:
              "Schedule solved and saved to Google Sheet tab. Ready for final email announcement.",
            resumeButtonLabel: "Resume Teams & Send Email",
            handleQuickResume: () => onSelectCoordinator(4),
          };
        case "EMAIL_SENT":
        case "CLOSED":
          return {
            statusLabel: "Email Sent (Live)",
            statusBadgeClass:
              "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-950 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800",
            statusDescription:
              "Monthly meal announcement broadcasted. Residents can view shifts on their calendars.",
            resumeButtonLabel: "View Live Resident Shifts",
            handleQuickResume: () => onSelectResident(activeMonthKey),
          };
        default:
          return {
            statusLabel: "In Progress",
            statusBadgeClass: "bg-slate-100 text-slate-800 border-slate-300",
            statusDescription: "Meal planning in progress.",
            resumeButtonLabel: "Open Planning Wizard",
            handleQuickResume: () => onSelectCoordinator(1),
          };
      }
    }, [
      activeMonthStatus,
      activeMonthDatesCount,
      activeMonthResponseCount,
      activeMonthKey,
      onSelectCoordinator,
      onSelectFormGenerator,
      onSelectResident,
    ]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-between transition-colors">
      {/* Unified Top Banner */}
      <TopHeader communityName={communityName} />

      {/* Main Action Cards */}
      <main className="max-w-5xl mx-auto px-4 py-8 sm:py-12 flex-1 flex flex-col justify-center w-full">
        <div className="text-center mb-8 sm:mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
            <span>Welcome to Community Meals</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
            What would you like to do?
          </h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-lg mx-auto mt-2">
            Select an option below to view personal shift calendars, run monthly team planning, or
            launch availability sign-up forms.
          </p>
        </div>

        {/* Active Month In-Progress Status Card */}
        {activeMonthKey && (
          <div className="mb-6 p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border-2 border-orange-200 dark:border-orange-800/80 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in duration-150">
            <div className="flex items-start sm:items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800 flex items-center justify-center shrink-0">
                <Utensils className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black uppercase tracking-wider bg-orange-100 dark:bg-orange-950/80 text-orange-950 dark:text-orange-300 px-2.5 py-0.5 rounded-full border border-orange-200 dark:border-orange-800">
                    Active Month
                  </span>
                  <span className="text-sm font-black text-slate-900 dark:text-white">
                    {activeMonthDisplayName}
                  </span>
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${statusBadgeClass}`}>
                    {statusLabel}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                  {statusDescription}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 sm:self-center">
              <button
                type="button"
                onClick={handleQuickResume}
                className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-orange-600/20 transition-all cursor-pointer"
              >
                <span>{resumeButtonLabel}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <div
          className={`grid grid-cols-1 ${onSelectFormGenerator ? "md:grid-cols-3" : "md:grid-cols-2"} gap-5 sm:gap-6`}
        >
          {/* Card 1: Resident Shift View & Calendar */}
          <button
            type="button"
            onClick={() => onSelectResident()}
            className="group text-left p-6 sm:p-7 rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 hover:border-orange-500 dark:hover:border-orange-500 hover:shadow-xl transition-all duration-200 flex flex-col justify-between cursor-pointer focus:outline-none focus:ring-4 focus:ring-orange-500/20"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform duration-200">
                <Calendar className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400 block mb-1">
                For Residents
              </span>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                View My Shifts &amp; Add to Calendar
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                Check your upcoming cook and clean shifts, view teammates, browse the monthly
                roster, and sync events to your calendar.
              </p>
            </div>

            <div className="pt-5 mt-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs sm:text-sm font-bold text-orange-600 dark:text-orange-400">
              <span>Open My Shifts</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          {/* Card 2: Coordinator Planning Wizard */}
          <button
            type="button"
            onClick={() => onSelectCoordinator()}
            className="group text-left p-6 sm:p-7 rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-xl transition-all duration-200 flex flex-col justify-between cursor-pointer focus:outline-none focus:ring-4 focus:ring-blue-500/20"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform duration-200">
                <Utensils className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 block mb-1">
                For Coordinators
              </span>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                Coordinator Planning Wizard
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                Audit survey responses, configure rules, solve the matchmaking engine, balance
                quotas, and publish announcements.
              </p>
            </div>

            <div className="pt-5 mt-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs sm:text-sm font-bold text-blue-600 dark:text-blue-400">
              <span>Open Planning Wizard</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          {/* Card 3: Survey Form Generator */}
          {onSelectFormGenerator && (
            <button
              type="button"
              onClick={() => onSelectFormGenerator()}
              className="group text-left p-6 sm:p-7 rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 hover:shadow-xl transition-all duration-200 flex flex-col justify-between cursor-pointer focus:outline-none focus:ring-4 focus:ring-emerald-500/20"
            >
              <div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform duration-200">
                  <FileText className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block mb-1">
                  For Coordinators
                </span>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  Survey Form Generator
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                  Configure meal dates, create next month&apos;s Google Form &amp; response sheets,
                  or manage beta availability sign-ups.
                </p>
              </div>

              <div className="pt-5 mt-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400">
                <span>Open Form Generator</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          )}
        </div>

        {/* Quick Tips footer */}
        <div className="mt-8 sm:mt-12 text-center text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
          <span>No login or passwords required for residents to view their shifts.</span>
        </div>
      </main>

      <footer className="py-4 text-center text-xs text-slate-400 dark:text-slate-500 border-t border-slate-200 dark:border-slate-800">
        CookTeamTool &bull; Zero-Cost Community Meal Planner
      </footer>
    </div>
  );
};

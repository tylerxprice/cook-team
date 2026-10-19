import React from "react";
import { Calendar, Sparkles, ArrowRight, Shield, FileText, Utensils } from "lucide-react";
import { TopHeader } from "../common/TopHeader";

export interface PortalLandingViewProps {
  communityName?: string;
  onSelectCoordinator: () => void;
  onSelectResident: () => void;
  onSelectFormGenerator?: () => void;
  monthTitle?: string;
}

export const PortalLandingView: React.FC<PortalLandingViewProps> = ({
  communityName = "Vancouver Cohousing",
  onSelectCoordinator,
  onSelectResident,
  onSelectFormGenerator,
  monthTitle: _monthTitle = "Community Meals",
}) => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-between transition-colors">
      {/* Unified Top Banner */}
      <TopHeader communityName={communityName} />

      {/* Main Action Cards */}
      <main className="max-w-5xl mx-auto px-4 py-8 sm:py-12 flex-1 flex flex-col justify-center w-full">
        <div className="text-center mb-8 sm:mb-12">
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

        <div
          className={`grid grid-cols-1 ${onSelectFormGenerator ? "md:grid-cols-3" : "md:grid-cols-2"} gap-5 sm:gap-6`}
        >
          {/* Card 1: Resident Shift View & Calendar */}
          <button
            type="button"
            onClick={onSelectResident}
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
            onClick={onSelectCoordinator}
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
              onClick={onSelectFormGenerator}
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

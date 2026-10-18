import React from "react";
import { Utensils, Calendar, Sparkles, ArrowRight, Shield } from "lucide-react";

export interface PortalLandingViewProps {
  communityName?: string;
  onSelectCoordinator: () => void;
  onSelectResident: () => void;
  monthTitle?: string;
}

export const PortalLandingView: React.FC<PortalLandingViewProps> = ({
  communityName: _communityName = "Vancouver Cohousing",
  onSelectCoordinator,
  onSelectResident,
  monthTitle: _monthTitle = "Community Meals",
}) => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      {/* Top Banner */}
      <header className="bg-white border-b border-slate-200 py-3 px-4 sm:px-6 sticky top-0 z-10 shadow-xs">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2.5 sm:space-x-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-500 flex items-center justify-center text-white shadow-md shadow-orange-500/20 shrink-0">
              <Utensils className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                CoHo CookTeam
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Action Cards */}
      <main className="max-w-4xl mx-auto px-4 py-8 sm:py-12 flex-1 flex flex-col justify-center w-full">
        <div className="text-center mb-8 sm:mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5 text-orange-600" />
            <span>Welcome to Community Meals</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
            What would you like to do?
          </h2>
          <p className="text-sm sm:text-base text-slate-600 max-w-md mx-auto mt-2">
            Select an option below to view your personal shift calendar or manage monthly meal
            teams.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
          {/* Card 1: Resident Shift View & Calendar */}
          <button
            type="button"
            onClick={onSelectResident}
            className="group text-left p-6 sm:p-8 rounded-2xl bg-white border-2 border-slate-200 hover:border-orange-500 hover:shadow-xl transition-all duration-200 flex flex-col justify-between cursor-pointer focus:outline-none focus:ring-4 focus:ring-orange-500/20"
          >
            <div>
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-orange-100 text-orange-700 border border-orange-200 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform duration-200">
                <Calendar className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-orange-600 block mb-1">
                For Community Residents
              </span>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 group-hover:text-orange-600 transition-colors">
                View My Shifts &amp; Add to Calendar
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
                Check your upcoming cook and clean shifts, view your teammates, browse the full
                month schedule, and download events directly to your Apple or Google Calendar.
              </p>
            </div>

            <div className="pt-6 mt-6 border-t border-slate-100 flex items-center justify-between text-xs sm:text-sm font-bold text-orange-600">
              <span>Open My Shifts</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          {/* Card 2: Coordinator Planning Wizard */}
          <button
            type="button"
            onClick={onSelectCoordinator}
            className="group text-left p-6 sm:p-8 rounded-2xl bg-white border-2 border-slate-200 hover:border-blue-500 hover:shadow-xl transition-all duration-200 flex flex-col justify-between cursor-pointer focus:outline-none focus:ring-4 focus:ring-blue-500/20"
          >
            <div>
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-blue-100 text-blue-700 border border-blue-200 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform duration-200">
                <Utensils className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 block mb-1">
                For Meal Coordinators
              </span>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 group-hover:text-blue-600 transition-colors">
                Coordinator Planning Wizard
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
                Audit survey responses, configure pair &amp; conflict rules, solve the constraint
                matchmaking engine, balance quotas, and publish announcements.
              </p>
            </div>

            <div className="pt-6 mt-6 border-t border-slate-100 flex items-center justify-between text-xs sm:text-sm font-bold text-blue-600">
              <span>Open Coordinator Wizard</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>
        </div>

        {/* Quick Tips footer */}
        <div className="mt-8 sm:mt-12 text-center text-xs text-slate-500 flex items-center justify-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-slate-400" />
          <span>No login or passwords required for residents to view their shifts.</span>
        </div>
      </main>

      <footer className="py-4 text-center text-xs text-slate-400 border-t border-slate-200">
        CookTeamTool &bull; Zero-Cost Community Meal Planner
      </footer>
    </div>
  );
};

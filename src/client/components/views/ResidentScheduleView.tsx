import React, { useState, useEffect, useMemo } from "react";
import {
  Calendar,
  ChevronDown,
  Sparkles,
  Download,
  Users,
  CheckCircle2,
  Search,
  X,
  Info,
  Home,
  Loader2,
} from "lucide-react";
import { DaySchedule, Member } from "../../../server/types";
import {
  extractMemberShifts,
  generateMemberIcs,
  downloadIcsFile,
} from "../../utils/ics";

export interface ResidentScheduleViewProps {
  schedule: DaySchedule[];
  members: Member[];
  monthTitle?: string;
  monthKey?: string;
  availableMonths?: string[];
  communityName?: string;
  onSelectMonth?: (monthKey: string) => void;
  onBackToHome: () => void;
  onOpenCoordinator: () => void;
  initialMemberName?: string;
  isLoading?: boolean;
}

const STORAGE_KEY = "cookteam_resident_name";

export const DEFAULT_RESIDENT_MONTHS = [
  "2026-10",
  "2026-09",
  "2026-08",
  "2026-07",
  "2026-06",
  "2026-05",
  "2026-04",
  "2026-03",
  "2026-02",
  "2026-01",
];

function formatMonthDisplay(mKey: string): string {
  const parts = mKey.split("-");
  if (parts.length >= 2) {
    const yr = parts[0];
    const mo = parseInt(parts[1], 10);
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    if (mo >= 1 && mo <= 12) {
      return `${months[mo - 1]} ${yr}`;
    }
  }
  return mKey;
}

export const ResidentScheduleView: React.FC<ResidentScheduleViewProps> = ({
  schedule,
  members,
  monthTitle = "Community Meals",
  monthKey,
  availableMonths,
  communityName = "Vancouver Cohousing",
  onSelectMonth,
  onBackToHome,
  onOpenCoordinator,
  initialMemberName,
  isLoading = false,
}) => {
  const displayMonths = useMemo(() => {
    const set = new Set<string>();
    if (availableMonths && availableMonths.length > 0) {
      availableMonths.forEach((m) => set.add(m));
    } else {
      DEFAULT_RESIDENT_MONTHS.forEach((m) => set.add(m));
    }
    if (monthKey) set.add(monthKey);
    const arr = Array.from(set);
    arr.sort((a, b) => b.localeCompare(a));
    return arr;
  }, [availableMonths, monthKey]);

  // 1. Initial Member Resolution (URL param -> LocalStorage -> empty)
  const [selectedMember, setSelectedMember] = useState<string>(() => {
    if (initialMemberName && initialMemberName.trim()) {
      return initialMemberName.trim();
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && stored.trim()) return stored.trim();
    } catch {
      // localStorage not accessible
    }
    return "";
  });

  const [activeTab, setActiveTab] = useState<"my_shifts" | "full_schedule">("my_shifts");
  const [isChangingMember, setIsChangingMember] = useState<boolean>(!selectedMember);
  const [memberSearchQuery, setMemberSearchQuery] = useState<string>("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 5000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // Save selected member to localStorage
  const handleSelectMember = (name: string) => {
    setSelectedMember(name);
    setIsChangingMember(false);
    try {
      localStorage.setItem(STORAGE_KEY, name);
    } catch {
      // ignore
    }
  };

  const handleClearMember = () => {
    setSelectedMember("");
    setIsChangingMember(true);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  // Derive unique active member names for selector
  const availableMemberNames = useMemo(() => {
    const namesSet = new Set<string>();

    // From members list
    (members || []).forEach((m) => {
      if (m.name) namesSet.add(m.name);
    });

    // Also include anyone who appears in the schedule
    (schedule || []).forEach((d) => {
      (d.cooks || []).forEach((c) => namesSet.add(c));
      (d.cleaners || []).forEach((c) => namesSet.add(c));
    });

    return Array.from(namesSet).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [members, schedule]);

  const filteredMemberNames = useMemo(() => {
    const q = memberSearchQuery.trim().toLowerCase();
    if (!q) return availableMemberNames;
    return availableMemberNames.filter((n) => n.toLowerCase().includes(q));
  }, [availableMemberNames, memberSearchQuery]);

  // If initialMemberName is provided or changes (e.g. from URL parameter hydration), update selectedMember
  useEffect(() => {
    if (initialMemberName && initialMemberName.trim()) {
      const trimmed = initialMemberName.trim();
      const canonical =
        availableMemberNames.find((n) => n.toLowerCase() === trimmed.toLowerCase()) || trimmed;
      setSelectedMember(canonical);
      setIsChangingMember(false);
      try {
        localStorage.setItem(STORAGE_KEY, canonical);
      } catch {
        // ignore
      }
    }
  }, [initialMemberName, availableMemberNames]);

  // Extract selected member's shifts
  const memberShifts = useMemo(() => {
    if (!selectedMember) return [];
    return extractMemberShifts(selectedMember, schedule, communityName);
  }, [selectedMember, schedule, communityName]);

  const cookCount = memberShifts.filter((s) => s.role === "Cook").length;
  const cleanCount = memberShifts.filter((s) => s.role === "Cleaner").length;

  // Handle Download .ics
  const handleDownloadCalendar = () => {
    if (!selectedMember || memberShifts.length === 0) return;
    const icsContent = generateMemberIcs(selectedMember, memberShifts, communityName);
    const sanitizedTitle = (monthTitle || "Meals").replace(/[\s/\\:]+/g, "-");
    const filename = `${selectedMember.replace(/\s+/g, "_")}-${sanitizedTitle}-Shifts.ics`;
    downloadIcsFile(filename, icsContent);
    setToastMessage(`Calendar file downloaded! Tap 'Add All' on your phone to save to Apple or Google Calendar.`);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between text-slate-900">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-md bg-emerald-900 text-white p-4 rounded-2xl shadow-2xl border border-emerald-700 flex items-start gap-3 animate-in fade-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs sm:text-sm font-medium leading-relaxed">
            {toastMessage}
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-white/60 hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-3xl mx-auto px-3 sm:px-4 py-2 sm:py-2.5 flex flex-wrap items-center justify-between gap-2">
          {/* Left: Home + Month selector */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBackToHome}
              title="Return to Hub Home"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            >
              <Home className="w-4 h-4" />
            </button>

            {/* Reusable Month Dropdown */}
            <div className="relative inline-flex items-center">
              <Calendar className="w-3.5 h-3.5 text-orange-600 absolute left-2.5 pointer-events-none" />
              <select
                value={monthKey || ""}
                onChange={(e) => onSelectMonth && onSelectMonth(e.target.value)}
                aria-label="Select meal month"
                className="text-xs sm:text-sm font-black text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl pl-8 pr-7 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-500/20 cursor-pointer appearance-none transition-colors"
              >
                {displayMonths.map((m) => (
                  <option key={m} value={m}>
                    {formatMonthDisplay(m)}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2 pointer-events-none" />
            </div>
          </div>

          {/* Right: Showing Shifts For Member Chip (if selected) + Coordinator Button */}
          <div className="flex items-center gap-2">
            {selectedMember && !isChangingMember && (
              <div className="flex items-center gap-1.5 sm:gap-2 bg-orange-50/90 border border-orange-200 rounded-xl px-2.5 py-1 text-xs shadow-2xs">
                <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-orange-600 text-white flex items-center justify-center font-black text-[10px] sm:text-xs shrink-0">
                  {selectedMember.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 max-w-[120px] sm:max-w-[160px]">
                  <span className="text-[9px] sm:text-[10px] font-bold text-orange-700 uppercase tracking-wider block leading-tight">
                    Showing Shifts For
                  </span>
                  <h2 className="text-xs sm:text-sm font-black text-slate-900 truncate leading-tight m-0">
                    {selectedMember}
                  </h2>
                </div>
                <div className="flex items-center gap-1 ml-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsChangingMember(true)}
                    className="px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-[11px] font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                  >
                    Switch
                  </button>
                  <button
                    type="button"
                    onClick={handleClearMember}
                    title="Clear remembered name"
                    className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-white/80 transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={onOpenCoordinator}
              className="text-xs text-blue-700 hover:text-blue-900 font-bold px-2.5 sm:px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer shrink-0"
            >
              Coordinator
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-2xl mx-auto px-4 py-4 flex-1 w-full space-y-4 pb-24">
        {isLoading && (
          <div className="bg-orange-50/70 border border-orange-200 rounded-2xl p-3.5 flex items-center justify-center gap-2.5 text-xs sm:text-sm font-bold text-orange-950 shadow-2xs">
            <Loader2 className="w-4 h-4 animate-spin text-orange-600" />
            <span>Loading schedule for {formatMonthDisplay(monthKey || "")}...</span>
          </div>
        )}

        {/* Member Search / Selector Card (shown when no member is selected or user tapped Switch) */}
        {(!selectedMember || isChangingMember) && (
          <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm sm:text-base font-black text-slate-900">
                  Whose shifts are you looking for?
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select your name to see your shifts and save them to your calendar.
                </p>
              </div>
              {selectedMember && (
                <button
                  type="button"
                  onClick={() => setIsChangingMember(false)}
                  className="text-xs text-slate-500 hover:text-slate-800 font-bold p-1 cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </div>

            {/* Search input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={memberSearchQuery}
                onChange={(e) => setMemberSearchQuery(e.target.value)}
                placeholder="Type to search your name..."
                className="w-full pl-9 pr-4 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-slate-900 font-medium"
              />
              {memberSearchQuery && (
                <button
                  type="button"
                  onClick={() => setMemberSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Name Pills */}
            <div className="max-h-56 overflow-y-auto pt-1 flex flex-wrap gap-2">
              {filteredMemberNames.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => handleSelectMember(name)}
                  className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                    selectedMember.toLowerCase() === name.toLowerCase()
                      ? "bg-orange-600 text-white shadow-xs"
                      : "bg-slate-100 hover:bg-orange-50 text-slate-800 hover:text-orange-950 border border-slate-200 hover:border-orange-300"
                  }`}
                >
                  {name}
                </button>
              ))}
              {filteredMemberNames.length === 0 && (
                <p className="text-xs text-slate-500 py-3 italic">
                  No community member found matching &quot;{memberSearchQuery}&quot;.
                </p>
              )}
            </div>
          </section>
        )}

        {/* Tab 1: My Shifts */}
        {activeTab === "my_shifts" && (
          <div className="space-y-3">
            {!selectedMember ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
                <Users className="w-10 h-10 text-slate-400 mx-auto" />
                <h3 className="text-base font-bold text-slate-900">Please select your name</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Pick your name from the selector above to view your cook and clean assignments for {monthTitle}.
                </p>
              </div>
            ) : memberShifts.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
                <Sparkles className="w-10 h-10 text-amber-500 mx-auto" />
                <h3 className="text-base font-bold text-slate-900">
                  {schedule.length === 0
                    ? `No schedule published yet for ${monthTitle}`
                    : `No shifts scheduled for ${selectedMember}`}
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {schedule.length === 0
                    ? `The meal team schedule for ${monthTitle} has not been published yet. Select another month in the top bar or check back once finalized!`
                    : `You are not assigned to any cook or clean shifts in ${monthTitle}. Enjoy the community meals, or browse the full schedule below!`}
                </p>
                {schedule.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("full_schedule")}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-600 hover:underline pt-2 cursor-pointer"
                  >
                    <span>View Full Community Schedule</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {/* Compact Shifts Summary Bar + Calendar Download */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white rounded-2xl border border-slate-200 p-3 sm:p-3.5 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-extrabold text-slate-900">
                      {memberShifts.length} Shift{memberShifts.length === 1 ? "" : "s"} Assigned
                    </span>
                    <div className="flex items-center gap-1.5 text-xs font-bold">
                      <span className="px-2 py-0.5 rounded-lg bg-orange-50 text-orange-800 border border-orange-200">
                        🍳 {cookCount} Cook
                      </span>
                      <span className="px-2 py-0.5 rounded-lg bg-sky-50 text-sky-800 border border-sky-200">
                        🧼 {cleanCount} Clean
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleDownloadCalendar}
                    disabled={memberShifts.length === 0}
                    className={`min-h-[38px] px-3.5 py-1.5 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-2xs transition-all cursor-pointer ${
                      memberShifts.length > 0
                        ? "bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white shadow-orange-600/20 active:scale-[0.99]"
                        : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                    }`}
                  >
                    <Download className="w-4 h-4 shrink-0" />
                    <span>Add All My Shifts to Calendar (.ics)</span>
                  </button>
                </div>

                {memberShifts.map((shift, idx) => (
                  <div
                    key={`${shift.dateKey}-${shift.role}-${idx}`}
                    className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3 hover:border-slate-300 transition-colors"
                  >
                    {/* Shift Header */}
                    <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <span className="text-base sm:text-lg font-black text-slate-900">
                          {shift.dateLabel || shift.dateKey}
                        </span>
                        <span className="text-xs text-slate-500 font-semibold block">
                          {shift.mealType === "BRUNCH" ? "Community Brunch" : "Community Dinner"}
                        </span>
                      </div>
                      <span
                        className={`text-xs font-black px-3 py-1.5 rounded-xl border flex items-center gap-1.5 shadow-2xs ${
                          shift.role === "Cook"
                            ? "bg-orange-50 text-orange-800 border-orange-200"
                            : "bg-sky-50 text-sky-800 border-sky-200"
                        }`}
                      >
                        {shift.role === "Cook" ? "🍳 Cook Shift" : "🧼 Clean Shift"}
                      </span>
                    </div>

                    {/* Teammates List */}
                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="font-bold text-slate-500 block mb-1">
                          Cook Team ({shift.teammatesCooks.length}):
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {shift.teammatesCooks.map((name) => (
                            <span
                              key={name}
                              className={`px-2.5 py-1 rounded-lg font-bold border ${
                                name.toLowerCase() === selectedMember.toLowerCase()
                                    ? "bg-orange-600 text-white border-orange-700 shadow-2xs"
                                    : "bg-slate-100 text-slate-800 border-slate-200"
                              }`}
                            >
                              {name} {name.toLowerCase() === selectedMember.toLowerCase() && "(You)"}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div>
                        <span className="font-bold text-slate-500 block mb-1">
                          Clean Team ({shift.teammatesCleaners.length}):
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {shift.teammatesCleaners.map((name) => (
                            <span
                              key={name}
                              className={`px-2.5 py-1 rounded-lg font-bold border ${
                                name.toLowerCase() === selectedMember.toLowerCase()
                                    ? "bg-sky-600 text-white border-sky-700 shadow-2xs"
                                    : "bg-slate-100 text-slate-800 border-slate-200"
                              }`}
                            >
                              {name} {name.toLowerCase() === selectedMember.toLowerCase() && "(You)"}
                            </span>
                          ))}
                        </div>
                      </div>

                      {shift.specialNote && (
                        <div className="mt-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <span>{shift.specialNote}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Full Community Schedule */}
        {activeTab === "full_schedule" && (
          <div className="space-y-3">
            <div className="px-1 text-xs font-bold text-slate-500">
              Showing all {schedule.length} community meals for {monthTitle}
            </div>

            {schedule.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
                <Calendar className="w-10 h-10 text-slate-300 mx-auto" />
                <h3 className="text-base font-bold text-slate-900">
                  No published schedule found for {monthTitle}
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  The schedule for this month has not been published yet. Select another month above to view past schedules.
                </p>
              </div>
            ) : (
              schedule.map((day, idx) => {
              const isUserCook = (day.cooks || []).some(
                (c) => c.toLowerCase() === selectedMember.toLowerCase()
              );
              const isUserCleaner = (day.cleaners || []).some(
                (c) => c.toLowerCase() === selectedMember.toLowerCase()
              );
              const isUserInvolved = isUserCook || isUserCleaner;
              const isNoMeal =
                day.isNoMeal ||
                (day.targetCookCount === 0 && day.targetCleanCount === 0) ||
                (day.cooks.length === 0 && day.cleaners.length === 0);

              return (
                <div
                  key={`${day.dateKey}-${idx}`}
                  className={`bg-white rounded-2xl border p-4 shadow-xs transition-colors space-y-2.5 ${
                    isUserInvolved
                      ? "border-orange-400 bg-orange-50/20 ring-1 ring-orange-300"
                      : "border-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm sm:text-base font-black text-slate-900">
                        {day.dateLabel}
                      </span>
                      <span className="text-[11px] font-bold text-slate-500">
                        {day.mealType === "BRUNCH" ? "Brunch" : "Dinner"}
                      </span>
                    </div>

                    {isUserInvolved && (
                      <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-orange-100 text-orange-950 border border-orange-300">
                        ★ You are on this team
                      </span>
                    )}

                    {isNoMeal && (
                      <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                        No Community Meal
                      </span>
                    )}
                  </div>

                  {!isNoMeal ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="font-bold text-slate-500 block text-[11px] mb-0.5">
                          🍳 Cooks:
                        </span>
                        <span className="text-slate-800 font-medium">
                          {day.cooks.length > 0 ? day.cooks.join(", ") : "(Need Volunteers)"}
                        </span>
                      </div>
                      <div>
                        <span className="font-bold text-slate-500 block text-[11px] mb-0.5">
                          🧼 Cleaners:
                        </span>
                        <span className="text-slate-800 font-medium">
                          {day.cleaners.length > 0 ? day.cleaners.join(", ") : "(Need Volunteers)"}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">No shifts scheduled for this date.</p>
                  )}

                  {day.specialNote && (
                    <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-1.5">
                      {day.specialNote}
                    </p>
                  )}
                </div>
              );
            }))}
          </div>
        )}
      </main>

      {/* Mobile Footer */}
      <footer className="py-4 text-center text-xs text-slate-400 border-t border-slate-200 bg-white">
        CookTeamTool &bull; {communityName}
      </footer>

      {/* Sticky Bottom Navigation: My Shifts vs Full Schedule */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg px-4 py-2 sm:py-2.5">
        <div className="max-w-md mx-auto flex items-center justify-around gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("my_shifts")}
            className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-2 text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === "my_shifts"
                ? "bg-orange-600 text-white shadow-xs"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>My Shifts {selectedMember ? `(${memberShifts.length})` : ""}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("full_schedule")}
            className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-2 text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === "full_schedule"
                ? "bg-orange-600 text-white shadow-xs"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700"
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Full Schedule ({schedule.length})</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

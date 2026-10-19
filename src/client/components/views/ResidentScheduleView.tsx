import React, { useState, useEffect, useMemo } from "react";
import {
  Calendar,
  ChevronDown,
  Sparkles,
  Download,
  Users,
  Search,
  X,
  Info,
  LayoutGrid,
  List,
} from "lucide-react";
import { DaySchedule, Member } from "../../../server/types";
import { parseDateFromLabelOrKey } from "../../../server/scheduleParser";
import { extractMemberShifts, generateMemberIcs, downloadIcsFile } from "../../utils/ics";
import { TopHeader } from "../common/TopHeader";
import { Toast } from "../common/Toast";
import { LoadingSpinner } from "../common/LoadingSpinner";

export interface ResidentScheduleViewProps {
  schedule: DaySchedule[];
  members: Member[];
  monthTitle?: string;
  monthKey?: string;
  availableMonths?: string[];
  communityName?: string;
  onSelectMonth?: (monthKey: string) => void;
  onBackToHome: () => void;
  onOpenCoordinator?: () => void;
  initialMemberName?: string;
  isLoading?: boolean;
}

const STORAGE_KEY = "cookteam_resident_name";

export const DEFAULT_RESIDENT_MONTHS = [
  "2026-11",
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
      const yrShort = yr.length === 4 ? yr.slice(2) : yr;
      return `${months[mo - 1]} ${yrShort}`;
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

  // Display format for meal teams: responsive calendar grid vs linear list
  const [displayFormat, setDisplayFormat] = useState<"calendar" | "list">(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      return "list";
    }
    return "calendar";
  });
  const [userToggledFormat, setUserToggledFormat] = useState<boolean>(false);

  useEffect(() => {
    const handleResize = () => {
      if (!userToggledFormat && typeof window !== "undefined") {
        if (window.innerWidth < 768) {
          setDisplayFormat("list");
        } else {
          setDisplayFormat("calendar");
        }
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [userToggledFormat]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 5000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // Sync with initialMemberName prop on URL changes
  useEffect(() => {
    if (initialMemberName && initialMemberName.trim()) {
      setSelectedMember(initialMemberName.trim());
      setIsChangingMember(false);
    }
  }, [initialMemberName]);

  // Save selected member to localStorage and sync URL
  const handleSelectMember = (name: string) => {
    setSelectedMember(name);
    setIsChangingMember(false);
    try {
      localStorage.setItem(STORAGE_KEY, name);
    } catch {
      // ignore
    }
    const SYSTEM_PARAMS = [
      "createoauthdialog",
      "createOAuthDialog",
      "authuser",
      "usp",
      "gclid",
      "gad_source",
    ];
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      SYSTEM_PARAMS.forEach((p) => url.searchParams.delete(p));
      url.searchParams.set("view", "schedule");
      url.searchParams.set("name", name);
      url.hash = "";
      window.history.replaceState({ view: "resident", name }, "", url.toString());
    }
    if (typeof (window as any).google !== "undefined" && (window as any).google?.script?.history) {
      try {
        const gasParams: Record<string, string> = {
          view: "schedule",
          name,
        };
        if (monthKey) gasParams.month = monthKey;
        (window as any).google.script.history.replace({ view: "resident", name }, gasParams, "");
      } catch (err) {
        console.warn("GAS history replace failed:", err);
      }
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
    const SYSTEM_PARAMS = [
      "createoauthdialog",
      "createOAuthDialog",
      "authuser",
      "usp",
      "gclid",
      "gad_source",
    ];
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      SYSTEM_PARAMS.forEach((p) => url.searchParams.delete(p));
      url.searchParams.delete("name");
      url.searchParams.delete("m");
      url.searchParams.delete("user");
      url.hash = "";
      window.history.replaceState({ view: "resident" }, "", url.toString());
    }
    if (typeof (window as any).google !== "undefined" && (window as any).google?.script?.history) {
      try {
        const gasParams: Record<string, string> = {
          view: "schedule",
        };
        if (monthKey) gasParams.month = monthKey;
        (window as any).google.script.history.replace({ view: "resident" }, gasParams, "");
      } catch (err) {
        console.warn("GAS history replace failed:", err);
      }
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

    return Array.from(namesSet).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    );
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
    setToastMessage(
      `Calendar file downloaded! Tap 'Add All' on your phone to save to Apple or Google Calendar.`
    );
  };

  // Derive monthly calendar grid data
  const calendarData = useMemo(() => {
    let effectiveYear = 2026;
    let effectiveMonth = 10; // 1-indexed

    if (monthKey && /^\d{4}-\d{2}$/.test(monthKey)) {
      const parts = monthKey.split("-");
      effectiveYear = parseInt(parts[0], 10);
      effectiveMonth = parseInt(parts[1], 10);
    } else if (schedule && schedule.length > 0) {
      for (const d of schedule) {
        const parsed = parseDateFromLabelOrKey(d.dateLabel, d.dateKey);
        if (parsed && !isNaN(parsed.getTime())) {
          effectiveYear = parsed.getFullYear();
          effectiveMonth = parsed.getMonth() + 1;
          break;
        }
      }
    }

    const daysInMonth = new Date(effectiveYear, effectiveMonth, 0).getDate();
    const firstWeekday = new Date(effectiveYear, effectiveMonth - 1, 1).getDay();

    const scheduleMap = new Map<string, DaySchedule[]>();
    const dayNumMap = new Map<number, DaySchedule[]>();

    (schedule || []).forEach((day) => {
      let key = "";
      let dNum: number | null = null;

      if (day.dateKey && /^\d{4}-\d{2}-\d{2}$/.test(day.dateKey)) {
        key = day.dateKey;
        dNum = parseInt(day.dateKey.split("-")[2], 10);
      } else {
        const parsed = parseDateFromLabelOrKey(day.dateLabel, day.dateKey, effectiveYear);
        if (parsed && !isNaN(parsed.getTime())) {
          key = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
          if (parsed.getMonth() + 1 === effectiveMonth) {
            dNum = parsed.getDate();
          }
        }
      }

      if (key) {
        if (!scheduleMap.has(key)) scheduleMap.set(key, []);
        scheduleMap.get(key)!.push(day);
      }
      if (dNum !== null && !isNaN(dNum)) {
        if (!dayNumMap.has(dNum)) dayNumMap.set(dNum, []);
        dayNumMap.get(dNum)!.push(day);
      }
    });

    interface MonthDayItem {
      dayNumber: number;
      dateKey: string;
      isCurrentMonth: boolean;
      daySchedules: DaySchedule[];
      isUserInvolved: boolean;
      isUserCook: boolean;
      isUserCleaner: boolean;
    }

    const days: MonthDayItem[] = [];

    // Leading padding days from previous month
    const prevMonthDays = new Date(effectiveYear, effectiveMonth - 1, 0).getDate();
    for (let i = firstWeekday - 1; i >= 0; i--) {
      const dNum = prevMonthDays - i;
      const prevMo = effectiveMonth === 1 ? 12 : effectiveMonth - 1;
      const prevYr = effectiveMonth === 1 ? effectiveYear - 1 : effectiveYear;
      const dateKey = `${prevYr}-${String(prevMo).padStart(2, "0")}-${String(dNum).padStart(2, "0")}`;
      days.push({
        dayNumber: dNum,
        dateKey,
        isCurrentMonth: false,
        daySchedules: [],
        isUserInvolved: false,
        isUserCook: false,
        isUserCleaner: false,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = `${effectiveYear}-${String(effectiveMonth).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const daySchedules = scheduleMap.get(dateKey) || dayNumMap.get(d) || [];

      let isUserInvolved = false;
      let isUserCook = false;
      let isUserCleaner = false;

      if (daySchedules.length > 0 && selectedMember) {
        const memLower = selectedMember.trim().toLowerCase();
        for (const s of daySchedules) {
          if ((s.cooks || []).some((c) => c.toLowerCase() === memLower)) {
            isUserCook = true;
            isUserInvolved = true;
          }
          if ((s.cleaners || []).some((c) => c.toLowerCase() === memLower)) {
            isUserCleaner = true;
            isUserInvolved = true;
          }
        }
      }

      days.push({
        dayNumber: d,
        dateKey,
        isCurrentMonth: true,
        daySchedules,
        isUserInvolved,
        isUserCook,
        isUserCleaner,
      });
    }

    // Trailing padding days to fill the final week row
    const remainder = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remainder; i++) {
      const nextMo = effectiveMonth === 12 ? 1 : effectiveMonth + 1;
      const nextYr = effectiveMonth === 12 ? effectiveYear + 1 : effectiveYear;
      const dateKey = `${nextYr}-${String(nextMo).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      days.push({
        dayNumber: i,
        dateKey,
        isCurrentMonth: false,
        daySchedules: [],
        isUserInvolved: false,
        isUserCook: false,
        isUserCleaner: false,
      });
    }

    return {
      year: effectiveYear,
      month: effectiveMonth,
      days,
    };
  }, [monthKey, schedule, selectedMember]);

  // Filter schedule days where the selected resident is assigned to cook or clean
  const myShiftsSchedule = useMemo(() => {
    if (!selectedMember) return [];
    const memLower = selectedMember.trim().toLowerCase();
    return (schedule || []).filter((day) => {
      const isCook = (day.cooks || []).some((c) => c.toLowerCase() === memLower);
      const isClean = (day.cleaners || []).some((c) => c.toLowerCase() === memLower);
      return isCook || isClean;
    });
  }, [schedule, selectedMember]);

  // Helper to render teammate chips with high-visibility highlight for the active user
  const renderNamesWithHighlight = (names: string[], role: "cook" | "clean") => {
    if (!names || names.length === 0) {
      return (
        <span className="text-slate-400 dark:text-slate-500 italic text-xs">(Need Volunteers)</span>
      );
    }
    return (
      <div className="flex flex-wrap gap-1.5">
        {names.map((name) => {
          const isMe = selectedMember && name.toLowerCase() === selectedMember.trim().toLowerCase();
          return (
            <span
              key={name}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${
                isMe
                  ? role === "cook"
                    ? "bg-orange-600 text-white border-orange-700 shadow-2xs font-black"
                    : "bg-sky-600 text-white border-sky-700 shadow-2xs font-black"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700"
              }`}
            >
              {name} {isMe && "(You)"}
            </span>
          );
        })}
      </div>
    );
  };

  // Unified renderer for both My Shifts (filtered) and Full Schedule (all meals)
  const renderScheduleContent = (isMyShiftsView: boolean) => {
    if (isLoading) {
      return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 sm:p-16 text-center space-y-3.5 min-h-[380px] sm:min-h-[440px] flex flex-col items-center justify-center shadow-2xs animate-in fade-in duration-150">
          <div className="w-12 h-12 rounded-2xl bg-orange-50 dark:bg-orange-950/40 flex items-center justify-center border border-orange-100 dark:border-orange-900/60 mb-1">
            <LoadingSpinner size="md" color="orange" />
          </div>
          <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
            Loading schedule for {formatMonthDisplay(monthKey || "")}...
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
            Fetching meal dates, cooks, and clean assignments...
          </p>
        </div>
      );
    }

    const displayedSchedule = isMyShiftsView ? myShiftsSchedule : schedule;

    if (displayedSchedule.length === 0) {
      if (isMyShiftsView) {
        return (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-3">
            <Sparkles className="w-10 h-10 text-amber-500 mx-auto" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {schedule.length === 0
                ? `No schedule published yet for ${monthTitle}`
                : `No shifts scheduled for ${selectedMember}`}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              {schedule.length === 0
                ? `The meal team schedule for ${monthTitle} has not been published yet. Select another month in the top bar or check back once finalized!`
                : `You are not assigned to any cook or clean shifts in ${monthTitle}. Enjoy the community meals, or browse the full schedule below!`}
            </p>
            {schedule.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab("full_schedule")}
                className="mt-1 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>View Full Community Schedule</span>
              </button>
            )}
          </div>
        );
      } else {
        return (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-3">
            <Calendar className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              No published schedule found for {monthTitle}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              The schedule for this month has not been published yet. Select another month above to
              view past schedules.
            </p>
          </div>
        );
      }
    }

    if (displayFormat === "calendar") {
      return (
        /* CALENDAR GRID VIEW (Responsive with auto-scroll on narrow viewport) */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 sm:p-4 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto pb-1">
            <div className="min-w-[700px] md:min-w-0">
              {/* Days of week header */}
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-2 text-center text-[11px] sm:text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((dayName) => (
                  <div key={dayName} className="py-1">
                    {dayName}
                  </div>
                ))}
              </div>

              {/* Month Day Cells */}
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                {calendarData.days.map((dayItem, cellIdx) => {
                  if (!dayItem.isCurrentMonth) {
                    return (
                      <div
                        key={`pad-${dayItem.dateKey}-${cellIdx}`}
                        className="min-h-[105px] sm:min-h-[125px] p-2 bg-slate-50/60 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 opacity-40 select-none flex flex-col justify-start"
                      >
                        <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                          {dayItem.dayNumber}
                        </span>
                      </div>
                    );
                  }

                  // In "My Shifts" mode, only show meals where selectedMember is assigned
                  const cellMeals = isMyShiftsView
                    ? dayItem.daySchedules.filter((s) => {
                        if (!selectedMember) return false;
                        const memLower = selectedMember.trim().toLowerCase();
                        const isCook = (s.cooks || []).some((c) => c.toLowerCase() === memLower);
                        const isClean = (s.cleaners || []).some(
                          (c) => c.toLowerCase() === memLower
                        );
                        return isCook || isClean;
                      })
                    : dayItem.daySchedules;

                  const hasMeals = cellMeals.length > 0;
                  const isUserInvolved = dayItem.isUserInvolved;

                  return (
                    <div
                      key={dayItem.dateKey}
                      className={`min-h-[105px] sm:min-h-[125px] p-2 rounded-xl border transition-all flex flex-col justify-between ${
                        isUserInvolved && hasMeals
                          ? "bg-orange-50/50 dark:bg-orange-950/30 border-orange-300 dark:border-orange-800 ring-2 ring-orange-400/60 shadow-xs"
                          : hasMeals
                            ? "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700"
                            : "bg-slate-50/30 dark:bg-slate-900/40 border-slate-100 dark:border-slate-800/60"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-xs font-black ${
                            isUserInvolved && hasMeals
                              ? "text-orange-950 dark:text-orange-200 font-black"
                              : hasMeals
                                ? "text-slate-800 dark:text-slate-200"
                                : "text-slate-400 dark:text-slate-500"
                          }`}
                        >
                          {dayItem.dayNumber}
                        </span>
                        {isUserInvolved && hasMeals && (
                          <span
                            className="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-orange-100 dark:bg-orange-950/60 text-orange-950 dark:text-orange-300 border border-orange-300 dark:border-orange-800"
                            title="You are scheduled on this date"
                          >
                            ★ You
                          </span>
                        )}
                      </div>

                      {hasMeals ? (
                        <div className="space-y-1.5 flex-1 flex flex-col justify-between">
                          {cellMeals.map((s, sIdx) => {
                            const isNoMeal =
                              s.isNoMeal ||
                              (s.targetCookCount === 0 && s.targetCleanCount === 0) ||
                              (s.cooks.length === 0 && s.cleaners.length === 0);

                            if (isNoMeal) {
                              return (
                                <div
                                  key={sIdx}
                                  className="text-[10px] text-slate-400 dark:text-slate-500 italic py-1"
                                >
                                  No Meal
                                </div>
                              );
                            }

                            return (
                              <div key={sIdx} className="space-y-1 text-[11px]">
                                <div className="flex items-center gap-1">
                                  <span
                                    className={`text-[9px] font-black px-1.5 py-0.2 rounded ${
                                      s.mealType === "BRUNCH"
                                        ? "bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                                        : "bg-sky-100 dark:bg-sky-950/60 text-sky-900 dark:text-sky-300 border border-sky-200 dark:border-sky-800"
                                    }`}
                                  >
                                    {s.mealType === "BRUNCH" ? "Brunch" : "Dinner"}
                                  </span>
                                </div>

                                {/* Cooks */}
                                <div className="leading-tight text-[10px] text-slate-700 dark:text-slate-300">
                                  <span className="font-bold text-slate-500 dark:text-slate-400">
                                    🍳{" "}
                                  </span>
                                  {s.cooks.length > 0 ? (
                                    s.cooks.map((c, i) => {
                                      const isMe =
                                        selectedMember &&
                                        c.toLowerCase() === selectedMember.trim().toLowerCase();
                                      return (
                                        <span key={c}>
                                          {i > 0 && ", "}
                                          <span
                                            className={
                                              isMe
                                                ? "font-black text-orange-900 dark:text-orange-300 bg-orange-100 dark:bg-orange-950/60 px-0.5 rounded"
                                                : ""
                                            }
                                          >
                                            {c}
                                          </span>
                                        </span>
                                      );
                                    })
                                  ) : (
                                    <span className="text-slate-400 dark:text-slate-500 italic">
                                      None
                                    </span>
                                  )}
                                </div>

                                {/* Cleaners */}
                                <div className="leading-tight text-[10px] text-slate-700 dark:text-slate-300">
                                  <span className="font-bold text-slate-500 dark:text-slate-400">
                                    🧼{" "}
                                  </span>
                                  {s.cleaners.length > 0 ? (
                                    s.cleaners.map((c, i) => {
                                      const isMe =
                                        selectedMember &&
                                        c.toLowerCase() === selectedMember.trim().toLowerCase();
                                      return (
                                        <span key={c}>
                                          {i > 0 && ", "}
                                          <span
                                            className={
                                              isMe
                                                ? "font-black text-sky-900 dark:text-sky-300 bg-sky-100 dark:bg-sky-950/60 px-0.5 rounded"
                                                : ""
                                            }
                                          >
                                            {c}
                                          </span>
                                        </span>
                                      );
                                    })
                                  ) : (
                                    <span className="text-slate-400 dark:text-slate-500 italic">
                                      None
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex-1" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      );
    }

    /* LIST VIEW */
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {displayedSchedule.map((day, idx) => {
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
              className={`bg-white dark:bg-slate-900 rounded-2xl border p-4 sm:p-5 shadow-xs transition-colors space-y-3 ${
                isUserInvolved
                  ? "border-orange-400 dark:border-orange-600 bg-orange-50/20 dark:bg-orange-950/20 ring-1 ring-orange-300 dark:ring-orange-800"
                  : "border-slate-200 dark:border-slate-800"
              }`}
            >
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                    {day.dateLabel || day.dateKey}
                  </span>
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    {day.mealType === "BRUNCH" ? "Community Brunch" : "Community Dinner"}
                  </span>
                </div>

                {isUserCook && isUserCleaner ? (
                  <span className="text-xs font-black px-2.5 py-1 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800 shadow-2xs">
                    🍳+🧼 Cook & Clean
                  </span>
                ) : isUserCook ? (
                  <span className="text-xs font-black px-2.5 py-1 rounded-xl bg-orange-100 dark:bg-orange-950/60 text-orange-950 dark:text-orange-300 border border-orange-200 dark:border-orange-800 shadow-2xs">
                    🍳 Cook Shift
                  </span>
                ) : isUserCleaner ? (
                  <span className="text-xs font-black px-2.5 py-1 rounded-xl bg-sky-100 dark:bg-sky-950/60 text-sky-950 dark:text-sky-300 border border-sky-200 dark:border-sky-800 shadow-2xs">
                    🧼 Clean Shift
                  </span>
                ) : isUserInvolved ? (
                  <span className="text-xs font-black px-2.5 py-1 rounded-xl bg-orange-100 dark:bg-orange-950/60 text-orange-950 dark:text-orange-300 border border-orange-200 dark:border-orange-800 shadow-2xs">
                    ★ You are on this team
                  </span>
                ) : isNoMeal ? (
                  <span className="text-xs font-black px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                    No Community Meal
                  </span>
                ) : null}
              </div>

              {!isNoMeal ? (
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="font-bold text-slate-500 dark:text-slate-400 block text-[11px] mb-1">
                      🍳 Cooks:
                    </span>
                    {renderNamesWithHighlight(day.cooks, "cook")}
                  </div>
                  <div>
                    <span className="font-bold text-slate-500 dark:text-slate-400 block text-[11px] mb-1">
                      🧼 Cleaners:
                    </span>
                    {renderNamesWithHighlight(day.cleaners, "clean")}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                  No shifts scheduled for this date.
                </p>
              )}

              {day.specialNote && (
                <div className="mt-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <span>{day.specialNote}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-between text-slate-900 dark:text-slate-100 transition-colors">
      {/* Toast Notification */}
      <Toast message={toastMessage} onClose={() => setToastMessage(null)} />

      {/* Top Header */}
      <TopHeader
        communityName={communityName}
        onBackToHome={onBackToHome}
        viewBadge={
          <span className="px-2.5 py-1 text-xs font-bold rounded-xl bg-orange-100 dark:bg-orange-950/60 text-orange-950 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
            Resident Shifts
          </span>
        }
      >
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Reusable Month Dropdown */}
          <div className="relative inline-flex items-center">
            <Calendar className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400 absolute left-2 sm:left-2.5 pointer-events-none" />
            <select
              value={monthKey || ""}
              onChange={(e) => onSelectMonth && onSelectMonth(e.target.value)}
              aria-label="Select meal month"
              className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-xl pl-7 sm:pl-8 pr-6 sm:pr-7 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-500/20 cursor-pointer appearance-none transition-colors"
            >
              {displayMonths.map((m) => (
                <option
                  key={m}
                  value={m}
                  className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  {formatMonthDisplay(m)}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 absolute right-1.5 sm:right-2 pointer-events-none" />
          </div>

          {/* Member Badge | T name X | */}
          {selectedMember && !isChangingMember && (
            <div className="inline-flex items-center gap-1 sm:gap-1.5 bg-orange-50/90 dark:bg-orange-950/50 border border-orange-200 dark:border-orange-800 rounded-xl pl-1 pr-1.5 py-1 text-xs shadow-2xs min-w-0 shrink-0">
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-orange-600 text-white flex items-center justify-center font-black text-[10px] sm:text-xs shrink-0 shadow-2xs">
                {selectedMember.charAt(0).toUpperCase()}
              </div>
              <span className="font-black text-slate-900 dark:text-white truncate max-w-[80px] sm:max-w-[150px] pl-0.5">
                {selectedMember}
              </span>
              <button
                type="button"
                onClick={handleClearMember}
                title={`Clear ${selectedMember} (switch resident)`}
                aria-label="Switch resident"
                className="w-5 h-5 rounded-md hover:bg-orange-200/80 dark:hover:bg-orange-900/60 text-orange-800 dark:text-orange-300 hover:text-orange-950 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0 ml-0.5"
              >
                <span className="sr-only">Switch</span>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </TopHeader>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 flex-1 w-full space-y-4 pb-24">
        {/* Member Search / Selector Card (shown when no member is selected or user tapped Switch) */}
        {(!selectedMember || isChangingMember) && (
          <div className="max-w-2xl mx-auto w-full">
            <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                    Whose shifts are you looking for?
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Select your name to see your shifts and save them to your calendar.
                  </p>
                </div>
                {selectedMember && (
                  <button
                    type="button"
                    onClick={() => setIsChangingMember(false)}
                    className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-bold p-1 cursor-pointer"
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
                  className="w-full pl-9 pr-4 py-2.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-slate-900 dark:text-white font-medium"
                />
                {memberSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setMemberSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
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
                        : "bg-slate-100 dark:bg-slate-800 hover:bg-orange-50 dark:hover:bg-orange-950/40 text-slate-800 dark:text-slate-200 hover:text-orange-950 dark:hover:text-orange-200 border border-slate-200 dark:border-slate-700 hover:border-orange-300 dark:hover:border-orange-800"
                    }`}
                  >
                    {name}
                  </button>
                ))}
                {filteredMemberNames.length === 0 && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 py-3 italic">
                    No community member found matching &quot;{memberSearchQuery}&quot;.
                  </p>
                )}
              </div>
            </section>
          </div>
        )}

        {/* Tab 1: My Shifts */}
        {activeTab === "my_shifts" && (
          <div className="space-y-3.5">
            {!selectedMember ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-3">
                <Users className="w-10 h-10 text-slate-400 mx-auto" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Please select your name
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  Pick your name from the selector above to view your cook and clean assignments for{" "}
                  {monthTitle}.
                </p>
              </div>
            ) : isLoading ? (
              renderScheduleContent(true)
            ) : memberShifts.length === 0 ? (
              renderScheduleContent(true)
            ) : (
              <>
                {/* Compact Shifts Summary Bar + Calendar/List Switcher + Download */}
                <div className="flex items-center justify-between gap-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-2 sm:p-3 shadow-2xs">
                  {/* Left: Shift Counters */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white shrink-0">
                      {memberShifts.length} Shift{memberShifts.length === 1 ? "" : "s"}
                      <span className="hidden md:inline"> Assigned</span>
                    </span>
                    <div className="flex items-center gap-1 text-xs font-bold shrink-0">
                      <span className="px-1.5 sm:px-2 py-0.5 rounded-lg bg-orange-50 dark:bg-orange-950/50 text-orange-800 dark:text-orange-300 border border-orange-200 dark:border-orange-800 text-[11px] sm:text-xs">
                        🍳 {cookCount}
                        <span className="hidden md:inline"> Cook</span>
                      </span>
                      <span className="px-1.5 sm:px-2 py-0.5 rounded-lg bg-sky-50 dark:bg-sky-950/50 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800 text-[11px] sm:text-xs">
                        🧼 {cleanCount}
                        <span className="hidden md:inline"> Clean</span>
                      </span>
                    </div>
                  </div>

                  {/* Right: View Switcher + Compact .ics Button */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* View Switcher Controls */}
                    <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 sm:p-1 rounded-xl border border-slate-200/80 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={() => {
                          setDisplayFormat("calendar");
                          setUserToggledFormat(true);
                        }}
                        title="Calendar view"
                        aria-label="Calendar view"
                        className={`p-1.5 sm:px-3 sm:py-1.5 rounded-lg font-bold text-xs flex items-center gap-1 transition-all cursor-pointer ${
                          displayFormat === "calendar"
                            ? "bg-white dark:bg-slate-700 text-orange-950 dark:text-white font-black shadow-xs border border-slate-200 dark:border-slate-600"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        }`}
                        aria-pressed={displayFormat === "calendar"}
                      >
                        <LayoutGrid className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Calendar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDisplayFormat("list");
                          setUserToggledFormat(true);
                        }}
                        title="List view"
                        aria-label="List view"
                        className={`p-1.5 sm:px-3 sm:py-1.5 rounded-lg font-bold text-xs flex items-center gap-1 transition-all cursor-pointer ${
                          displayFormat === "list"
                            ? "bg-white dark:bg-slate-700 text-orange-950 dark:text-white font-black shadow-xs border border-slate-200 dark:border-slate-600"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        }`}
                        aria-pressed={displayFormat === "list"}
                      >
                        <List className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">List</span>
                      </button>
                    </div>

                    {/* .ics Download Button */}
                    <button
                      type="button"
                      onClick={handleDownloadCalendar}
                      disabled={memberShifts.length === 0}
                      title="Add All My Shifts to Calendar (.ics)"
                      className={`min-h-[30px] sm:min-h-[36px] px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer ${
                        memberShifts.length > 0
                          ? "bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white shadow-orange-600/20 active:scale-[0.99]"
                          : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                      }`}
                    >
                      <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                      <span className="hidden lg:inline">Add All My Shifts to Calendar (.ics)</span>
                      <span className="lg:hidden">Save shifts (.ics)</span>
                    </button>
                  </div>
                </div>

                {renderScheduleContent(true)}
              </>
            )}
          </div>
        )}

        {/* Tab 2: Full Community Schedule */}
        {activeTab === "full_schedule" && (
          <div className="space-y-3.5">
            {isLoading ? (
              renderScheduleContent(false)
            ) : (
              <>
                {/* Header + Calendar/List View Toggle Bar */}
                <div className="flex items-center justify-between gap-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-2 sm:p-3 shadow-2xs">
                  <div className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate min-w-0">
                    <span className="hidden md:inline">
                      Showing all {schedule.length} community meals for {monthTitle}
                    </span>
                    <span className="hidden sm:inline md:hidden">
                      {schedule.length} meals ({monthTitle})
                    </span>
                    <span className="sm:hidden">{schedule.length} meals</span>
                  </div>

                  {/* Right: View Switcher + Compact .ics Button */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* View Switcher Controls */}
                    <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 sm:p-1 rounded-xl border border-slate-200/80 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={() => {
                          setDisplayFormat("calendar");
                          setUserToggledFormat(true);
                        }}
                        title="Calendar view"
                        aria-label="Calendar view"
                        className={`p-1.5 sm:px-3 sm:py-1.5 rounded-lg font-bold text-xs flex items-center gap-1 transition-all cursor-pointer ${
                          displayFormat === "calendar"
                            ? "bg-white dark:bg-slate-700 text-orange-950 dark:text-white font-black shadow-xs border border-slate-200 dark:border-slate-600"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        }`}
                        aria-pressed={displayFormat === "calendar"}
                      >
                        <LayoutGrid className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Calendar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDisplayFormat("list");
                          setUserToggledFormat(true);
                        }}
                        title="List view"
                        aria-label="List view"
                        className={`p-1.5 sm:px-3 sm:py-1.5 rounded-lg font-bold text-xs flex items-center gap-1 transition-all cursor-pointer ${
                          displayFormat === "list"
                            ? "bg-white dark:bg-slate-700 text-orange-950 dark:text-white font-black shadow-xs border border-slate-200 dark:border-slate-600"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        }`}
                        aria-pressed={displayFormat === "list"}
                      >
                        <List className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">List</span>
                      </button>
                    </div>

                    {/* .ics Download Button */}
                    {selectedMember && (
                      <button
                        type="button"
                        onClick={handleDownloadCalendar}
                        disabled={memberShifts.length === 0}
                        title={
                          memberShifts.length > 0
                            ? "Add All My Shifts to Calendar (.ics)"
                            : `No shifts assigned to ${selectedMember} to download`
                        }
                        className={`min-h-[30px] sm:min-h-[36px] px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer ${
                          memberShifts.length > 0
                            ? "bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white shadow-orange-600/20 active:scale-[0.99]"
                            : "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed shadow-none"
                        }`}
                      >
                        <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                        <span className="hidden lg:inline">
                          Add All My Shifts to Calendar (.ics)
                        </span>
                        <span className="lg:hidden">Save shifts (.ics)</span>
                      </button>
                    )}
                  </div>
                </div>

                {renderScheduleContent(false)}
              </>
            )}
          </div>
        )}
      </main>

      {/* Mobile Footer */}
      <footer className="py-4 text-center text-xs text-slate-400 dark:text-slate-500 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        CookTeamTool &bull; {communityName}
      </footer>

      {/* Sticky Bottom Navigation: My Shifts vs Full Schedule */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 shadow-lg px-4 py-2 sm:py-2.5">
        <div className="max-w-md mx-auto flex items-center justify-around gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("my_shifts")}
            className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-2 text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === "my_shifts"
                ? "bg-orange-600 text-white shadow-xs"
                : "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
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
                : "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
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

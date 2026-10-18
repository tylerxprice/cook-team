import React, { useState, useEffect, useMemo } from "react";
import { Utensils, Calendar, MessageSquare, List } from "lucide-react";
import { MealDate, AvailabilityStatus } from "../../../server/types";
import { formatDisplayDateLabel } from "../../utils/formatters";

export interface SurveyResponseFormProps {
  mealDates: MealDate[];
  monthKey?: string;
  cookQuota: number;
  setCookQuota: (val: number) => void;
  cleanQuota: number;
  setCleanQuota: (val: number) => void;
  maxTotalShifts: number;
  setMaxTotalShifts: (val: number) => void;
  cookTeamSizePref: string;
  setCookTeamSizePref: (val: string) => void;
  sameDayPref: "NO" | "YES" | "PREFERRED";
  setSameDayPref: (val: "NO" | "YES" | "PREFERRED") => void;
  availability: Record<string, AvailabilityStatus>;
  setAvailability: React.Dispatch<React.SetStateAction<Record<string, AvailabilityStatus>>>;
  specialInstructions: string;
  setSpecialInstructions: (val: string) => void;
  disabled?: boolean;
  accentColor?: "orange" | "violet" | "emerald";
}

export const SurveyResponseForm: React.FC<SurveyResponseFormProps> = ({
  mealDates,
  monthKey,
  cookQuota,
  setCookQuota,
  cleanQuota,
  setCleanQuota,
  maxTotalShifts,
  setMaxTotalShifts,
  cookTeamSizePref,
  setCookTeamSizePref,
  sameDayPref,
  setSameDayPref,
  availability,
  setAvailability,
  specialInstructions,
  setSpecialInstructions,
  disabled = false,
  accentColor = "orange",
}) => {
  // Display format toggle: Calendar vs List (collapses to List on mobile viewports by default)
  const [displayFormat, setDisplayFormat] = useState<"calendar" | "list">(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      return "list";
    }
    return "calendar";
  });
  const [userToggledFormat, setUserToggledFormat] = useState(false);

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

  // Derive counts of chosen availability
  const { availableCount, cookOnlyCount, cleanOnlyCount, unavailableCount } = useMemo(() => {
    let avail = 0;
    let cook = 0;
    let clean = 0;
    let unavail = 0;
    mealDates.forEach((d) => {
      const status = availability[d.dateLabel] || "UNAVAILABLE";
      if (status === "AVAILABLE") avail++;
      else if (status === "COOK_ONLY") cook++;
      else if (status === "CLEAN_ONLY") clean++;
      else unavail++;
    });
    return {
      availableCount: avail,
      cookOnlyCount: cook,
      cleanOnlyCount: clean,
      unavailableCount: unavail,
    };
  }, [mealDates, availability]);

  // Derive monthly calendar grid data
  const calendarData = useMemo(() => {
    let effectiveYear = 2026;
    let effectiveMonth = 11; // 1-indexed

    if (monthKey && /^\d{4}-\d{2}$/.test(monthKey)) {
      const parts = monthKey.split("-");
      effectiveYear = parseInt(parts[0], 10);
      effectiveMonth = parseInt(parts[1], 10);
    } else if (mealDates && mealDates.length > 0) {
      for (const d of mealDates) {
        if (d.dateKey && /^\d{4}-\d{2}-\d{2}$/.test(d.dateKey)) {
          const parts = d.dateKey.split("-");
          effectiveYear = parseInt(parts[0], 10);
          effectiveMonth = parseInt(parts[1], 10);
          break;
        }
      }
    }

    const daysInMonth = new Date(effectiveYear, effectiveMonth, 0).getDate();
    const firstWeekday = new Date(effectiveYear, effectiveMonth - 1, 1).getDay();

    const mealByDay = new Map<number, MealDate>();
    mealDates.forEach((d) => {
      let matchedDay: number | null = null;
      if (d.dateKey && /^\d{4}-\d{2}-\d{2}$/.test(d.dateKey)) {
        const parts = d.dateKey.split("-");
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        if (y === effectiveYear && m === effectiveMonth) {
          matchedDay = parseInt(parts[2], 10);
        }
      }
      if (matchedDay === null) {
        const m = d.dateLabel.match(/\b(\d{1,2})\b/);
        if (m) matchedDay = parseInt(m[1], 10);
      }
      if (matchedDay !== null && !isNaN(matchedDay)) {
        mealByDay.set(matchedDay, d);
      }
    });

    const days: {
      dayNumber: number;
      isCurrentMonth: boolean;
      mealDate?: MealDate;
    }[] = [];

    const prevMonthDays = new Date(effectiveYear, effectiveMonth - 1, 0).getDate();
    for (let i = firstWeekday - 1; i >= 0; i--) {
      days.push({
        dayNumber: prevMonthDays - i,
        isCurrentMonth: false,
      });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      days.push({
        dayNumber: d,
        isCurrentMonth: true,
        mealDate: mealByDay.get(d),
      });
    }

    const remainder = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remainder; i++) {
      days.push({
        dayNumber: i,
        isCurrentMonth: false,
      });
    }

    return {
      year: effectiveYear,
      month: effectiveMonth,
      days,
    };
  }, [mealDates, monthKey]);
  const handleSetAllAvailability = (
    status: AvailabilityStatus,
    filterType?: "DINNER" | "BRUNCH"
  ) => {
    setAvailability((prev) => {
      const next = { ...prev };
      for (const d of mealDates) {
        if (!filterType || d.mealType === filterType) {
          next[d.dateLabel] = status;
        }
      }
      return next;
    });
  };

  const handleDateStatusChange = (dateLabel: string, status: AvailabilityStatus) => {
    setAvailability((prev) => ({
      ...prev,
      [dateLabel]: status,
    }));
  };

  const iconColorClass =
    accentColor === "violet"
      ? "text-violet-600"
      : accentColor === "emerald"
        ? "text-emerald-600"
        : "text-orange-600";

  return (
    <div className="space-y-6">
      {/* Section 1: Quotas & Sizing Preferences */}
      <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-3.5">
        <h4 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
          <Utensils className={`w-4 h-4 ${iconColorClass}`} />
          Requested Shifts &amp; Preferences
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {/* Cook Quota */}
          <div>
            <label
              htmlFor="survey-form-cook-quota"
              className="text-xs font-bold text-slate-700 block mb-1"
            >
              Cook Quota (Shifts):
            </label>
            <select
              id="survey-form-cook-quota"
              value={cookQuota}
              onChange={(e) => {
                const nextCook = parseInt(e.target.value, 10);
                setCookQuota(nextCook);
                // If max total was tracking the sum, update it
                if (maxTotalShifts === cookQuota + cleanQuota) {
                  setMaxTotalShifts(nextCook + cleanQuota);
                }
              }}
              disabled={disabled}
              className="w-full min-h-[42px] px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 font-bold text-slate-900 cursor-pointer"
            >
              <option value={0}>0 (No Cooking)</option>
              <option value={1}>1 shift (Default)</option>
              <option value={2}>2 shifts</option>
              <option value={3}>3 shifts</option>
              <option value={4}>4 shifts</option>
            </select>
          </div>

          {/* Clean Quota */}
          <div>
            <label
              htmlFor="survey-form-clean-quota"
              className="text-xs font-bold text-slate-700 block mb-1"
            >
              Clean Quota (Shifts):
            </label>
            <select
              id="survey-form-clean-quota"
              value={cleanQuota}
              onChange={(e) => {
                const nextClean = parseInt(e.target.value, 10);
                setCleanQuota(nextClean);
                if (maxTotalShifts === cookQuota + cleanQuota) {
                  setMaxTotalShifts(cookQuota + nextClean);
                }
              }}
              disabled={disabled}
              className="w-full min-h-[42px] px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 font-bold text-slate-900 cursor-pointer"
            >
              <option value={0}>0 (No Cleaning)</option>
              <option value={1}>1 shift (Default)</option>
              <option value={2}>2 shifts</option>
              <option value={3}>3 shifts</option>
            </select>
          </div>

          {/* Max Total Shifts Cap */}
          <div>
            <label
              htmlFor="survey-form-max-shifts-cap"
              className="text-xs font-bold text-slate-700 block mb-1 flex items-center justify-between"
            >
              <span>Max Total Shifts (Cap):</span>
              {maxTotalShifts < cookQuota + cleanQuota && (
                <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                  Capped
                </span>
              )}
            </label>
            <select
              id="survey-form-max-shifts-cap"
              value={maxTotalShifts}
              onChange={(e) => setMaxTotalShifts(parseInt(e.target.value, 10))}
              disabled={disabled}
              className="w-full min-h-[42px] px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 font-bold text-slate-900 cursor-pointer"
            >
              <option value={cookQuota + cleanQuota}>
                Sum of above ({cookQuota + cleanQuota} total)
              </option>
              <option value={1}>1 shift max</option>
              <option value={2}>2 shifts max</option>
              <option value={3}>3 shifts max</option>
              <option value={4}>4 shifts max</option>
              <option value={5}>5 shifts max</option>
              <option value={6}>6 shifts max</option>
            </select>
          </div>

          {/* Cook Team Sizing */}
          <div>
            <label
              htmlFor="survey-form-cook-team-sizing"
              className="text-xs font-bold text-slate-700 block mb-1"
            >
              Cook Team Sizing:
            </label>
            <select
              id="survey-form-cook-team-sizing"
              value={cookTeamSizePref}
              onChange={(e) => setCookTeamSizePref(e.target.value)}
              disabled={disabled}
              className="w-full min-h-[42px] px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 font-medium text-slate-900 cursor-pointer"
            >
              <option value="Dinner = 3, Brunch = 2">Dinner = 3, Brunch = 2</option>
              <option value="2 for either">2 for either (Accept 2 cooks)</option>
              <option value="2 regardless of meal type">2 regardless of meal type</option>
            </select>
          </div>

          {/* Same-Day Shifts */}
          <div className="sm:col-span-2 lg:col-span-2">
            <label
              htmlFor="survey-form-same-day-pref"
              className="text-xs font-bold text-slate-700 block mb-1"
            >
              Same-Day Cook &amp; Clean:
            </label>
            <select
              id="survey-form-same-day-pref"
              value={sameDayPref}
              onChange={(e) => setSameDayPref(e.target.value as any)}
              disabled={disabled}
              className="w-full min-h-[42px] px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 font-medium text-slate-900 cursor-pointer"
            >
              <option value="NO">No (Separate days only)</option>
              <option value="YES">Yes (Willing on same day)</option>
              <option value="PREFERRED">Preferred (Prefers same day)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Section 2: Meal Dates Availability Grid */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
              <Calendar className={`w-4 h-4 ${iconColorClass}`} />
              Monthly Meal Availability ({mealDates.length} Dates)
            </h4>
            <p className="text-xs text-slate-600">
              Select which dates and roles you are available for:
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Bulk Actions */}
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => handleSetAllAvailability("AVAILABLE")}
                disabled={disabled}
                className="px-2.5 py-1 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                All Available
              </button>
              <button
                type="button"
                onClick={() => handleSetAllAvailability("AVAILABLE", "DINNER")}
                disabled={disabled}
                className="px-2.5 py-1 text-xs font-bold text-orange-800 bg-orange-50 hover:bg-orange-100 border border-orange-300 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                Dinners Only
              </button>
              <button
                type="button"
                onClick={() => handleSetAllAvailability("AVAILABLE", "BRUNCH")}
                disabled={disabled}
                className="px-2.5 py-1 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                Brunches Only
              </button>
              <button
                type="button"
                onClick={() => handleSetAllAvailability("UNAVAILABLE")}
                disabled={disabled}
                className="px-2.5 py-1 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                Clear All
              </button>
            </div>

            {/* View Format Toggle: Calendar vs List */}
            <div className="inline-flex items-center p-0.5 bg-slate-200/80 rounded-xl border border-slate-300">
              <button
                type="button"
                onClick={() => {
                  setUserToggledFormat(true);
                  setDisplayFormat("calendar");
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  displayFormat === "calendar"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="Calendar month view"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Calendar</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setUserToggledFormat(true);
                  setDisplayFormat("list");
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  displayFormat === "list"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="Linear list view"
              >
                <List className="w-3.5 h-3.5" />
                <span>List</span>
              </button>
            </div>
          </div>
        </div>

        {/* Live Availability Summary Pills */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs">
          <span className="font-bold text-slate-600 mr-1 text-[11px]">Selected:</span>
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg font-bold bg-emerald-100 text-emerald-950 border border-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            {availableCount} Both (Cook &amp; Clean)
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg font-bold bg-orange-100 text-orange-950 border border-orange-300">
            <span className="w-2 h-2 rounded-full bg-orange-500" />
            {cookOnlyCount} Cook Only
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg font-bold bg-sky-100 text-sky-950 border border-sky-300">
            <span className="w-2 h-2 rounded-full bg-sky-500" />
            {cleanOnlyCount} Clean Only
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg font-bold bg-slate-100 text-slate-700 border border-slate-300">
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            {unavailableCount} Off
          </span>
        </div>

        {mealDates.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-300 rounded-xl">
            No meal dates loaded in current survey sheet.
          </div>
        ) : displayFormat === "calendar" ? (
          /* Calendar Grid View */
          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
            {/* Weekday Header */}
            <div className="grid grid-cols-7 bg-slate-100/90 border-b border-slate-200 text-center font-black text-[11px] sm:text-xs text-slate-600 py-2">
              <span>Sun</span>
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
            </div>

            {/* Calendar Days Grid */}
            <div className="grid grid-cols-7 gap-px bg-slate-200">
              {calendarData.days.map((cell, idx) => {
                if (!cell.isCurrentMonth) {
                  return (
                    <div
                      key={`pad-${idx}`}
                      className="bg-slate-50/60 p-1.5 sm:p-2 min-h-[90px] sm:min-h-[115px] select-none text-slate-300 flex flex-col justify-between"
                    >
                      <span className="text-xs font-bold">{cell.dayNumber}</span>
                    </div>
                  );
                }

                if (!cell.mealDate) {
                  return (
                    <div
                      key={`day-${cell.dayNumber}`}
                      className="bg-white p-1.5 sm:p-2 min-h-[90px] sm:min-h-[115px] select-none text-slate-400 flex flex-col justify-between"
                    >
                      <span className="text-xs font-bold text-slate-400">{cell.dayNumber}</span>
                    </div>
                  );
                }

                // Meal Date Cell
                const d = cell.mealDate;
                const currentStatus = availability[d.dateLabel] || "UNAVAILABLE";
                const isDinner = d.mealType === "DINNER";

                return (
                  <div
                    key={d.dateKey || d.dateLabel}
                    className={`p-1.5 sm:p-2 min-h-[105px] sm:min-h-[125px] flex flex-col justify-between transition-colors ${
                      currentStatus === "AVAILABLE"
                        ? "bg-emerald-50/80 hover:bg-emerald-50"
                        : currentStatus === "COOK_ONLY"
                          ? "bg-orange-50/80 hover:bg-orange-50"
                          : currentStatus === "CLEAN_ONLY"
                            ? "bg-sky-50/80 hover:bg-sky-50"
                            : "bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div>
                      {/* Cell Header: Day Number + Meal Type Badge */}
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-xs sm:text-sm font-black text-slate-900">
                          {cell.dayNumber}
                        </span>
                        <span
                          className={`text-[9px] sm:text-[10px] font-extrabold px-1.5 py-0.2 rounded uppercase tracking-wider ${
                            isDinner
                              ? "bg-orange-100 text-orange-900 border border-orange-300"
                              : "bg-amber-100 text-amber-900 border border-amber-300"
                          }`}
                        >
                          {d.mealType === "DINNER" ? "Din" : "Bru"}
                        </span>
                      </div>

                      {/* Special Note if any */}
                      {d.specialNote && (
                        <p
                          className="text-[10px] text-purple-700 font-semibold truncate mb-1"
                          title={d.specialNote}
                        >
                          📌 {d.specialNote}
                        </p>
                      )}

                      {/* Current Status Pill */}
                      <div className="mb-1 text-center">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-black leading-tight ${
                            currentStatus === "AVAILABLE"
                              ? "bg-emerald-600 text-white"
                              : currentStatus === "COOK_ONLY"
                                ? "bg-orange-600 text-white"
                                : currentStatus === "CLEAN_ONLY"
                                  ? "bg-sky-600 text-white"
                                  : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {currentStatus === "AVAILABLE"
                            ? "✓ Both"
                            : currentStatus === "COOK_ONLY"
                              ? "🍳 Cook"
                              : currentStatus === "CLEAN_ONLY"
                                ? "🧼 Clean"
                                : "Off"}
                        </span>
                      </div>
                    </div>

                    {/* 2x2 Mini Action Buttons */}
                    <div className="grid grid-cols-2 gap-1 mt-1">
                      <button
                        type="button"
                        onClick={() => handleDateStatusChange(d.dateLabel, "AVAILABLE")}
                        disabled={disabled}
                        className={`py-1 px-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer text-center ${
                          currentStatus === "AVAILABLE"
                            ? "bg-emerald-700 text-white border-emerald-800 font-black shadow-2xs"
                            : "bg-white hover:bg-emerald-50 text-emerald-900 border-slate-200"
                        }`}
                        title="Available for both Cooking & Cleaning"
                      >
                        Both
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDateStatusChange(d.dateLabel, "COOK_ONLY")}
                        disabled={disabled}
                        className={`py-1 px-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer text-center ${
                          currentStatus === "COOK_ONLY"
                            ? "bg-orange-700 text-white border-orange-800 font-black shadow-2xs"
                            : "bg-white hover:bg-orange-50 text-orange-900 border-slate-200"
                        }`}
                        title="Cook Only"
                      >
                        Cook
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDateStatusChange(d.dateLabel, "CLEAN_ONLY")}
                        disabled={disabled}
                        className={`py-1 px-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer text-center ${
                          currentStatus === "CLEAN_ONLY"
                            ? "bg-sky-700 text-white border-sky-800 font-black shadow-2xs"
                            : "bg-white hover:bg-sky-50 text-sky-900 border-slate-200"
                        }`}
                        title="Clean Only"
                      >
                        Clean
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDateStatusChange(d.dateLabel, "UNAVAILABLE")}
                        disabled={disabled}
                        className={`py-1 px-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer text-center ${
                          currentStatus === "UNAVAILABLE"
                            ? "bg-slate-700 text-white border-slate-800 font-black shadow-2xs"
                            : "bg-white hover:bg-slate-100 text-slate-500 border-slate-200"
                        }`}
                        title="Not Available"
                      >
                        Off
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Linear List View (Collapsible on mobile) */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[380px] overflow-y-auto p-1 border border-slate-200 rounded-xl bg-slate-50/50">
            {mealDates.map((d) => {
              const currentStatus = availability[d.dateLabel] || "UNAVAILABLE";
              const isDinner = d.mealType === "DINNER";

              return (
                <div
                  key={d.dateKey || d.dateLabel}
                  className={`p-2.5 rounded-xl border transition-all ${
                    currentStatus === "AVAILABLE"
                      ? "bg-emerald-50/70 border-emerald-300"
                      : currentStatus === "COOK_ONLY"
                        ? "bg-orange-50/70 border-orange-300"
                        : currentStatus === "CLEAN_ONLY"
                          ? "bg-sky-50/70 border-sky-300"
                          : "bg-white border-slate-200 opacity-75"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-900">
                      {formatDisplayDateLabel(d.dateLabel)}
                    </span>
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        isDinner
                          ? "bg-orange-100 text-orange-900 border border-orange-300"
                          : "bg-amber-100 text-amber-900 border border-amber-300"
                      }`}
                    >
                      {d.mealType}
                    </span>
                  </div>

                  {d.specialNote && (
                    <p className="text-[11px] text-purple-700 font-semibold mb-1.5 line-clamp-1">
                      📌 {d.specialNote}
                    </p>
                  )}

                  {/* 4 Segment Status Buttons */}
                  <div className="grid grid-cols-4 gap-1 text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => handleDateStatusChange(d.dateLabel, "AVAILABLE")}
                      disabled={disabled}
                      className={`py-1 rounded-lg border transition-colors cursor-pointer ${
                        currentStatus === "AVAILABLE"
                          ? "bg-emerald-600 text-white border-emerald-700 shadow-xs"
                          : "bg-white hover:bg-emerald-50 text-emerald-800 border-slate-200"
                      }`}
                      title="Available for both Cooking and Cleaning"
                    >
                      Available
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDateStatusChange(d.dateLabel, "COOK_ONLY")}
                      disabled={disabled}
                      className={`py-1 rounded-lg border transition-colors cursor-pointer ${
                        currentStatus === "COOK_ONLY"
                          ? "bg-orange-600 text-white border-orange-700 shadow-xs"
                          : "bg-white hover:bg-orange-50 text-orange-800 border-slate-200"
                      }`}
                      title="Cook Only"
                    >
                      Cook
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDateStatusChange(d.dateLabel, "CLEAN_ONLY")}
                      disabled={disabled}
                      className={`py-1 rounded-lg border transition-colors cursor-pointer ${
                        currentStatus === "CLEAN_ONLY"
                          ? "bg-sky-600 text-white border-sky-700 shadow-xs"
                          : "bg-white hover:bg-sky-50 text-sky-800 border-slate-200"
                      }`}
                      title="Clean Only"
                    >
                      Clean
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDateStatusChange(d.dateLabel, "UNAVAILABLE")}
                      disabled={disabled}
                      className={`py-1 rounded-lg border transition-colors cursor-pointer ${
                        currentStatus === "UNAVAILABLE"
                          ? "bg-slate-700 text-white border-slate-800 shadow-xs"
                          : "bg-white hover:bg-slate-100 text-slate-600 border-slate-200"
                      }`}
                      title="Unavailable"
                    >
                      Off
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 3: Special Instructions & Notes */}
      <div>
        <label
          htmlFor="survey-form-special-instructions"
          className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1.5"
        >
          <MessageSquare className={`w-3.5 h-3.5 ${iconColorClass}`} />
          Special Instructions, Vacation Dates, or Notes:
        </label>
        <textarea
          id="survey-form-special-instructions"
          value={specialInstructions}
          onChange={(e) => setSpecialInstructions(e.target.value)}
          placeholder="e.g. Vegetarian cook; away Oct 12-16; prefer working with Jordan..."
          rows={2}
          disabled={disabled}
          className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 resize-y"
        />
      </div>
    </div>
  );
};

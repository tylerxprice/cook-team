import React, { useState, useEffect, useMemo } from "react";
import { Calendar, Plus, X, AlertCircle } from "lucide-react";
import { MealType, SurveyFormDateConfig } from "../../../server/types";
import { formatSurveyDateLabel, buildFormGridRowLabel } from "../../../server/surveyFormGenerator";

export interface AddCustomDateModalProps {
  show: boolean;
  onClose: () => void;
  onAddDate: (newDate: SurveyFormDateConfig) => void;
  monthKey: string;
  existingDates: SurveyFormDateConfig[];
}

export const AddCustomDateModal: React.FC<AddCustomDateModalProps> = ({
  show,
  onClose,
  onAddDate,
  monthKey,
  existingDates,
}) => {
  // Parse monthKey (e.g. "2026-11")
  const { year, monthNum, daysInMonth, minDate, maxDate, monthTitle } = useMemo(() => {
    const m = (monthKey || "").match(/^(\d{4})[-_](\d{1,2})$/);
    const yr = m ? parseInt(m[1], 10) : new Date().getFullYear();
    const mo = m ? parseInt(m[2], 10) : new Date().getMonth() + 1;
    const totalDays = new Date(yr, mo, 0).getDate();
    const mm = String(mo).padStart(2, "0");
    const monthNames = [
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
    return {
      year: yr,
      monthNum: mo,
      daysInMonth: totalDays,
      minDate: `${yr}-${mm}-01`,
      maxDate: `${yr}-${mm}-${String(totalDays).padStart(2, "0")}`,
      monthTitle: `${monthNames[mo - 1] || "Month"} ${yr}`,
    };
  }, [monthKey]);

  // Find first unused date in monthKey to default to
  const defaultDateKey = useMemo(() => {
    const existingSet = new Set(existingDates.map((d) => d.dateKey));
    const mm = String(monthNum).padStart(2, "0");
    for (let day = 1; day <= daysInMonth; day++) {
      const cand = `${year}-${mm}-${String(day).padStart(2, "0")}`;
      if (!existingSet.has(cand)) {
        return cand;
      }
    }
    return `${year}-${mm}-01`;
  }, [year, monthNum, daysInMonth, existingDates]);

  const [dateKey, setDateKey] = useState<string>(defaultDateKey);
  const [mealType, setMealType] = useState<MealType>("DINNER");
  const [specialNote, setSpecialNote] = useState<string>("");

  // Re-sync default date whenever modal opens or month changes
  useEffect(() => {
    if (show) {
      setDateKey(defaultDateKey);
      setMealType("DINNER");
      setSpecialNote("");
    }
  }, [show, defaultDateKey]);

  // Keyboard accessibility: Escape to close
  useEffect(() => {
    if (!show) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [show, onClose]);

  if (!show) return null;

  // Derive calculated day and label
  const { dayOfWeek, dateLabel } = formatSurveyDateLabel(dateKey, mealType);
  const candidateConfig: SurveyFormDateConfig = {
    dateKey,
    dateLabel,
    dayOfWeek,
    mealType,
    specialNote: specialNote.trim() || undefined,
    included: true,
  };
  const previewLabel = buildFormGridRowLabel(candidateConfig);

  const isDuplicate = existingDates.some((d) => d.dateKey === dateKey);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dateKey) return;
    onAddDate(candidateConfig);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-custom-date-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in"
    >
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5 animate-scale-up">
        {/* Header */}
        <div className="flex items-start justify-between gap-3.5 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-orange-100 dark:bg-orange-950/60 border border-orange-300 dark:border-orange-800 text-orange-800 dark:text-orange-300 flex items-center justify-center shrink-0 shadow-2xs">
              <Calendar className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h3
                id="add-custom-date-modal-title"
                className="text-base sm:text-lg font-bold text-slate-900 dark:text-white"
              >
                Add Custom Meal Date
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-0.5">
                Configure an additional meal date for <strong>{monthTitle}</strong>.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Date Picker & Day of Week */}
          <div className="space-y-1.5">
            <label
              htmlFor="custom-meal-date-input"
              className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
            >
              Choose Date <span className="text-orange-600 dark:text-orange-400">*</span>
            </label>
            <div className="flex items-center gap-2.5">
              <input
                id="custom-meal-date-input"
                type="date"
                required
                value={dateKey}
                onChange={(e) => setDateKey(e.target.value)}
                className="flex-1 min-h-[44px] px-3.5 py-2 text-sm font-semibold border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer shadow-2xs"
              />
              <span className="px-3.5 py-2 min-h-[44px] inline-flex items-center text-xs font-bold rounded-xl bg-orange-100 dark:bg-orange-950/60 text-orange-900 dark:text-orange-300 border border-orange-200 dark:border-orange-800 shrink-0">
                {dayOfWeek}
              </span>
            </div>
            {isDuplicate && (
              <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1.5 mt-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {dateKey} is already in the survey list. Adding will update its settings.
                </span>
              </p>
            )}
          </div>

          {/* Meal Type Radio Selection */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Meal Type
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setMealType("DINNER")}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  mealType === "DINNER"
                    ? "bg-orange-50 dark:bg-orange-950/40 border-orange-500 dark:border-orange-600 ring-2 ring-orange-500/20 text-orange-950 dark:text-orange-100"
                    : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-sm">Dinner</span>
                  <span className="text-base">🍳</span>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Evening meal (3 cooks &amp; 3 cleaners)
                </span>
              </button>

              <button
                type="button"
                onClick={() => setMealType("BRUNCH")}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  mealType === "BRUNCH"
                    ? "bg-orange-50 dark:bg-orange-950/40 border-orange-500 dark:border-orange-600 ring-2 ring-orange-500/20 text-orange-950 dark:text-orange-100"
                    : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-sm">Brunch</span>
                  <span className="text-base">🥞</span>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Weekend brunch (2 cooks &amp; 2 cleaners)
                </span>
              </button>
            </div>
          </div>

          {/* Special Event / Note Field */}
          <div className="space-y-1.5">
            <label
              htmlFor="custom-meal-note-input"
              className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
            >
              Special Event or Note <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              id="custom-meal-note-input"
              type="text"
              value={specialNote}
              onChange={(e) => setSpecialNote(e.target.value)}
              placeholder="e.g. Thanksgiving, Community Meeting, Potluck"
              className="w-full min-h-[44px] px-3.5 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 shadow-2xs"
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Appended to the date option in the survey form grid.
            </p>
          </div>

          {/* Form Row Label Live Preview */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider">
              <span>Google Form Row Label Preview</span>
              <span className="text-emerald-700 dark:text-emerald-400 font-bold">Live Preview</span>
            </div>
            <div className="text-sm font-black text-slate-900 dark:text-white bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 truncate shadow-2xs">
              {previewLabel}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[42px] px-4 py-2 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={!dateKey}
              className="min-h-[42px] px-5 py-2 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 rounded-xl shadow-xs hover:shadow transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>{isDuplicate ? "Update Meal Date" : "Add Meal Date"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

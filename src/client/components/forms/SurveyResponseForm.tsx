import React from "react";
import {
  Utensils,
  Calendar,
  MessageSquare,
} from "lucide-react";
import { MealDate, AvailabilityStatus } from "../../../server/types";
import { formatDisplayDateLabel } from "../../utils/formatters";

export interface SurveyResponseFormProps {
  mealDates: MealDate[];
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
            <label htmlFor="survey-form-cook-quota" className="text-xs font-bold text-slate-700 block mb-1">
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
            <label htmlFor="survey-form-clean-quota" className="text-xs font-bold text-slate-700 block mb-1">
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
            <label htmlFor="survey-form-max-shifts-cap" className="text-xs font-bold text-slate-700 block mb-1 flex items-center justify-between">
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
            <label htmlFor="survey-form-cook-team-sizing" className="text-xs font-bold text-slate-700 block mb-1">
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
            <label htmlFor="survey-form-same-day-pref" className="text-xs font-bold text-slate-700 block mb-1">
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
              <Calendar className={`w-4 h-4 ${iconColorClass}`} />
              Monthly Meal Availability ({mealDates.length} Dates)
            </h4>
            <p className="text-xs text-slate-600">
              Select which dates and roles the member is available for:
            </p>
          </div>

          {/* Quick Bulk Actions */}
          <div className="flex flex-wrap items-center gap-1.5">
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
        </div>

        {mealDates.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-300 rounded-xl">
            No meal dates loaded in current survey sheet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[360px] overflow-y-auto p-1 border border-slate-200 rounded-xl bg-slate-50/50">
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
                      : "bg-white border-slate-200 opacity-65"
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
        <label htmlFor="survey-form-special-instructions" className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1.5">
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

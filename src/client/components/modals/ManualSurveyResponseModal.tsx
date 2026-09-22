import React, { useState, useEffect } from "react";
import {
  ClipboardEdit,
  X,
  User,
  Mail,
  Calendar,
  Utensils,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import {
  IntakePayload,
  Member,
  MealDate,
  AvailabilityStatus,
  ManualSurveyResponsePayload,
} from "../../../server/types";
import { formatDisplayDateLabel } from "../../utils/formatters";

export interface ManualSurveyResponseModalProps {
  isOpen: boolean;
  onClose: () => void;
  intakeData: IntakePayload | null;
  members: Member[];
  initialMemberName?: string | null;
  onSubmit: (payload: ManualSurveyResponsePayload) => Promise<void>;
  loading?: boolean;
}

export const ManualSurveyResponseModal: React.FC<ManualSurveyResponseModalProps> = ({
  isOpen,
  onClose,
  intakeData,
  members,
  initialMemberName,
  onSubmit,
  loading = false,
}) => {
  const [selectedMemberName, setSelectedMemberName] = useState<string>("");
  const [customName, setCustomName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [cookQuota, setCookQuota] = useState<number>(1);
  const [cleanQuota, setCleanQuota] = useState<number>(1);
  const [maxTotalShifts, setMaxTotalShifts] = useState<number>(2);
  const [cookTeamSizePref, setCookTeamSizePref] = useState<string>("Dinner = 3, Brunch = 2");
  const [sameDayPref, setSameDayPref] = useState<"NO" | "YES" | "PREFERRED">("NO");
  const [availability, setAvailability] = useState<Record<string, AvailabilityStatus>>({});
  const [specialInstructions, setSpecialInstructions] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mealDates: MealDate[] = intakeData?.mealDates || [];

  const populateFormForMember = (targetName: string) => {
    setSelectedMemberName(targetName);
    if (targetName === "custom" || !targetName) {
      setCustomName("");
      setEmail("");
      setCookQuota(1);
      setCleanQuota(1);
      setMaxTotalShifts(2);
      setCookTeamSizePref("Dinner = 3, Brunch = 2");
      setSameDayPref("NO");
      setSpecialInstructions("");
      const initAvail: Record<string, AvailabilityStatus> = {};
      for (const d of mealDates) {
        initAvail[d.dateLabel] = "UNAVAILABLE";
      }
      setAvailability(initAvail);
      return;
    }

    setCustomName("");
    const matchedMember = members.find(
      (m) => m.name.toLowerCase() === targetName.toLowerCase()
    );
    const existingResp = intakeData?.responses?.find(
      (r) => r.name.toLowerCase() === targetName.toLowerCase()
    );

    if (existingResp) {
      const respEmail =
        existingResp.email ||
        (matchedMember?.google_email ? matchedMember.google_email.split(/[,;]/)[0].trim() : "");
      const cq = typeof existingResp.cookQuota === "number" ? existingResp.cookQuota : 1;
      const clq = typeof existingResp.cleanQuota === "number" ? existingResp.cleanQuota : 1;
      const mq =
        typeof existingResp.maxTotalShifts === "number" && existingResp.maxTotalShifts > 0
          ? existingResp.maxTotalShifts
          : cq + clq;

      setEmail(respEmail);
      setCookQuota(cq);
      setCleanQuota(clq);
      setMaxTotalShifts(mq);
      setCookTeamSizePref(existingResp.cookTeamSizePref || "Dinner = 3, Brunch = 2");
      setSameDayPref(
        existingResp.sameDayPref || (existingResp.canCookCleanSameDay ? "YES" : "NO")
      );
      setSpecialInstructions(existingResp.specialInstructions || "");
      const initAvail: Record<string, AvailabilityStatus> = {};
      for (const d of mealDates) {
        initAvail[d.dateLabel] = existingResp.availability?.[d.dateLabel] || "UNAVAILABLE";
      }
      setAvailability(initAvail);
    } else {
      const primaryEmail = matchedMember?.google_email
        ? matchedMember.google_email.split(/[,;]/)[0].trim()
        : "";
      setEmail(primaryEmail);
      setCookQuota(1);
      setCleanQuota(1);
      setMaxTotalShifts(2);
      setCookTeamSizePref("Dinner = 3, Brunch = 2");
      setSameDayPref("NO");
      setSpecialInstructions("");
      const initAvail: Record<string, AvailabilityStatus> = {};
      for (const d of mealDates) {
        initAvail[d.dateLabel] = "UNAVAILABLE";
      }
      setAvailability(initAvail);
    }
  };

  // Initialize or reset form state whenever modal opens or initialMemberName changes
  useEffect(() => {
    if (!isOpen) {
      setErrorMessage(null);
      return;
    }

    populateFormForMember(initialMemberName || "");
    setErrorMessage(null);
  }, [isOpen, initialMemberName, members, intakeData]);

  if (!isOpen) return null;

  const handleMemberSelect = (name: string) => {
    populateFormForMember(name);
  };

  const handleSetAllAvailability = (status: AvailabilityStatus, filterType?: "DINNER" | "BRUNCH") => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const effectiveName = selectedMemberName === "custom" ? customName.trim() : selectedMemberName.trim();
    if (!effectiveName) {
      setErrorMessage("Please select a community member or enter a name.");
      return;
    }

    const payload: ManualSurveyResponsePayload = {
      memberName: effectiveName,
      email: email.trim(),
      cookQuota: Math.max(0, cookQuota),
      cleanQuota: Math.max(0, cleanQuota),
      maxTotalShifts: Math.max(0, maxTotalShifts),
      cookTeamSizePref,
      sameDayPref,
      availability,
      specialInstructions: specialInstructions.trim(),
    };

    try {
      await onSubmit(payload);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to save response.");
    }
  };

  const isEditingExisting = Boolean(
    intakeData?.responses?.some(
      (r) =>
        r.name.toLowerCase() ===
        (selectedMemberName === "custom" ? customName : selectedMemberName).trim().toLowerCase()
    )
  );

  // Missing members list from audit for prioritizing at top of dropdown
  const missingMemberNames = new Set(
    (intakeData?.audit?.missingMembers || []).map((m) => m.name.toLowerCase())
  );
  const submittedMemberNames = new Set(
    (intakeData?.responses || []).map((r) => r.name.toLowerCase())
  );

  const missingList = members.filter((m) => missingMemberNames.has(m.name.toLowerCase()));
  const submittedList = (intakeData?.responses || [])
    .map((r) => r.name)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  const otherMembersList = members.filter(
    (m) => !missingMemberNames.has(m.name.toLowerCase()) && !submittedMemberNames.has(m.name.toLowerCase())
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-survey-modal-title"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
    >
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
              isEditingExisting
                ? "bg-blue-100 text-blue-800 border-blue-200"
                : "bg-orange-100 text-orange-800 border-orange-200"
            }`}>
              <ClipboardEdit className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="manual-survey-modal-title" className="text-base sm:text-lg font-bold text-slate-900">
                  {isEditingExisting ? `Modify Survey Response` : `Enter Availability Survey for Member`}
                </h3>
                {isEditingExisting && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-900 border border-blue-300">
                    Existing Response
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                {isEditingExisting
                  ? `Update submitted quotas, dates, or notes for ${selectedMemberName || "this resident"}`
                  : `Record survey responses on behalf of a resident (via phone, text, or email)`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-6">
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs sm:text-sm text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Section 1: Member Selection & Contact */}
          <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-3.5">
            <h4 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
              <User className="w-4 h-4 text-orange-600" />
              Community Member Info
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Select Member: *
                </label>
                <select
                  value={selectedMemberName}
                  onChange={(e) => handleMemberSelect(e.target.value)}
                  disabled={loading}
                  className="w-full min-h-[42px] px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 font-medium text-slate-900 cursor-pointer"
                  required
                >
                  <option value="" disabled>
                    -- Choose a Member --
                  </option>
                  {submittedList.length > 0 && (
                    <optgroup label="✅ Submitted Respondents (Edit Response)">
                      {submittedList.map((name) => (
                        <option key={name} value={name}>
                          {name} (Submitted)
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {missingList.length > 0 && (
                    <optgroup label="⚠️ Missing Active Members (Need Survey)">
                      {missingList.map((m) => (
                        <option key={m.name} value={m.name}>
                          {m.name} (Missing)
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {otherMembersList.length > 0 && (
                    <optgroup label="👥 Other Registered Members">
                      {otherMembersList.map((m) => (
                        <option key={m.name} value={m.name}>
                          {m.name} {m.active ? "" : "(Inactive)"}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="✏️ Custom / New Person">
                    <option value="custom">+ Other / Non-Registry Resident...</option>
                  </optgroup>
                </select>
              </div>

              {selectedMemberName === "custom" && (
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Resident Full Name: *
                  </label>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="e.g. Robin Banks"
                    disabled={loading}
                    className="w-full min-h-[42px] px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    required
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-500" />
                  Email Address:
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="resident@example.com (optional)"
                  disabled={loading}
                  className="w-full min-h-[42px] px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Quotas & Sizing Preferences */}
          <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-3.5">
            <h4 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
              <Utensils className="w-4 h-4 text-orange-600" />
              Requested Shifts &amp; Preferences
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {/* Cook Quota */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Cook Quota (Shifts):
                </label>
                <select
                  value={cookQuota}
                  onChange={(e) => {
                    const nextCook = parseInt(e.target.value, 10);
                    setCookQuota(nextCook);
                    // If max total was tracking the sum, update it
                    if (maxTotalShifts === cookQuota + cleanQuota) {
                      setMaxTotalShifts(nextCook + cleanQuota);
                    }
                  }}
                  disabled={loading}
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
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Clean Quota (Shifts):
                </label>
                <select
                  value={cleanQuota}
                  onChange={(e) => {
                    const nextClean = parseInt(e.target.value, 10);
                    setCleanQuota(nextClean);
                    if (maxTotalShifts === cookQuota + cleanQuota) {
                      setMaxTotalShifts(cookQuota + nextClean);
                    }
                  }}
                  disabled={loading}
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
                <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center justify-between">
                  <span>Max Total Shifts (Cap):</span>
                  {maxTotalShifts < cookQuota + cleanQuota && (
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                      Capped
                    </span>
                  )}
                </label>
                <select
                  value={maxTotalShifts}
                  onChange={(e) => setMaxTotalShifts(parseInt(e.target.value, 10))}
                  disabled={loading}
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
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Cook Team Sizing:
                </label>
                <select
                  value={cookTeamSizePref}
                  onChange={(e) => setCookTeamSizePref(e.target.value)}
                  disabled={loading}
                  className="w-full min-h-[42px] px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 font-medium text-slate-900 cursor-pointer"
                >
                  <option value="Dinner = 3, Brunch = 2">Dinner = 3, Brunch = 2</option>
                  <option value="2 for either">2 for either (Accept 2 cooks)</option>
                  <option value="2 regardless of meal type">2 regardless of meal type</option>
                </select>
              </div>

              {/* Same-Day Shifts */}
              <div className="sm:col-span-2 lg:col-span-2">
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Same-Day Cook &amp; Clean:
                </label>
                <select
                  value={sameDayPref}
                  onChange={(e) => setSameDayPref(e.target.value as any)}
                  disabled={loading}
                  className="w-full min-h-[42px] px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 font-medium text-slate-900 cursor-pointer"
                >
                  <option value="NO">No (Separate days only)</option>
                  <option value="YES">Yes (Willing on same day)</option>
                  <option value="PREFERRED">Preferred (Prefers same day)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Meal Dates Availability Grid */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-orange-600" />
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
                  className="px-2.5 py-1 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors cursor-pointer"
                >
                  All Available
                </button>
                <button
                  type="button"
                  onClick={() => handleSetAllAvailability("AVAILABLE", "DINNER")}
                  className="px-2.5 py-1 text-xs font-bold text-orange-800 bg-orange-50 hover:bg-orange-100 border border-orange-300 rounded-lg transition-colors cursor-pointer"
                >
                  Dinners Only
                </button>
                <button
                  type="button"
                  onClick={() => handleSetAllAvailability("AVAILABLE", "BRUNCH")}
                  className="px-2.5 py-1 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg transition-colors cursor-pointer"
                >
                  Brunches Only
                </button>
                <button
                  type="button"
                  onClick={() => handleSetAllAvailability("UNAVAILABLE")}
                  className="px-2.5 py-1 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors cursor-pointer"
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[320px] overflow-y-auto p-1 border border-slate-200 rounded-xl bg-slate-50/50">
                {mealDates.map((d) => {
                  const currentStatus = availability[d.dateLabel] || "UNAVAILABLE";
                  const isDinner = d.mealType === "DINNER";

                  return (
                    <div
                      key={d.id}
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

          {/* Section 4: Special Instructions & Notes */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Special Instructions, Vacation Dates, or Notes:
            </label>
            <textarea
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              placeholder="e.g. Vegetarian cook; away Oct 12-16; prefer working with Jordan..."
              rows={2}
              disabled={loading}
              className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            />
          </div>
        </form>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-200 flex items-center justify-between bg-slate-50/80">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="min-h-[44px] px-4 py-2 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-200/70 rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || (!selectedMemberName && !customName)}
            className={`min-h-[44px] inline-flex items-center gap-2 px-6 py-2.5 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-colors cursor-pointer ${
              isEditingExisting
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-orange-600 hover:bg-orange-700"
            }`}
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Saving Response...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>{isEditingExisting ? "Update Survey Response" : "Save Availability Response"}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

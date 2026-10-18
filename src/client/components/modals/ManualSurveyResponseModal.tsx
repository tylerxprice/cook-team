import React, { useState, useEffect } from "react";
import {
  ClipboardEdit,
  X,
  User,
  Mail,
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
import { SurveyResponseForm } from "../forms/SurveyResponseForm";

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

          {/* Shared Availability and Preferences Controls */}
          <SurveyResponseForm
            mealDates={mealDates}
            cookQuota={cookQuota}
            setCookQuota={setCookQuota}
            cleanQuota={cleanQuota}
            setCleanQuota={setCleanQuota}
            maxTotalShifts={maxTotalShifts}
            setMaxTotalShifts={setMaxTotalShifts}
            cookTeamSizePref={cookTeamSizePref}
            setCookTeamSizePref={setCookTeamSizePref}
            sameDayPref={sameDayPref}
            setSameDayPref={setSameDayPref}
            availability={availability}
            setAvailability={setAvailability}
            specialInstructions={specialInstructions}
            setSpecialInstructions={setSpecialInstructions}
            disabled={loading}
            accentColor="orange"
          />
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

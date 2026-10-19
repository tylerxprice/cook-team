import React, { useState, useEffect, useMemo } from "react";
import { X, ShieldCheck, Search, Check, AlertCircle, Plus } from "lucide-react";
import { Member, TargetRole, ExceptionRule } from "../../../server/types";

export interface WhitelistRuleModalProps {
  show: boolean;
  onClose: () => void;
  ruleToEdit?: ExceptionRule | null;
  members: Member[];
  onSaveRule: (rule: ExceptionRule) => Promise<void>;
  preselectedMemberName?: string;
}

export const WhitelistRuleModal: React.FC<WhitelistRuleModalProps> = ({
  show,
  onClose,
  ruleToEdit,
  members,
  onSaveRule,
  preselectedMemberName,
}) => {
  const [personA, setPersonA] = useState<string>("");
  const [roleScope, setRoleScope] = useState<TargetRole>("ANY");
  const [selectedMentors, setSelectedMentors] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isHardRule, setIsHardRule] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Initialize or reset form when modal opens or ruleToEdit changes
  useEffect(() => {
    if (!show) return;

    if (ruleToEdit) {
      setPersonA(ruleToEdit.person_a || "");
      setRoleScope((ruleToEdit.target_role_a as TargetRole) || "ANY");
      const parsedMentors = (ruleToEdit.person_b || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      setSelectedMentors(parsedMentors);
      setIsHardRule(ruleToEdit.is_hard_rule ?? true);
      setNotes(
        ruleToEdit.notes ||
          "Youth mentor whitelist (must pair with at least one approved co-worker)"
      );
    } else {
      setPersonA(preselectedMemberName || "");
      setRoleScope("ANY");
      setSelectedMentors([]);
      setIsHardRule(true);
      setNotes("Youth mentor whitelist (must pair with at least one approved co-worker)");
    }
    setSearchQuery("");
    setErrorMessage(null);
    setIsSaving(false);
  }, [show, ruleToEdit, preselectedMemberName]);

  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );
  }, [members]);

  const availableMentorOptions = useMemo(() => {
    return sortedMembers.filter((m) => m.name.toLowerCase() !== personA.toLowerCase());
  }, [sortedMembers, personA]);

  const filteredMentors = useMemo(() => {
    if (!searchQuery.trim()) return availableMentorOptions;
    const q = searchQuery.toLowerCase().trim();
    return availableMentorOptions.filter((m) => m.name.toLowerCase().includes(q));
  }, [availableMentorOptions, searchQuery]);

  const handleToggleMentor = (mentorName: string) => {
    setSelectedMentors((prev) => {
      const exists = prev.some((m) => m.toLowerCase() === mentorName.toLowerCase());
      if (exists) {
        return prev.filter((m) => m.toLowerCase() !== mentorName.toLowerCase());
      } else {
        return [...prev, mentorName];
      }
    });
  };

  const handleRemoveMentor = (mentorName: string) => {
    setSelectedMentors((prev) => prev.filter((m) => m.toLowerCase() !== mentorName.toLowerCase()));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personA.trim()) {
      setErrorMessage("Please select the youth / resident (Person A).");
      return;
    }
    if (selectedMentors.length === 0) {
      setErrorMessage("Please select at least one approved co-worker / mentor.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const rule: ExceptionRule = {
        id: ruleToEdit?.id || `RULE-${Date.now().toString().slice(-4)}`,
        person_a: personA.trim(),
        person_b: selectedMentors.join(", "),
        rule_type: "REQUIRE_ONE_OF_TEAM",
        target_role_a: roleScope,
        target_role_b: roleScope,
        is_hard_rule: isHardRule,
        notes: notes.trim(),
      };

      await onSaveRule(rule);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to save mentor whitelist rule");
    } finally {
      setIsSaving(false);
    }
  };

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title-whitelist"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
    >
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl flex flex-col max-h-[92vh] border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-purple-50 via-indigo-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 border border-purple-200 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3
                id="modal-title-whitelist"
                className="text-base sm:text-lg font-black text-slate-900"
              >
                {ruleToEdit ? "Edit Mentor Whitelist Rule" : "Configure Mentor Whitelist Rule"}
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Ensure this resident is always paired with at least one approved mentor on their
                team.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs sm:text-sm text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Person A & Role Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label
                htmlFor="whitelist-person-a"
                className="text-xs font-bold text-slate-800 block mb-1"
              >
                Youth / Resident (Person A): *
              </label>
              <select
                id="whitelist-person-a"
                value={personA}
                onChange={(e) => {
                  const newA = e.target.value;
                  setPersonA(newA);
                  // Remove from selected mentors if they were selected
                  setSelectedMentors((prev) =>
                    prev.filter((m) => m.toLowerCase() !== newA.toLowerCase())
                  );
                }}
                className="w-full min-h-[42px] px-3.5 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 bg-white text-slate-900 font-medium"
                required
              >
                <option value="">Select Resident...</option>
                {sortedMembers.map((m) => (
                  <option key={m.name} value={m.name}>
                    {m.name} {!m.active ? "(Inactive)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-800 block mb-1">
                Applies to Team:
              </label>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setRoleScope("ANY")}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${
                    roleScope === "ANY"
                      ? "bg-white text-purple-900 shadow-2xs font-black"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Both
                </button>
                <button
                  type="button"
                  onClick={() => setRoleScope("COOK")}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${
                    roleScope === "COOK"
                      ? "bg-white text-purple-900 shadow-2xs font-black"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Cooks
                </button>
                <button
                  type="button"
                  onClick={() => setRoleScope("CLEAN")}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${
                    roleScope === "CLEAN"
                      ? "bg-white text-purple-900 shadow-2xs font-black"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Cleans
                </button>
              </div>
            </div>
          </div>

          {/* Approved Mentors Multi-Select */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span>Approved Co-Workers / Mentors (Whitelist Pool): *</span>
                <span className="text-purple-700 font-extrabold bg-purple-100 px-2 py-0.5 rounded-full text-[11px]">
                  {selectedMentors.length} selected
                </span>
              </label>
              {selectedMentors.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedMentors([])}
                  className="text-xs text-slate-500 hover:text-rose-600 font-medium cursor-pointer"
                >
                  Clear all
                </button>
              )}
            </div>

            {/* Selected Mentors Pill Tray */}
            {selectedMentors.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 p-2.5 bg-purple-50/70 border border-purple-200 rounded-xl min-h-[46px] items-center">
                {selectedMentors.map((name) => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-purple-300 text-purple-950 font-bold text-xs shadow-2xs"
                  >
                    <span>✓ {name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveMentor(name)}
                      className="text-purple-400 hover:text-rose-600 transition-colors cursor-pointer"
                      title={`Remove ${name}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 italic text-center">
                No mentors selected yet. Choose at least one co-worker below who works well with{" "}
                {personA || "this resident"}.
              </div>
            )}

            {/* Mentor Search & Selection Grid */}
            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter community members..."
                  className="w-full min-h-[38px] pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-[180px] overflow-y-auto p-1">
                {filteredMentors.map((m) => {
                  const isSelected = selectedMentors.some(
                    (name) => name.toLowerCase() === m.name.toLowerCase()
                  );
                  return (
                    <button
                      key={m.name}
                      type="button"
                      onClick={() => handleToggleMentor(m.name)}
                      className={`text-left px-2.5 py-2 rounded-xl text-xs font-bold border transition-all truncate flex items-center justify-between gap-1 cursor-pointer ${
                        isSelected
                          ? "bg-purple-700 text-white border-purple-800 shadow-2xs"
                          : "bg-white hover:bg-purple-50 text-slate-800 border-slate-200"
                      }`}
                    >
                      <span className="truncate">{m.name}</span>
                      {isSelected ? (
                        <Check className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <Plus className="w-3.5 h-3.5 text-slate-400 shrink-0 opacity-0 group-hover:opacity-100" />
                      )}
                    </button>
                  );
                })}
                {filteredMentors.length === 0 && (
                  <p className="text-xs text-slate-500 italic col-span-3 text-center py-2">
                    No members match "{searchQuery}"
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Strictness */}
          <div>
            <span className="text-xs font-bold text-slate-800 block mb-1.5">
              Constraint Strictness:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <label
                className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                  isHardRule
                    ? "bg-purple-50/80 border-purple-300 text-purple-950 font-bold"
                    : "bg-slate-50 border-slate-200 text-slate-700 font-medium"
                }`}
              >
                <input
                  type="radio"
                  name="whitelist_strictness"
                  checked={isHardRule}
                  onChange={() => setIsHardRule(true)}
                  className="w-4 h-4 text-purple-600 focus:ring-purple-500 mt-0.5"
                />
                <div className="text-xs">
                  <span className="block font-bold">Hard Rule (Strictly enforced)</span>
                  <span className="text-[11px] text-slate-500 block font-normal mt-0.5">
                    The solver will NEVER schedule {personA || "this resident"} without an approved
                    mentor.
                  </span>
                </div>
              </label>

              <label
                className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                  !isHardRule
                    ? "bg-purple-50/80 border-purple-300 text-purple-950 font-bold"
                    : "bg-slate-50 border-slate-200 text-slate-700 font-medium"
                }`}
              >
                <input
                  type="radio"
                  name="whitelist_strictness"
                  checked={!isHardRule}
                  onChange={() => setIsHardRule(false)}
                  className="w-4 h-4 text-purple-600 focus:ring-purple-500 mt-0.5"
                />
                <div className="text-xs">
                  <span className="block font-bold">Soft Preference (Best effort)</span>
                  <span className="text-[11px] text-slate-500 block font-normal mt-0.5">
                    Prioritizes pairing with a mentor when available, but permits other co-workers
                    if tight.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Rationale / Notes */}
          <div>
            <label
              htmlFor="whitelist-notes-input"
              className="text-xs font-bold text-slate-800 block mb-1"
            >
              Rationale / Notes:
            </label>
            <input
              id="whitelist-notes-input"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Youth mentor whitelist (must pair with at least one approved mentor)"
              className="w-full min-h-[40px] px-3.5 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 bg-white text-slate-900 font-medium"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="min-h-[44px] px-4 py-2 text-xs sm:text-sm font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving || !personA.trim() || selectedMentors.length === 0}
            className="min-h-[44px] px-6 py-2 bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>
              {isSaving
                ? "Saving..."
                : ruleToEdit
                  ? "Update Whitelist Rule"
                  : "Save Whitelist Rule"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

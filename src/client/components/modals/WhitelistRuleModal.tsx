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
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full shadow-2xl flex flex-col max-h-[92vh] border border-slate-200 dark:border-slate-800 overflow-hidden text-slate-900 dark:text-slate-100">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-orange-50 via-amber-50 to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3
                id="modal-title-whitelist"
                className="text-base sm:text-lg font-black text-slate-900 dark:text-white"
              >
                {ruleToEdit ? "Edit Mentor Whitelist Rule" : "Configure Mentor Whitelist Rule"}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Ensure this resident is always paired with at least one approved mentor on their
                team.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs sm:text-sm text-rose-800 dark:text-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Person A & Role Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label
                htmlFor="whitelist-person-a"
                className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1"
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
                className="w-full min-h-[42px] px-3.5 py-2 text-xs sm:text-sm border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
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
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
                Applies to Team:
              </label>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setRoleScope("ANY")}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${
                    roleScope === "ANY"
                      ? "bg-white dark:bg-slate-700 text-orange-950 dark:text-white shadow-2xs font-black"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  Both
                </button>
                <button
                  type="button"
                  onClick={() => setRoleScope("COOK")}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${
                    roleScope === "COOK"
                      ? "bg-white dark:bg-slate-700 text-orange-950 dark:text-white shadow-2xs font-black"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  Cooks
                </button>
                <button
                  type="button"
                  onClick={() => setRoleScope("CLEAN")}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${
                    roleScope === "CLEAN"
                      ? "bg-white dark:bg-slate-700 text-orange-950 dark:text-white shadow-2xs font-black"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
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
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <span>Approved Co-Workers / Mentors (Whitelist Pool): *</span>
                <span className="text-orange-700 dark:text-orange-300 font-extrabold bg-orange-100 dark:bg-orange-950/60 px-2 py-0.5 rounded-full text-[11px]">
                  {selectedMentors.length} selected
                </span>
              </label>
              {selectedMentors.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedMentors([])}
                  className="text-xs text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 font-medium cursor-pointer"
                >
                  Clear all
                </button>
              )}
            </div>

            {/* Selected Mentors Pill Tray */}
            {selectedMentors.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 p-2.5 bg-orange-50/70 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-xl min-h-[46px] items-center">
                {selectedMentors.map((name) => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-orange-300 dark:border-orange-700 text-orange-950 dark:text-orange-200 font-bold text-xs shadow-2xs"
                  >
                    <span>✓ {name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveMentor(name)}
                      className="text-orange-400 dark:text-orange-300 hover:text-rose-600 transition-colors cursor-pointer"
                      title={`Remove ${name}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-500 dark:text-slate-400 italic text-center">
                No mentors selected yet. Choose at least one co-worker below who works well with{" "}
                {personA || "this resident"}.
              </div>
            )}

            {/* Mentor Search & Selection Grid */}
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-800/40 space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter community members..."
                  className="w-full min-h-[42px] pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 text-slate-900 dark:text-white"
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
                          ? "bg-orange-600 text-white border-orange-700 shadow-2xs"
                          : "bg-white dark:bg-slate-800 hover:bg-orange-50 dark:hover:bg-orange-950/40 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700"
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
                  <p className="text-xs text-slate-500 dark:text-slate-400 italic col-span-3 text-center py-2">
                    No members match "{searchQuery}"
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Strictness */}
          <div>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1.5">
              Constraint Strictness:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <label
                className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                  isHardRule
                    ? "bg-orange-50/80 dark:bg-orange-950/40 border-orange-300 dark:border-orange-800 text-orange-950 dark:text-orange-200 font-bold"
                    : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium"
                }`}
              >
                <input
                  type="radio"
                  name="whitelist_strictness"
                  checked={isHardRule}
                  onChange={() => setIsHardRule(true)}
                  className="w-4 h-4 text-orange-600 focus:ring-orange-500 mt-0.5"
                />
                <div className="text-xs">
                  <span className="block font-bold">Hard Rule (Strictly enforced)</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-normal mt-0.5">
                    The solver will NEVER schedule {personA || "this resident"} without an approved
                    mentor.
                  </span>
                </div>
              </label>

              <label
                className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                  !isHardRule
                    ? "bg-orange-50/80 dark:bg-orange-950/40 border-orange-300 dark:border-orange-800 text-orange-950 dark:text-orange-200 font-bold"
                    : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium"
                }`}
              >
                <input
                  type="radio"
                  name="whitelist_strictness"
                  checked={!isHardRule}
                  onChange={() => setIsHardRule(false)}
                  className="w-4 h-4 text-orange-600 focus:ring-orange-500 mt-0.5"
                />
                <div className="text-xs">
                  <span className="block font-bold">Soft Preference (Best effort)</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-normal mt-0.5">
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
              className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1"
            >
              Rationale / Notes:
            </label>
            <input
              id="whitelist-notes-input"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Youth mentor whitelist (must pair with at least one approved mentor)"
              className="w-full min-h-[42px] px-3.5 py-2 text-xs sm:text-sm border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="min-h-[44px] px-4 py-2 text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving || !personA.trim() || selectedMentors.length === 0}
            className="min-h-[44px] px-6 py-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
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

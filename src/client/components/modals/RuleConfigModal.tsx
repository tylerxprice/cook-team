import React from "react";
import { X, MessageSquare } from "lucide-react";
import { Member, RuleType, ExceptionRule } from "../../../server/types";

export interface RuleConfigModalProps {
  show: boolean;
  onClose: () => void;
  newRule: Partial<ExceptionRule>;
  setNewRule: React.Dispatch<React.SetStateAction<Partial<ExceptionRule>>>;
  modalContextNote: string | null;
  members: Member[];
  handleSaveRule: (e: React.FormEvent) => void;
}

export const RuleConfigModal: React.FC<RuleConfigModalProps> = ({
  show,
  onClose,
  newRule,
  setNewRule,
  modalContextNote,
  members,
  handleSaveRule,
}) => {
  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title-rule"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl p-6 space-y-4 border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h3 id="modal-title-rule" className="text-base sm:text-lg font-bold text-slate-900">
            {newRule.id ? "Edit Exception Rule" : "Add Exception Rule"}
          </h3>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Display Special Note Context if available */}
        {modalContextNote && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-start gap-2.5">
            <MessageSquare className="w-4 h-4 text-amber-800 mt-0.5 shrink-0" />
            <div>
              <span className="text-xs font-bold text-amber-950">
                Survey Request from {newRule.person_a}:
              </span>
              <p className="text-xs text-amber-900 mt-0.5 font-medium italic">
                &quot;{modalContextNote}&quot;
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSaveRule} className="space-y-4">
          <div>
            <label
              htmlFor="rule-type-select"
              className="text-xs font-bold text-slate-800 block mb-1"
            >
              Rule Type
            </label>
            <select
              id="rule-type-select"
              value={newRule.rule_type}
              onChange={(e) => setNewRule({ ...newRule, rule_type: e.target.value as RuleType })}
              className="w-full min-h-[44px] px-3.5 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white text-slate-900 font-medium"
            >
              <option value="NOT_SAME_TEAM">NOT_SAME_TEAM (Cannot be in same team)</option>
              <option value="NOT_SAME_DAY">NOT_SAME_DAY (Cannot be scheduled on same date)</option>
              <option value="SAME_DAY_DIFF_TEAM">
                SAME_DAY_DIFF_TEAM (Same date, different team)
              </option>
              <option value="PAIR_WITH_ROLE">PAIR_WITH_ROLE (Assign together for role)</option>
              <option value="PREF_SAME_DAY">
                PREF_SAME_DAY (Allow Cook &amp; Clean on same date)
              </option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="person-a-select"
                className="text-xs font-bold text-slate-800 block mb-1"
              >
                Person A
              </label>
              <select
                id="person-a-select"
                value={newRule.person_a}
                onChange={(e) => setNewRule({ ...newRule, person_a: e.target.value })}
                className="w-full min-h-[44px] px-3.5 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white text-slate-900 font-medium"
              >
                <option value="">Select Member...</option>
                {[...members]
                  .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
                  .map((m) => (
                    <option key={m.name} value={m.name}>
                      {m.name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="person-b-select"
                className="text-xs font-bold text-slate-800 block mb-1"
              >
                Person B (Optional)
              </label>
              <select
                id="person-b-select"
                value={newRule.person_b || ""}
                onChange={(e) => setNewRule({ ...newRule, person_b: e.target.value })}
                className="w-full min-h-[44px] px-3.5 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white text-slate-900 font-medium"
              >
                <option value="">Select Member (if paired)...</option>
                {[...members]
                  .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
                  .map((m) => (
                    <option key={m.name} value={m.name}>
                      {m.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div>
            <span className="text-xs font-bold text-slate-800 block mb-1.5">
              Constraint Strictness
            </span>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 min-h-[44px] px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 cursor-pointer">
                <input
                  type="radio"
                  name="strictness"
                  checked={newRule.is_hard_rule === true}
                  onChange={() => setNewRule({ ...newRule, is_hard_rule: true })}
                  className="w-4 h-4 text-orange-600 focus:ring-orange-500"
                />
                Hard Rule (Strictly enforced)
              </label>
              <label className="flex items-center gap-2 min-h-[44px] px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 cursor-pointer">
                <input
                  type="radio"
                  name="strictness"
                  checked={newRule.is_hard_rule === false}
                  onChange={() => setNewRule({ ...newRule, is_hard_rule: false })}
                  className="w-4 h-4 text-orange-600 focus:ring-orange-500"
                />
                Soft Preference (Best effort)
              </label>
            </div>
          </div>

          <div>
            <label
              htmlFor="rule-notes-input"
              className="text-xs font-bold text-slate-800 block mb-1"
            >
              Rationale / Notes
            </label>
            <input
              id="rule-notes-input"
              type="text"
              value={newRule.notes || ""}
              onChange={(e) => setNewRule({ ...newRule, notes: e.target.value })}
              placeholder="e.g. Roommates, Childcare conflict..."
              className="w-full min-h-[44px] px-3.5 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white text-slate-900 font-medium"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 text-xs sm:text-sm font-bold text-slate-700 hover:text-slate-950 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-[44px] px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-colors cursor-pointer"
            >
              {newRule.id ? "Update Rule" : "Save Rule"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

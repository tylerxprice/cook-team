import React from "react";
import { Plus, MessageSquare, Pencil, Trash2, Sparkles, RefreshCw } from "lucide-react";
import { ExceptionRule } from "../../../server/types";

export interface MemberAttentionItem {
  name: string;
  specialInstructions?: string;
  canCookCleanSameDay: boolean;
  cookQuota: number;
  rules: ExceptionRule[];
}

interface Step2NotesRulesProps {
  membersRequiringAttention: MemberAttentionItem[];
  handleOpenAddGenericRule: () => void;
  handleOpenAddRuleForMember: (memberName: string, contextNote?: string) => void;
  handleOpenEditRule: (rule: ExceptionRule) => void;
  handleDeleteRule: (ruleId: string) => void;
  goToStep: (step: 1 | 2 | 3 | 4) => void;
  handleRunSolver: () => void;
  loading: boolean;
}

export const Step2NotesRules: React.FC<Step2NotesRulesProps> = ({
  membersRequiringAttention,
  handleOpenAddGenericRule,
  handleOpenAddRuleForMember,
  handleOpenEditRule,
  handleDeleteRule,
  goToStep,
  handleRunSolver,
  loading,
}) => {
  return (
    <div className="space-y-6">
      {/* Header & Quick Action */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Member Notes &amp; Exception Rules ({membersRequiringAttention.length} Members with
            Notes or Rules)
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Review respondent special instructions and verify or configure exception rules for each
            member.
          </p>
        </div>
        <button
          onClick={handleOpenAddGenericRule}
          className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add General Rule</span>
        </button>
      </div>

      {/* Per-Member Cards */}
      <div className="space-y-4">
        {membersRequiringAttention.length > 0 ? (
          membersRequiringAttention.map((item) => (
            <div
              key={item.name}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3.5 hover:border-orange-200 transition-colors"
            >
              {/* Member Header Row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-900 font-bold flex items-center justify-center text-sm shadow-sm border border-orange-200">
                    {item.name.charAt(0)}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm sm:text-base font-bold text-slate-900">{item.name}</h3>
                      <span className="text-xs font-bold px-2.5 py-1 bg-slate-100 text-slate-800 rounded-lg border border-slate-200">
                        Cook Quota: {item.cookQuota}
                      </span>
                      {item.canCookCleanSameDay && (
                        <span className="text-xs font-bold px-2.5 py-1 bg-emerald-100 text-emerald-950 rounded-full border border-emerald-300">
                          ✨ Survey: Can Cook &amp; Clean Same Day
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleOpenAddRuleForMember(item.name, item.specialInstructions)}
                  className="min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 bg-orange-50 hover:bg-orange-100 text-orange-800 border border-orange-300 rounded-xl text-xs sm:text-sm font-bold transition-colors self-start sm:self-auto cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Encode Rule for {item.name}</span>
                </button>
              </div>

              {/* Member Survey Note (if present) */}
              {item.specialInstructions && (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 flex items-start gap-3">
                  <MessageSquare className="w-5 h-5 text-amber-800 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-amber-950 block">
                      Survey Note from {item.name}:
                    </span>
                    <p className="text-xs sm:text-sm text-amber-900 mt-0.5 font-medium italic">
                      "{item.specialInstructions}"
                    </p>
                  </div>
                </div>
              )}

              {/* Associated Active Exception Rules */}
              <div>
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                  Configured Exception Rules ({item.rules.length})
                </span>

                {item.rules.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {item.rules.map((rule) => (
                      <div
                        key={rule.id}
                        className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-lg font-bold uppercase shrink-0 ${
                              rule.is_hard_rule
                                ? "bg-rose-100 text-rose-950 border border-rose-300"
                                : "bg-sky-100 text-sky-950 border border-sky-300"
                            }`}
                          >
                            {rule.is_hard_rule ? "Hard" : "Soft"}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate">
                              <span className="text-orange-800 font-mono">{rule.rule_type}</span>
                              {rule.person_b &&
                                ` ↔ ${rule.person_a === item.name ? rule.person_b : rule.person_a}`}
                            </p>
                            {rule.notes && (
                              <p className="text-xs text-slate-700 truncate max-w-[220px]">
                                {rule.notes}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleOpenEditRule(rule)}
                            aria-label={`Edit rule for ${rule.person_a}`}
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-600 hover:text-orange-700 hover:bg-orange-50 rounded-xl transition-colors cursor-pointer"
                            title="Edit Rule"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteRule(rule.id)}
                            aria-label={`Delete rule for ${rule.person_a}`}
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                            title="Delete Rule"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-600 italic">
                    No exception rule created for this note yet. Click "Encode Rule for {item.name}"
                    above to add one.
                  </p>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-600 text-xs sm:text-sm">
            No special notes or active rules for this month. You can proceed directly to solving or
            click "Add General Rule".
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between items-center">
        <button
          onClick={() => goToStep(1)}
          className="min-h-[48px] px-5 py-2.5 text-xs sm:text-sm font-bold text-slate-700 hover:text-slate-950 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
        >
          ← Back to Intake
        </button>
        <button
          onClick={() => handleRunSolver()}
          disabled={loading}
          className={`min-h-[48px] inline-flex items-center gap-2.5 px-6 py-3 rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all cursor-pointer ${
            loading
              ? "bg-orange-500 text-white cursor-wait opacity-90 shadow-orange-500/30"
              : "bg-orange-600 hover:bg-orange-700 text-white shadow-orange-600/20"
          }`}
        >
          {loading ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin text-white" />
              <span>Solving Optimal Schedule...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              <span>Run Matchmaker Solver</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

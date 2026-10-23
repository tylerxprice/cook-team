import React, { useState, useMemo } from "react";
import {
  Plus,
  MessageSquare,
  Pencil,
  Trash2,
  Sparkles,
  RefreshCw,
  ShieldCheck,
  Users,
  Search,
  X,
  ChevronDown,
  ChevronRight,
  SlidersHorizontal,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { ExceptionRule, IntakePayload } from "../../../server/types";

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
  handleOpenAddWhitelistRule: () => void;
  handleOpenAddRuleForMember: (memberName: string, contextNote?: string) => void;
  handleOpenEditRule: (rule: ExceptionRule) => void;
  handleDeleteRule: (ruleId: string) => void;
  goToStep: (step: 1 | 2 | 3 | 4) => void;
  handleRunSolver: () => void;
  loading: boolean;
  intakeData?: IntakePayload | null;
  handleLoadExistingSchedule?: () => void;
  sheetInput?: string;
}

function hasValidSpecialNote(note?: string): boolean {
  if (!note) return false;
  const trimmed = note.trim();
  if (trimmed === "") return false;
  const lower = trimmed.toLowerCase();
  return !["nope", "none", "n/a", "no", "nothing", "nope.", "none."].includes(lower);
}

export const Step2NotesRules: React.FC<Step2NotesRulesProps> = ({
  membersRequiringAttention,
  handleOpenAddGenericRule,
  handleOpenAddWhitelistRule,
  handleOpenAddRuleForMember,
  handleOpenEditRule,
  handleDeleteRule,
  goToStep,
  handleRunSolver,
  loading,
  intakeData,
  handleLoadExistingSchedule,
  sheetInput = "",
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isNotesExpanded, setIsNotesExpanded] = useState(true);
  const [isRulesExpanded, setIsRulesExpanded] = useState(true);
  const [isNoRulesExpanded, setIsNoRulesExpanded] = useState(false);
  const [showOverwriteModal, setShowOverwriteModal] = useState(false);

  const sheetUrl = useMemo(() => {
    if (!sheetInput) return "";
    return sheetInput.startsWith("http")
      ? sheetInput
      : `https://docs.google.com/spreadsheets/d/${sheetInput}/edit`;
  }, [sheetInput]);

  const requestRunSolver = () => {
    if (intakeData?.existingScheduleTab?.exists) {
      setShowOverwriteModal(true);
    } else {
      handleRunSolver();
    }
  };

  // Group members into the 3 distinct categories
  const specialNotesMembers = useMemo(() => {
    return membersRequiringAttention.filter((m) => hasValidSpecialNote(m.specialInstructions));
  }, [membersRequiringAttention]);

  const existingRulesMembers = useMemo(() => {
    return membersRequiringAttention.filter(
      (m) => !hasValidSpecialNote(m.specialInstructions) && m.rules.length > 0
    );
  }, [membersRequiringAttention]);

  const noRulesMembers = useMemo(() => {
    return membersRequiringAttention.filter(
      (m) => !hasValidSpecialNote(m.specialInstructions) && m.rules.length === 0
    );
  }, [membersRequiringAttention]);

  // Search filter predicate: strictly match on member name
  const q = searchQuery.trim().toLowerCase();
  const matchesSearch = React.useCallback(
    (item: MemberAttentionItem) => {
      if (!q) return true;
      return item.name.toLowerCase().includes(q);
    },
    [q]
  );

  const filteredNotes = useMemo(
    () => specialNotesMembers.filter(matchesSearch),
    [specialNotesMembers, matchesSearch]
  );
  const filteredRules = useMemo(
    () => existingRulesMembers.filter(matchesSearch),
    [existingRulesMembers, matchesSearch]
  );
  const filteredNoRules = useMemo(
    () => noRulesMembers.filter(matchesSearch),
    [noRulesMembers, matchesSearch]
  );

  const totalFilteredCount =
    filteredNotes.length + filteredRules.length + filteredNoRules.length;

  // If search query is active, auto-expand sections that have matching members
  const showNotesSection = q ? filteredNotes.length > 0 : isNotesExpanded;
  const showRulesSection = q ? filteredRules.length > 0 : isRulesExpanded;
  const showNoRulesSection = q ? filteredNoRules.length > 0 : isNoRulesExpanded;

  const allSectionsExpanded = isNotesExpanded && isRulesExpanded && isNoRulesExpanded;
  const toggleExpandAll = () => {
    if (allSectionsExpanded) {
      setIsNotesExpanded(false);
      setIsRulesExpanded(false);
      setIsNoRulesExpanded(false);
    } else {
      setIsNotesExpanded(true);
      setIsRulesExpanded(true);
      setIsNoRulesExpanded(true);
    }
  };

  const renderRuleCard = (rule: ExceptionRule, memberName: string) => {
    const isWhitelist = rule.rule_type === "REQUIRE_ONE_OF_TEAM";
    const mentorList =
      isWhitelist && rule.person_b
        ? rule.person_b
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

    return (
      <div
        key={rule.id}
        className={`p-3 rounded-xl border flex items-center justify-between gap-2 transition-colors ${
          isWhitelist
            ? "bg-orange-50/50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800"
            : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"
        }`}
      >
        <div className="flex items-start gap-2.5 min-w-0">
          <span
            className={`text-xs px-2 py-0.5 rounded-lg font-bold uppercase shrink-0 ${
              rule.is_hard_rule
                ? "bg-rose-100 dark:bg-rose-950/60 text-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800"
                : "bg-sky-100 dark:bg-sky-950/60 text-sky-950 dark:text-sky-300 border border-sky-300 dark:border-sky-800"
            }`}
          >
            {rule.is_hard_rule ? "Hard" : "Soft"}
          </span>
          <div className="min-w-0">
            {isWhitelist ? (
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-black text-orange-950 dark:text-orange-200 bg-orange-100 dark:bg-orange-950/60 px-2 py-0.5 rounded-md border border-orange-200 dark:border-orange-800 inline-flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-orange-700 dark:text-orange-400" />
                    Mentor Whitelist
                  </span>
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                    {rule.target_role_a === "COOK"
                      ? "(Cooks Only)"
                      : rule.target_role_a === "CLEAN"
                        ? "(Cleans Only)"
                        : "(Cook & Clean)"}
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-900 dark:text-white mt-1">
                  Must pair with at least one of:
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {mentorList.map((m) => (
                    <span
                      key={m}
                      className="inline-block px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-orange-300 dark:border-orange-700 text-orange-950 dark:text-orange-200 rounded text-[11px] font-bold"
                    >
                      ✓ {m}
                    </span>
                  ))}
                </div>
              </div>
            ) : rule.rule_type === "EXTRA_HELPER" ? (
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800">
                    🤝 Extra Helper
                  </span>
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                    {rule.target_role_a === "CLEAN"
                      ? "(Clean Teams Only)"
                      : rule.target_role_a === "COOK"
                        ? "(Cook Teams Only)"
                        : "(Either Team Type - Cook or Clean)"}
                  </span>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 mt-1">
                  Tacked onto full teams without diluting core team size (max 1 helper per meal)
                  {rule.person_b ? ` (paired with ${rule.person_b})` : ""}.
                </p>
              </div>
            ) : (
              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                <span className="text-orange-800 dark:text-orange-400 font-mono">
                  {rule.rule_type}
                </span>
                {rule.person_b &&
                  ` ↔ ${rule.person_a === memberName ? rule.person_b : rule.person_a}`}
              </p>
            )}
            {rule.notes && (
              <p className="text-xs text-slate-700 dark:text-slate-300 truncate max-w-[220px] mt-0.5">
                {rule.notes}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => handleOpenEditRule(rule)}
            aria-label={`Edit rule for ${rule.person_a}`}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-orange-700 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            title="Edit Rule"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDeleteRule(rule.id)}
            aria-label={`Delete rule for ${rule.person_a}`}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-rose-700 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            title="Delete Rule"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  const renderDetailedMemberCard = (item: MemberAttentionItem) => (
    <div
      key={item.name}
      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-3.5 hover:border-orange-200 dark:hover:border-orange-800/80 transition-colors"
    >
      {/* Member Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3.5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-950/60 text-orange-900 dark:text-orange-200 font-bold flex items-center justify-center text-sm shadow-sm border border-orange-200 dark:border-orange-800">
            {item.name.charAt(0)}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                {item.name}
              </h4>
              <span className="text-xs font-bold px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-lg border border-slate-200 dark:border-slate-700">
                Cook Quota: {item.cookQuota}
              </span>
              {item.canCookCleanSameDay && (
                <span className="text-xs font-bold px-2.5 py-1 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-950 dark:text-emerald-200 rounded-full border border-emerald-300 dark:border-emerald-800">
                  ✨ Survey: Can Cook &amp; Clean Same Day
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={() => handleOpenAddRuleForMember(item.name, item.specialInstructions)}
          className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 bg-orange-50 dark:bg-orange-950/40 hover:bg-orange-100 dark:hover:bg-orange-900/60 text-orange-800 dark:text-orange-300 border border-orange-300 dark:border-orange-800 rounded-xl text-xs sm:text-sm font-bold transition-colors self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Encode Rule for {item.name}</span>
        </button>
      </div>

      {/* Member Survey Note (if present) */}
      {item.specialInstructions && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/80 rounded-xl p-3.5 flex items-start gap-3">
          <MessageSquare className="w-5 h-5 text-amber-800 dark:text-amber-400 mt-0.5 shrink-0" />
          <div>
            <span className="text-xs font-bold text-amber-950 dark:text-amber-200 block">
              Survey Note from {item.name}:
            </span>
            <p className="text-xs sm:text-sm text-amber-900 dark:text-amber-300 mt-0.5 font-medium italic">
              "{item.specialInstructions}"
            </p>
          </div>
        </div>
      )}

      {/* Associated Active Exception Rules */}
      <div>
        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-2">
          Configured Exception Rules ({item.rules.length})
        </span>

        {item.rules.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {item.rules.map((rule) => renderRuleCard(rule, item.name))}
          </div>
        ) : (
          <p className="text-xs text-slate-600 dark:text-slate-400 italic">
            No exception rule created for this note yet. Click "Encode Rule for {item.name}" above to
            add one.
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header & Quick Actions */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Member Notes &amp; Exception Rules
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            Review respondent special instructions and verify or configure exception rules for each
            member.
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-2.5">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 rounded-lg border border-amber-300 dark:border-amber-800">
              <MessageSquare className="w-3.5 h-3.5" />
              {specialNotesMembers.length} with Notes
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 bg-sky-100 dark:bg-sky-950/60 text-sky-900 dark:text-sky-200 rounded-lg border border-sky-300 dark:border-sky-800">
              <ShieldCheck className="w-3.5 h-3.5" />
              {existingRulesMembers.length} with Existing Rules
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700">
              <Users className="w-3.5 h-3.5" />
              {noRulesMembers.length} with No Rules
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleOpenAddWhitelistRule}
            className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-colors cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Add Mentor Whitelist</span>
          </button>
          <button
            type="button"
            onClick={handleOpenAddGenericRule}
            className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add General Rule</span>
          </button>
        </div>
      </div>

      {/* Search & Collapse Controls Bar */}
      <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter members by name..."
            aria-label="Filter members by name"
            className="w-full pl-10 pr-9 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-600 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              aria-label="Clear filter"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 text-xs font-medium">
          {searchQuery && (
            <span className="text-slate-600 dark:text-slate-400 font-bold">
              Found {totalFilteredCount} member{totalFilteredCount === 1 ? "" : "s"}
            </span>
          )}
          <button
            type="button"
            onClick={toggleExpandAll}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer shrink-0"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
            <span>{allSectionsExpanded ? "Collapse All" : "Expand All"}</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: Responses with Special Notes for the Current Month */}
      <section className="space-y-3" aria-label="Responses with Special Notes">
        <button
          type="button"
          onClick={() => setIsNotesExpanded((prev) => !prev)}
          className="w-full flex items-center justify-between p-4 bg-amber-500/10 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/80 rounded-2xl hover:bg-amber-500/15 transition-colors cursor-pointer text-left"
          aria-expanded={showNotesSection}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shadow-xs shrink-0">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  Responses with Special Notes
                </h3>
                <span className="text-xs font-bold px-2 py-0.5 bg-amber-100 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 rounded-full border border-amber-300 dark:border-amber-700">
                  {filteredNotes.length}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                New dietary restrictions, special instructions, and availability preferences
                submitted this month
              </p>
            </div>
          </div>
          <div className="text-slate-500 dark:text-slate-400 p-1 shrink-0">
            {showNotesSection ? (
              <ChevronDown className="w-5 h-5" />
            ) : (
              <ChevronRight className="w-5 h-5" />
            )}
          </div>
        </button>

        {showNotesSection && (
          <div className="space-y-4 pt-1">
            {filteredNotes.length > 0 ? (
              filteredNotes.map((item) => renderDetailedMemberCard(item))
            ) : (
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 text-center text-slate-600 dark:text-slate-400 text-xs sm:text-sm">
                {searchQuery
                  ? "No members with special notes matched your search."
                  : "No respondents submitted special instructions for this month."}
              </div>
            )}
          </div>
        )}
      </section>

      {/* SECTION 2: Members with Existing Rules (no notes this month) */}
      <section className="space-y-3" aria-label="Members with Existing Rules">
        <button
          type="button"
          onClick={() => setIsRulesExpanded((prev) => !prev)}
          className="w-full flex items-center justify-between p-4 bg-sky-500/10 dark:bg-sky-950/40 border border-sky-300 dark:border-sky-800/80 rounded-2xl hover:bg-sky-500/15 transition-colors cursor-pointer text-left"
          aria-expanded={showRulesSection}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  Members with Existing Rules
                </h3>
                <span className="text-xs font-bold px-2 py-0.5 bg-sky-100 dark:bg-sky-900/60 text-sky-900 dark:text-sky-200 rounded-full border border-sky-300 dark:border-sky-700">
                  {filteredRules.length}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Standing exception rules, mentor requirements, and pairings from registry (no notes
                this month)
              </p>
            </div>
          </div>
          <div className="text-slate-500 dark:text-slate-400 p-1 shrink-0">
            {showRulesSection ? (
              <ChevronDown className="w-5 h-5" />
            ) : (
              <ChevronRight className="w-5 h-5" />
            )}
          </div>
        </button>

        {showRulesSection && (
          <div className="space-y-4 pt-1">
            {filteredRules.length > 0 ? (
              filteredRules.map((item) => renderDetailedMemberCard(item))
            ) : (
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 text-center text-slate-600 dark:text-slate-400 text-xs sm:text-sm">
                {searchQuery
                  ? "No members with existing rules matched your search."
                  : "No other members have existing exception rules configured."}
              </div>
            )}
          </div>
        )}
      </section>

      {/* SECTION 3: Members with No Rules (and no notes) */}
      <section className="space-y-3" aria-label="Members with No Rules">
        <button
          type="button"
          onClick={() => setIsNoRulesExpanded((prev) => !prev)}
          className="w-full flex items-center justify-between p-4 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left"
          aria-expanded={showNoRulesSection}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-600 dark:bg-slate-700 text-white flex items-center justify-center shadow-xs shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  Members with No Rules
                </h3>
                <span className="text-xs font-bold px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-full border border-slate-300 dark:border-slate-600">
                  {filteredNoRules.length}
                </span>
                {!isNoRulesExpanded && !searchQuery && (
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 italic">
                    (Click to expand)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Respondents with standard availability and no special instructions or active
                constraints
              </p>
            </div>
          </div>
          <div className="text-slate-500 dark:text-slate-400 p-1 shrink-0">
            {showNoRulesSection ? (
              <ChevronDown className="w-5 h-5" />
            ) : (
              <ChevronRight className="w-5 h-5" />
            )}
          </div>
        </button>

        {showNoRulesSection && (
          <div className="pt-1">
            {filteredNoRules.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredNoRules.map((item) => (
                  <div
                    key={item.name}
                    className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs hover:border-orange-200 dark:hover:border-orange-800/80 transition-colors flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold flex items-center justify-center text-xs shrink-0 border border-slate-200 dark:border-slate-700">
                        {item.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {item.name}
                        </h4>
                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                            Cook Quota: {item.cookQuota}
                          </span>
                          {item.canCookCleanSameDay && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-950 dark:text-emerald-200 rounded-md">
                              Same-Day OK
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenAddRuleForMember(item.name)}
                      className="min-h-[36px] inline-flex items-center gap-1 px-2.5 py-1.5 bg-orange-50 dark:bg-orange-950/40 hover:bg-orange-100 dark:hover:bg-orange-900/60 text-orange-800 dark:text-orange-300 border border-orange-200 dark:border-orange-800 rounded-lg text-xs font-bold transition-colors shrink-0 cursor-pointer"
                      title={`Encode rule for ${item.name}`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Encode Rule</span>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 text-center text-slate-600 dark:text-slate-400 text-xs sm:text-sm">
                No members found without rules.
              </div>
            )}
          </div>
        )}
      </section>

      {/* Overwrite Guard Confirmation Modal */}
      {showOverwriteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  Finalized Schedule Exists
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                  <span>Tab:</span>
                  {sheetUrl ? (
                    <a
                      href={sheetUrl}
                      target="_blank"
                      rel="noreferrer"
                      title="Open schedule tab in Google Sheets"
                      className="font-mono text-orange-600 dark:text-orange-400 hover:underline inline-flex items-center gap-1 font-bold"
                    >
                      <span>{intakeData?.existingScheduleTab?.name || "Schedule"}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                      {intakeData?.existingScheduleTab?.name || "Schedule"}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              A saved schedule already exists for this month in your spreadsheet. You can view the
              existing schedule to inspect and make manual adjustments, or re-run the matchmaker
              solver to generate a fresh roster from scratch.
            </p>

            <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowOverwriteModal(false)}
                className="w-full sm:w-auto min-h-[42px] px-4 py-2 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              {handleLoadExistingSchedule && (
                <button
                  type="button"
                  onClick={() => {
                    setShowOverwriteModal(false);
                    handleLoadExistingSchedule();
                  }}
                  className="w-full sm:w-auto min-h-[42px] px-4 py-2 text-xs sm:text-sm font-bold text-emerald-800 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-950/60 hover:bg-emerald-200 dark:hover:bg-emerald-900 border border-emerald-300 dark:border-emerald-800 rounded-xl transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>View Existing Schedule</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowOverwriteModal(false);
                  handleRunSolver();
                }}
                className="w-full sm:w-auto min-h-[42px] px-5 py-2 text-xs sm:text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-xl shadow-xs transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-4 h-4" />
                <span>Proceed &amp; Re-run Solver</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between items-center pt-2">
        <button
          onClick={() => goToStep(1)}
          className="min-h-[48px] px-5 py-2.5 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          ← Back to Intake
        </button>
        <button
          onClick={() => requestRunSolver()}
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

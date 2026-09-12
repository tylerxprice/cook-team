import React from "react";
import { X, Users, Search, Pencil, RefreshCw } from "lucide-react";
import { Member } from "../../../server/types";

export interface MemberDirectoryModalProps {
  show: boolean;
  onClose: () => void;
  members: Member[];
  showBulkImport: boolean;
  setShowBulkImport: (val: boolean) => void;
  bulkImportText: string;
  setBulkImportText: (val: string) => void;
  parsedBulkMembers: Member[];
  bulkImportSaving: boolean;
  handleBulkImportSave: (mode: "replace" | "merge") => void;
  newMemberName: string;
  setNewMemberName: (val: string) => void;
  newMemberEmail: string;
  setNewMemberEmail: (val: string) => void;
  newMemberAliases: string;
  setNewMemberAliases: (val: string) => void;
  handleAddMember: (e: React.FormEvent) => void;
  memberFilter: "all" | "active" | "inactive";
  setMemberFilter: (val: "all" | "active" | "inactive") => void;
  memberSearchQuery: string;
  setMemberSearchQuery: (val: string) => void;
  updatingMemberName: string | null;
  editingMember: {
    originalName: string;
    name: string;
    emails: string;
    aliases: string;
    active: boolean;
  } | null;
  setEditingMember: React.Dispatch<
    React.SetStateAction<{
      originalName: string;
      name: string;
      emails: string;
      aliases: string;
      active: boolean;
    } | null>
  >;
  handleSaveEditedMember: (e: React.FormEvent) => void;
  isSavingMember: boolean;
  handleToggleMember: (name: string, currentStatus: boolean) => void;
}

export const MemberDirectoryModal: React.FC<MemberDirectoryModalProps> = ({
  show,
  onClose,
  members,
  showBulkImport,
  setShowBulkImport,
  bulkImportText,
  setBulkImportText,
  parsedBulkMembers,
  bulkImportSaving,
  handleBulkImportSave,
  newMemberName,
  setNewMemberName,
  newMemberEmail,
  setNewMemberEmail,
  newMemberAliases,
  setNewMemberAliases,
  handleAddMember,
  memberFilter,
  setMemberFilter,
  memberSearchQuery,
  setMemberSearchQuery,
  updatingMemberName,
  editingMember,
  setEditingMember,
  handleSaveEditedMember,
  isSavingMember,
  handleToggleMember,
}) => {
  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title-members"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 id="modal-title-members" className="text-base sm:text-lg font-bold text-slate-900">
              Community Member Directory
            </h3>
            <p className="text-xs text-slate-700 mt-0.5">
              Manage active vs inactive members and roster information
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar: Quick Add + Import from Google Group Toggle */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setShowBulkImport(!showBulkImport)}
            aria-expanded={showBulkImport}
            className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer ${
              showBulkImport
                ? "bg-indigo-700 text-white"
                : "bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-300"
            }`}
          >
            <Users className="w-4 h-4" />
            {showBulkImport
              ? "Hide Google Group Importer"
              : "📋 Import from Google Group (vancoho-residents)"}
          </button>

          <span className="text-xs text-slate-700 font-bold">
            {members.length} members ({members.filter((m) => m.active).length} active)
          </span>
        </div>

        {/* Bulk Import Drawer */}
        {showBulkImport && (
          <div className="p-4 bg-indigo-50/80 border-b border-indigo-200 space-y-3">
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-indigo-950 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-indigo-700" />
                Import Roster from Google Group (Community Residents)
              </h4>
              <p className="text-xs text-slate-700 mt-1">
                Paste member names, emails, or rows copied directly from Google Groups (
                <code className="bg-indigo-100 px-1 py-0.5 rounded text-indigo-950 font-bold">
                  community-residents@googlegroups.com
                </code>
                ). Names will be formatted as <strong>First Names</strong>, and duplicates are
                automatically disambiguated with <strong>Last Initials</strong> (e.g.{" "}
                <em>Sarah C.</em> and <em>Sarah M.</em>).
              </p>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="bulk-import-roster-textarea"
                className="text-xs font-bold text-slate-800"
              >
                Paste Member Names / Google Group Rows:
              </label>
              <textarea
                id="bulk-import-roster-textarea"
                value={bulkImportText}
                onChange={(e) => setBulkImportText(e.target.value)}
                placeholder={`Example lines to paste from Google Groups:\nTaylor Tester <taylor@example.com>\nBeth Coordinator <beth@example.com>\nSarah Chen <sarah.c@example.com>\nSarah Miller <sarah.m@example.com>\nMaya Patel`}
                rows={5}
                className="w-full p-3 bg-white border border-indigo-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
              />
            </div>

            {parsedBulkMembers.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-indigo-950">
                  <span>✓ Detected {parsedBulkMembers.length} Members:</span>
                  <span className="text-slate-600 font-semibold">
                    Auto-formatted (First Name / Initial)
                  </span>
                </div>

                <div className="max-h-32 overflow-y-auto p-2 bg-white rounded-xl border border-indigo-200 divide-y divide-slate-100 text-xs">
                  {parsedBulkMembers.map((p, idx) => (
                    <div key={idx} className="py-1.5 flex items-center justify-between">
                      <span className="font-bold text-slate-900">{p.name}</span>
                      <span className="text-xs text-slate-600 font-mono">
                        {p.google_email || "no email"}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleBulkImportSave("replace")}
                    disabled={bulkImportSaving}
                    className="min-h-[44px] px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50 shadow-xs cursor-pointer"
                  >
                    {bulkImportSaving
                      ? "Saving..."
                      : `Replace Master Registry (${parsedBulkMembers.length} Members)`}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkImportSave("merge")}
                    disabled={bulkImportSaving}
                    className="min-h-[44px] px-4 py-2 bg-white hover:bg-slate-50 text-indigo-900 border border-indigo-300 rounded-xl text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    Merge with Existing
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Quick Add Single Member Form */}
        <form
          onSubmit={handleAddMember}
          className="p-3 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row gap-2"
        >
          <div className="flex-1 min-w-[130px]">
            <label htmlFor="quick-add-member-name" className="sr-only">
              Member Name
            </label>
            <input
              id="quick-add-member-name"
              type="text"
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              placeholder="Member name (e.g. Alexandra)"
              className="w-full min-h-[44px] px-3.5 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white font-medium text-slate-900"
            />
          </div>
          <div className="flex-1 min-w-[150px]">
            <label htmlFor="quick-add-member-email" className="sr-only">
              Member Google Account Email
            </label>
            <input
              id="quick-add-member-email"
              type="text"
              value={newMemberEmail}
              onChange={(e) => setNewMemberEmail(e.target.value)}
              placeholder="Google email(s) (comma-separated)"
              className="w-full min-h-[44px] px-3.5 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white font-medium text-slate-900"
            />
          </div>
          <div className="flex-1 min-w-[130px]">
            <label htmlFor="quick-add-member-aliases" className="sr-only">
              Nicknames / Aliases
            </label>
            <input
              id="quick-add-member-aliases"
              type="text"
              value={newMemberAliases}
              onChange={(e) => setNewMemberAliases(e.target.value)}
              placeholder="Nicknames (e.g. Alex, Sasha)"
              className="w-full min-h-[44px] px-3.5 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white font-medium text-slate-900"
            />
          </div>
          <button
            type="submit"
            className="min-h-[44px] px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs sm:text-sm font-bold shrink-0 transition-colors shadow-xs cursor-pointer"
          >
            + Add Member
          </button>
        </form>

        {/* Filter Tabs & Search Bar */}
        <div className="px-5 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs bg-white">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMemberFilter("all")}
              className={`min-h-[44px] px-3.5 py-2 rounded-xl font-bold transition-colors cursor-pointer ${
                memberFilter === "all"
                  ? "bg-slate-900 text-white"
                  : "text-slate-700 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              All ({members.length})
            </button>
            <button
              type="button"
              onClick={() => setMemberFilter("active")}
              className={`min-h-[44px] px-3.5 py-2 rounded-xl font-bold transition-colors cursor-pointer ${
                memberFilter === "active"
                  ? "bg-emerald-700 text-white"
                  : "text-slate-700 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              Active ({members.filter((m) => m.active).length})
            </button>
            <button
              type="button"
              onClick={() => setMemberFilter("inactive")}
              className={`min-h-[44px] px-3.5 py-2 rounded-xl font-bold transition-colors cursor-pointer ${
                memberFilter === "inactive"
                  ? "bg-slate-700 text-white"
                  : "text-slate-700 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              Inactive ({members.filter((m) => !m.active).length})
            </button>
          </div>

          {/* Search Filter */}
          <div className="relative flex-1 sm:max-w-56">
            <label htmlFor="member-search-query-input" className="sr-only">
              Search members
            </label>
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              id="member-search-query-input"
              type="text"
              value={memberSearchQuery}
              onChange={(e) => setMemberSearchQuery(e.target.value)}
              placeholder="Search members..."
              className="w-full min-h-[44px] pl-9 pr-8 py-2 text-xs border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 placeholder:text-slate-500 text-slate-900 font-medium"
            />
            {memberSearchQuery && (
              <button
                type="button"
                onClick={() => setMemberSearchQuery("")}
                aria-label="Clear member search"
                className="min-h-[44px] min-w-[36px] flex items-center justify-center absolute right-1 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Member List (Alphabetically Sorted) */}
        <div className="divide-y divide-slate-100 overflow-y-auto flex-1 p-2">
          {[...members]
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
            .filter((m) => {
              if (memberFilter === "active" && !m.active) return false;
              if (memberFilter === "inactive" && m.active) return false;
              if (memberSearchQuery.trim()) {
                const q = memberSearchQuery.trim().toLowerCase();
                const nameMatch = m.name.toLowerCase().includes(q);
                const emailMatch = m.google_email
                  ? m.google_email.toLowerCase().includes(q)
                  : false;
                const aliasMatch = m.aliases
                  ? m.aliases.some((a) => a.toLowerCase().includes(q))
                  : false;
                return nameMatch || emailMatch || aliasMatch;
              }
              return true;
            })
            .map((m) => {
              const isUpdating = updatingMemberName === m.name;
              const isEditingThis =
                editingMember && editingMember.originalName.toLowerCase() === m.name.toLowerCase();

              return (
                <div key={m.name} className="p-3.5 hover:bg-slate-50 rounded-xl transition-colors">
                  {isEditingThis ? (
                    <form
                      onSubmit={handleSaveEditedMember}
                      className="space-y-3 bg-white p-4 rounded-xl border border-orange-300 shadow-sm"
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <h4 className="text-xs font-bold text-orange-950 uppercase tracking-wider">
                          Edit Member Profile
                        </h4>
                        <button
                          type="button"
                          onClick={() => setEditingMember(null)}
                          className="text-xs text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
                        >
                          ✕ Cancel
                        </button>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Full Member Name
                        </label>
                        <input
                          type="text"
                          value={editingMember.name}
                          onChange={(e) =>
                            setEditingMember({ ...editingMember, name: e.target.value })
                          }
                          required
                          className="w-full min-h-[38px] px-3 py-1.5 text-xs sm:text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-medium text-slate-900 bg-white"
                          placeholder="e.g. Alexandra"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-0.5">
                          Google Account &amp; Alternate Emails
                        </label>
                        <p className="text-[11px] text-slate-500 mb-1">
                          Comma-separated emails. Form submissions from any listed email map to this
                          member.
                        </p>
                        <input
                          type="text"
                          value={editingMember.emails}
                          onChange={(e) =>
                            setEditingMember({ ...editingMember, emails: e.target.value })
                          }
                          className="w-full min-h-[38px] px-3 py-1.5 text-xs sm:text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-medium text-slate-900 bg-white"
                          placeholder="e.g. alexandra@example.com, alex.personal@example.com"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-0.5">
                          Nicknames &amp; Aliases
                        </label>
                        <p className="text-[11px] text-slate-500 mb-1">
                          Comma-separated nicknames. Forms submitted with any of these names map to
                          this member.
                        </p>
                        <input
                          type="text"
                          value={editingMember.aliases}
                          onChange={(e) =>
                            setEditingMember({ ...editingMember, aliases: e.target.value })
                          }
                          className="w-full min-h-[38px] px-3 py-1.5 text-xs sm:text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-medium text-slate-900 bg-white"
                          placeholder="e.g. Alex, Sasha"
                        />
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editingMember.active}
                            onChange={(e) =>
                              setEditingMember({ ...editingMember, active: e.target.checked })
                            }
                            className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500 border-slate-300"
                          />
                          Active Member (Included in monthly completeness audits)
                        </label>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setEditingMember(null)}
                          disabled={isSavingMember}
                          className="min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isSavingMember || !editingMember.name.trim()}
                          className="min-h-[36px] inline-flex items-center gap-1.5 px-4 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                        >
                          {isSavingMember ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Saving...</span>
                            </>
                          ) : (
                            <span>Save Changes</span>
                          )}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-slate-900">{m.name}</p>
                          {m.aliases && m.aliases.length > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-100 text-sky-900 text-[11px] font-bold border border-sky-200">
                              🏷️ {m.aliases.join(", ")}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5 truncate">
                          {m.google_email || "No email registered"} • Last active:{" "}
                          {m.last_active_survey || "Never"}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setEditingMember({
                              originalName: m.name,
                              name: m.name,
                              emails: m.google_email || "",
                              aliases: (m.aliases || []).join(", "),
                              active: m.active,
                            })
                          }
                          aria-label={`Edit ${m.name}`}
                          className="min-h-[38px] px-3 py-1.5 inline-flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                          title="Edit name, emails, or nicknames"
                        >
                          <Pencil className="w-3.5 h-3.5 text-slate-500" />
                          <span>Edit</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleMember(m.name, m.active)}
                          disabled={isUpdating}
                          aria-label={
                            m.active ? `Mark ${m.name} as inactive` : `Mark ${m.name} as active`
                          }
                          className={`min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                            isUpdating
                              ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-75"
                              : m.active
                                ? "bg-emerald-100 text-emerald-950 hover:bg-emerald-200 border border-emerald-300 cursor-pointer"
                                : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300 cursor-pointer"
                          }`}
                        >
                          {isUpdating ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin text-orange-600 shrink-0" />
                              <span>Saving...</span>
                            </>
                          ) : m.active ? (
                            "Active"
                          ) : (
                            "Inactive (Dormant)"
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
};

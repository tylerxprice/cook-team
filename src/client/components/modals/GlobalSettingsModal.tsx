import React from "react";
import {
  Settings,
  X,
  Utensils,
  ShieldCheck,
  Sparkles,
  Calendar,
  Folder,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import { CookTeamPolicy } from "../../../server/types";

export interface GlobalSettingsModalProps {
  show: boolean;
  onClose: () => void;
  cookPolicy: CookTeamPolicy;
  setCookPolicy: (policy: CookTeamPolicy) => void;
  defaultCleanQuota: number;
  setDefaultCleanQuota: (quota: number) => void;
  autoCancelDeficitDates: boolean;
  setAutoCancelDeficitDates: (val: boolean) => void;
  masterSheetInput: string;
  setMasterSheetInput: (val: string) => void;
  driveFolderId: string;
  setDriveFolderId: (val: string) => void;
  handleCreateLaunchers: () => void;
  handleProvisionDrive: () => void;
  provisioning: boolean;
  provisionResult: any;
  onSaveAndRecalculate: () => void;
}

export const GlobalSettingsModal: React.FC<GlobalSettingsModalProps> = ({
  show,
  onClose,
  cookPolicy,
  setCookPolicy,
  defaultCleanQuota,
  setDefaultCleanQuota,
  autoCancelDeficitDates,
  setAutoCancelDeficitDates,
  masterSheetInput,
  setMasterSheetInput,
  driveFolderId,
  setDriveFolderId,
  handleCreateLaunchers,
  handleProvisionDrive,
  provisioning,
  provisionResult,
  onSaveAndRecalculate,
}) => {
  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title-settings"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-800 flex items-center justify-center border border-orange-200">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3
                id="modal-title-settings"
                className="text-base sm:text-lg font-bold text-slate-900"
              >
                Global Application &amp; Solver Settings
              </h3>
              <p className="text-xs text-slate-700 mt-0.5">
                Configure sizing policies, default quotas, and solver behavior
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Settings Form Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* 1. Cook Team Sizing Policy */}
          <div className="space-y-2">
            <span className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Utensils className="w-4 h-4 text-orange-600" />
              Cook Team Sizing Policy
            </span>
            <p className="text-slate-700 text-xs">
              Controls target cook team sizes and dynamic flexibility on tight dates.
            </p>

            <div className="space-y-2 pt-1">
              {[
                {
                  id: "ADAPTIVE_3_OR_2",
                  title: "Adaptive Sizing (Recommended / Default)",
                  desc: "Target 3 cooks on Dinners & 2 on Brunches. Dynamically accepts 2 cooks on Dinner without errors if all assigned cooks agreed to 2 in the survey.",
                  badge: "Default",
                },
                {
                  id: "DINNER_3_BRUNCH_2",
                  title: "Strict 3 Dinner / 2 Brunch",
                  desc: "Strictly requires 3 cooks on every Dinner and 2 on every Brunch, flagging unfilled slots if 3 cooks cannot be scheduled.",
                },
                {
                  id: "TWO_REGARDLESS",
                  title: "Strict 2 Cooks Regardless",
                  desc: "Always schedules exactly 2 cooks for all Dinners and Brunches.",
                },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${
                    cookPolicy === opt.id
                      ? "bg-orange-50 border-orange-300 ring-1 ring-orange-400"
                      : "bg-white border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="cookPolicy"
                    value={opt.id}
                    checked={cookPolicy === opt.id}
                    onChange={() => setCookPolicy(opt.id as CookTeamPolicy)}
                    className="mt-1 w-4 h-4 text-orange-600 focus:ring-orange-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-xs sm:text-sm">
                        {opt.title}
                      </span>
                      {opt.badge && (
                        <span className="text-xs bg-orange-100 text-orange-950 border border-orange-300 font-bold px-2 py-0.5 rounded-full">
                          {opt.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-700 text-xs mt-1 leading-relaxed">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* 2. Default Clean Shift Quota */}
          <div className="space-y-2 pt-3 border-t border-slate-200">
            <span className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-sky-600" />
              Default Cleaning Shifts per Member (Fallback)
            </span>
            <p className="text-slate-700 text-xs">
              Default monthly cleaning shifts assigned per person when not specified in survey or
              for legacy responses.
            </p>

            <div className="grid grid-cols-3 gap-2.5 pt-1">
              {[
                { val: 1, label: "1 Shift (Default)" },
                { val: 2, label: "2 Shifts" },
                { val: 0, label: "0 (Exempt)" },
              ].map((item) => (
                <button
                  key={item.val}
                  type="button"
                  onClick={() => setDefaultCleanQuota(item.val)}
                  className={`min-h-[44px] py-2.5 px-3 rounded-xl border text-center font-bold text-xs transition-all cursor-pointer ${
                    defaultCleanQuota === item.val
                      ? "bg-sky-100 border-sky-400 text-sky-950 ring-1 ring-sky-500"
                      : "bg-white border-slate-300 text-slate-700 hover:border-slate-400"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Complete Meal Maximizer & Deficit Date Handling */}
          <div className="space-y-2 pt-3 border-t border-slate-200">
            <span className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-purple-600" />
              Complete Meal Maximization (Deficit Date Handling)
            </span>
            <p className="text-slate-700 text-xs">
              Automatically drops unviable deficit dates (e.g. holiday long weekends with severe
              volunteer shortages) to concentrate quotas and maximize 100% staffed complete meals.
            </p>

            <label
              className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${
                autoCancelDeficitDates
                  ? "bg-purple-50 border-purple-300 ring-1 ring-purple-400"
                  : "bg-white border-slate-200 hover:border-slate-300"
              }`}
            >
              <input
                type="checkbox"
                checked={autoCancelDeficitDates}
                onChange={(e) => setAutoCancelDeficitDates(e.target.checked)}
                className="mt-1 w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 text-xs sm:text-sm">
                    Auto-Drop Deficit Dates to Maximize Complete Meals
                  </span>
                  <span className="text-xs bg-purple-100 text-purple-950 border border-purple-300 font-bold px-2 py-0.5 rounded-full">
                    Recommended
                  </span>
                </div>
                <p className="text-slate-700 text-xs mt-1 leading-relaxed">
                  When volunteer supply is tight, cancels bottleneck dates so volunteers are not
                  stranded on broken half-teams, ensuring all scheduled meals are 100% complete.
                </p>
              </div>
            </label>
          </div>

          {/* 4. Team Sizing Targets Summary */}
          <div className="space-y-2 pt-3 border-t border-slate-200">
            <span className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-indigo-600" />
              Standard Meal Staffing Targets
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-300">
                <span className="font-bold text-indigo-950 block text-xs sm:text-sm">
                  Dinner Shifts
                </span>
                <p className="text-slate-700 text-xs mt-1">
                  🍳 3 Cooks (or 2 adaptive) • 🧼 3 Cleaners
                </p>
              </div>
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-300">
                <span className="font-bold text-amber-950 block text-xs sm:text-sm">
                  Brunch Shifts
                </span>
                <p className="text-slate-700 text-xs mt-1">🍳 2 Cooks • 🧼 2 Cleaners</p>
              </div>
            </div>
          </div>

          {/* 5. Google Drive Workspace & Master Community Registry */}
          <div className="space-y-3 pt-3 border-t border-slate-200">
            <span className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Folder className="w-4 h-4 text-emerald-600" />
              Google Drive Workspace &amp; Master Registry
            </span>
            <p className="text-slate-700 text-xs">
              Link the canonical community roster spreadsheet and provision test spreadsheets in
              your Drive folder.
            </p>

            <div className="space-y-3">
              <div>
                <label
                  htmlFor="master-sheet-url-input"
                  className="text-xs font-bold text-slate-800 block mb-1"
                >
                  Master Registry Sheet URL or ID:
                </label>
                <input
                  id="master-sheet-url-input"
                  type="text"
                  value={masterSheetInput}
                  onChange={(e) => setMasterSheetInput(e.target.value)}
                  placeholder="Leave blank to use default Script Property or paste Sheet URL..."
                  className="w-full min-h-[44px] px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white text-slate-900 font-medium"
                />
              </div>

              <div>
                <label
                  htmlFor="drive-folder-id-input"
                  className="text-xs font-bold text-slate-800 block mb-1"
                >
                  Target Google Drive Root Folder ID:
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    id="drive-folder-id-input"
                    type="text"
                    value={driveFolderId}
                    onChange={(e) => setDriveFolderId(e.target.value)}
                    placeholder="Google Drive Folder ID (e.g. 1U0cJqnxCgWn...)"
                    className="flex-1 min-h-[44px] px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white text-slate-900 font-medium font-mono"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleCreateLaunchers}
                      disabled={provisioning}
                      className="min-h-[44px] px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50 shrink-0 flex items-center gap-1.5 shadow-xs cursor-pointer"
                      title="Generates direct 1-click launcher documents and HTML shortcuts in Google Drive"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Create Shortcuts</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleProvisionDrive}
                      disabled={provisioning}
                      className="min-h-[44px] px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50 shrink-0 flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <RefreshCw className={`w-4 h-4 ${provisioning ? "animate-spin" : ""}`} />
                      <span>{provisioning ? "Provisioning..." : "Re-Provision Folders"}</span>
                    </button>
                  </div>
                </div>
              </div>

              {provisionResult && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center gap-1.5 text-emerald-950 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                    Drive Workspace Ready!
                  </div>
                  <div className="space-y-1.5 text-slate-800">
                    <p>
                      <strong>Live Master Registry:</strong>{" "}
                      <a
                        href={provisionResult.liveMasterSheetUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-800 hover:underline inline-flex items-center gap-1 font-bold"
                      >
                        Open Live Sheet <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </p>
                    <p>
                      <strong>Dev/Test Master Registry:</strong>{" "}
                      <a
                        href={provisionResult.devMasterSheetUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-800 hover:underline inline-flex items-center gap-1 font-bold"
                      >
                        Open Dev Sheet <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </p>
                    {provisionResult.testSheets && (
                      <div className="pt-2 border-t border-emerald-200">
                        <span className="font-bold text-slate-900 block mb-1">
                          Generated Test Scenario Sheets ({provisionResult.testSheets.length}):
                        </span>
                        <ul className="list-disc pl-4 space-y-1 text-slate-700">
                          {provisionResult.testSheets.map((ts: any) => (
                            <li key={ts.key}>
                              <a
                                href={ts.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-indigo-800 hover:underline inline-flex items-center gap-1 font-semibold"
                              >
                                {ts.name} <ExternalLink className="w-3 h-3" />
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 text-slate-700 hover:text-slate-950 font-bold text-xs sm:text-sm rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onSaveAndRecalculate}
            className="min-h-[44px] px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" /> Save &amp; Re-Calculate Schedule
          </button>
        </div>
      </div>
    </div>
  );
};

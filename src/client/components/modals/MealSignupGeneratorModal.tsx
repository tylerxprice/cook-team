import React from "react";
import {
  ClipboardList,
  X,
  CheckCircle2,
  FileSpreadsheet,
  ExternalLink,
  Calendar,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import {
  DaySchedule,
  MealSignupExportResult,
  MealSignupWorkbookInfo,
  ScheduleOutput,
} from "../../../server/types";
import { generateMealSignupPreviewColumns } from "../../../server/signupWorkbook";

export interface MealSignupGeneratorModalProps {
  show: boolean;
  onClose: () => void;
  mealSignupModalBodyRef: React.RefObject<HTMLDivElement>;
  mealSignupExportResult: MealSignupExportResult | null;
  mealSignupSchedule: DaySchedule[];
  mealSignupSourceSheet: string;
  setMealSignupSourceSheet: (val: string) => void;
  initMealSignupModal: (sourceSheetId?: string) => void;
  solverResult: ScheduleOutput | null;
  liveSheetsList: { id: string; name: string }[];
  devSheetsList: { id: string; name: string }[];
  mealSignupTargetWorkbookId: string;
  setMealSignupTargetWorkbookId: (val: string) => void;
  checkTargetWorkbook: (val: string) => void;
  mealSignupWorkbookError: string | null;
  mealSignupWorkbookInfo: MealSignupWorkbookInfo | null;
  mealSignupLoadingWorkbook: boolean;
  mealSignupTargetTabName: string;
  setMealSignupTargetTabName: (val: string) => void;
  mealSignupBackupExisting: boolean;
  setMealSignupBackupExisting: (val: boolean) => void;
  mealSignupHideOlder: boolean;
  setMealSignupHideOlder: (val: boolean) => void;
  mealSignupLoadingInfo: boolean;
  mealSignupCustomDeadlines: Record<string, string>;
  setMealSignupCustomDeadlines: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  mealSignupCustomDayLabels: Record<string, string>;
  setMealSignupCustomDayLabels: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  handleExecuteMealSignupExport: () => void;
  mealSignupLoadingExport: boolean;
}

export const MealSignupGeneratorModal: React.FC<MealSignupGeneratorModalProps> = ({
  show,
  onClose,
  mealSignupModalBodyRef,
  mealSignupExportResult,
  mealSignupSchedule,
  mealSignupSourceSheet,
  setMealSignupSourceSheet,
  initMealSignupModal,
  solverResult,
  liveSheetsList,
  devSheetsList,
  mealSignupTargetWorkbookId,
  setMealSignupTargetWorkbookId,
  checkTargetWorkbook,
  mealSignupWorkbookError,
  mealSignupWorkbookInfo,
  mealSignupLoadingWorkbook,
  mealSignupTargetTabName,
  setMealSignupTargetTabName,
  mealSignupBackupExisting,
  setMealSignupBackupExisting,
  mealSignupHideOlder,
  setMealSignupHideOlder,
  mealSignupLoadingInfo,
  mealSignupCustomDeadlines,
  setMealSignupCustomDeadlines,
  mealSignupCustomDayLabels,
  setMealSignupCustomDayLabels,
  handleExecuteMealSignupExport,
  mealSignupLoadingExport,
}) => {
  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title-meal-signup"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-900 text-white flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white border border-white/30">
              <ClipboardList className="w-6 h-6" />
            </div>
            <div>
              <h2
                id="modal-title-meal-signup"
                className="text-base sm:text-lg font-black tracking-tight text-white"
              >
                Common Meal Sign-Up Generator
              </h2>
              <p className="text-xs text-emerald-100 font-medium mt-0.5">
                Rose&apos;s Workflow • Create next month&apos;s meal sign-up sheet from
                Brenda&apos;s schedule
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="min-h-[44px] min-w-[44px] rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div
          ref={mealSignupModalBodyRef}
          className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50"
        >
          {/* Success Result Banner */}
          {mealSignupExportResult && mealSignupExportResult.success && (
            <div className="p-4 bg-emerald-50 border-2 border-emerald-300 rounded-2xl space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2 text-emerald-950 font-bold text-sm sm:text-base">
                  <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
                  <span>{mealSignupExportResult.message}</span>
                </div>
                {mealSignupExportResult.isBackupCreated && mealSignupExportResult.backupTabName && (
                  <span className="text-xs font-bold bg-emerald-100 text-emerald-950 px-2.5 py-1 rounded-full border border-emerald-300">
                    📦 Backup Saved: {mealSignupExportResult.backupTabName}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <a
                  href={mealSignupExportResult.tabUrl || mealSignupExportResult.spreadsheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md hover:shadow-lg cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Open &apos;{mealSignupExportResult.tabName}&apos; in Sign-Up Workbook</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
                <span className="text-xs text-emerald-900 font-bold">
                  ✓ {mealSignupExportResult.totalMealColumns} meal columns configured and sorted.
                </span>
              </div>
            </div>
          )}

          {/* Source & Target Configuration Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. Source Schedule Selection */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="meal-signup-source-sheet-select"
                  className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5"
                >
                  <Calendar className="w-4 h-4 text-orange-600" />
                  <span>1. Source Schedule (Brenda&apos;s Survey)</span>
                </label>
                {mealSignupSchedule.length > 0 && (
                  <span className="text-xs font-bold bg-orange-100 text-orange-950 border border-orange-300 px-2.5 py-0.5 rounded-full">
                    {mealSignupSchedule.length} Dates Found
                  </span>
                )}
              </div>

              <select
                id="meal-signup-source-sheet-select"
                value={mealSignupSourceSheet}
                onChange={(e) => {
                  setMealSignupSourceSheet(e.target.value);
                  initMealSignupModal(e.target.value);
                }}
                className="w-full min-h-[44px] px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-900"
              >
                <option value="">
                  {solverResult
                    ? "⚡ Currently Loaded Schedule (Active Solver)"
                    : "-- Select Finalized Survey Sheet --"}
                </option>
                {liveSheetsList.map((s) => (
                  <option key={s.id} value={s.id}>
                    📄 {s.name}
                  </option>
                ))}
                {devSheetsList.map((s) => (
                  <option key={s.id} value={s.id}>
                    🧪 {s.name}
                  </option>
                ))}
              </select>

              <p className="text-xs text-slate-700">
                Reads the finalized <code>Schedule_YYYY-MM</code> tab created in Step 4.
              </p>
            </div>

            {/* 2. Target Common Meal Sign-Up Workbook */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="meal-signup-target-workbook-id-input"
                  className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>2. Target Sign-Up Workbook</span>
                </label>
                {mealSignupWorkbookInfo && mealSignupWorkbookInfo.spreadsheetUrl && (
                  <a
                    href={mealSignupWorkbookInfo.spreadsheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 hover:text-emerald-950 underline"
                  >
                    <span>Open Workbook</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>

              <div className="relative">
                <input
                  id="meal-signup-target-workbook-id-input"
                  type="text"
                  placeholder="Paste Common Meal Sign-Up Sheet URL or ID..."
                  value={mealSignupTargetWorkbookId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setMealSignupTargetWorkbookId(val);
                  }}
                  onBlur={(e) => checkTargetWorkbook(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      checkTargetWorkbook(mealSignupTargetWorkbookId);
                    }
                  }}
                  className={`w-full min-h-[44px] pl-3.5 pr-24 py-2 text-xs sm:text-sm bg-slate-50 border rounded-xl focus:outline-none font-medium text-slate-900 font-mono transition-colors ${
                    mealSignupWorkbookError
                      ? "border-rose-400 focus:ring-2 focus:ring-rose-500/20 bg-rose-50 text-rose-950"
                      : mealSignupWorkbookInfo
                        ? "border-emerald-300 focus:ring-2 focus:ring-emerald-500/20"
                        : "border-slate-300 focus:ring-2 focus:ring-emerald-500/20"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => checkTargetWorkbook(mealSignupTargetWorkbookId)}
                  disabled={mealSignupLoadingWorkbook || !mealSignupTargetWorkbookId.trim()}
                  className="min-h-[36px] absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-40 flex items-center gap-1"
                  title="Click to check and verify spreadsheet link"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${mealSignupLoadingWorkbook ? "animate-spin text-emerald-600" : ""}`}
                  />
                  <span>{mealSignupLoadingWorkbook ? "Checking..." : "Verify"}</span>
                </button>
              </div>

              {/* Status / Error feedback */}
              {mealSignupLoadingWorkbook ? (
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                  <span>Checking spreadsheet in Google Sheets...</span>
                </div>
              ) : mealSignupWorkbookError ? (
                <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl flex items-start gap-2 text-xs text-rose-900 font-medium animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-bold">Spreadsheet Error</strong>
                    <span>{mealSignupWorkbookError}</span>
                  </div>
                </div>
              ) : mealSignupWorkbookInfo ? (
                <div className="flex items-center justify-between text-xs text-slate-700 bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl">
                  <div className="truncate mr-2 font-bold text-slate-900">
                    📄 {mealSignupWorkbookInfo.spreadsheetName}
                  </div>
                  {mealSignupWorkbookInfo.hasTemplate ? (
                    <span className="text-emerald-950 font-bold shrink-0 text-xs bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-md">
                      ✓ Template Tab Found
                    </span>
                  ) : (
                    <span className="text-amber-950 font-bold shrink-0 text-xs bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md">
                      ⚠️ No &apos;Template&apos; tab found
                    </span>
                  )}
                </div>
              ) : (
                <div className="text-xs text-slate-600">
                  Paste a Google Sheet URL or ID and press Enter or click Verify.
                </div>
              )}
            </div>
          </div>

          {/* Month Tab & Options */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
              <div>
                <label
                  htmlFor="meal-signup-target-tab-name-input"
                  className="text-xs sm:text-sm font-bold text-slate-800 block mb-1"
                >
                  New Sheet Tab Name:
                </label>
                <input
                  id="meal-signup-target-tab-name-input"
                  type="text"
                  value={mealSignupTargetTabName}
                  onChange={(e) => setMealSignupTargetTabName(e.target.value)}
                  placeholder="e.g. OCT 2026"
                  className="w-full min-h-[44px] px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div className="sm:col-span-2 space-y-2 pt-1">
                <label className="flex items-center gap-2 min-h-[36px] text-xs font-bold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mealSignupBackupExisting}
                    onChange={(e) => setMealSignupBackupExisting(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>
                    Backup existing tab if it already exists (e.g. &apos;
                    {mealSignupTargetTabName || "OCT 2026"} (Backup - YYYY-MM-DD)&apos;)
                  </span>
                </label>

                <label className="flex items-center gap-2 min-h-[36px] text-xs font-bold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mealSignupHideOlder}
                    onChange={(e) => setMealSignupHideOlder(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>
                    Auto-hide older month sheets (prior to current month) &amp; keep Template hidden
                  </span>
                </label>
              </div>
            </div>

            {/* Overwrite Warning Banner */}
            {mealSignupWorkbookInfo?.isTargetTabExisting && (
              <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl flex items-center gap-2 text-xs text-amber-950 font-medium">
                <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0" />
                <span>
                  <strong>Notice:</strong> &apos;{mealSignupTargetTabName}&apos; already exists in
                  the Common Meal Sign-Up Workbook.
                  {mealSignupBackupExisting
                    ? " It will be safely renamed to a hidden backup before publishing the fresh tab."
                    : " It will be overwritten."}
                </span>
              </div>
            )}
          </div>

          {/* Live Meal Date Columns Preview Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Meal Date Columns Preview ({mealSignupSchedule.length} Meals)</span>
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Injected in 3-column blocks across the duplicated Template tab. Deadlines default
                  to the day before at 9:00 AM.
                </p>
              </div>
            </div>

            {mealSignupLoadingInfo ? (
              <div className="p-8 text-center text-slate-600 text-xs sm:text-sm flex items-center justify-center gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
                <span>Loading schedule &amp; workbook preview...</span>
              </div>
            ) : mealSignupSchedule.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs sm:text-sm">
                No meals found. Please select a source survey spreadsheet above.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th
                        scope="col"
                        className="px-3.5 py-2.5 border-r border-slate-200 bg-slate-200/80 sticky left-0 z-10 w-28"
                      >
                        Row Header
                      </th>
                      {generateMealSignupPreviewColumns(
                        mealSignupSchedule,
                        mealSignupCustomDeadlines,
                        mealSignupCustomDayLabels
                      ).map((col) => (
                        <th
                          scope="col"
                          key={col.dateKey}
                          className="px-3.5 py-2.5 border-r border-slate-200 min-w-[160px] text-center font-bold text-slate-900"
                        >
                          {col.dayLabel}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {/* Row 4: DAY (Editable) */}
                    <tr className="bg-white">
                      <th
                        scope="row"
                        className="px-3.5 py-2 font-bold text-slate-700 bg-slate-50 border-r border-slate-200 sticky left-0 z-10 text-left"
                      >
                        Row 4: DAY
                      </th>
                      {generateMealSignupPreviewColumns(
                        mealSignupSchedule,
                        mealSignupCustomDeadlines,
                        mealSignupCustomDayLabels
                      ).map((col) => (
                        <td
                          key={`day-${col.dateKey}`}
                          className="px-2 py-1.5 border-r border-slate-200"
                        >
                          <label htmlFor={`day-edit-${col.dateKey}`} className="sr-only">
                            Day label for {col.dateKey}
                          </label>
                          <input
                            id={`day-edit-${col.dateKey}`}
                            type="text"
                            value={mealSignupCustomDayLabels[col.dateKey] ?? col.dayLabel}
                            onChange={(e) =>
                              setMealSignupCustomDayLabels((prev) => ({
                                ...prev,
                                [col.dateKey]: e.target.value,
                              }))
                            }
                            className="w-full min-h-[36px] px-2 py-1 text-xs bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900 text-center focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                            placeholder="e.g. MON - T&R Day"
                          />
                        </td>
                      ))}
                    </tr>

                    {/* Row 5: DATE & TIME */}
                    <tr className="bg-slate-50/50">
                      <th
                        scope="row"
                        className="px-3.5 py-2 font-bold text-slate-700 bg-slate-50 border-r border-slate-200 sticky left-0 z-10 text-left"
                      >
                        Row 5: DATE
                      </th>
                      {generateMealSignupPreviewColumns(
                        mealSignupSchedule,
                        mealSignupCustomDeadlines,
                        mealSignupCustomDayLabels
                      ).map((col) => (
                        <td
                          key={`date-${col.dateKey}`}
                          className="px-3.5 py-2 border-r border-slate-200 text-center font-bold text-emerald-900"
                        >
                          {col.dateShort}
                        </td>
                      ))}
                    </tr>

                    {/* Row 6: MEAL MAKERS */}
                    <tr className="bg-white">
                      <th
                        scope="row"
                        className="px-3.5 py-2 font-bold text-slate-700 bg-slate-50 border-r border-slate-200 sticky left-0 z-10 text-left"
                      >
                        Row 6: Cooks
                      </th>
                      {generateMealSignupPreviewColumns(
                        mealSignupSchedule,
                        mealSignupCustomDeadlines,
                        mealSignupCustomDayLabels
                      ).map((col) => (
                        <td
                          key={`cooks-${col.dateKey}`}
                          className="px-3.5 py-2 border-r border-slate-200 text-xs text-orange-950 font-bold"
                        >
                          {col.isNoMeal ? (
                            <span className="font-bold text-slate-400 italic">
                              No Community Meal
                            </span>
                          ) : (
                            col.cooks || <span className="text-rose-700 italic">Need Cooks</span>
                          )}
                        </td>
                      ))}
                    </tr>

                    {/* Row 7: Cleaners */}
                    <tr className="bg-slate-50/50">
                      <th
                        scope="row"
                        className="px-3.5 py-2 font-bold text-slate-700 bg-slate-50 border-r border-slate-200 sticky left-0 z-10 text-left"
                      >
                        Row 7: Cleaners
                      </th>
                      {generateMealSignupPreviewColumns(
                        mealSignupSchedule,
                        mealSignupCustomDeadlines,
                        mealSignupCustomDayLabels
                      ).map((col) => (
                        <td
                          key={`cleaners-${col.dateKey}`}
                          className="px-3.5 py-2 border-r border-slate-200 text-xs text-sky-950 font-bold"
                        >
                          {col.isNoMeal
                            ? ""
                            : col.cleaners || (
                                <span className="text-rose-700 italic">Need Cleaners</span>
                              )}
                        </td>
                      ))}
                    </tr>

                    {/* Row 8: SIGN UP DEADLINE (Editable) */}
                    <tr className="bg-white">
                      <th
                        scope="row"
                        className="px-3.5 py-2 font-bold text-slate-700 bg-slate-50 border-r border-slate-200 sticky left-0 z-10 text-left"
                      >
                        Row 8: Deadline
                      </th>
                      {generateMealSignupPreviewColumns(
                        mealSignupSchedule,
                        mealSignupCustomDeadlines,
                        mealSignupCustomDayLabels
                      ).map((col) => (
                        <td
                          key={`deadline-${col.dateKey}`}
                          className="px-2 py-1.5 border-r border-slate-200"
                        >
                          {col.isNoMeal ? (
                            <span className="text-slate-400 text-center block font-bold">—</span>
                          ) : (
                            <div>
                              <label htmlFor={`deadline-edit-${col.dateKey}`} className="sr-only">
                                Deadline for {col.dateKey}
                              </label>
                              <input
                                id={`deadline-edit-${col.dateKey}`}
                                type="text"
                                value={mealSignupCustomDeadlines[col.dateKey] || col.deadline}
                                onChange={(e) =>
                                  setMealSignupCustomDeadlines((prev) => ({
                                    ...prev,
                                    [col.dateKey]: e.target.value,
                                  }))
                                }
                                className="w-full min-h-[36px] px-2 py-1 text-xs bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900 text-center focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                placeholder="e.g. Saturday 9am"
                              />
                            </div>
                          )}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          {mealSignupExportResult && mealSignupExportResult.success ? (
            <>
              <div className="flex items-center gap-2 text-xs sm:text-sm text-emerald-950 font-bold">
                <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
                <span>
                  ✓ &apos;{mealSignupExportResult.tabName}&apos; sheet created in Sign-Up Workbook!
                </span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[44px] px-5 py-2 text-xs sm:text-sm font-bold text-slate-700 hover:text-slate-950 bg-white border border-slate-300 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  Close
                </button>

                <a
                  href={mealSignupExportResult.tabUrl || mealSignupExportResult.spreadsheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="min-h-[44px] px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center gap-2 cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Open &apos;{mealSignupExportResult.tabName}&apos; in Sign-Up Workbook</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </>
          ) : (
            <>
              <div className="text-xs sm:text-sm text-slate-700 font-semibold">
                {mealSignupSchedule.length > 0
                  ? `Ready to generate '${mealSignupTargetTabName || "OCT 2026"}' with ${mealSignupSchedule.length} meal dates.`
                  : "Please select a schedule to proceed."}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[44px] px-5 py-2 text-xs sm:text-sm font-bold text-slate-700 hover:text-slate-950 bg-white border border-slate-300 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleExecuteMealSignupExport}
                  disabled={mealSignupLoadingExport || mealSignupSchedule.length === 0}
                  className="min-h-[44px] px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {mealSignupLoadingExport ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Publishing Sign-Up Sheet...</span>
                    </>
                  ) : (
                    <>
                      <ClipboardList className="w-4 h-4" />
                      <span>Generate {mealSignupTargetTabName || "Month"} Sign-Up Sheet</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

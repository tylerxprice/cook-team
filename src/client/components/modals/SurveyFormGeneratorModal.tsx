import React from "react";
import {
  FileText,
  X,
  CheckCircle2,
  Copy,
  ExternalLink,
  Pencil,
  FileSpreadsheet,
  Folder,
  Settings,
  Sparkles,
  Calendar,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { MealType, SurveyFormDateConfig, CreateSurveyFormResult } from "../../../server/types";

export interface SurveyFormGeneratorModalProps {
  show: boolean;
  onClose: () => void;
  surveyFormModalBodyRef: React.RefObject<HTMLDivElement>;
  surveyFormMonthKey: string;
  setSurveyFormMonthKey: (val: string) => void;
  loadSurveyFormDatesPreview: (mKey: string) => void;
  surveyFormTitle: string;
  setSurveyFormTitle: (val: string) => void;
  surveyFormFolderId: string;
  setSurveyFormFolderId: (val: string) => void;
  surveyFormDates: SurveyFormDateConfig[];
  setSurveyFormDates: React.Dispatch<React.SetStateAction<SurveyFormDateConfig[]>>;
  surveyFormLoadingDates: boolean;
  surveyFormLoadingCreate: boolean;
  surveyFormResult: CreateSurveyFormResult | null;
  surveyFormCopiedLink: boolean;
  handleCopySurveyLink: (url: string) => void;
  handleAddCustomSurveyDate: () => void;
  handleExecuteCreateSurveyForm: () => void;
}

export const SurveyFormGeneratorModal: React.FC<SurveyFormGeneratorModalProps> = ({
  show,
  onClose,
  surveyFormModalBodyRef,
  surveyFormMonthKey,
  setSurveyFormMonthKey,
  loadSurveyFormDatesPreview,
  surveyFormTitle,
  setSurveyFormTitle,
  surveyFormFolderId,
  setSurveyFormFolderId,
  surveyFormDates,
  setSurveyFormDates,
  surveyFormLoadingDates,
  surveyFormLoadingCreate,
  surveyFormResult,
  surveyFormCopiedLink,
  handleCopySurveyLink,
  handleAddCustomSurveyDate,
  handleExecuteCreateSurveyForm,
}) => {
  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title-survey-form"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-violet-700 via-purple-700 to-indigo-800 text-white flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-white border border-white/20">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h2
                id="modal-title-survey-form"
                className="text-base sm:text-lg font-black tracking-tight"
              >
                Survey Form Generator
              </h2>
              <p className="text-xs text-violet-100 font-medium">
                Brenda&apos;s Workflow • Create next month&apos;s Google Form &amp; Response Sheet
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
          ref={surveyFormModalBodyRef}
          className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50"
        >
          {/* Success Result Banner */}
          {surveyFormResult && surveyFormResult.success && (
            <div className="p-5 bg-emerald-50 border-2 border-emerald-300 rounded-2xl space-y-4 shadow-xs animate-in fade-in duration-200">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2 text-emerald-950 font-bold text-sm sm:text-base">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                  <span>{surveyFormResult.message}</span>
                </div>
                <span className="text-xs font-bold bg-emerald-100 text-emerald-900 px-3 py-1 rounded-full border border-emerald-300 shrink-0">
                  {surveyFormResult.totalDates} Dates Included
                </span>
              </div>

              {/* Quick Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => handleCopySurveyLink(surveyFormResult.formPublishedUrl)}
                  className="min-h-[44px] px-3.5 py-2.5 bg-violet-700 hover:bg-violet-800 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs hover:shadow transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {surveyFormCopiedLink ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  <span>{surveyFormCopiedLink ? "Link Copied!" : "Copy Survey Link"}</span>
                </button>

                <a
                  href={surveyFormResult.formPublishedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="min-h-[44px] px-3.5 py-2.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs sm:text-sm font-bold rounded-xl shadow-2xs hover:shadow transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4 text-slate-600" />
                  <span>View Live Form ↗</span>
                </a>

                <a
                  href={surveyFormResult.formEditUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="min-h-[44px] px-3.5 py-2.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs sm:text-sm font-bold rounded-xl shadow-2xs hover:shadow transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Pencil className="w-4 h-4 text-purple-600" />
                  <span>Edit Google Form ↗</span>
                </a>

                <a
                  href={surveyFormResult.spreadsheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="min-h-[44px] px-3.5 py-2.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs sm:text-sm font-bold rounded-xl shadow-2xs hover:shadow transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Response Sheet ↗</span>
                </a>
              </div>

              {surveyFormResult.folderUrl && (
                <div className="text-xs text-slate-600 flex items-center gap-1.5 pt-1">
                  <Folder className="w-4 h-4 text-slate-500" />
                  <span>Saved inside Google Drive folder:</span>
                  <a
                    href={surveyFormResult.folderUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-violet-700 hover:underline font-bold"
                  >
                    Open Drive Folder ↗
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Form Settings Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <Settings className="w-4 h-4 text-violet-600" />
                Target Month &amp; Form Title
              </h3>
              <div className="flex items-center gap-1.5 flex-wrap">
                {["2026-10", "2026-11", "2026-12", "2027-01"].map((mKey) => (
                  <button
                    key={mKey}
                    type="button"
                    onClick={() => {
                      setSurveyFormMonthKey(mKey);
                      loadSurveyFormDatesPreview(mKey);
                    }}
                    className={`min-h-[38px] px-3 py-1.5 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
                      surveyFormMonthKey === mKey
                        ? "bg-violet-700 text-white shadow-xs"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
                    }`}
                  >
                    {mKey}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="survey-form-month-key"
                  className="block text-xs sm:text-sm font-bold text-slate-800 mb-1.5"
                >
                  Target Month (YYYY-MM)
                </label>
                <input
                  id="survey-form-month-key"
                  type="month"
                  value={surveyFormMonthKey}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSurveyFormMonthKey(val);
                    if (val) loadSurveyFormDatesPreview(val);
                  }}
                  className="w-full min-h-[44px] px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 font-semibold text-slate-900"
                />
              </div>

              <div>
                <label
                  htmlFor="survey-form-title"
                  className="block text-xs sm:text-sm font-bold text-slate-800 mb-1.5"
                >
                  Google Form Title
                </label>
                <input
                  id="survey-form-title"
                  type="text"
                  value={surveyFormTitle}
                  onChange={(e) => setSurveyFormTitle(e.target.value)}
                  placeholder="e.g. 26-11 Nov Meal Team Sign-Up"
                  className="w-full min-h-[44px] px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 font-semibold text-slate-900"
                />
              </div>

              <div>
                <label
                  htmlFor="survey-form-folder-id"
                  className="block text-xs sm:text-sm font-bold text-slate-800 mb-1.5"
                >
                  Target Google Drive Folder ID
                </label>
                <input
                  id="survey-form-folder-id"
                  type="text"
                  value={surveyFormFolderId}
                  onChange={(e) => setSurveyFormFolderId(e.target.value)}
                  placeholder="1miNkXw-7co1ncAMZvaRJYUZXkFT07R4o"
                  className="w-full min-h-[44px] px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 font-mono text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* Standard Question Suite Preview Summary */}
          <div className="bg-violet-50/80 border border-violet-200 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-violet-950">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-600 shrink-0" />
                <span>Standard 8-Question Suite Included</span>
              </div>
              <span className="text-xs font-bold text-violet-900 bg-violet-100 border border-violet-200 px-3 py-1 rounded-full">
                Community Standard
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-700 pt-1">
              <div className="bg-white p-2.5 rounded-xl border border-violet-200 font-medium shadow-2xs">
                1. Verified Email (1-Click Consent)
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-violet-200 font-medium shadow-2xs">
                2. Member Name (Text)
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-violet-200 font-medium shadow-2xs">
                3. Cook Quota [1, 2, 3, 0]
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-violet-200 font-medium shadow-2xs">
                4. Clean Quota [1, 2, 3, 0]
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-violet-200 font-medium shadow-2xs">
                5. Cook Team Size (Dropdown)
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-violet-200 font-medium shadow-2xs">
                6. Same-Day Shift (Dropdown)
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-violet-200 font-medium shadow-2xs">
                7. Date Availability Grid
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-violet-200 font-medium shadow-2xs">
                8. Notes &amp; Instructions
              </div>
            </div>
          </div>

          {/* Interactive Meal Dates Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden space-y-3 p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-violet-600" />
                  Configure Meal Dates for Survey Grid
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Toggle dates on/off, change meal types, or add special notes (e.g.
                  &apos;Thanksgiving&apos;, &apos;Community Meeting&apos;).
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const allIncluded = surveyFormDates.every((d) => d.included);
                    setSurveyFormDates((prev) =>
                      prev.map((d) => ({ ...d, included: !allIncluded }))
                    );
                  }}
                  className="min-h-[38px] px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  {surveyFormDates.every((d) => d.included) ? "Deselect All" : "Select All"}
                </button>

                <button
                  type="button"
                  onClick={handleAddCustomSurveyDate}
                  className="min-h-[38px] px-3.5 py-1.5 text-xs font-bold text-violet-800 hover:text-violet-950 bg-violet-50 hover:bg-violet-100 border border-violet-300 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Custom Date</span>
                </button>
              </div>
            </div>

            {surveyFormLoadingDates ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-500 gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-violet-600" />
                <span className="text-xs sm:text-sm font-medium">Calculating meal dates...</span>
              </div>
            ) : surveyFormDates.length === 0 ? (
              <div className="py-8 text-center text-xs sm:text-sm text-slate-500">
                No dates found for this month. Please select a valid month.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs sm:text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200">
                      <th scope="col" className="py-3 px-3 w-14 text-center">
                        Include
                      </th>
                      <th scope="col" className="py-3 px-3 w-28">
                        Date
                      </th>
                      <th scope="col" className="py-3 px-3 w-24">
                        Day
                      </th>
                      <th scope="col" className="py-3 px-3 w-32">
                        Meal Type
                      </th>
                      <th scope="col" className="py-3 px-3">
                        Special Note (Optional)
                      </th>
                      <th scope="col" className="py-3 px-3">
                        Form Grid Row Label Preview
                      </th>
                      <th scope="col" className="py-3 px-3 w-14 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {surveyFormDates.map((d, idx) => {
                      let previewLabel = d.dateLabel;
                      if (d.specialNote && d.specialNote.trim()) {
                        previewLabel = `${previewLabel} - ${d.specialNote.trim()}`;
                      }
                      return (
                        <tr
                          key={`date-${d.dateKey}-${idx}`}
                          className={`transition-colors ${
                            d.included ? "hover:bg-violet-50/30" : "bg-slate-50/50 opacity-60"
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={d.included}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setSurveyFormDates((prev) =>
                                  prev.map((item, i) =>
                                    i === idx ? { ...item, included: checked } : item
                                  )
                                );
                              }}
                              aria-label={`Include date ${d.dateKey}`}
                              className="w-5 h-5 rounded text-violet-600 focus:ring-violet-500 border-slate-300 cursor-pointer"
                            />
                          </td>
                          <td className="py-2.5 px-3 font-mono font-medium text-slate-800">
                            {d.dateKey}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-900">
                            {d.dayOfWeek}
                          </td>
                          <td className="py-2.5 px-3">
                            <select
                              value={d.mealType}
                              disabled={!d.included}
                              aria-label={`Meal type for ${d.dateKey}`}
                              onChange={(e) => {
                                const mType = e.target.value as MealType;
                                const shortName = d.dateLabel.split(" ")[0] || "Nov";
                                const dayNum = d.dateKey.split("-")[2] || "1";
                                let newLabel = d.dateLabel;
                                if (d.dayOfWeek === "Sunday") {
                                  newLabel = `${shortName} ${parseInt(dayNum, 10)} (${mType === "BRUNCH" ? "Sun, Brunch" : "Sun, Dinner"})`;
                                }
                                setSurveyFormDates((prev) =>
                                  prev.map((item, i) =>
                                    i === idx
                                      ? { ...item, mealType: mType, dateLabel: newLabel }
                                      : item
                                  )
                                );
                              }}
                              className="min-h-[38px] px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500"
                            >
                              <option value="DINNER">Dinner</option>
                              <option value="BRUNCH">Brunch</option>
                            </select>
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              value={d.specialNote || ""}
                              disabled={!d.included}
                              aria-label={`Special note for ${d.dateKey}`}
                              onChange={(e) => {
                                const note = e.target.value;
                                setSurveyFormDates((prev) =>
                                  prev.map((item, i) =>
                                    i === idx ? { ...item, specialNote: note } : item
                                  )
                                );
                              }}
                              placeholder="e.g. Thanksgiving, Community Meeting"
                              className="w-full min-h-[38px] px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 text-slate-900 placeholder:text-slate-400"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-xs font-medium text-slate-700">
                            <span className="px-2.5 py-1 bg-slate-100 rounded-lg border border-slate-200">
                              {previewLabel}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                setSurveyFormDates((prev) => prev.filter((_, i) => i !== idx));
                              }}
                              aria-label={`Remove meal date ${d.dateKey}`}
                              title={`Remove date ${d.dateKey}`}
                              className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          {surveyFormResult && surveyFormResult.success ? (
            <>
              <div className="flex items-center gap-2 text-xs sm:text-sm text-emerald-900 font-bold">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>✓ &apos;{surveyFormResult.formTitle}&apos; created and linked!</span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[44px] px-5 py-2.5 text-xs sm:text-sm font-bold text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded-xl cursor-pointer transition-colors"
                >
                  Close
                </button>

                <button
                  type="button"
                  onClick={() => handleCopySurveyLink(surveyFormResult.formPublishedUrl)}
                  className="min-h-[44px] px-4 py-2.5 text-xs sm:text-sm font-bold text-violet-800 bg-violet-100 hover:bg-violet-200 border border-violet-300 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {surveyFormCopiedLink ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  <span>{surveyFormCopiedLink ? "Link Copied!" : "Copy Survey Link"}</span>
                </button>

                <a
                  href={surveyFormResult.formPublishedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="min-h-[44px] px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-violet-700 hover:bg-violet-800 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center gap-2 cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Open Live Survey ↗</span>
                </a>
              </div>
            </>
          ) : (
            <>
              <div className="text-xs sm:text-sm text-slate-600 font-medium">
                {surveyFormDates.filter((d) => d.included).length} of {surveyFormDates.length} meal
                dates selected for inclusion in the Google Form.
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[44px] px-5 py-2.5 text-xs sm:text-sm font-bold text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded-xl cursor-pointer transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleExecuteCreateSurveyForm}
                  disabled={
                    surveyFormLoadingCreate ||
                    surveyFormDates.filter((d) => d.included).length === 0
                  }
                  className="min-h-[44px] px-6 py-2.5 text-xs sm:text-sm font-bold text-white bg-violet-700 hover:bg-violet-800 rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {surveyFormLoadingCreate ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Generating Google Form &amp; Response Sheet...</span>
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4" />
                      <span>Generate Google Form &amp; Response Sheet</span>
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

import React from "react";
import { AlertTriangle, FileText, X, RefreshCw } from "lucide-react";
import { ExistingSurveyInfo } from "../../../server/types";

interface OverwriteSurveyConfirmModalProps {
  show: boolean;
  onClose: () => void;
  onConfirm: () => void;
  monthKey: string;
  existingSurvey: ExistingSurveyInfo | null;
  loading?: boolean;
}

export const OverwriteSurveyConfirmModal: React.FC<OverwriteSurveyConfirmModalProps> = ({
  show,
  onClose,
  onConfirm,
  monthKey,
  existingSurvey,
  loading = false,
}) => {
  if (!show || !existingSurvey) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="overwrite-survey-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in"
    >
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-scale-up">
        <div className="flex items-start justify-between gap-3.5">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-300 text-amber-800 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-6 h-6 text-amber-700" />
            </div>
            <div>
              <h3
                id="overwrite-survey-modal-title"
                className="text-base sm:text-lg font-bold text-slate-900"
              >
                Overwrite Existing Survey?
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-1">
                A survey form or response sheet already exists for <strong>{monthKey}</strong>.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Close"
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs text-slate-700">
          <div className="flex items-center gap-2 font-semibold text-slate-900">
            <FileText className="w-4 h-4 text-violet-600" />
            <span className="truncate">
              {existingSurvey.spreadsheetName || `${monthKey} Responses`}
            </span>
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-slate-200 text-slate-600">
            <span>Responses recorded:</span>
            <span className="font-bold text-slate-900">
              {existingSurvey.responseCount}{" "}
              {existingSurvey.responseCount === 1 ? "response" : "responses"}
            </span>
          </div>
        </div>

        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-950 space-y-1">
          <p className="font-bold">⚠️ Warning</p>
          <p className="text-amber-800">
            Generating a new Google Form will create a brand-new form and response spreadsheet in
            Google Drive. Any residents using the previous link will need the new link.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="min-h-[44px] px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="min-h-[44px] px-4 py-2 text-xs sm:text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-colors shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Overwriting &amp; Creating...</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4" />
                <span>Yes, Overwrite &amp; Create Form</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

import React from "react";
import { AlertTriangle, Send } from "lucide-react";
import { EmailDispatchInfo } from "../../../server/types";

interface ResendConfirmModalProps {
  show: boolean;
  onClose: () => void;
  onConfirm: () => void;
  emailDispatchInfo: EmailDispatchInfo | null;
  emailTo: string;
}

export const ResendConfirmModal: React.FC<ResendConfirmModalProps> = ({
  show,
  onClose,
  onConfirm,
  emailDispatchInfo,
  emailTo,
}) => {
  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="duplicate-email-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in"
    >
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-scale-up">
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-300 text-amber-800 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6 text-amber-700" />
          </div>
          <div>
            <h3
              id="duplicate-email-modal-title"
              className="text-base sm:text-lg font-bold text-slate-900"
            >
              Send Duplicate Announcement?
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              An announcement email for this schedule was already sent to{" "}
              <strong>{emailDispatchInfo?.to || emailTo}</strong>
              {emailDispatchInfo?.sentAt
                ? ` on ${new Date(emailDispatchInfo.sentAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}`
                : ""}
              .
            </p>
          </div>
        </div>

        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-950 space-y-1">
          <p className="font-bold">⚠️ Are you sure you want to send another email?</p>
          <p className="text-amber-800">
            This will dispatch a new email notification to all group members immediately.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs sm:text-sm font-bold transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-orange-600/20 transition-all cursor-pointer inline-flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            <span>Yes, Send Email Again</span>
          </button>
        </div>
      </div>
    </div>
  );
};

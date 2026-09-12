import React from "react";
import {
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Mail,
  Copy,
  FileText,
  Send,
  AlertTriangle,
} from "lucide-react";
import { ScheduleOutput, EmailDispatchInfo } from "../../../server/types";

interface Step4PublishEmailProps {
  solverResult: ScheduleOutput;
  exportedResult: {
    url?: string;
    sheetName?: string;
    success?: boolean;
    message?: string;
  } | null;
  sheetInput: string;
  loading: boolean;
  handleExportSheet: (result: ScheduleOutput) => Promise<void> | void;
  handleCopyEmail: () => void;
  handleSendGmail: (mode: "draft" | "send") => Promise<void> | void;
  sendingEmail: boolean;
  emailDispatchInfo: EmailDispatchInfo | null;
  emailDeliveryResult: {
    success?: boolean;
    mode: "send" | "draft";
    message: string;
    recipient?: string;
    recipientCount?: number;
  } | null;
  emailTo: string;
  setEmailTo: (to: string) => void;
  LIVE_LISTSERV_EMAIL: string;
  DEV_TEST_EMAIL: string;
  emailSubject: string;
  setEmailSubject: (subject: string) => void;
  isEmailSubjectDirty: React.MutableRefObject<boolean>;
  customEmailBody: string | null;
  setCustomEmailBody: (body: string | null) => void;
  generateEmailText: () => string;
  goToStep: (step: 1 | 2 | 3 | 4) => void;
  parseDateFromLabelOrKey: (label: string, key?: string) => Date | null;
}

export const Step4PublishEmail: React.FC<Step4PublishEmailProps> = ({
  solverResult,
  exportedResult,
  sheetInput,
  loading,
  handleExportSheet,
  handleCopyEmail,
  handleSendGmail,
  sendingEmail,
  emailDispatchInfo,
  emailDeliveryResult,
  emailTo,
  setEmailTo,
  LIVE_LISTSERV_EMAIL,
  DEV_TEST_EMAIL,
  emailSubject,
  setEmailSubject,
  isEmailSubjectDirty,
  customEmailBody,
  setCustomEmailBody,
  generateEmailText,
  goToStep,
  parseDateFromLabelOrKey,
}) => {
  return (
    <div className="space-y-6">
      {/* Full-width Horizontal Auto-Publish Status Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6 text-emerald-700" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-slate-900">
                Schedule Published to Google Sheets
              </h3>
              <span className="text-xs font-mono font-bold text-emerald-950 bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-lg">
                {exportedResult?.sheetName ||
                  (() => {
                    if (solverResult?.schedule?.length) {
                      for (const d of solverResult.schedule) {
                        if (d.dateKey && /^\d{4}-\d{2}/.test(d.dateKey)) {
                          return `Schedule_${d.dateKey.slice(0, 7)}`;
                        }
                        const parsed = parseDateFromLabelOrKey(d.dateLabel, d.dateKey);
                        if (parsed && !isNaN(parsed.getTime())) {
                          return `Schedule_${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`;
                        }
                      }
                    }
                    return "Schedule_2026-10";
                  })()}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
              All {solverResult.schedule.length} monthly meal shifts have been automatically
              published to your spreadsheet tab.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {exportedResult?.url ? (
            <a
              href={exportedResult.url}
              target="_blank"
              rel="noreferrer"
              className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-colors cursor-pointer"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Open Tab in Sheets</span>
            </a>
          ) : sheetInput ? (
            <a
              href={
                sheetInput.startsWith("http")
                  ? sheetInput
                  : `https://docs.google.com/spreadsheets/d/${sheetInput}`
              }
              target="_blank"
              rel="noreferrer"
              className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-colors cursor-pointer"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Open in Sheets</span>
            </a>
          ) : null}
          <button
            onClick={() => handleExportSheet(solverResult)}
            disabled={loading}
            className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs sm:text-sm font-bold border border-slate-300 transition-colors cursor-pointer"
            title="Re-write spreadsheet tab"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span>Update Tab</span>
          </button>
        </div>
      </div>

      {/* Full-width Community Announcement & Gmail Dispatch Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-800 border border-blue-200 flex items-center justify-center shrink-0">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Community Announcement &amp; Gmail Dispatch
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                Send directly through your connected Gmail account, create a draft in Gmail, or copy
                formatted text
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleCopyEmail}
              className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-xl text-xs sm:text-sm font-bold transition-colors cursor-pointer"
            >
              <Copy className="w-4 h-4" />
              <span>Copy Text</span>
            </button>
            <button
              onClick={() => handleSendGmail("draft")}
              disabled={sendingEmail}
              className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-300 rounded-xl text-xs sm:text-sm font-bold transition-colors disabled:opacity-50 cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              <span>Create Gmail Draft</span>
            </button>
            <button
              onClick={() => handleSendGmail("send")}
              disabled={sendingEmail}
              className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Send className={`w-4 h-4 ${sendingEmail ? "animate-spin" : ""}`} />
              <span>Send via Gmail</span>
            </button>
          </div>
        </div>

        {/* Warning Banner if Email Announcement was Already Sent */}
        {emailDispatchInfo?.alreadySent && (
          <div
            role="alert"
            className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm animate-fade-in"
          >
            <div className="flex items-start sm:items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-amber-100 border border-amber-300 text-amber-800 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                <AlertTriangle className="w-6 h-6 text-amber-700" />
              </div>
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold uppercase tracking-wider bg-amber-200 text-amber-950 px-2.5 py-0.5 rounded-lg border border-amber-300">
                    Notice: Announcement Already Sent
                  </span>
                  {emailDispatchInfo.sentAt && (
                    <span className="text-xs font-semibold text-amber-900">
                      Sent on{" "}
                      {new Date(emailDispatchInfo.sentAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-amber-950 font-medium">
                  A monthly meal announcement was already emailed to{" "}
                  <strong>{emailDispatchInfo.to || emailTo}</strong>.
                </p>
                {emailDispatchInfo.subject && (
                  <p className="text-xs text-amber-800 italic">
                    Subject: "{emailDispatchInfo.subject}"{" "}
                    {emailDispatchInfo.sentBy ? `• Sent by ${emailDispatchInfo.sentBy}` : ""}
                  </p>
                )}
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-2 sm:self-center">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-950 bg-amber-100 px-3 py-1.5 rounded-xl border border-amber-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>Broadcast Logged</span>
              </span>
            </div>
          </div>
        )}

        {/* Delivery Result Alert Banner */}
        {emailDeliveryResult && (
          <div
            role="status"
            aria-live="polite"
            className={`p-4 rounded-xl border flex items-center justify-between gap-3 animate-fade-in ${
              emailDeliveryResult.mode === "send"
                ? "bg-emerald-50 border-emerald-300 text-emerald-950 font-semibold"
                : "bg-blue-50 border-blue-300 text-blue-950 font-semibold"
            }`}
          >
            <div className="flex items-center gap-2.5 text-xs sm:text-sm min-w-0">
              <CheckCircle2
                className={`w-5 h-5 shrink-0 ${
                  emailDeliveryResult.mode === "send" ? "text-emerald-700" : "text-blue-700"
                }`}
              />
              <span className="truncate">{emailDeliveryResult.message}</span>
            </div>
            <a
              href="https://mail.google.com"
              target="_blank"
              rel="noreferrer"
              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shrink-0 ${
                emailDeliveryResult.mode === "send"
                  ? "bg-emerald-700 hover:bg-emerald-800 text-white"
                  : "bg-blue-700 hover:bg-blue-800 text-white"
              }`}
            >
              <span>Open Gmail</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}

        {/* Email Header Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <label
                htmlFor="email-recipients-to-input"
                className="text-xs sm:text-sm font-bold text-slate-800"
              >
                Recipients / Listserv (To:)
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setEmailTo(LIVE_LISTSERV_EMAIL)}
                  className={`text-xs px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                    emailTo === LIVE_LISTSERV_EMAIL
                      ? "bg-blue-100 text-blue-950 border border-blue-300"
                      : "text-slate-700 hover:text-blue-900 bg-slate-100 border border-slate-200"
                  }`}
                >
                  Vancouver Cohousing Listserv
                </button>
                <button
                  type="button"
                  onClick={() => setEmailTo(DEV_TEST_EMAIL)}
                  className={`text-xs px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                    emailTo === DEV_TEST_EMAIL
                      ? "bg-amber-100 text-amber-950 border border-amber-300"
                      : "text-slate-700 hover:text-amber-900 bg-slate-100 border border-slate-200"
                  }`}
                >
                  Dev / Test (Tyler)
                </button>
              </div>
            </div>
            <input
              id="email-recipients-to-input"
              type="text"
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              placeholder="e.g. Vancouver Cohousing Residents <vancoho-residents@googlegroups.com>"
              className="w-full min-h-[44px] px-3.5 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white font-medium text-slate-900"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="email-subject-line-input"
              className="text-xs sm:text-sm font-bold text-slate-800"
            >
              Subject Line
            </label>
            <input
              id="email-subject-line-input"
              type="text"
              value={emailSubject}
              onChange={(e) => {
                isEmailSubjectDirty.current = true;
                setEmailSubject(e.target.value);
              }}
              placeholder="Subject line..."
              className="w-full min-h-[44px] px-3.5 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white font-bold text-slate-900"
            />
          </div>
        </div>

        {/* Email Body Editor */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="email-body-text-area"
              className="text-xs sm:text-sm font-bold text-slate-800"
            >
              Email Announcement Body
            </label>
            {customEmailBody !== null && (
              <button
                onClick={() => setCustomEmailBody(null)}
                className="text-xs text-orange-700 hover:text-orange-900 font-bold hover:underline cursor-pointer"
              >
                Reset to Default Template
              </button>
            )}
          </div>
          <textarea
            id="email-body-text-area"
            value={generateEmailText()}
            onChange={(e) => setCustomEmailBody(e.target.value)}
            rows={12}
            className="w-full p-4 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 leading-relaxed resize-y select-all"
          />
        </div>
      </div>

      <div className="flex justify-start">
        <button
          onClick={() => goToStep(3)}
          className="min-h-[48px] px-5 py-2.5 text-xs sm:text-sm font-bold text-slate-700 hover:text-slate-950 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
        >
          ← Back to Schedule View
        </button>
      </div>
    </div>
  );
};

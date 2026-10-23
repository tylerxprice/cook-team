import React, { useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Mail,
  Copy,
  Eye,
  Edit3,
  Check,
} from "lucide-react";
import { ScheduleOutput, EmailDispatchInfo, MonthStatus } from "../../../server/types";
import { formatEmailHtmlBody } from "../../utils/formatters";

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
  emailCc: string;
  setEmailCc: (cc: string) => void;
  DEFAULT_ANNOUNCEMENT_TO: string;
  DEFAULT_ANNOUNCEMENT_CC: string;
  DEV_TEST_EMAIL?: string;
  emailSubject: string;
  setEmailSubject: (subject: string) => void;
  isEmailSubjectDirty: React.MutableRefObject<boolean>;
  customEmailBody: string | null;
  setCustomEmailBody: (body: string | null) => void;
  generateEmailText: () => string;
  goToStep: (step: 1 | 2 | 3 | 4) => void;
  parseDateFromLabelOrKey: (label: string, key?: string) => Date | null;
  monthKey?: string;
  monthStatus?: MonthStatus;
  recordingBroadcast?: boolean;
  onRecordBroadcastSent?: (info?: Partial<EmailDispatchInfo>) => Promise<void>;
  onToggleBroadcastSent?: (sent: boolean) => Promise<void>;
}

export const Step4PublishEmail: React.FC<Step4PublishEmailProps> = ({
  solverResult,
  exportedResult,
  sheetInput,
  loading,
  handleExportSheet: _handleExportSheet,
  handleCopyEmail,
  handleSendGmail: _handleSendGmail,
  sendingEmail: _sendingEmail,
  emailDispatchInfo,
  emailDeliveryResult,
  emailTo,
  setEmailTo,
  emailCc,
  setEmailCc,
  DEFAULT_ANNOUNCEMENT_TO,
  DEFAULT_ANNOUNCEMENT_CC,
  DEV_TEST_EMAIL: _DEV_TEST_EMAIL,
  emailSubject,
  setEmailSubject,
  isEmailSubjectDirty,
  customEmailBody,
  setCustomEmailBody,
  generateEmailText,
  goToStep,
  parseDateFromLabelOrKey,
  monthKey,
  monthStatus,
  recordingBroadcast = false,
  onRecordBroadcastSent,
  onToggleBroadcastSent,
}) => {
  const [emailTab, setEmailTab] = useState<"edit" | "preview">("edit");
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isEditingResend, setIsEditingResend] = useState<boolean>(false);
  const recording = isRecording || recordingBroadcast;
  const isBroadcastSent = Boolean(
    emailDispatchInfo?.alreadySent || monthStatus === "EMAIL_SENT" || monthStatus === "CLOSED"
  );

  React.useEffect(() => {
    setIsEditingResend(false);
  }, [monthKey]);

  const showSentNoticeOnly = isBroadcastSent && !isEditingResend;

  const scheduleTabName =
    exportedResult?.sheetName ||
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
    })();

  const sheetUrl =
    exportedResult?.url ||
    (sheetInput
      ? sheetInput.startsWith("http")
        ? sheetInput
        : `https://docs.google.com/spreadsheets/d/${sheetInput}/edit`
      : "");

  return (
    <div className="space-y-6">
      {/* Compact Schedule Published Status Banner */}
      <div className="bg-white dark:bg-slate-900 px-5 py-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Schedule Published
              </h3>
              {sheetUrl ? (
                <a
                  href={sheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  title="Open schedule tab in Google Sheets"
                  className="inline-flex items-center gap-1 text-xs font-mono font-bold text-emerald-950 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-950/60 hover:bg-emerald-200 dark:hover:bg-emerald-900 border border-emerald-300 dark:border-emerald-800 px-2.5 py-0.5 rounded-lg transition-colors cursor-pointer"
                >
                  <span>{scheduleTabName}</span>
                  <ExternalLink className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
                </a>
              ) : (
                <span className="text-xs font-mono font-bold text-emerald-950 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 px-2.5 py-0.5 rounded-lg">
                  {scheduleTabName}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              All {solverResult.schedule.length} monthly meal shifts are saved and active on the
              Resident Schedule Portal.
            </p>
          </div>
        </div>
      </div>

      {/* Full-width Community Announcement & Gmail Dispatch Card */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center justify-center shrink-0">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Community Announcement &amp; Gmail Dispatch
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                {showSentNoticeOnly
                  ? "Monthly schedule announcement has been dispatched to the community"
                  : "Compose in Gmail web or copy formatted text"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {!showSentNoticeOnly && (
              <>
                {isBroadcastSent && isEditingResend && (
                  <button
                    type="button"
                    onClick={() => setIsEditingResend(false)}
                    className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-bold transition-colors cursor-pointer"
                  >
                    <span>Cancel Resend</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleCopyEmail}
                  className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-bold transition-colors cursor-pointer"
                >
                  <Copy className="w-4 h-4" />
                  <span>Copy Text</span>
                </button>

                <button
                  type="button"
                  disabled={recording || loading}
                  onClick={async () => {
                    handleCopyEmail();
                    const bodyText = customEmailBody ?? generateEmailText();
                    const composeUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
                      emailTo
                    )}&su=${encodeURIComponent(emailSubject)}${
                      emailCc ? `&cc=${encodeURIComponent(emailCc)}` : ""
                    }&body=${encodeURIComponent(bodyText)}`;
                    window.open(composeUrl, "_blank");
                    if (onRecordBroadcastSent) {
                      setIsRecording(true);
                      try {
                        await onRecordBroadcastSent({
                          to: emailTo,
                          subject: emailSubject,
                          monthKey,
                        });
                        setIsEditingResend(false);
                      } finally {
                        setIsRecording(false);
                      }
                    }
                  }}
                  className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-colors cursor-pointer"
                  title="Open Gmail compose tab in browser with recipient, subject, and email body pre-filled"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Compose in Gmail Web</span>
                </button>
              </>
            )}

            <button
              type="button"
              disabled={recording || loading}
              onClick={async () => {
                if (recording) return;
                setIsRecording(true);
                try {
                  if (isBroadcastSent && onToggleBroadcastSent) {
                    await onToggleBroadcastSent(false);
                    setIsEditingResend(false);
                  } else if (onRecordBroadcastSent) {
                    await onRecordBroadcastSent({
                      to: emailTo,
                      subject: emailSubject,
                      monthKey,
                    });
                    setIsEditingResend(false);
                  }
                } finally {
                  setIsRecording(false);
                }
              }}
              className={`min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-bold rounded-xl border transition-colors cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed ${
                isBroadcastSent
                  ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                  : "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700"
              }`}
              title="Manually toggle broadcast sent status if sent via external client or desktop app"
            >
              {recording ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-500" />
                  <span>{isBroadcastSent ? "Updating..." : "Marking as Sent..."}</span>
                </>
              ) : isBroadcastSent ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Broadcast Sent ✓</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 text-slate-500" />
                  <span>Mark as Broadcast Sent</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Already Sent Notice View (replaces email editor until Resend is clicked) */}
        {showSentNoticeOnly ? (
          <div
            role="alert"
            className="bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-800 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs animate-fade-in"
          >
            <div className="flex items-start sm:items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                <CheckCircle2 className="w-6 h-6 text-emerald-700 dark:text-emerald-400" />
              </div>
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold uppercase tracking-wider bg-amber-200 dark:bg-amber-900/60 text-amber-950 dark:text-amber-200 px-2.5 py-0.5 rounded-lg border border-amber-300 dark:border-amber-700">
                    Notice: Announcement Already Sent
                  </span>
                  {emailDispatchInfo?.sentAt && (
                    <span className="text-xs font-semibold text-amber-900 dark:text-amber-300">
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
                <p className="text-xs sm:text-sm text-amber-950 dark:text-amber-200 font-medium">
                  A monthly meal announcement was emailed to{" "}
                  <strong>{emailDispatchInfo?.to || emailTo}</strong>.
                </p>
                {(emailDispatchInfo?.subject || emailSubject) && (
                  <p className="text-xs text-amber-800 dark:text-amber-400 italic">
                    Subject: &quot;{emailDispatchInfo?.subject || emailSubject}&quot;{" "}
                    {emailDispatchInfo?.sentBy ? `• Sent by ${emailDispatchInfo.sentBy}` : ""}
                  </p>
                )}
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-2 sm:self-center">
              <button
                type="button"
                onClick={handleCopyEmail}
                className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-amber-100/60 dark:hover:bg-slate-700 text-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-700 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-2xs"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Text</span>
              </button>
              <button
                type="button"
                onClick={() => setIsEditingResend(true)}
                className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Resend Announcement</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Delivery Result Alert Banner */}
            {emailDeliveryResult && (
              <div
                role="status"
                aria-live="polite"
                className={`p-4 rounded-xl border flex items-center justify-between gap-3 animate-fade-in ${
                  emailDeliveryResult.mode === "send"
                    ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200 font-semibold"
                    : "bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-950 dark:text-blue-200 font-semibold"
                }`}
              >
                <div className="flex items-center gap-2.5 text-xs sm:text-sm min-w-0">
                  <CheckCircle2
                    className={`w-5 h-5 shrink-0 ${
                      emailDeliveryResult.mode === "send"
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-blue-700 dark:text-blue-400"
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
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Recipients (To:) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <label
                      htmlFor="email-recipients-to-input"
                      className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200"
                    >
                      Recipients (To:)
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEmailTo(DEFAULT_ANNOUNCEMENT_TO)}
                        className={`text-xs px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                          emailTo === DEFAULT_ANNOUNCEMENT_TO
                            ? "bg-blue-100 dark:bg-blue-950/60 text-blue-950 dark:text-blue-200 border border-blue-300 dark:border-blue-800"
                            : "text-slate-700 dark:text-slate-300 hover:text-blue-900 dark:hover:text-blue-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        Vancouver Cohousing Listserv
                      </button>
                    </div>
                  </div>
                  <input
                    id="email-recipients-to-input"
                    type="text"
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                    placeholder="e.g. Vancouver Cohousing Residents <vancoho-residents@googlegroups.com>"
                    className="w-full min-h-[44px] px-3.5 py-2 text-xs sm:text-sm border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white dark:bg-slate-800 font-medium text-slate-900 dark:text-white"
                  />
                </div>

                {/* CC Recipients (CC:) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <label
                      htmlFor="email-recipients-cc-input"
                      className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200"
                    >
                      CC Recipients (CC:)
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEmailCc(DEFAULT_ANNOUNCEMENT_CC)}
                        className={`text-xs px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                          emailCc === DEFAULT_ANNOUNCEMENT_CC
                            ? "bg-indigo-100 dark:bg-indigo-950/60 text-indigo-950 dark:text-indigo-200 border border-indigo-300 dark:border-indigo-800"
                            : "text-slate-700 dark:text-slate-300 hover:text-indigo-900 dark:hover:text-indigo-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        Default CC (Ben, Fabrice, Patricia)
                      </button>
                      {emailCc && (
                        <button
                          type="button"
                          onClick={() => setEmailCc("")}
                          className="text-xs px-2.5 py-1 rounded-lg font-bold text-slate-600 dark:text-slate-400 hover:text-rose-700 dark:hover:text-rose-400 bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-slate-200 dark:border-slate-700 hover:border-rose-200 dark:hover:border-rose-800 transition-colors cursor-pointer"
                        >
                          Clear CC
                        </button>
                      )}
                    </div>
                  </div>
                  <input
                    id="email-recipients-cc-input"
                    type="text"
                    value={emailCc}
                    onChange={(e) => setEmailCc(e.target.value)}
                    placeholder="e.g. Ben Ernst <ben@earnesticecream.com>, Fabrice Retiere <fabrulous@gmail.com>, Patricia Fahrni <pfahrni@shaw.ca>"
                    className="w-full min-h-[44px] px-3.5 py-2 text-xs sm:text-sm border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white dark:bg-slate-800 font-medium text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Subject Line */}
              <div className="space-y-1.5">
                <label
                  htmlFor="email-subject-line-input"
                  className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200"
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
                  className="w-full min-h-[44px] px-3.5 py-2 text-xs sm:text-sm border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white dark:bg-slate-800 font-bold text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Email Body Editor & Formatted Preview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <label
                    htmlFor="email-body-text-area"
                    className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200"
                  >
                    Email Announcement Body
                  </label>
                  <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setEmailTab("edit")}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                        emailTab === "edit"
                          ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit Text</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEmailTab("preview")}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                        emailTab === "preview"
                          ? "bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-400 shadow-xs"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Formatted Preview</span>
                    </button>
                  </div>
                </div>
                {customEmailBody !== null && (
                  <button
                    onClick={() => setCustomEmailBody(null)}
                    className="text-xs text-orange-700 dark:text-orange-400 hover:text-orange-900 dark:hover:text-orange-300 font-bold hover:underline cursor-pointer"
                  >
                    Reset to Default Template
                  </button>
                )}
              </div>

              {emailTab === "edit" ? (
                <textarea
                  id="email-body-text-area"
                  value={generateEmailText()}
                  onChange={(e) => setCustomEmailBody(e.target.value)}
                  rows={12}
                  className="w-full p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 leading-relaxed resize-y select-all"
                />
              ) : (
                <div className="p-5 bg-white dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-xl shadow-inner min-h-[260px] overflow-y-auto">
                  <div
                    className="text-slate-900 dark:text-slate-100 leading-relaxed"
                    dangerouslySetInnerHTML={{
                      __html: formatEmailHtmlBody(generateEmailText()),
                    }}
                  />
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="flex justify-start">
        <button
          onClick={() => goToStep(3)}
          className="min-h-[48px] px-5 py-2.5 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          ← Back to Schedule View
        </button>
      </div>
    </div>
  );
};

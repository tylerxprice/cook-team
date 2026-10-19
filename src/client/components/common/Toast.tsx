import React, { useEffect } from "react";
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastProps {
  message: string | null;
  type?: ToastType;
  onClose: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  type = "success",
  onClose,
  duration = 4000,
}) => {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!message) return null;

  const isSuccess = type === "success";
  const isError = type === "error";
  const isWarning = type === "warning";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-16 right-4 sm:right-6 z-50 max-w-sm sm:max-w-md w-auto px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 text-xs sm:text-sm font-semibold transition-all transform animate-in fade-in slide-in-from-top-3 border ${
        isError
          ? "bg-rose-900 dark:bg-rose-950 text-white border-rose-800"
          : isWarning
            ? "bg-amber-900 dark:bg-amber-950 text-white border-amber-800"
            : "bg-slate-900 dark:bg-slate-800 text-white border-slate-700/80"
      }`}
    >
      {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
      {isError && <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />}
      {isWarning && <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />}
      {!isSuccess && !isError && !isWarning && <Info className="w-5 h-5 text-sky-400 shrink-0" />}

      <span className="flex-1 leading-snug">{message}</span>

      <button
        type="button"
        onClick={onClose}
        className="p-1 -mr-1 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer shrink-0"
        aria-label="Close notification"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

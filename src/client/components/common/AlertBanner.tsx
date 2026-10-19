import React from "react";
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from "lucide-react";

export type AlertType = "success" | "warning" | "error" | "info" | "neutral";

export interface AlertBannerProps {
  type?: AlertType;
  title?: React.ReactNode;
  children?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  onClose?: () => void;
  className?: string;
}

const TYPE_CONFIG: Record<
  AlertType,
  {
    container: string;
    iconColor: string;
    defaultIcon: React.ComponentType<{ className?: string }>;
  }
> = {
  success: {
    container:
      "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800/80",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    defaultIcon: CheckCircle2,
  },
  warning: {
    container:
      "bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-800/80",
    iconColor: "text-amber-600 dark:text-amber-400",
    defaultIcon: AlertTriangle,
  },
  error: {
    container:
      "bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 border-rose-200 dark:border-rose-800/80",
    iconColor: "text-rose-600 dark:text-rose-400",
    defaultIcon: AlertCircle,
  },
  info: {
    container:
      "bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200 border-sky-200 dark:border-sky-800/80",
    iconColor: "text-sky-600 dark:text-sky-400",
    defaultIcon: Info,
  },
  neutral: {
    container:
      "bg-slate-50 dark:bg-slate-900/70 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-800",
    iconColor: "text-slate-500 dark:text-slate-400",
    defaultIcon: Info,
  },
};

export const AlertBanner: React.FC<AlertBannerProps> = ({
  type = "info",
  title,
  children,
  icon: CustomIcon,
  action,
  onClose,
  className = "",
}) => {
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.info;
  const IconComponent = CustomIcon || cfg.defaultIcon;

  return (
    <div
      role="alert"
      className={`rounded-2xl border p-4 sm:p-4.5 flex items-start justify-between gap-3 shadow-2xs transition-all ${cfg.container} ${className}`}
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <IconComponent className={`w-5 h-5 shrink-0 mt-0.5 ${cfg.iconColor}`} />
        <div className="min-w-0 flex-1 text-xs sm:text-sm">
          {title && <div className="font-bold tracking-tight mb-0.5">{title}</div>}
          {children && <div className="leading-relaxed opacity-95">{children}</div>}
          {action && <div className="mt-2.5 flex items-center gap-2 flex-wrap">{action}</div>}
        </div>
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="p-1 -mr-1 -mt-1 rounded-lg opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer shrink-0"
          aria-label="Dismiss banner"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

import React from "react";
import { Loader2 } from "lucide-react";

export interface LoadingSpinnerProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  color?: "orange" | "white" | "emerald" | "current" | "muted";
  label?: string;
  className?: string;
}

const SIZE_MAP = {
  xs: "w-3.5 h-3.5",
  sm: "w-4 h-4",
  md: "w-5 h-5",
  lg: "w-8 h-8",
  xl: "w-10 h-10",
};

const COLOR_MAP = {
  orange: "text-orange-600 dark:text-orange-500",
  white: "text-white",
  emerald: "text-emerald-600 dark:text-emerald-400",
  current: "text-current",
  muted: "text-slate-400 dark:text-slate-500",
};

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = "sm",
  color = "orange",
  label = "Loading...",
  className = "",
}) => {
  return (
    <span
      className="inline-flex items-center justify-center shrink-0"
      role="status"
      aria-label={label}
    >
      <Loader2
        className={`animate-spin ${SIZE_MAP[size] || SIZE_MAP.sm} ${COLOR_MAP[color] || COLOR_MAP.orange} ${className}`}
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
    </span>
  );
};

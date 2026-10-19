import React from "react";
import { Utensils } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";

export interface TopHeaderProps {
  communityName?: string;
  viewBadge?: React.ReactNode;
  onBackToHome?: () => void;
  children?: React.ReactNode;
  showThemeToggle?: boolean;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  communityName,
  viewBadge,
  onBackToHome,
  children,
  showThemeToggle = true,
}) => {
  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 shadow-2xs transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-3">
        {/* Left: Brand Logo & Title */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
          <button
            type="button"
            onClick={onBackToHome}
            disabled={!onBackToHome}
            title={onBackToHome ? "Return to Hub Home" : "CoHo CookTeam"}
            className={`flex items-center space-x-2.5 sm:space-x-3 text-left group min-w-0 ${
              onBackToHome ? "cursor-pointer" : "cursor-default"
            }`}
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-500 flex items-center justify-center text-white shadow-md shadow-orange-500/20 group-hover:scale-105 transition-transform shrink-0">
              <Utensils className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors truncate">
                CoHo CookTeam
              </h1>
              {communityName && (
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold truncate leading-none mt-0.5">
                  {communityName}
                </p>
              )}
            </div>
          </button>

          {/* View Context Badge */}
          {viewBadge && <div className="hidden sm:flex items-center shrink-0">{viewBadge}</div>}
        </div>

        {/* Right: Controls & Actions */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {children}
          {showThemeToggle && <ThemeToggle />}
        </div>
      </div>
    </header>
  );
};

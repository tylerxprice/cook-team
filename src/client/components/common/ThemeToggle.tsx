import React from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "../../utils/theme";

export interface ThemeToggleProps {
  className?: string;
  variant?: "button" | "dropdown";
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = "", variant = "button" }) => {
  const { theme, isDark, setTheme, toggleTheme } = useTheme();

  if (variant === "dropdown") {
    return (
      <div
        className={`flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 ${className}`}
      >
        <button
          type="button"
          onClick={() => setTheme("light")}
          className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
            theme === "light"
              ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
          title="Light Theme"
        >
          <Sun className="w-3.5 h-3.5 text-amber-500" />
          <span>Light</span>
        </button>
        <button
          type="button"
          onClick={() => setTheme("dark")}
          className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
            theme === "dark"
              ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
          title="Dark Theme"
        >
          <Moon className="w-3.5 h-3.5 text-orange-400" />
          <span>Dark</span>
        </button>
        <button
          type="button"
          onClick={() => setTheme("system")}
          className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
            theme === "system"
              ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
          title="Match System/Browser Theme"
        >
          <Monitor className="w-3.5 h-3.5 text-slate-500" />
          <span>Auto</span>
        </button>
      </div>
    );
  }

  const tooltip =
    theme === "system"
      ? `Theme: System (${isDark ? "Dark" : "Light"}) • Click to cycle`
      : `Theme: ${theme === "dark" ? "Dark" : "Light"} • Click to cycle`;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`min-h-[38px] min-w-[38px] p-2 rounded-xl text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 transition-colors flex items-center justify-center cursor-pointer shadow-2xs ${className}`}
      title={tooltip}
      aria-label={tooltip}
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-amber-400 animate-in spin-in-90 duration-200" />
      ) : (
        <Moon className="w-4 h-4 text-slate-700 animate-in spin-in-90 duration-200" />
      )}
    </button>
  );
};

import { useState, useEffect, useCallback } from "react";

export type Theme = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "cook_team_theme";

export function getSystemIsDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  try {
    const val = localStorage.getItem(THEME_STORAGE_KEY);
    if (val === "light" || val === "dark" || val === "system") {
      return val;
    }
  } catch {
    // Ignore localStorage errors
  }
  return "system";
}

export function applyThemeClass(theme: Theme): boolean {
  if (typeof document === "undefined") return false;
  const isDark = theme === "dark" || (theme === "system" && getSystemIsDark());
  const root = document.documentElement;
  if (isDark) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
  return isDark;
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme);
  const [isDark, setIsDark] = useState<boolean>(() => {
    const current = getStoredTheme();
    return current === "dark" || (current === "system" && getSystemIsDark());
  });

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch {
      // Ignore localStorage errors
    }
    const resolvedDark = applyThemeClass(newTheme);
    setIsDark(resolvedDark);
  }, []);

  const toggleTheme = useCallback(() => {
    // Cycles: system -> dark -> light -> system
    if (theme === "system") {
      setTheme(isDark ? "light" : "dark");
    } else if (theme === "dark") {
      setTheme("light");
    } else {
      setTheme("dark");
    }
  }, [theme, isDark, setTheme]);

  useEffect(() => {
    // Sync initial theme
    const resolvedDark = applyThemeClass(theme);
    setIsDark(resolvedDark);

    if (typeof window === "undefined" || !window.matchMedia) return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = () => {
      if (getStoredTheme() === "system") {
        const dark = applyThemeClass("system");
        setIsDark(dark);
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    } else if ((mediaQuery as any).addListener) {
      (mediaQuery as any).addListener(handleChange);
      return () => (mediaQuery as any).removeListener(handleChange);
    }
  }, [theme]);

  return {
    theme,
    isDark,
    setTheme,
    toggleTheme,
  };
}

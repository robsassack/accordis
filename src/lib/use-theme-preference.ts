"use client";

import { useCallback, useEffect, useState } from "react";

const THEME_STORAGE_KEY = "accordis-theme-preference";

export type ThemePreference = "light" | "dark";

export function useThemePreference() {
  const [themePreference, setThemePreference] = useState<ThemePreference>("light");
  const [hasInitializedTheme, setHasInitializedTheme] = useState(false);
  const isDarkMode = themePreference === "dark";

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (storedTheme === "light" || storedTheme === "dark") {
        setThemePreference(storedTheme);
      } else {
        const systemPrefersDark =
          typeof window.matchMedia === "function" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches;
        setThemePreference(systemPrefersDark ? "dark" : "light");
      }

      setHasInitializedTheme(true);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, []);

  useEffect(() => {
    if (!hasInitializedTheme) {
      return;
    }

    document.documentElement.classList.toggle("dark", isDarkMode);
    document.documentElement.style.colorScheme = themePreference;
    localStorage.setItem(THEME_STORAGE_KEY, themePreference);
  }, [hasInitializedTheme, isDarkMode, themePreference]);

  const toggleTheme = useCallback(() => {
    setThemePreference((current) => (current === "dark" ? "light" : "dark"));
  }, []);

  return { isDarkMode, toggleTheme };
}

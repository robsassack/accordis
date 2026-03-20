"use client";

import { useCallback, useEffect, useState } from "react";
import { withBasePath } from "@/lib/base-path";

const THEME_STORAGE_KEY = "accordis-theme-preference";
const LIGHT_FAVICON_HREF = withBasePath("/logo_light.png");
const DARK_FAVICON_HREF = withBasePath("/logo_dark.png");

export type ThemePreference = "light" | "dark";

function syncFaviconForTheme(themePreference: ThemePreference) {
  const faviconHref = themePreference === "dark" ? DARK_FAVICON_HREF : LIGHT_FAVICON_HREF;
  const iconLinks = document.querySelectorAll<HTMLLinkElement>(
    'link[rel="icon"], link[rel="shortcut icon"], link[rel="alternate icon"]',
  );

  iconLinks.forEach((link) => {
    link.href = faviconHref;
    link.media = "";
  });

  let runtimeIconLink = document.querySelector<HTMLLinkElement>(
    'link[data-accordis-theme-favicon="true"]',
  );

  if (!runtimeIconLink) {
    runtimeIconLink = document.createElement("link");
    runtimeIconLink.rel = "icon";
    runtimeIconLink.type = "image/png";
    runtimeIconLink.setAttribute("data-accordis-theme-favicon", "true");
    document.head.appendChild(runtimeIconLink);
  }

  runtimeIconLink.href = faviconHref;
}

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
    syncFaviconForTheme(themePreference);
  }, [hasInitializedTheme, isDarkMode, themePreference]);

  const toggleTheme = useCallback(() => {
    setThemePreference((current) => {
      const nextTheme = current === "dark" ? "light" : "dark";
      syncFaviconForTheme(nextTheme);
      return nextTheme;
    });
  }, []);

  return { isDarkMode, toggleTheme };
}

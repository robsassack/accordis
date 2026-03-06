"use client";

import type { ReactNode } from "react";
import { faMoon, faSun } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ModeSwitcher } from "@/components/navigation/ModeSwitcher";
import { useThemePreference } from "@/lib/use-theme-preference";

type AppShellProps = {
  activeMode: "detect" | "library";
  libraryHref?: "/library/scales" | "/library/chords";
  children: ReactNode;
};

export function AppShell({ activeMode, libraryHref = "/library/scales", children }: AppShellProps) {
  const { isDarkMode, toggleTheme } = useThemePreference();

  return (
    <main className="min-h-screen bg-linear-to-b from-slate-100 via-white to-sky-50 px-6 py-12 text-slate-900 transition-colors dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 dark:text-slate-100">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <header className="flex items-center justify-between gap-4">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            Accordis
          </p>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
            title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            <FontAwesomeIcon icon={isDarkMode ? faSun : faMoon} className="h-4 w-4" />
          </button>
        </header>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900 sm:p-8">
          <div className="mb-4 sm:mb-6">
            <ModeSwitcher activeMode={activeMode} libraryHref={libraryHref} />
          </div>
          {children}
        </section>
      </div>
    </main>
  );
}

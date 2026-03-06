"use client";

import type { ReactNode } from "react";
import { ModeSwitcher } from "@/components/navigation/ModeSwitcher";
import { useThemePreference } from "@/lib/use-theme-preference";

type AppShellProps = {
  activeMode: "detect" | "library";
  libraryHref?: string;
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
            {isDarkMode ? (
              <svg aria-hidden="true" className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                <path d="M12 17.25a5.25 5.25 0 1 0 0-10.5 5.25 5.25 0 0 0 0 10.5zM12 3a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 12 3zm0 15.75a.75.75 0 0 1 .75.75V21a.75.75 0 0 1-1.5 0v-1.5a.75.75 0 0 1 .75-.75zM3 12a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5A.75.75 0 0 1 3 12zm15.75 0a.75.75 0 0 1 .75-.75H21a.75.75 0 0 1 0 1.5h-1.5a.75.75 0 0 1-.75-.75zM5.47 5.47a.75.75 0 0 1 1.06 0l1.06 1.06a.75.75 0 1 1-1.06 1.06L5.47 6.53a.75.75 0 0 1 0-1.06zm10.94 10.94a.75.75 0 0 1 1.06 0l1.06 1.06a.75.75 0 0 1-1.06 1.06l-1.06-1.06a.75.75 0 0 1 0-1.06zM5.47 18.53a.75.75 0 0 1 0-1.06l1.06-1.06a.75.75 0 1 1 1.06 1.06l-1.06 1.06a.75.75 0 0 1-1.06 0zm10.94-10.94a.75.75 0 0 1 0-1.06l1.06-1.06a.75.75 0 0 1 1.06 1.06l-1.06 1.06a.75.75 0 0 1-1.06 0z" />
              </svg>
            ) : (
              <svg aria-hidden="true" className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                <path d="M14.5 2.8a.75.75 0 0 0-.83.96 8.25 8.25 0 0 1-10 10 .75.75 0 0 0-.96.83A10.5 10.5 0 1 0 14.5 2.8z" />
              </svg>
            )}
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

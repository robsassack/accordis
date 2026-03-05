"use client";

import { useEffect, useState } from "react";
import { faMoon, faSun } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { detectChords, detectIntervals } from "@/lib/chord-detect";
import {
  buildPianoKeys,
  uniquePitchClassesFromKeyIds,
  type NotationPreference,
} from "@/lib/piano";
import { PianoKeyboard } from "@/components/piano/PianoKeyboard";
import { SelectionBar } from "@/components/piano/SelectionBar";
import { DetectedResults } from "@/components/results/DetectedResults";

const PIANO_KEYS = buildPianoKeys(4, 5);
const NOTATION_STORAGE_KEY = "accordis-notation-preference";
const THEME_STORAGE_KEY = "accordis-theme-preference";
const DEFAULT_NOTATION_PREFERENCE: NotationPreference = "sharps";
type ThemePreference = "light" | "dark";

export default function Home() {
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [notationPreference, setNotationPreference] = useState<NotationPreference>(() => {
    if (typeof window === "undefined") {
      return DEFAULT_NOTATION_PREFERENCE;
    }

    const storedPreference = window.localStorage.getItem(NOTATION_STORAGE_KEY);
    return storedPreference === "sharps" || storedPreference === "flats"
      ? storedPreference
      : DEFAULT_NOTATION_PREFERENCE;
  });
  const [themePreference, setThemePreference] = useState<ThemePreference>(() => {
    if (typeof window === "undefined") {
      return "light";
    }

    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === "light" || storedTheme === "dark") {
      return storedTheme;
    }

    const systemPrefersDark =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    return systemPrefersDark ? "dark" : "light";
  });

  useEffect(() => {
    localStorage.setItem(NOTATION_STORAGE_KEY, notationPreference);
  }, [notationPreference]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", themePreference === "dark");
    document.documentElement.style.colorScheme = themePreference;
    localStorage.setItem(THEME_STORAGE_KEY, themePreference);
  }, [themePreference]);

  function handleKeyClick(keyId: string): void {
    setSelectedKeys((current) =>
      current.includes(keyId)
        ? current.filter((key) => key !== keyId)
        : [...current, keyId],
    );
  }

  function handleDeselectAll(): void {
    setSelectedKeys([]);
  }

  const uniquePitchClasses = uniquePitchClassesFromKeyIds(selectedKeys);
  const intervalMatches = detectIntervals(selectedKeys);
  const chordMatches = detectChords(selectedKeys);
  const isDarkMode = themePreference === "dark";

  return (
    <main className="min-h-screen bg-linear-to-b from-slate-100 via-white to-sky-50 px-6 py-12 text-slate-900 transition-colors dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 dark:text-slate-100">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <header className="flex items-center justify-between gap-4">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            Accordis
          </p>
          <button
            type="button"
            onClick={() => setThemePreference(isDarkMode ? "light" : "dark")}
            aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
            title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            <FontAwesomeIcon icon={isDarkMode ? faSun : faMoon} className="h-4 w-4" />
          </button>
        </header>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900 sm:p-8">
          <SelectionBar
            selectedKeys={selectedKeys}
            onClear={handleDeselectAll}
            notationPreference={notationPreference}
            onNotationPreferenceChange={setNotationPreference}
          />

          <PianoKeyboard
            keys={PIANO_KEYS}
            selectedKeys={selectedKeys}
            onKeyClick={handleKeyClick}
            notationPreference={notationPreference}
          />

          <DetectedResults
            uniquePitchClasses={uniquePitchClasses}
            intervalMatches={intervalMatches}
            chordMatches={chordMatches}
            notationPreference={notationPreference}
          />
        </section>
      </div>
    </main>
  );
}

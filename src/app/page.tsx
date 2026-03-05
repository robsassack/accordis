"use client";

import { useEffect, useState } from "react";
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
const DEFAULT_NOTATION_PREFERENCE: NotationPreference = "sharps";

function getInitialNotationPreference(): NotationPreference {
  if (typeof window === "undefined") {
    return DEFAULT_NOTATION_PREFERENCE;
  }

  const storedPreference = window.localStorage.getItem(NOTATION_STORAGE_KEY);
  if (storedPreference === "sharps" || storedPreference === "flats") {
    return storedPreference;
  }

  return DEFAULT_NOTATION_PREFERENCE;
}

export default function Home() {
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [notationPreference, setNotationPreference] = useState<NotationPreference>(
    getInitialNotationPreference,
  );

  useEffect(() => {
    localStorage.setItem(NOTATION_STORAGE_KEY, notationPreference);
  }, [notationPreference]);

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

  return (
    <main className="min-h-screen bg-linear-to-b from-slate-100 via-white to-sky-50 px-6 py-12 text-slate-900">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <header className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
            Accordis
          </p>
        </header>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
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

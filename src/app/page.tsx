"use client";

import React, { useMemo, useState } from "react";

// ✅ Adjust this import path to wherever you put chordDetect.ts / detect.ts
import { detectChords } from "@/lib/chordDetect"; // e.g. "@/lib/music/chords/detect"

const NOTE_NAMES_SHARPS = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"] as const;
const pcToName = (pc: number) => NOTE_NAMES_SHARPS[((pc % 12) + 12) % 12] ?? `${pc}`;

type WhiteKey = {
  midi: number;
  label: string; // C, D, E...
  hasBlackAfter: boolean;
  blackMidi?: number;
};

function buildTwoOctaveKeys(startMidiC: number): WhiteKey[] {
  // Two octaves from C..B => 14 white keys (C D E F G A B x2)
  const whiteSteps = [0, 2, 4, 5, 7, 9, 11]; // relative to C
  const labels = ["C", "D", "E", "F", "G", "A", "B"];
  const keys: WhiteKey[] = [];

  for (let oct = 0; oct < 2; oct++) {
    for (let i = 0; i < 7; i++) {
      const midi = startMidiC + oct * 12 + whiteSteps[i];
      const label = labels[i]!;
      const hasBlackAfter = label !== "E" && label !== "B"; // no black after E/B
      keys.push({
        midi,
        label,
        hasBlackAfter,
        blackMidi: hasBlackAfter ? midi + 1 : undefined,
      });
    }
  }

  return keys;
}

export default function Page() {
  // C4 = 60. Two octaves -> C4..B5
  const whites = useMemo(() => buildTwoOctaveKeys(60), []);

  const [pressed, setPressed] = useState<Set<number>>(() => new Set());

  const pressedList = useMemo(() => Array.from(pressed).sort((a, b) => a - b), [pressed]);

  const result = useMemo(() => {
    return detectChords(pressedList, {
      inputIsMidi: true,
      preferAccidentals: "sharps",
      maxCandidates: 8,
    });
  }, [pressedList]);

  const toggle = (midi: number) => {
    setPressed(prev => {
      const next = new Set(prev);
      if (next.has(midi)) next.delete(midi);
      else next.add(midi);
      return next;
    });
  };

  const clear = () => setPressed(new Set());

  const best = result.best;

  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-semibold">Accordis — Chord Detect (2-octave selector)</h1>
          <p className="text-sm text-neutral-600">
            Click keys to toggle. Inversions collapse; slash chords use the lowest note as bass.
          </p>
        </header>

        {/* Piano */}
        <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="text-sm text-neutral-700">
              Pressed MIDI:{" "}
              <span className="font-mono">
                {pressedList.length ? pressedList.join(", ") : "—"}
              </span>
            </div>
            <button
              onClick={clear}
              className="rounded-xl border border-neutral-200 px-3 py-1.5 text-sm hover:bg-neutral-50 active:bg-neutral-100"
            >
              Clear
            </button>
          </div>

          <div className="relative select-none">
            <div className="flex">
              {whites.map((k, idx) => {
                const whiteOn = pressed.has(k.midi);
                const blackOn = k.blackMidi != null && pressed.has(k.blackMidi);

                return (
                  <div key={`${k.midi}-${idx}`} className="relative">
                    {/* White key */}
                    <button
                      onClick={() => toggle(k.midi)}
                      className={[
                        "h-40 w-12 md:w-14 border border-neutral-300 rounded-b-lg",
                        "flex items-end justify-center pb-2",
                        "text-xs text-neutral-700",
                        whiteOn ? "bg-amber-100" : "bg-white hover:bg-neutral-50",
                        "active:translate-y-[1px]",
                      ].join(" ")}
                      aria-label={`White key ${k.label}`}
                      type="button"
                    >
                      {k.label}
                    </button>

                    {/* Black key (overlay between this and next white key) */}
                    {k.hasBlackAfter && k.blackMidi != null && (
                      <button
                        onClick={() => toggle(k.blackMidi!)}
                        className={[
                          "absolute top-0 right-[-18px] md:right-[-20px] z-10",
                          "h-24 w-9 md:w-10 rounded-b-lg",
                          "border border-neutral-900",
                          blackOn ? "bg-amber-300" : "bg-neutral-900 hover:bg-neutral-800",
                          "active:translate-y-[1px]",
                        ].join(" ")}
                        aria-label={`Black key ${k.label}#`}
                        type="button"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Output */}
        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">Best guess</h2>
              {best?.quality && (
                <span
                  className={[
                    "text-xs px-2 py-1 rounded-full border",
                    best.quality === "exact"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : best.quality === "incomplete"
                        ? "border-amber-200 bg-amber-50 text-amber-700"
                        : "border-rose-200 bg-rose-50 text-rose-700",
                  ].join(" ")}
                >
                  {best.quality}
                </span>
              )}
            </div>

            {best ? (
              <>
                <div className="text-2xl font-semibold">{best.name}</div>

                <div className="text-sm text-neutral-700 space-y-1">
                  <div>
                    <span className="text-neutral-500">Score:</span>{" "}
                    <span className="font-mono">{best.score}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500">Pitch classes:</span>{" "}
                    <span className="font-mono">
                      {best.usedPitchClasses.map(pcToName).join(" ")}
                    </span>
                  </div>

                  {(best.missingPcs.length > 0 || best.extraPcs.length > 0) && (
                    <div className="pt-2 space-y-1">
                      {best.missingPcs.length > 0 && (
                        <div>
                          <span className="text-neutral-500">Missing:</span>{" "}
                          <span className="font-mono">
                            {best.missingPcs.map(pcToName).join(" ")}
                          </span>
                        </div>
                      )}
                      {best.extraPcs.length > 0 && (
                        <div>
                          <span className="text-neutral-500">Extra:</span>{" "}
                          <span className="font-mono">
                            {best.extraPcs.map(pcToName).join(" ")}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-sm text-neutral-600">Press at least 2 unique notes.</div>
            )}
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold mb-3">Close matches</h2>

            {result.candidates.length ? (
              <div className="space-y-2">
                {result.candidates.map((c, i) => (
                  <div
                    key={`${c.templateId}-${c.rootPc}-${i}`}
                    className={[
                      "rounded-xl border p-3",
                      i === 0 ? "border-neutral-300 bg-neutral-50" : "border-neutral-200",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-neutral-600 font-mono">score {c.score}</div>
                    </div>

                    {(c.missingPcs.length > 0 || c.extraPcs.length > 0) && (
                      <div className="mt-1 text-xs text-neutral-600">
                        {c.missingPcs.length > 0 && (
                          <span className="mr-3">
                            Missing: <span className="font-mono">{c.missingPcs.map(pcToName).join(" ")}</span>
                          </span>
                        )}
                        {c.extraPcs.length > 0 && (
                          <span>
                            Extra: <span className="font-mono">{c.extraPcs.map(pcToName).join(" ")}</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-neutral-600">No candidates yet.</div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

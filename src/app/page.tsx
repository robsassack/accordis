"use client";

import { faArrowRotateLeft } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useState } from "react";

type PianoKey = {
  note: string;
  octave: number;
  isSharp: boolean;
};

const NOTE_SEQUENCE = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;

function buildKeys(): PianoKey[] {
  const keys: PianoKey[] = [];

  for (let octave = 4; octave <= 5; octave += 1) {
    for (const note of NOTE_SEQUENCE) {
      keys.push({
        note,
        octave,
        isSharp: note.includes("#"),
      });
    }
  }

  return keys;
}

const PIANO_KEYS = buildKeys();
const WHITE_KEY_COUNT = PIANO_KEYS.filter((key) => !key.isSharp).length;
const BLACK_KEY_WIDTH_PERCENT = 4.8;
const BLACK_KEY_GAP_REDUCTION_PX = 2.5;

export default function Home() {
  const keys = PIANO_KEYS;
  const [selectedKeys, setSelectedKeys] = useState<string[]>(["C4"]);

  const whiteKeys = keys.filter((key) => !key.isSharp);
  const blackKeys = keys
    .map((key, index) => ({ key, index }))
    .filter(({ key }) => key.isSharp);

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

  const hasSelectedKeys = selectedKeys.length > 0;

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-100 via-white to-sky-50 px-6 py-12 text-slate-900">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <header className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
            Accordis
          </p>
        </header>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="rounded-full bg-sky-100 px-4 py-2 text-sm font-medium text-sky-800">
              Current: {selectedKeys.length > 0 ? selectedKeys.join(", ") : "None"}
            </div>
            <button
              type="button"
              onClick={handleDeselectAll}
              aria-label="Clear selected keys"
              disabled={!hasSelectedKeys}
              className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold transition-colors duration-200 ${
                hasSelectedKeys
                  ? "border-slate-300 text-slate-700 hover:bg-slate-100"
                  : "cursor-not-allowed border-slate-200 text-slate-300"
              }`}
            >
              <FontAwesomeIcon icon={faArrowRotateLeft} className="h-4 w-4" />
            </button>
          </div>

          <div className="pb-2">
            <div className="relative mx-auto h-44 w-full max-w-4xl select-none sm:h-56">
              <div className="absolute inset-x-0 bottom-0 flex h-[180px] sm:h-[220px]">
                {whiteKeys.map((key) => {
                  const id = `${key.note}${key.octave}`;
                  const isSelected = selectedKeys.includes(id);

                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => handleKeyClick(id)}
                      className={`relative h-full flex-1 rounded-b-md border border-slate-300 pb-3 text-xs font-medium transition ${
                        isSelected
                          ? "bg-sky-100 text-sky-900"
                          : "bg-white text-slate-700 hover:bg-slate-100"
                      }`}
                      aria-label={`Select ${id}`}
                    >
                      <span className="absolute bottom-3 left-1/2 -translate-x-1/2">
                        {id}
                      </span>
                    </button>
                  );
                })}
              </div>

              {blackKeys.map(({ key, index }) => {
                  const id = `${key.note}${key.octave}`;
                  const isSelected = selectedKeys.includes(id);
                  const whiteKeysBefore = keys
                    .slice(0, index)
                    .filter((pianoKey) => !pianoKey.isSharp).length;
                  const whiteKeyWidth = 100 / WHITE_KEY_COUNT;
                  const center = whiteKeysBefore * whiteKeyWidth;
                  const left = center - BLACK_KEY_WIDTH_PERCENT / 2;

                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => handleKeyClick(id)}
                      className={`absolute z-10 mt-1 h-[112px] rounded-b-md border-x border-b border-slate-900 text-[10px] font-medium text-white transition sm:h-[140px] ${
                        isSelected
                          ? "bg-sky-700"
                          : "bg-slate-900 hover:bg-slate-700"
                      }`}
                      style={{
                        left: `calc(${left}% - ${BLACK_KEY_GAP_REDUCTION_PX}px)`,
                        width: `calc(${BLACK_KEY_WIDTH_PERCENT}% + ${BLACK_KEY_GAP_REDUCTION_PX * 2}px)`,
                      }}
                      aria-label={`Select ${id}`}
                    >
                      <span className="mt-24 inline-block">{id}</span>
                    </button>
                  );
                })}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

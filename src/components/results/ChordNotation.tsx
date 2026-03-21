"use client";

import { useEffect, useRef } from "react";
import type { ChordMatch } from "@/lib/chord-types";
import type { NotationPreference, PitchClass } from "@/lib/piano";
import { pitchClassToIndex } from "@/lib/piano";

type NoteVexInfo = {
  key: string;
  accidental: string | null;
};

const LETTER_TO_SEMITONE: Record<string, number> = {
  c: 0,
  d: 2,
  e: 4,
  f: 5,
  g: 7,
  a: 9,
  b: 11,
};

const TARGET_MIDI_RANGE_BY_MODE: Record<
  "upper" | "treble" | "bass" | "lower",
  { min: number; max: number }
> = {
  // Keep each mode readable while still preserving the "higher/lower" character.
  upper: { min: 62, max: 86 },
  treble: { min: 57, max: 81 },
  bass: { min: 38, max: 64 },
  lower: { min: 33, max: 59 },
};

const SHARP_NOTE_LETTERS: Record<PitchClass, { letter: string; accidental: string | null }> = {
  C: { letter: "c", accidental: null },
  "C#": { letter: "c#", accidental: "#" },
  D: { letter: "d", accidental: null },
  "D#": { letter: "d#", accidental: "#" },
  E: { letter: "e", accidental: null },
  F: { letter: "f", accidental: null },
  "F#": { letter: "f#", accidental: "#" },
  G: { letter: "g", accidental: null },
  "G#": { letter: "g#", accidental: "#" },
  A: { letter: "a", accidental: null },
  "A#": { letter: "a#", accidental: "#" },
  B: { letter: "b", accidental: null },
};

const FLAT_NOTE_LETTERS: Record<PitchClass, { letter: string; accidental: string | null }> = {
  C: { letter: "c", accidental: null },
  "C#": { letter: "db", accidental: "b" },
  D: { letter: "d", accidental: null },
  "D#": { letter: "eb", accidental: "b" },
  E: { letter: "e", accidental: null },
  F: { letter: "f", accidental: null },
  "F#": { letter: "gb", accidental: "b" },
  G: { letter: "g", accidental: null },
  "G#": { letter: "ab", accidental: "b" },
  A: { letter: "a", accidental: null },
  "A#": { letter: "bb", accidental: "b" },
  B: { letter: "b", accidental: null },
};

// Assign octaves to make notes ascending, starting from octave 4.
// When a note's chromatic index is lower than the previous note's, we wrap
// into the next octave so the chord reads bottom-to-top on the staff.
function buildNoteInfos(
  notes: PitchClass[],
  notationPreference: NotationPreference,
  baseOctave: number,
): NoteVexInfo[] {
  const infoMap = notationPreference === "flats" ? FLAT_NOTE_LETTERS : SHARP_NOTE_LETTERS;
  let octave = baseOctave;
  const result: NoteVexInfo[] = [];

  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];
    if (i > 0) {
      const prevIdx = pitchClassToIndex(notes[i - 1]);
      const currIdx = pitchClassToIndex(note);
      if (currIdx < prevIdx) {
        octave++;
      }
    }
    const { letter, accidental } = infoMap[note];
    result.push({ key: `${letter}/${octave}`, accidental });
  }

  return result;
}

function parseKeyToMidi(key: string): number | null {
  const match = key.match(/^([a-g])(b|#)?\/(-?\d+)$/i);
  if (!match) {
    return null;
  }
  const [, rawLetter, accidental, rawOctave] = match;
  const letter = rawLetter.toLowerCase();
  const base = LETTER_TO_SEMITONE[letter];
  const octave = Number(rawOctave);
  if (base === undefined || Number.isNaN(octave)) {
    return null;
  }
  const accidentalShift = accidental === "#" ? 1 : accidental === "b" ? -1 : 0;
  return (octave + 1) * 12 + base + accidentalShift;
}

function chooseOctaveShiftForRange(
  noteInfos: NoteVexInfo[],
  displayMode: "upper" | "treble" | "bass" | "lower",
): number {
  const target = TARGET_MIDI_RANGE_BY_MODE[displayMode];
  const baseMidis = noteInfos.map((info) => parseKeyToMidi(info.key)).filter((midi): midi is number => midi !== null);
  if (baseMidis.length === 0) {
    return 0;
  }

  let bestShift = 0;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const octaveShift of [-2, -1, 0, 1, 2]) {
    const semitoneShift = octaveShift * 12;
    const shifted = baseMidis.map((midi) => midi + semitoneShift);
    const min = Math.min(...shifted);
    const max = Math.max(...shifted);
    const overflowLow = Math.max(0, target.min - min);
    const overflowHigh = Math.max(0, max - target.max);
    const overflowPenalty = overflowLow + overflowHigh;
    const movementPenalty = Math.abs(octaveShift) * 0.25;
    const score = overflowPenalty + movementPenalty;
    if (score < bestScore) {
      bestScore = score;
      bestShift = octaveShift;
    }
  }
  return bestShift;
}

export function ChordNotation({
  match,
  notationPreference,
  displayMode,
}: {
  match: ChordMatch;
  notationPreference: NotationPreference;
  displayMode: "upper" | "treble" | "bass" | "lower";
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousDisplayModeRef = useRef(displayMode);
  const notesKey = match.notes.join("|");
  const renderWidth = 200;
  const renderHeight = 200;
  const staveY = 40;
  const staveWidthInset = 5;
  const formatterWidthInset = 70;
  const cropPadX = 6;
  const cropPadBottom = 24;
  const targetHeight = 90;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || match.notes.length === 0) return;

    const modeOrder: Array<typeof displayMode> = ["upper", "treble", "bass", "lower"];
    const previousDisplayMode = previousDisplayModeRef.current;
    const previousIndex = modeOrder.indexOf(previousDisplayMode);
    const currentIndex = modeOrder.indexOf(displayMode);
    const slideDirection = currentIndex >= previousIndex ? 1 : -1;
    previousDisplayModeRef.current = displayMode;

    let cancelled = false;

    (async () => {
      const { Renderer, Stave, StaveNote, Voice, Formatter, Accidental, MetricsDefaults } = await import(
        "vexflow"
      );
      if (cancelled) return;

      container.innerHTML = "";

      // VexFlow's formatter computes accidental placement from these metrics.
      // Tightening these values makes accidentals sit closer to noteheads.
      MetricsDefaults.Accidental.noteheadAccidentalPadding = -7;
      MetricsDefaults.Accidental.accidentalSpacing = 1;
      MetricsDefaults.Accidental.leftPadding = 0;

      const renderer = new Renderer(container, Renderer.Backends.SVG);
      renderer.resize(renderWidth, renderHeight);
      const context = renderer.getContext();

      const clefAndShiftByMode = {
        upper: { clef: "treble" as const, shift: 1 },
        treble: { clef: "treble" as const, shift: 0 },
        bass: { clef: "bass" as const, shift: 0 },
        lower: { clef: "bass" as const, shift: -1 },
      };
      const mode = clefAndShiftByMode[displayMode];
      const resolvedClef = mode.clef;
      const octaveShift = mode.shift;
      // Keep bass-clef chord shapes closer to the staff center for readability,
      // then apply optional user octave shift.
      const baseOctave = (resolvedClef === "bass" ? 3 : 4) + octaveShift;

      const stave = new Stave(0, staveY, renderWidth - staveWidthInset);
      stave.addClef(resolvedClef);
      stave.setContext(context).draw();

      const initialNoteInfos = buildNoteInfos(match.notes, notationPreference, baseOctave);
      const octaveRangeShift = chooseOctaveShiftForRange(initialNoteInfos, displayMode);
      const noteInfos =
        octaveRangeShift === 0
          ? initialNoteInfos
          : buildNoteInfos(match.notes, notationPreference, baseOctave + octaveRangeShift);
      const highestRenderedOctave = noteInfos.reduce((maxOctave, info) => {
        const octavePart = Number(info.key.split("/")[1]);
        if (Number.isNaN(octavePart)) {
          return maxOctave;
        }
        return Math.max(maxOctave, octavePart);
      }, 0);
      const staveNote = new StaveNote({
        clef: resolvedClef,
        keys: noteInfos.map((n) => n.key),
        duration: "w",
      });
      const containerWidth = container.clientWidth || 0;
      const noteXShift = containerWidth > 0 && containerWidth < 190 ? 7 : 12;
      staveNote.setXShift(noteXShift);

      noteInfos.forEach((info, idx) => {
        if (info.accidental !== null) {
          staveNote.addModifier(new Accidental(info.accidental), idx);
        }
      });

      const voice = new Voice({ numBeats: 4, beatValue: 4 });
      voice.setStrict(false);
      voice.addTickables([staveNote]);

      new Formatter().joinVoices([voice]).format([voice], renderWidth - formatterWidthInset);
      voice.draw(context, stave);

      // Crop and scale the SVG down to a compact fixed height.
      // getBBox() must be called on the inner <g> (VexFlow's content wrapper)
      // rather than the <svg> element, which returns the full viewport bounds.
      const svgEl = container.querySelector("svg");
      const contentGroup = container.querySelector("svg > g") as SVGGElement | null;
      if (svgEl && contentGroup && typeof contentGroup.getBBox === "function") {
        const bbox = contentGroup.getBBox();
        // Add generous top room for high ledger lines, especially in upper/8va mode.
        const baseCropPadTop = displayMode === "upper" ? 48 : 26;
        const octaveOverflowPad = Math.max(0, highestRenderedOctave - 5) * 18;
        const cropPadTop = baseCropPadTop + octaveOverflowPad;
        const vbW = bbox.width + cropPadX * 2;
        const vbH = bbox.height + cropPadTop + cropPadBottom;
        svgEl.setAttribute("viewBox", `${bbox.x - cropPadX} ${bbox.y - cropPadTop} ${vbW} ${vbH}`);
        svgEl.setAttribute("preserveAspectRatio", "xMinYMid meet");
        svgEl.setAttribute("height", String(targetHeight));
        svgEl.setAttribute("width", "100%");
        svgEl.style.display = "block";
        svgEl.style.overflow = "visible";
        svgEl.style.maxWidth = "100%";
        svgEl.style.height = `${targetHeight}px`;
        svgEl.style.transformOrigin = "center center";

        const prefersReducedMotion =
          typeof window !== "undefined" &&
          typeof window.matchMedia === "function" &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (!prefersReducedMotion && typeof svgEl.animate === "function") {
          svgEl.animate(
            [
              { transform: `translateX(${slideDirection * 12}px)` },
              { transform: "translateX(0px)" },
            ],
            { duration: 180, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "both" },
          );
        }
      }
    })().catch(console.error);

    return () => {
      cancelled = true;
    };
  }, [
    notesKey,
    notationPreference,
    displayMode,
    renderWidth,
    renderHeight,
    staveY,
    staveWidthInset,
    formatterWidthInset,
    cropPadX,
    cropPadBottom,
    targetHeight,
  ]);

  // VexFlow renders in black by default; dark:invert flips to white in dark mode.
  return <div ref={containerRef} className="w-full max-w-52 overflow-visible dark:invert" />;
}

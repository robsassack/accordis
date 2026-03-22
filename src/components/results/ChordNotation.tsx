"use client";

import { useLayoutEffect, useRef } from "react";
import { Renderer, Stave, StaveNote, Voice, Formatter, Accidental, MetricsDefaults } from "vexflow";
import type { ChordMatch } from "@/lib/chord-types";
import type { NotationPreference, PitchClass } from "@/lib/piano";
import { parseKeyId, pitchClassToIndex } from "@/lib/piano";

type NoteVexInfo = {
  key: string;
  accidental: string | null;
};

const CHORD_ACCIDENTAL_METRICS = {
  noteheadAccidentalPadding: -7,
  accidentalSpacing: 1,
  leftPadding: 0,
} as const;

const DEFAULT_ACCIDENTAL_METRICS = {
  noteheadAccidentalPadding: MetricsDefaults.Accidental.noteheadAccidentalPadding,
  accidentalSpacing: MetricsDefaults.Accidental.accidentalSpacing,
  leftPadding: MetricsDefaults.Accidental.leftPadding,
};

let chordAccidentalMetricsUsers = 0;

function applyChordAccidentalMetrics() {
  MetricsDefaults.Accidental.noteheadAccidentalPadding = CHORD_ACCIDENTAL_METRICS.noteheadAccidentalPadding;
  MetricsDefaults.Accidental.accidentalSpacing = CHORD_ACCIDENTAL_METRICS.accidentalSpacing;
  MetricsDefaults.Accidental.leftPadding = CHORD_ACCIDENTAL_METRICS.leftPadding;
}

function restoreDefaultAccidentalMetrics() {
  MetricsDefaults.Accidental.noteheadAccidentalPadding = DEFAULT_ACCIDENTAL_METRICS.noteheadAccidentalPadding;
  MetricsDefaults.Accidental.accidentalSpacing = DEFAULT_ACCIDENTAL_METRICS.accidentalSpacing;
  MetricsDefaults.Accidental.leftPadding = DEFAULT_ACCIDENTAL_METRICS.leftPadding;
}

function acquireChordAccidentalMetrics() {
  if (chordAccidentalMetricsUsers === 0) {
    applyChordAccidentalMetrics();
  }
  chordAccidentalMetricsUsers += 1;
}

function releaseChordAccidentalMetrics() {
  if (chordAccidentalMetricsUsers === 0) {
    return;
  }
  chordAccidentalMetricsUsers -= 1;
  if (chordAccidentalMetricsUsers === 0) {
    restoreDefaultAccidentalMetrics();
  }
}

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

function buildNoteInfosFromVoicingKeyIds(
  voicingKeyIds: string[],
  notationPreference: NotationPreference,
): NoteVexInfo[] {
  const parsedVoicing = voicingKeyIds
    .map((keyId) => parseKeyId(keyId))
    .filter((parsed): parsed is NonNullable<ReturnType<typeof parseKeyId>> => parsed !== null);

  const chooseInfo = (
    parsed: NonNullable<ReturnType<typeof parseKeyId>>,
    preferFlats: boolean,
  ): NoteVexInfo => {
    const infoMap = preferFlats ? FLAT_NOTE_LETTERS : SHARP_NOTE_LETTERS;
    const { letter, accidental } = infoMap[parsed.note];
    return { key: `${letter}/${parsed.octave}`, accidental };
  };

  const chosenInfos = parsedVoicing.map((parsed) => chooseInfo(parsed, notationPreference === "flats"));

  // Improve readability for clusters like D + D# by respelling the sharp pitch as Eb.
  // This avoids two noteheads sharing the same staff line in one chord.
  if (notationPreference === "sharps") {
    const lineKeyCounts = new Map<string, number>();
    chosenInfos.forEach((info) => {
      const [notePart, octavePart] = info.key.split("/");
      const lineKey = `${notePart[0]}/${octavePart}`;
      lineKeyCounts.set(lineKey, (lineKeyCounts.get(lineKey) ?? 0) + 1);
    });

    parsedVoicing.forEach((parsed, index) => {
      const currentInfo = chosenInfos[index];
      const [notePart, octavePart] = currentInfo.key.split("/");
      const currentLineKey = `${notePart[0]}/${octavePart}`;
      const currentCount = lineKeyCounts.get(currentLineKey) ?? 0;
      if (currentCount <= 1) {
        return;
      }

      // Only respell chromatic sharps (C#, D#, F#, G#, A#) when they collide.
      if (!parsed.note.includes("#")) {
        return;
      }

      const flatInfo = chooseInfo(parsed, true);
      const [flatNotePart, flatOctavePart] = flatInfo.key.split("/");
      const flatLineKey = `${flatNotePart[0]}/${flatOctavePart}`;
      const flatCount = lineKeyCounts.get(flatLineKey) ?? 0;
      if (flatCount >= currentCount) {
        return;
      }

      lineKeyCounts.set(currentLineKey, currentCount - 1);
      lineKeyCounts.set(flatLineKey, flatCount + 1);
      chosenInfos[index] = flatInfo;
    });
  }

  return chosenInfos;
}

function shiftNoteInfosByOctaves(noteInfos: NoteVexInfo[], octaveShift: number): NoteVexInfo[] {
  if (octaveShift === 0) {
    return noteInfos;
  }

  return noteInfos.map((info) => {
    const [notePart, octavePart] = info.key.split("/");
    const octave = Number(octavePart);
    if (Number.isNaN(octave)) {
      return info;
    }
    return { ...info, key: `${notePart}/${octave + octaveShift}` };
  });
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
  voicingKeyIds,
}: {
  match: ChordMatch;
  notationPreference: NotationPreference;
  displayMode: "upper" | "treble" | "bass" | "lower";
  voicingKeyIds?: string[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const notesKey = match.notes.join("|");
  const renderWidth = 200;
  const renderHeight = 200;
  const staveY = 40;
  const staveWidthInset = 5;
  const formatterWidthInset = 70;
  const cropPadX = 6;
  const cropPadBottom = 24;
  const targetHeight = 90;

  useLayoutEffect(() => {
    acquireChordAccidentalMetrics();
    return () => {
      releaseChordAccidentalMetrics();
    };
  }, []);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const notes = notesKey.length > 0 ? (notesKey.split("|") as PitchClass[]) : [];
    if (!container || notes.length === 0) return;

    const stagingContainer = document.createElement("div");
    stagingContainer.style.position = "absolute";
    stagingContainer.style.inset = "0";
    stagingContainer.style.visibility = "hidden";
    stagingContainer.style.pointerEvents = "none";
    container.appendChild(stagingContainer);

    const renderer = new Renderer(stagingContainer, Renderer.Backends.SVG);
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

    const explicitVoicingNoteInfos =
      voicingKeyIds && voicingKeyIds.length > 0
        ? buildNoteInfosFromVoicingKeyIds(voicingKeyIds, notationPreference)
        : [];
    const initialNoteInfos =
      explicitVoicingNoteInfos.length > 0
        ? explicitVoicingNoteInfos
        : buildNoteInfos(notes, notationPreference, baseOctave);
    const noteInfos =
      explicitVoicingNoteInfos.length > 0
        ? initialNoteInfos
        : (() => {
            const octaveRangeShift = chooseOctaveShiftForRange(initialNoteInfos, displayMode);
            return octaveRangeShift === 0
              ? initialNoteInfos
              : shiftNoteInfosByOctaves(initialNoteInfos, octaveRangeShift);
          })();
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
    const svgEl = stagingContainer.querySelector("svg");
    const contentGroup = stagingContainer.querySelector("svg > g") as SVGGElement | null;
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
    }

    const nextSvg = stagingContainer.querySelector("svg");
    if (nextSvg) {
      container.replaceChildren(nextSvg);
    } else {
      stagingContainer.remove();
    }

    return () => {
      stagingContainer.remove();
    };
  }, [
    notesKey,
    notationPreference,
    displayMode,
    voicingKeyIds,
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

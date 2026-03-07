import type { ChordQuality } from "@/lib/chord-types";
import {
  NOTE_SEQUENCE,
  applyNotationPreference,
  indexToPitchClass,
  pitchClassToIndex,
  type PitchClass,
} from "@/lib/piano";

type ChordDefinitionRecord = {
  id: ChordQuality;
  name: string;
  suffix: string;
  intervals: readonly number[];
  formula: string;
  aliases?: readonly string[];
};

export const CHORD_DEFINITIONS = [
  { id: "major", name: "Major", suffix: "", intervals: [0, 4, 7], formula: "1 3 5" },
  { id: "minor", name: "Minor", suffix: "m", intervals: [0, 3, 7], formula: "1 b3 5" },
  { id: "diminished", name: "Diminished", suffix: "dim", intervals: [0, 3, 6], formula: "1 b3 b5" },
  { id: "augmented", name: "Augmented", suffix: "aug", intervals: [0, 4, 8], formula: "1 3 #5" },
  { id: "suspended2", name: "Suspended 2", suffix: "sus2", intervals: [0, 2, 7], formula: "1 2 5" },
  { id: "suspended4", name: "Suspended 4", suffix: "sus4", intervals: [0, 5, 7], formula: "1 4 5" },
  {
    id: "suspendedDominant7",
    name: "7th Suspended 4",
    suffix: "7sus4",
    intervals: [0, 5, 7, 10],
    formula: "1 4 5 b7",
    aliases: ["sus7"],
  },
  { id: "major6", name: "6th", suffix: "6", intervals: [0, 4, 7, 9], formula: "1 3 5 6" },
  { id: "minor6", name: "Minor 6th", suffix: "m6", intervals: [0, 3, 7, 9], formula: "1 b3 5 6" },
  { id: "majorAdd9", name: "Add 9", suffix: "add9", intervals: [0, 4, 7, 14], formula: "1 3 5 9" },
  {
    id: "minorAdd9",
    name: "Minor Add 9",
    suffix: "madd9",
    intervals: [0, 3, 7, 14],
    formula: "1 b3 5 9",
  },
  {
    id: "dominant7",
    name: "Dominant 7",
    suffix: "7",
    intervals: [0, 4, 7, 10],
    formula: "1 3 5 b7",
    aliases: ["seventh"],
  },
  {
    id: "dominant7Flat5",
    name: "7th Flat 5",
    suffix: "7b5",
    intervals: [0, 4, 6, 10],
    formula: "1 3 b5 b7",
  },
  {
    id: "dominant7Sharp5",
    name: "7th Sharp 5",
    suffix: "7#5",
    intervals: [0, 4, 8, 10],
    formula: "1 3 #5 b7",
  },
  { id: "major7", name: "Major 7", suffix: "maj7", intervals: [0, 4, 7, 11], formula: "1 3 5 7" },
  {
    id: "minorMajor7",
    name: "Minor Major 7",
    suffix: "m(maj7)",
    intervals: [0, 3, 7, 11],
    formula: "1 b3 5 7",
  },
  { id: "minor7", name: "Minor 7", suffix: "m7", intervals: [0, 3, 7, 10], formula: "1 b3 5 b7" },
  {
    id: "halfDiminished7",
    name: "Half-diminished 7",
    suffix: "m7b5",
    intervals: [0, 3, 6, 10],
    formula: "1 b3 b5 b7",
    aliases: ["ø7"],
  },
  {
    id: "diminished7",
    name: "Diminished 7",
    suffix: "dim7",
    intervals: [0, 3, 6, 9],
    formula: "1 b3 b5 bb7",
  },
  { id: "dominant9", name: "9th", suffix: "9", intervals: [0, 4, 7, 10, 14], formula: "1 3 5 b7 9" },
  { id: "major9", name: "Major 9", suffix: "maj9", intervals: [0, 4, 7, 11, 14], formula: "1 3 5 7 9" },
  { id: "minor9", name: "Minor 9", suffix: "m9", intervals: [0, 3, 7, 10, 14], formula: "1 b3 5 b7 9" },
  {
    id: "major6Add9",
    name: "6th Add 9",
    suffix: "6add9",
    intervals: [0, 4, 7, 9, 14],
    formula: "1 3 5 6 9",
  },
] as const satisfies readonly ChordDefinitionRecord[];

export type ChordDefinition = (typeof CHORD_DEFINITIONS)[number];
export type ChordId = ChordDefinition["id"];
export type ChordVoicingRange = {
  minMidiLike: number;
  maxMidiLike: number;
};

const CHORD_ROOT_SEGMENT_BY_PITCH_CLASS: Record<PitchClass, string> = {
  C: "c",
  "C#": "c-sharp",
  D: "d",
  "D#": "d-sharp",
  E: "e",
  F: "f",
  "F#": "f-sharp",
  G: "g",
  "G#": "g-sharp",
  A: "a",
  "A#": "a-sharp",
  B: "b",
};

const CHORD_PITCH_CLASS_BY_ROOT_SEGMENT: Record<string, PitchClass> = {
  c: "C",
  "c-sharp": "C#",
  "d-flat": "C#",
  db: "C#",
  d: "D",
  "d-sharp": "D#",
  "e-flat": "D#",
  eb: "D#",
  e: "E",
  f: "F",
  "f-sharp": "F#",
  "g-flat": "F#",
  gb: "F#",
  g: "G",
  "g-sharp": "G#",
  "a-flat": "G#",
  ab: "G#",
  a: "A",
  "a-sharp": "A#",
  "b-flat": "A#",
  bb: "A#",
  b: "B",
};

const CHORD_DEFINITION_BY_ID = new Map<ChordId, ChordDefinition>(
  CHORD_DEFINITIONS.map((definition) => [definition.id, definition]),
);

export const CHORD_ROOT_PITCH_CLASSES: readonly PitchClass[] = NOTE_SEQUENCE;

export function getChordDefinitionById(chordId: ChordId): ChordDefinition {
  const definition = CHORD_DEFINITION_BY_ID.get(chordId);
  if (!definition) {
    throw new Error(`Unknown chord definition: ${chordId}`);
  }
  return definition;
}

export function buildChordPitchClasses(root: PitchClass, chordDefinition: ChordDefinition): PitchClass[] {
  const rootIndex = pitchClassToIndex(root);
  return chordDefinition.intervals.map((interval) => indexToPitchClass(rootIndex + interval));
}

function midiLikeToKeyId(midiLike: number): string {
  const note = indexToPitchClass(midiLike);
  const octave = Math.floor(midiLike / 12);
  return `${note}${octave}`;
}

export function buildChordPlaybackKeyIds(
  root: PitchClass,
  chordDefinition: ChordDefinition,
  baseOctave = 4,
): string[] {
  return buildChordVoicingKeyIds(root, chordDefinition, 0, baseOctave);
}

function toOrdinal(value: number): string {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) {
    return `${value}th`;
  }

  const mod10 = value % 10;
  if (mod10 === 1) {
    return `${value}st`;
  }

  if (mod10 === 2) {
    return `${value}nd`;
  }

  if (mod10 === 3) {
    return `${value}rd`;
  }

  return `${value}th`;
}

export function formatChordInversionLabel(
  inversionIndex: number,
  chordDefinition: ChordDefinition,
): string {
  const inversionCount = chordDefinition.intervals.length;
  if (inversionCount === 0) {
    return "Root position";
  }

  const normalizedInversion = ((inversionIndex % inversionCount) + inversionCount) % inversionCount;
  if (normalizedInversion === 0) {
    return "Root position";
  }

  return `${toOrdinal(normalizedInversion)} inversion`;
}

function fitVoicingMidiNotesToRange(
  voicingMidiNotes: number[],
  range: ChordVoicingRange,
): number[] {
  if (voicingMidiNotes.length === 0) {
    return voicingMidiNotes;
  }

  const rangeSpan = range.maxMidiLike - range.minMidiLike;
  const voicingSpan = voicingMidiNotes[voicingMidiNotes.length - 1] - voicingMidiNotes[0];
  if (voicingSpan > rangeSpan) {
    return voicingMidiNotes;
  }

  let fitted = [...voicingMidiNotes];
  while (fitted[fitted.length - 1] > range.maxMidiLike) {
    fitted = fitted.map((midiLike) => midiLike - 12);
  }
  while (fitted[0] < range.minMidiLike) {
    fitted = fitted.map((midiLike) => midiLike + 12);
  }

  return fitted;
}

export function buildChordVoicingKeyIds(
  root: PitchClass,
  chordDefinition: ChordDefinition,
  inversionIndex: number,
  baseOctave = 4,
  range?: ChordVoicingRange,
): string[] {
  const rootMidi = baseOctave * 12 + pitchClassToIndex(root);
  const sortedIntervals = chordDefinition.intervals
    .slice()
    .sort((left, right) => left - right);
  const inversionCount = sortedIntervals.length;

  if (inversionCount === 0) {
    return [];
  }

  const normalizedInversion = ((inversionIndex % inversionCount) + inversionCount) % inversionCount;
  const voicingMidiNotes = sortedIntervals
    .map((interval, index) => rootMidi + interval + (index < normalizedInversion ? 12 : 0))
    .sort((left, right) => left - right);
  const fittedVoicingMidiNotes = range
    ? fitVoicingMidiNotesToRange(voicingMidiNotes, range)
    : voicingMidiNotes;

  return fittedVoicingMidiNotes.map((midiLike) => midiLikeToKeyId(midiLike));
}

export function formatChordLabel(root: PitchClass, chordDefinition: ChordDefinition): string {
  const sharpRoot = root;
  return `${sharpRoot} ${chordDefinition.name}`;
}

export function buildChordSearchText(root: PitchClass, chordDefinition: ChordDefinition): string {
  const aliases = chordDefinition.aliases?.join(" ") ?? "";
  const sharpRoot = root;
  const flatRoot = applyNotationPreference(root, "flats");
  const sharpSymbol = `${sharpRoot}${chordDefinition.suffix}`;
  const flatSymbol = `${flatRoot}${chordDefinition.suffix}`;
  const label = formatChordLabel(root, chordDefinition);

  return [sharpRoot, flatRoot, sharpSymbol, flatSymbol, chordDefinition.name, aliases, label]
    .join(" ")
    .toLowerCase()
    .replaceAll("♯", "#")
    .replaceAll("♭", "b");
}

export function buildChordLibraryPath(root: PitchClass, chordId: ChordId): string {
  const rootSegment = CHORD_ROOT_SEGMENT_BY_PITCH_CLASS[root];
  return `/library/chords/${rootSegment}/${chordId}`;
}

export function parseChordLibraryPath(pathname: string): { root: PitchClass; chordId: ChordId } | null {
  const [cleanPathname] = pathname.split("?");
  const segments = cleanPathname.split("/").filter(Boolean);
  if (segments.length < 4) {
    return null;
  }

  const [librarySegment, chordsSegment, rootSegment, chordSegment] = segments;
  if (librarySegment !== "library" || chordsSegment !== "chords") {
    return null;
  }

  const root = CHORD_PITCH_CLASS_BY_ROOT_SEGMENT[rootSegment.toLowerCase()];
  const chordId = CHORD_DEFINITIONS.find((definition) => definition.id === chordSegment)?.id;
  if (!root || !chordId) {
    return null;
  }

  return { root, chordId };
}

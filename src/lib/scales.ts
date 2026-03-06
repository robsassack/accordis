import {
  NOTE_SEQUENCE,
  applyNotationPreference,
  formatMusicText,
  indexToPitchClass,
  pitchClassToIndex,
  type NotationPreference,
  type PitchClass,
} from "@/lib/piano";

type ScaleDefinitionRecord = {
  id: string;
  name: string;
  intervals: readonly number[];
  formula: string;
  parentMajorOffset: number;
  aliases?: readonly string[];
};

export const SCALE_DEFINITIONS = [
  {
    id: "major",
    name: "Major",
    intervals: [0, 2, 4, 5, 7, 9, 11],
    formula: "1 2 3 4 5 6 7",
    parentMajorOffset: 0,
    aliases: ["ionian"],
  },
  {
    id: "naturalMinor",
    name: "Natural Minor",
    intervals: [0, 2, 3, 5, 7, 8, 10],
    formula: "1 2 b3 4 5 b6 b7",
    parentMajorOffset: 3,
    aliases: ["aeolian"],
  },
  {
    id: "harmonicMinor",
    name: "Harmonic Minor",
    intervals: [0, 2, 3, 5, 7, 8, 11],
    formula: "1 2 b3 4 5 b6 7",
    parentMajorOffset: 3,
  },
  {
    id: "melodicMinor",
    name: "Melodic Minor",
    intervals: [0, 2, 3, 5, 7, 9, 11],
    formula: "1 2 b3 4 5 6 7",
    parentMajorOffset: 3,
  },
  {
    id: "dorian",
    name: "Dorian",
    intervals: [0, 2, 3, 5, 7, 9, 10],
    formula: "1 2 b3 4 5 6 b7",
    parentMajorOffset: 10,
  },
  {
    id: "phrygian",
    name: "Phrygian",
    intervals: [0, 1, 3, 5, 7, 8, 10],
    formula: "1 b2 b3 4 5 b6 b7",
    parentMajorOffset: 8,
  },
  {
    id: "lydian",
    name: "Lydian",
    intervals: [0, 2, 4, 6, 7, 9, 11],
    formula: "1 2 3 #4 5 6 7",
    parentMajorOffset: 7,
  },
  {
    id: "mixolydian",
    name: "Mixolydian",
    intervals: [0, 2, 4, 5, 7, 9, 10],
    formula: "1 2 3 4 5 6 b7",
    parentMajorOffset: 5,
  },
  {
    id: "locrian",
    name: "Locrian",
    intervals: [0, 1, 3, 5, 6, 8, 10],
    formula: "1 b2 b3 4 b5 b6 b7",
    parentMajorOffset: 1,
  },
  {
    id: "majorPentatonic",
    name: "Major Pentatonic",
    intervals: [0, 2, 4, 7, 9],
    formula: "1 2 3 5 6",
    parentMajorOffset: 0,
  },
  {
    id: "minorPentatonic",
    name: "Minor Pentatonic",
    intervals: [0, 3, 5, 7, 10],
    formula: "1 b3 4 5 b7",
    parentMajorOffset: 3,
  },
  {
    id: "minorBlues",
    name: "Minor Blues",
    intervals: [0, 3, 5, 6, 7, 10],
    formula: "1 b3 4 #4 5 b7",
    parentMajorOffset: 3,
    aliases: ["blues"],
  },
  {
    id: "majorBlues",
    name: "Major Blues",
    intervals: [0, 2, 3, 4, 7, 9],
    formula: "1 2 b3 3 5 6",
    parentMajorOffset: 0,
  },
  {
    id: "wholeTone",
    name: "Whole Tone",
    intervals: [0, 2, 4, 6, 8, 10],
    formula: "1 2 3 #4 #5 b7",
    parentMajorOffset: 0,
  },
  {
    id: "diminishedHalfWhole",
    name: "Diminished (Half-Whole)",
    intervals: [0, 1, 3, 4, 6, 7, 9, 10],
    formula: "1 b2 b3 3 b5 5 6 b7",
    parentMajorOffset: 0,
  },
  {
    id: "diminishedWholeHalf",
    name: "Diminished (Whole-Half)",
    intervals: [0, 2, 3, 5, 6, 8, 9, 11],
    formula: "1 2 b3 4 b5 b6 6 7",
    parentMajorOffset: 0,
  },
] as const satisfies readonly ScaleDefinitionRecord[];

export type ScaleDefinition = (typeof SCALE_DEFINITIONS)[number];
export type ScaleId = ScaleDefinition["id"];
export type ScalePlaybackDirection = "ascending" | "descending" | "both";

const SCALE_ROOT_SEGMENT_BY_PITCH_CLASS: Record<PitchClass, string> = {
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

const SCALE_PITCH_CLASS_BY_ROOT_SEGMENT: Record<string, PitchClass> = {
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

const SCALE_DEFINITION_BY_ID = new Map<ScaleId, ScaleDefinition>(
  SCALE_DEFINITIONS.map((definition) => [definition.id, definition]),
);

const MAJOR_KEY_NOTATION_BY_PITCH_CLASS: Partial<Record<number, NotationPreference>> = {
  0: "sharps",
  2: "sharps",
  4: "sharps",
  5: "flats",
  7: "sharps",
  9: "sharps",
  11: "sharps",
};

export const SCALE_ROOT_PITCH_CLASSES: readonly PitchClass[] = NOTE_SEQUENCE;

export function getScaleDefinitionById(scaleId: ScaleId): ScaleDefinition {
  const definition = SCALE_DEFINITION_BY_ID.get(scaleId);
  if (!definition) {
    throw new Error(`Unknown scale definition: ${scaleId}`);
  }
  return definition;
}

export function getScaleNotationPreference(
  root: PitchClass,
  scaleDefinition: ScaleDefinition,
): NotationPreference {
  const rootIndex = pitchClassToIndex(root);
  const parentMajorIndex = (rootIndex + scaleDefinition.parentMajorOffset + 12) % 12;
  return MAJOR_KEY_NOTATION_BY_PITCH_CLASS[parentMajorIndex] ?? "flats";
}

export function buildScalePitchClasses(root: PitchClass, scaleDefinition: ScaleDefinition): PitchClass[] {
  const rootIndex = pitchClassToIndex(root);
  return scaleDefinition.intervals.map((interval) => indexToPitchClass(rootIndex + interval));
}

export function formatScaleLabel(root: PitchClass, scaleDefinition: ScaleDefinition): string {
  const notationPreference = getScaleNotationPreference(root, scaleDefinition);
  return `${formatMusicText(root, notationPreference)} ${scaleDefinition.name}`;
}

export function buildScaleSearchText(root: PitchClass, scaleDefinition: ScaleDefinition): string {
  const aliases =
    ("aliases" in scaleDefinition ? scaleDefinition.aliases : undefined)?.join(" ") ?? "";
  const sharpRoot = root;
  const flatRoot = applyNotationPreference(root, "flats");
  const autoLabel = formatScaleLabel(root, scaleDefinition);

  return [sharpRoot, flatRoot, scaleDefinition.name, aliases, autoLabel]
    .join(" ")
    .toLowerCase()
    .replaceAll("♯", "#")
    .replaceAll("♭", "b");
}

export function buildScaleLibraryPath(root: PitchClass, scaleId: ScaleId): string {
  const rootSegment = SCALE_ROOT_SEGMENT_BY_PITCH_CLASS[root];
  return `/library/scales/${rootSegment}/${scaleId}`;
}

export function parseScaleLibraryPath(pathname: string): { root: PitchClass; scaleId: ScaleId } | null {
  const [cleanPathname] = pathname.split("?");
  const segments = cleanPathname.split("/").filter(Boolean);
  if (segments.length < 4) {
    return null;
  }

  const [librarySegment, scalesSegment, rootSegment, scaleSegment] = segments;
  if (librarySegment !== "library" || scalesSegment !== "scales") {
    return null;
  }

  const root = SCALE_PITCH_CLASS_BY_ROOT_SEGMENT[rootSegment.toLowerCase()];
  const scaleId = SCALE_DEFINITIONS.find((definition) => definition.id === scaleSegment)?.id;
  if (!root || !scaleId) {
    return null;
  }

  return { root, scaleId };
}

function midiLikeToNoteName(midiLike: number): string {
  const note = indexToPitchClass(midiLike);
  const octave = Math.floor(midiLike / 12);
  return `${note}${octave}`;
}

export function buildScalePlaybackNoteNames(
  root: PitchClass,
  scaleDefinition: ScaleDefinition,
  direction: ScalePlaybackDirection,
  baseOctave = 4,
): string[] {
  const rootMidi = baseOctave * 12 + pitchClassToIndex(root);
  const ascending = [...scaleDefinition.intervals, 12].map((interval) =>
    midiLikeToNoteName(rootMidi + interval),
  );

  if (direction === "ascending") {
    return ascending;
  }

  if (direction === "descending") {
    return [...ascending].reverse();
  }

  return [...ascending, ...ascending.slice(0, -1).reverse()];
}

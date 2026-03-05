export const NOTE_SEQUENCE = [
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

export type PitchClass = (typeof NOTE_SEQUENCE)[number];
export type NotationPreference = "sharps" | "flats";
export type PianoKey = {
  note: PitchClass;
  octave: number;
  isSharp: boolean;
};

const NOTE_TO_INDEX: Record<PitchClass, number> = {
  C: 0,
  "C#": 1,
  D: 2,
  "D#": 3,
  E: 4,
  F: 5,
  "F#": 6,
  G: 7,
  "G#": 8,
  A: 9,
  "A#": 10,
  B: 11,
};

const FLAT_TO_SHARP: Record<string, PitchClass> = {
  Db: "C#",
  Eb: "D#",
  Gb: "F#",
  Ab: "G#",
  Bb: "A#",
};

const SHARP_TO_FLAT_DISPLAY: Record<PitchClass, string> = {
  C: "C",
  "C#": "Db",
  D: "D",
  "D#": "Eb",
  E: "E",
  F: "F",
  "F#": "Gb",
  G: "G",
  "G#": "Ab",
  A: "A",
  "A#": "Bb",
  B: "B",
};

export type ParsedKeyId = {
  note: PitchClass;
  octave: number;
  midiLike: number;
};

export function normalizePitchClass(note: string): PitchClass | null {
  if ((NOTE_SEQUENCE as readonly string[]).includes(note)) {
    return note as PitchClass;
  }

  return FLAT_TO_SHARP[note] ?? null;
}

export function pitchClassToIndex(note: PitchClass): number {
  return NOTE_TO_INDEX[note];
}

export function indexToPitchClass(index: number): PitchClass {
  const normalized = ((index % 12) + 12) % 12;
  return NOTE_SEQUENCE[normalized];
}

export function parseKeyId(keyId: string): ParsedKeyId | null {
  const match = keyId.match(/^([A-G](?:#|b)?)(-?\d+)$/);
  if (!match) {
    return null;
  }

  const parsedNote = normalizePitchClass(match[1]);
  const octave = Number(match[2]);

  if (!parsedNote || Number.isNaN(octave)) {
    return null;
  }

  return {
    note: parsedNote,
    octave,
    midiLike: octave * 12 + pitchClassToIndex(parsedNote),
  };
}

export function uniquePitchClassesFromKeyIds(keyIds: string[]): PitchClass[] {
  const seen = new Set<PitchClass>();

  for (const keyId of keyIds) {
    const parsed = parseKeyId(keyId);
    if (parsed) {
      seen.add(parsed.note);
    }
  }

  return NOTE_SEQUENCE.filter((note) => seen.has(note));
}

export function findBassPitchClass(keyIds: string[]): PitchClass | null {
  const parsed = keyIds
    .map(parseKeyId)
    .filter((item): item is ParsedKeyId => item !== null)
    .sort((a, b) => a.midiLike - b.midiLike);

  return parsed[0]?.note ?? null;
}

export function buildPianoKeys(startOctave: number, endOctave: number): PianoKey[] {
  const keys: PianoKey[] = [];

  for (let octave = startOctave; octave <= endOctave; octave += 1) {
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

export function applyNotationPreference(
  value: string,
  notationPreference: NotationPreference = "sharps",
): string {
  if (notationPreference === "sharps") {
    return value;
  }

  return value.replaceAll(
    /C#|D#|F#|G#|A#/g,
    (note) => SHARP_TO_FLAT_DISPLAY[note as PitchClass],
  );
}

export function formatMusicText(
  value: string,
  notationPreference: NotationPreference = "sharps",
): string {
  return applyNotationPreference(value, notationPreference)
    .replaceAll("#", "♯")
    .replaceAll("b", "♭");
}

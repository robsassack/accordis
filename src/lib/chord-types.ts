import type { PitchClass } from "@/lib/piano";

export type ChordQuality =
  | "major"
  | "minor"
  | "diminished"
  | "augmented"
  | "suspended2"
  | "suspended4"
  | "suspendedDominant7"
  | "major6"
  | "minor6"
  | "majorAdd9"
  | "minorAdd9"
  | "dominant7"
  | "dominant7Flat5"
  | "dominant7Sharp5"
  | "major7"
  | "minorMajor7"
  | "minor7"
  | "halfDiminished7"
  | "diminished7"
  | "dominant9"
  | "major9"
  | "minor9"
  | "major6Add9";

export type ChordMatch = {
  name: string;
  symbol: string;
  root: PitchClass;
  quality: ChordQuality;
  notes: PitchClass[];
  inversionLabel: string;
  bass: PitchClass;
  slashSymbol: string | null;
  partialOmission: "fifth" | "seventh" | null;
};

export type IntervalMatch = {
  name: string;
  symbol: string;
  semitones: number;
  notes: PitchClass[];
};

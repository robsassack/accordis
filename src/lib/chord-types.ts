import type { PitchClass } from "@/lib/piano";

export type ChordQuality =
  | "major"
  | "minor"
  | "diminished"
  | "augmented"
  | "suspended2"
  | "suspended4"
  | "dominant7"
  | "major7"
  | "minor7"
  | "halfDiminished7"
  | "diminished7";

export type ChordMatch = {
  name: string;
  symbol: string;
  root: PitchClass;
  quality: ChordQuality;
  notes: PitchClass[];
  inversionLabel: string;
  bass: PitchClass;
  slashSymbol: string | null;
};

export type IntervalMatch = {
  name: string;
  symbol: string;
  semitones: number;
  notes: PitchClass[];
};

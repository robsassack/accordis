import type { ChordMatch, ChordQuality, IntervalMatch } from "@/lib/chord-types";
import {
  findBassPitchClass,
  indexToPitchClass,
  parseKeyId,
  pitchClassToIndex,
  uniquePitchClassesFromKeyIds,
} from "@/lib/piano";

export const MIN_UNIQUE_NOTES_FOR_CHORD = 3;

type ChordTemplate = {
  quality: ChordQuality;
  label: string;
  suffix: string;
  intervals: number[];
  rank: number;
};

const CHORD_TEMPLATES: ChordTemplate[] = [
  { quality: "major", label: "Major", suffix: "", intervals: [0, 4, 7], rank: 1 },
  { quality: "minor", label: "Minor", suffix: "m", intervals: [0, 3, 7], rank: 1 },
  { quality: "diminished", label: "Diminished", suffix: "dim", intervals: [0, 3, 6], rank: 2 },
  { quality: "augmented", label: "Augmented", suffix: "aug", intervals: [0, 4, 8], rank: 2 },
  { quality: "suspended2", label: "Suspended 2", suffix: "sus2", intervals: [0, 2, 7], rank: 3 },
  { quality: "suspended4", label: "Suspended 4", suffix: "sus4", intervals: [0, 5, 7], rank: 3 },
  { quality: "dominant7", label: "Dominant 7", suffix: "7", intervals: [0, 4, 7, 10], rank: 4 },
  { quality: "major7", label: "Major 7", suffix: "maj7", intervals: [0, 4, 7, 11], rank: 4 },
  { quality: "minor7", label: "Minor 7", suffix: "m7", intervals: [0, 3, 7, 10], rank: 4 },
  {
    quality: "halfDiminished7",
    label: "Half-diminished 7",
    suffix: "m7b5",
    intervals: [0, 3, 6, 10],
    rank: 5,
  },
  {
    quality: "diminished7",
    label: "Diminished 7",
    suffix: "dim7",
    intervals: [0, 3, 6, 9],
    rank: 5,
  },
];

const INTERVAL_LABELS: Record<number, { name: string; symbol: string }> = {
  0: { name: "Perfect Unison", symbol: "P1" },
  1: { name: "Minor 2nd", symbol: "m2" },
  2: { name: "Major 2nd", symbol: "M2" },
  3: { name: "Minor 3rd", symbol: "m3" },
  4: { name: "Major 3rd", symbol: "M3" },
  5: { name: "Perfect 4th", symbol: "P4" },
  6: { name: "Tritone", symbol: "TT" },
  7: { name: "Perfect 5th", symbol: "P5" },
  8: { name: "Minor 6th", symbol: "m6" },
  9: { name: "Major 6th", symbol: "M6" },
  10: { name: "Minor 7th", symbol: "m7" },
  11: { name: "Major 7th", symbol: "M7" },
};

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

function describeInterval(semitones: number): { name: string; symbol: string } {
  if (semitones <= 11) {
    return INTERVAL_LABELS[semitones];
  }

  if (semitones === 12) {
    return { name: "Octave", symbol: "P8" };
  }

  const octaves = Math.floor(semitones / 12);
  const remainder = semitones % 12;

  if (remainder === 0) {
    const compoundNumber = 1 + octaves * 7;
    return {
      name: `Perfect ${toOrdinal(compoundNumber)}`,
      symbol: `P${compoundNumber} (compound of P8)`,
    };
  }

  const base = INTERVAL_LABELS[remainder];
  if (!base || base.symbol === "TT") {
    return {
      name: "Compound Tritone",
      symbol: "TT (compound of TT)",
    };
  }

  const quality = base.name.split(" ")[0];
  const baseNumber = Number(base.symbol.slice(1));
  const compoundNumber = baseNumber + octaves * 7;
  const qualitySymbol = base.symbol[0];

  return {
    name: `${quality} ${toOrdinal(compoundNumber)}`,
    symbol: `${qualitySymbol}${compoundNumber} (compound of ${base.symbol})`,
  };
}

function setsEqual(left: Set<number>, right: Set<number>): boolean {
  if (left.size !== right.size) {
    return false;
  }

  for (const value of left) {
    if (!right.has(value)) {
      return false;
    }
  }

  return true;
}

function buildChordSet(rootIndex: number, intervals: number[]): Set<number> {
  return new Set(intervals.map((interval) => (rootIndex + interval) % 12));
}

function setWithoutInterval(intervals: number[], omittedInterval: number): number[] {
  return intervals.filter((interval) => interval !== omittedInterval);
}

function buildInversionLabel(intervals: number[], bassInterval: number): string {
  const index = intervals.indexOf(bassInterval);
  if (index <= 0) {
    return "Root position";
  }

  if (index === 1) {
    return "1st inversion";
  }

  if (index === 2) {
    return "2nd inversion";
  }

  return "3rd inversion";
}

export function detectIntervals(selectedKeyIds: string[]): IntervalMatch[] {
  const parsedSorted = selectedKeyIds
    .map(parseKeyId)
    .filter((item): item is NonNullable<ReturnType<typeof parseKeyId>> => item !== null)
    .sort((a, b) => a.midiLike - b.midiLike);

  if (parsedSorted.length < 2) {
    return [];
  }

  const uniquePitchClasses = uniquePitchClassesFromKeyIds(selectedKeyIds);
  if (uniquePitchClasses.length === 1) {
    return [
      {
        name: "Octave",
        symbol: "P8",
        semitones: 12,
        notes: [uniquePitchClasses[0], uniquePitchClasses[0]],
      },
    ];
  }

  if (uniquePitchClasses.length > 2) {
    return [];
  }

  const lowest = parsedSorted[0];
  const highest = parsedSorted[parsedSorted.length - 1];
  const semitones = highest.midiLike - lowest.midiLike;
  const interval = describeInterval(semitones);

  return [
    {
      name: interval.name,
      symbol: interval.symbol,
      semitones,
      notes: [lowest.note, highest.note],
    },
  ];
}

export function detectChords(selectedKeyIds: string[]): ChordMatch[] {
  const uniquePitchClasses = uniquePitchClassesFromKeyIds(selectedKeyIds);

  if (uniquePitchClasses.length < MIN_UNIQUE_NOTES_FOR_CHORD) {
    return [];
  }

  const selectedSet = new Set(uniquePitchClasses.map((note) => pitchClassToIndex(note)));
  const bassPitchClass = findBassPitchClass(selectedKeyIds);

  if (!bassPitchClass) {
    return [];
  }

  const bassIndex = pitchClassToIndex(bassPitchClass);
  const matches: Array<ChordMatch & { score: number }> = [];
  const FIFTH_INTERVAL_INDEX = 2;

  for (let rootIndex = 0; rootIndex < 12; rootIndex += 1) {
    for (const template of CHORD_TEMPLATES) {
      let isMatch = false;
      let omittedFifth = false;

      if (template.intervals.length === selectedSet.size) {
        const fullChordSet = buildChordSet(rootIndex, template.intervals);
        isMatch = setsEqual(selectedSet, fullChordSet);
      } else if (template.intervals.length === 4 && selectedSet.size === 3) {
        // Common jazz/pop voicing: seventh chords with omitted fifth.
        const fifthInterval = template.intervals[FIFTH_INTERVAL_INDEX];
        const intervalsWithoutFifth = setWithoutInterval(template.intervals, fifthInterval);
        const noFifthSet = buildChordSet(rootIndex, intervalsWithoutFifth);
        isMatch = setsEqual(selectedSet, noFifthSet);
        omittedFifth = isMatch;
      }

      if (!isMatch) {
        continue;
      }

      const root = indexToPitchClass(rootIndex);
      const notes = template.intervals.map((interval) => indexToPitchClass(rootIndex + interval));
      const bassInterval = ((bassIndex - rootIndex) % 12 + 12) % 12;

      if (!template.intervals.includes(bassInterval)) {
        continue;
      }

      const inversionLabel = buildInversionLabel(template.intervals, bassInterval);
      const symbol = `${root}${template.suffix}`;
      const slashSymbol = bassPitchClass === root ? null : `${symbol}/${bassPitchClass}`;
      const name = `${root} ${template.label}`;
      const score = (bassPitchClass === root ? 0 : 8) + template.rank + (omittedFifth ? 2 : 0);

      matches.push({
        name,
        symbol,
        root,
        quality: template.quality,
        notes,
        inversionLabel,
        bass: bassPitchClass,
        slashSymbol,
        partialOmission: omittedFifth ? "fifth" : null,
        score,
      });
    }
  }

  return matches
    .sort((a, b) => a.score - b.score || a.symbol.localeCompare(b.symbol))
    .map((match) => ({
      name: match.name,
      symbol: match.symbol,
      root: match.root,
      quality: match.quality,
      notes: match.notes,
      inversionLabel: match.inversionLabel,
      bass: match.bass,
      slashSymbol: match.slashSymbol,
      partialOmission: match.partialOmission,
    }));
}

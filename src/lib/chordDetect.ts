export type PreferAccidentals = "sharps" | "flats";

const NOTE_NAMES_SHARPS = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"] as const;
const NOTE_NAMES_FLATS  = ["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"] as const;

function mod(n: number, m: number) {
  return ((n % m) + m) % m;
}

function uniqSorted(nums: number[]) {
  return Array.from(new Set(nums)).sort((a, b) => a - b);
}

function pcToName(pc: number, prefer: PreferAccidentals) {
  const names = prefer === "flats" ? NOTE_NAMES_FLATS : NOTE_NAMES_SHARPS;
  return names[mod(pc, 12)]!;
}

function midiToPc(midi: number) {
  return mod(midi, 12);
}

function intervalToPc(rootPc: number, interval: number) {
  return mod(rootPc + interval, 12);
}

export type ChordTemplate = {
  id: string;                // stable key for code
  label: string;             // human label e.g. "maj7"
  intervals: number[];       // pitch classes relative to root (0..11), must include 0
  optional?: number[];       // intervals allowed to be missing with smaller penalty (e.g., 5th)
};

const T = (id: string, label: string, intervals: number[], optional: number[] = []): ChordTemplate => ({
  id, label, intervals: uniqSorted(intervals.map(i => mod(i, 12))),
  optional: uniqSorted(optional.map(i => mod(i, 12))),
});

// Medium-ish starter vocab (easy to extend later)
export const CHORD_TEMPLATES: ChordTemplate[] = [
  // Triads / basics
  T("maj",   "",      [0,4,7],     [7]),
  T("min",   "m",     [0,3,7],     [7]),
  T("dim",   "dim",   [0,3,6]),
  T("aug",   "aug",   [0,4,8]),
  T("sus2",  "sus2",  [0,2,7],     [7]),
  T("sus4",  "sus4",  [0,5,7],     [7]),
  T("pow5",  "5",     [0,7]),

  // 6 / add
  T("6",     "6",     [0,4,7,9],   [7]),
  T("m6",    "m6",    [0,3,7,9],   [7]),
  T("add9",  "add9",  [0,2,4,7],   [7]),
  T("madd9", "madd9", [0,2,3,7],   [7]),

  // 7ths
  T("7",     "7",     [0,4,7,10],  [7]),
  T("maj7",  "maj7",  [0,4,7,11],  [7]),
  T("m7",    "m7",    [0,3,7,10],  [7]),
  T("m7b5",  "m7♭5",  [0,3,6,10]),
  T("dim7",  "dim7",  [0,3,6,9]),

  // Extensions (kept simple; expand/alter later)
  T("9",     "9",     [0,2,4,7,10],     [7]),
  T("maj9",  "maj9",  [0,2,4,7,11],     [7]),
  T("m9",    "m9",    [0,2,3,7,10],     [7]),
  T("11",    "11",    [0,2,4,5,7,10],   [7]),
  T("13",    "13",    [0,2,4,5,7,9,10], [7]),
];

export type DetectOptions = {
  /**
   * If your UI sends 0..87 for an 88-key keyboard where 0 = A0,
   * MIDI = 21 + keyIndex (default).
   */
  keyIndexToMidiOffset?: number; // default 21
  preferAccidentals?: PreferAccidentals; // default "sharps"
  /**
   * If true, treat the numbers passed in as MIDI notes already,
   * and skip keyIndex -> MIDI conversion.
   */
  inputIsMidi?: boolean; // default false
  /**
   * How many candidates to return (including best).
   */
  maxCandidates?: number; // default 8
};

export type ChordCandidate = {
  name: string;          // e.g. "Cmaj7/E" or "Dm"
  chordName: string;     // without slash, e.g. "Cmaj7"
  slash?: string;        // e.g. "E" (bass), if different from root
  rootPc: number;
  bassPc: number;

  score: number;
  quality: "exact" | "incomplete" | "extra";

  missingPcs: number[];  // chord tones expected but not present (PCs)
  extraPcs: number[];    // pressed tones not in template (PCs)

  templateId: string;
  templateLabel: string;

  // Useful for UI/debug
  usedPitchClasses: number[]; // unique PCs from input
};

export type DetectResult = {
  pressedMidi: number[];       // includes duplicates
  pressedPitchClasses: number[]; // unique sorted PCs
  bassMidi?: number;
  best?: ChordCandidate;
  candidates: ChordCandidate[];
};

/**
 * Detect chords from pressed keys.
 * - Inversions collapse naturally (pitch class sets)
 * - Slash chords use the *lowest pressed note* as bass
 * - Returns best guess + ranked alternatives + diagnostics
 */
export function detectChords(pressedKeys: number[], opts: DetectOptions = {}): DetectResult {
  const {
    keyIndexToMidiOffset = 21,
    preferAccidentals = "sharps",
    inputIsMidi = false,
    maxCandidates = 8,
  } = opts;

  // Keep duplicates for UI; detection uses unique pitch classes
  const pressedMidi = pressedKeys
    .map(n => inputIsMidi ? n : (keyIndexToMidiOffset + n))
    .filter(n => Number.isFinite(n))
    .map(n => Math.round(n));

  if (pressedMidi.length === 0) return { pressedMidi: [], pressedPitchClasses: [], candidates: [] };

  const bassMidi = Math.min(...pressedMidi);
  const bassPc = midiToPc(bassMidi);

  const pcs = uniqSorted(pressedMidi.map(midiToPc));
  if (pcs.length < 2) {
    // Not really a chord yet; return no best guess
    return { pressedMidi, pressedPitchClasses: pcs, bassMidi, candidates: [] };
  }

  type Raw = {
    rootPc: number;
    template: ChordTemplate;
    score: number;
    missingPcs: number[];
    extraPcs: number[];
    quality: "exact" | "incomplete" | "extra";
  };

  const raws: Raw[] = [];

  for (let rootPc = 0; rootPc < 12; rootPc++) {
    const rel = new Set(pcs.map(pc => mod(pc - rootPc, 12)));

    for (const tpl of CHORD_TEMPLATES) {
      const tplSet = new Set(tpl.intervals);
      const optSet = new Set(tpl.optional ?? []);
      const req = tpl.intervals.filter(i => !optSet.has(i));

      const hitsReq = req.filter(i => rel.has(i)).length;
      const missReq = req.filter(i => !rel.has(i)).length;

      const hitsOpt = (tpl.optional ?? []).filter(i => rel.has(i)).length;
      const missOpt = (tpl.optional ?? []).filter(i => !rel.has(i)).length;

      const extraRel = Array.from(rel).filter(i => !tplSet.has(i));
      const extraCount = extraRel.length;

      // Small bias: prefer roots that are actually present (helps reduce weird roots)
      const rootPresent = pcs.includes(rootPc);
      const rootBonus = rootPresent ? 1 : -1;

      // Score weights (tweak later):
      // - required hits matter most
      // - missing required hurts
      // - extra notes hurt a lot
      // - missing optional is mild (lets you omit 5th)
      const score =
        hitsReq * 4 +
        hitsOpt * 2 +
        rootBonus -
        missReq * 3 -
        missOpt * 1 -
        extraCount * 3;

      // Diagnostics in actual note PCs
      const missingPcs = req
        .filter(i => !rel.has(i))
        .map(i => intervalToPc(rootPc, i));

      const extraPcs = extraRel.map(i => intervalToPc(rootPc, i));

      const quality: Raw["quality"] =
        (missingPcs.length === 0 && extraPcs.length === 0) ? "exact" :
        (extraPcs.length > 0) ? "extra" :
        "incomplete";

      raws.push({ rootPc, template: tpl, score, missingPcs, extraPcs, quality });
    }
  }

  raws.sort((a, b) => b.score - a.score);

  const toCandidate = (r: Raw): ChordCandidate => {
    const rootName = pcToName(r.rootPc, preferAccidentals);
    const bassName = pcToName(bassPc, preferAccidentals);
    const chordName = `${rootName}${r.template.label}`;
    const slash = bassPc !== r.rootPc ? bassName : undefined;
    const name = slash ? `${chordName}/${slash}` : chordName;

    return {
      name,
      chordName,
      slash,
      rootPc: r.rootPc,
      bassPc,
      score: r.score,
      quality: r.quality,
      missingPcs: uniqSorted(r.missingPcs),
      extraPcs: uniqSorted(r.extraPcs),
      templateId: r.template.id,
      templateLabel: r.template.label,
      usedPitchClasses: pcs,
    };
  };

  const candidates = raws.slice(0, maxCandidates).map(toCandidate);
  const best = candidates[0];

  return { pressedMidi, pressedPitchClasses: pcs, bassMidi, best, candidates };
}
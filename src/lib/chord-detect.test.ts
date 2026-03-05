import { describe, expect, it } from "vitest";
import { detectChords, detectIntervals } from "@/lib/chord-detect";

describe("detectIntervals", () => {
  it("returns empty when fewer than 2 keys are selected", () => {
    expect(detectIntervals(["C4"])) .toEqual([]);
  });

  it("detects simple intervals between two unique notes", () => {
    expect(detectIntervals(["C4", "E4"])).toEqual([
      {
        name: "Major 3rd",
        symbol: "M3",
        semitones: 4,
        notes: ["C", "E"],
      },
    ]);
  });

  it("detects octave when only one unique pitch class is present", () => {
    expect(detectIntervals(["C4", "C5"])).toEqual([
      {
        name: "Octave",
        symbol: "P8",
        semitones: 12,
        notes: ["C", "C"],
      },
    ]);
  });

  it("detects compound intervals from the lowest and highest selected keys", () => {
    expect(detectIntervals(["C4", "G5"])).toEqual([
      {
        name: "Perfect 12th",
        symbol: "P12 (compound of P5)",
        semitones: 19,
        notes: ["C", "G"],
      },
    ]);
  });

  it("collapses repeated pitch classes across multiple octaves to octave", () => {
    expect(detectIntervals(["C4", "C6"])).toEqual([
      {
        name: "Octave",
        symbol: "P8",
        semitones: 12,
        notes: ["C", "C"],
      },
    ]);
  });

  it("labels compound tritones distinctly", () => {
    expect(detectIntervals(["C4", "F#5"])).toEqual([
      {
        name: "Compound Tritone",
        symbol: "TT (compound of TT)",
        semitones: 18,
        notes: ["C", "F#"],
      },
    ]);
  });
});

describe("detectChords", () => {
  it("detects C major in root position", () => {
    const [match] = detectChords(["C4", "E4", "G4"]);

    expect(match).toMatchObject({
      symbol: "C",
      name: "C Major",
      inversionLabel: "Root position",
      slashSymbol: null,
      partialOmission: null,
    });
  });

  it("detects first inversion slash notation from bass note", () => {
    const [match] = detectChords(["E4", "G4", "C5"]);

    expect(match).toMatchObject({
      symbol: "C",
      slashSymbol: "C/E",
      inversionLabel: "1st inversion",
      bass: "E",
    });
  });

  it("detects first inversion dominant seventh with omitted fifth", () => {
    const [match] = detectChords(["F#3", "C4", "D4"]);

    expect(match).toMatchObject({
      symbol: "D7",
      slashSymbol: "D7/F#",
      inversionLabel: "1st inversion",
      bass: "F#",
      partialOmission: "fifth",
    });
  });

  it("detects third inversion dominant seventh with omitted fifth", () => {
    const [match] = detectChords(["C4", "D4", "F#4"]);

    expect(match).toMatchObject({
      symbol: "D7",
      slashSymbol: "D7/C",
      inversionLabel: "3rd inversion",
      bass: "C",
      partialOmission: "fifth",
    });
  });

  it("allows seventh chord matches with omitted sevenths", () => {
    const matches = detectChords(["D4", "F#4", "A4"]);

    expect(matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          symbol: "D7",
          slashSymbol: null,
          inversionLabel: "Root position",
          partialOmission: "seventh",
        }),
      ]),
    );
  });

  it("keeps triads strict when the fifth is omitted", () => {
    expect(detectChords(["C4", "E4", "C5"])).toEqual([]);
  });

  it("detects second inversion slash notation from bass note", () => {
    const [match] = detectChords(["G3", "C4", "E4"]);

    expect(match).toMatchObject({
      symbol: "C",
      slashSymbol: "C/G",
      inversionLabel: "2nd inversion",
      bass: "G",
    });
  });

  it("prefers full seventh voicings over omitted-fifth matches", () => {
    const [match] = detectChords(["D4", "F#4", "A4", "C5"]);

    expect(match).toMatchObject({
      symbol: "D7",
      slashSymbol: null,
      inversionLabel: "Root position",
      partialOmission: null,
    });
  });

  it("supports nine chords voiced without the fifth", () => {
    const matches = detectChords(["C4", "D4", "E4", "B4"]);

    expect(matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          symbol: "Cmaj9",
          slashSymbol: null,
          inversionLabel: "Root position",
          partialOmission: "fifth",
        }),
      ]),
    );
  });

  it("detects Fadd9 with omitted fifth from F, G, A", () => {
    const matches = detectChords(["F4", "G4", "A4"]);

    expect(matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          symbol: "Fadd9",
          notes: ["F", "G", "A", "C"],
          partialOmission: "fifth",
        }),
      ]),
    );
  });

  it("keeps root-bass matches ranked above slash alternatives", () => {
    const [first] = detectChords(["C3", "E4", "G4", "A4"]);

    expect(first).toMatchObject({
      symbol: "C6",
      slashSymbol: null,
      inversionLabel: "Root position",
      partialOmission: null,
    });
  });

  it("ignores duplicate octaves and still detects the same chord", () => {
    const [match] = detectChords(["C3", "C4", "E4", "G4"]);

    expect(match).toMatchObject({
      symbol: "C",
      slashSymbol: null,
      inversionLabel: "Root position",
      partialOmission: null,
    });
  });

  it("ignores invalid key IDs when valid notes still form a chord", () => {
    const [match] = detectChords(["C4", "E4", "G4", "bad"]);

    expect(match).toMatchObject({
      symbol: "C",
      slashSymbol: null,
      inversionLabel: "Root position",
      partialOmission: null,
    });
  });
});

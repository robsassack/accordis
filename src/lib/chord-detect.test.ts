import { describe, expect, it } from "vitest";
import { detectChords, detectIntervals } from "@/lib/chord-detect";

describe("detectIntervals", () => {
  it("returns empty when fewer than 2 keys are selected", () => {
    expect(detectIntervals(["C4"])) .toEqual([]);
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
});

describe("detectChords", () => {
  it("detects C major in root position", () => {
    const [match] = detectChords(["C4", "E4", "G4"]);

    expect(match).toMatchObject({
      symbol: "C",
      name: "C Major",
      inversionLabel: "Root position",
      slashSymbol: null,
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
    });
  });

  it("detects third inversion dominant seventh with omitted fifth", () => {
    const [match] = detectChords(["C4", "D4", "F#4"]);

    expect(match).toMatchObject({
      symbol: "D7",
      slashSymbol: "D7/C",
      inversionLabel: "3rd inversion",
      bass: "C",
    });
  });

  it("keeps triads strict when the fifth is omitted", () => {
    expect(detectChords(["C4", "E4", "C5"])).toEqual([]);
  });

  it("prefers full seventh voicings over omitted-fifth matches", () => {
    const [match] = detectChords(["D4", "F#4", "A4", "C5"]);

    expect(match).toMatchObject({
      symbol: "D7",
      slashSymbol: null,
      inversionLabel: "Root position",
    });
  });
});

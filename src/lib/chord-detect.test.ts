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
});

import { describe, expect, it } from "vitest";
import {
  buildChordLibraryPath,
  buildChordVoicingKeyIds,
  formatChordInversionLabel,
  getChordDefinitionById,
  parseChordLibraryPath,
} from "@/lib/chords";

describe("chord library path helpers", () => {
  it("builds canonical per-chord paths", () => {
    expect(buildChordLibraryPath("C", "major")).toBe("/library/chords/c/major");
    expect(buildChordLibraryPath("D#", "major7")).toBe("/library/chords/d-sharp/major7");
    expect(buildChordLibraryPath("A#", "minor7")).toBe("/library/chords/a-sharp/minor7");
  });

  it("parses canonical sharp root segments", () => {
    expect(parseChordLibraryPath("/library/chords/c/major")).toEqual({
      root: "C",
      chordId: "major",
    });
    expect(parseChordLibraryPath("/library/chords/f-sharp/major7")).toEqual({
      root: "F#",
      chordId: "major7",
    });
  });

  it("parses flat aliases and short flat spellings", () => {
    expect(parseChordLibraryPath("/library/chords/d-flat/major")).toEqual({
      root: "C#",
      chordId: "major",
    });
    expect(parseChordLibraryPath("/library/chords/eb/minor7")).toEqual({
      root: "D#",
      chordId: "minor7",
    });
  });

  it("ignores query strings while parsing", () => {
    expect(parseChordLibraryPath("/library/chords/g/major7?voice=drop2")).toEqual({
      root: "G",
      chordId: "major7",
    });
  });

  it("returns null for invalid library paths", () => {
    expect(parseChordLibraryPath("/library/chords")).toBeNull();
    expect(parseChordLibraryPath("/library/chords/not-a-root/major")).toBeNull();
    expect(parseChordLibraryPath("/library/chords/c/not-a-chord")).toBeNull();
    expect(parseChordLibraryPath("/detect")).toBeNull();
  });
});

describe("chord voicing helpers", () => {
  it("builds voicing key ids for root position and inversions", () => {
    const majorChord = getChordDefinitionById("major");

    expect(buildChordVoicingKeyIds("C", majorChord, 0, 4)).toEqual(["C4", "E4", "G4"]);
    expect(buildChordVoicingKeyIds("C", majorChord, 1, 4)).toEqual(["E4", "G4", "C5"]);
    expect(buildChordVoicingKeyIds("C", majorChord, 2, 4)).toEqual(["G4", "C5", "E5"]);
  });

  it("uses stacked 9ths in root-position extension voicings", () => {
    const majorSixAddNineChord = getChordDefinitionById("major6Add9");

    expect(buildChordVoicingKeyIds("C", majorSixAddNineChord, 0, 4)).toEqual([
      "C4",
      "E4",
      "G4",
      "A4",
      "D5",
    ]);
  });

  it("fits inversion voicings into a provided key range", () => {
    const majorChord = getChordDefinitionById("major");

    expect(
      buildChordVoicingKeyIds("C", majorChord, 1, 5, {
        minMidiLike: 48, // C4
        maxMidiLike: 71, // B5
      }),
    ).toEqual(["E4", "G4", "C5"]);
  });

  it("fits low voicings upward into the visible key range", () => {
    const majorChord = getChordDefinitionById("major");

    expect(
      buildChordVoicingKeyIds("C", majorChord, 0, 3, {
        minMidiLike: 48, // C4
        maxMidiLike: 71, // B5
      }),
    ).toEqual(["C4", "E4", "G4"]);
  });

  it("leaves voicings unchanged when they cannot fit in the provided range span", () => {
    const majorChord = getChordDefinitionById("major");

    expect(
      buildChordVoicingKeyIds("C", majorChord, 0, 4, {
        minMidiLike: 60, // C5
        maxMidiLike: 62, // D5
      }),
    ).toEqual(["C4", "E4", "G4"]);
  });

  it("formats inversion labels", () => {
    const dominantNineChord = getChordDefinitionById("dominant9");

    expect(formatChordInversionLabel(0, dominantNineChord)).toBe("Root position");
    expect(formatChordInversionLabel(1, dominantNineChord)).toBe("1st inversion");
    expect(formatChordInversionLabel(4, dominantNineChord)).toBe("4th inversion");
    expect(formatChordInversionLabel(5, dominantNineChord)).toBe("Root position");
  });
});

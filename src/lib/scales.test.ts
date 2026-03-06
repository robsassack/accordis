import { describe, expect, it } from "vitest";
import {
  buildScaleLibraryPath,
  parseScaleLibraryPath,
} from "@/lib/scales";

describe("scale library path helpers", () => {
  it("builds canonical per-scale paths", () => {
    expect(buildScaleLibraryPath("C", "major")).toBe("/library/scales/c/major");
    expect(buildScaleLibraryPath("D#", "mixolydian")).toBe("/library/scales/d-sharp/mixolydian");
    expect(buildScaleLibraryPath("A#", "naturalMinor")).toBe("/library/scales/a-sharp/naturalMinor");
  });

  it("parses canonical sharp root segments", () => {
    expect(parseScaleLibraryPath("/library/scales/c/major")).toEqual({
      root: "C",
      scaleId: "major",
    });
    expect(parseScaleLibraryPath("/library/scales/f-sharp/dorian")).toEqual({
      root: "F#",
      scaleId: "dorian",
    });
  });

  it("parses flat aliases and short flat spellings", () => {
    expect(parseScaleLibraryPath("/library/scales/d-flat/major")).toEqual({
      root: "C#",
      scaleId: "major",
    });
    expect(parseScaleLibraryPath("/library/scales/eb/melodicMinor")).toEqual({
      root: "D#",
      scaleId: "melodicMinor",
    });
  });

  it("ignores query strings while parsing", () => {
    expect(parseScaleLibraryPath("/library/scales/g/mixolydian?tempo=120")).toEqual({
      root: "G",
      scaleId: "mixolydian",
    });
  });

  it("returns null for invalid library paths", () => {
    expect(parseScaleLibraryPath("/library/scales")).toBeNull();
    expect(parseScaleLibraryPath("/library/scales/not-a-root/major")).toBeNull();
    expect(parseScaleLibraryPath("/library/scales/c/not-a-scale")).toBeNull();
    expect(parseScaleLibraryPath("/detect")).toBeNull();
  });
});

"use client";

import { useEffect, useRef } from "react";
import type { ChordMatch } from "@/lib/chord-types";
import type { NotationPreference, PitchClass } from "@/lib/piano";
import { pitchClassToIndex } from "@/lib/piano";

type NoteVexInfo = {
  key: string;
  accidental: string | null;
};

const SHARP_NOTE_LETTERS: Record<PitchClass, { letter: string; accidental: string | null }> = {
  C: { letter: "c", accidental: null },
  "C#": { letter: "c#", accidental: "#" },
  D: { letter: "d", accidental: null },
  "D#": { letter: "d#", accidental: "#" },
  E: { letter: "e", accidental: null },
  F: { letter: "f", accidental: null },
  "F#": { letter: "f#", accidental: "#" },
  G: { letter: "g", accidental: null },
  "G#": { letter: "g#", accidental: "#" },
  A: { letter: "a", accidental: null },
  "A#": { letter: "a#", accidental: "#" },
  B: { letter: "b", accidental: null },
};

const FLAT_NOTE_LETTERS: Record<PitchClass, { letter: string; accidental: string | null }> = {
  C: { letter: "c", accidental: null },
  "C#": { letter: "db", accidental: "b" },
  D: { letter: "d", accidental: null },
  "D#": { letter: "eb", accidental: "b" },
  E: { letter: "e", accidental: null },
  F: { letter: "f", accidental: null },
  "F#": { letter: "gb", accidental: "b" },
  G: { letter: "g", accidental: null },
  "G#": { letter: "ab", accidental: "b" },
  A: { letter: "a", accidental: null },
  "A#": { letter: "bb", accidental: "b" },
  B: { letter: "b", accidental: null },
};

// Assign octaves to make notes ascending, starting from octave 4.
// When a note's chromatic index is lower than the previous note's, we wrap
// into the next octave so the chord reads bottom-to-top on the staff.
function buildNoteInfos(
  notes: PitchClass[],
  notationPreference: NotationPreference,
  baseOctave: number,
): NoteVexInfo[] {
  const infoMap = notationPreference === "flats" ? FLAT_NOTE_LETTERS : SHARP_NOTE_LETTERS;
  let octave = baseOctave;
  const result: NoteVexInfo[] = [];

  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];
    if (i > 0) {
      const prevIdx = pitchClassToIndex(notes[i - 1]);
      const currIdx = pitchClassToIndex(note);
      if (currIdx < prevIdx) {
        octave++;
      }
    }
    const { letter, accidental } = infoMap[note];
    result.push({ key: `${letter}/${octave}`, accidental });
  }

  return result;
}

export function ChordNotation({
  match,
  notationPreference,
  displayMode,
}: {
  match: ChordMatch;
  notationPreference: NotationPreference;
  displayMode: "upper" | "treble" | "bass" | "lower";
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousDisplayModeRef = useRef(displayMode);
  const renderWidth = 200;
  const renderHeight = 200;
  const staveY = 40;
  const staveWidthInset = 5;
  const formatterWidthInset = 70;
  const cropPadX = 6;
  const cropPadBottom = 24;
  const targetHeight = 90;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || match.notes.length === 0) return;

    const modeOrder: Array<typeof displayMode> = ["upper", "treble", "bass", "lower"];
    const previousDisplayMode = previousDisplayModeRef.current;
    const previousIndex = modeOrder.indexOf(previousDisplayMode);
    const currentIndex = modeOrder.indexOf(displayMode);
    const slideDirection = currentIndex >= previousIndex ? 1 : -1;
    previousDisplayModeRef.current = displayMode;

    let cancelled = false;

    (async () => {
      const { Renderer, Stave, StaveNote, Voice, Formatter, Accidental } = await import("vexflow");
      if (cancelled) return;

      container.innerHTML = "";

      const renderer = new Renderer(container, Renderer.Backends.SVG);
      renderer.resize(renderWidth, renderHeight);
      const context = renderer.getContext();

      const clefAndShiftByMode = {
        upper: { clef: "treble" as const, shift: 1 },
        treble: { clef: "treble" as const, shift: 0 },
        bass: { clef: "bass" as const, shift: 0 },
        lower: { clef: "bass" as const, shift: -1 },
      };
      const mode = clefAndShiftByMode[displayMode];
      const resolvedClef = mode.clef;
      const octaveShift = mode.shift;
      // Keep bass-clef chord shapes closer to the staff center for readability,
      // then apply optional user octave shift.
      const baseOctave = (resolvedClef === "bass" ? 3 : 4) + octaveShift;

      const stave = new Stave(0, staveY, renderWidth - staveWidthInset);
      stave.addClef(resolvedClef);
      stave.setContext(context).draw();

      const noteInfos = buildNoteInfos(match.notes, notationPreference, baseOctave);
      const highestRenderedOctave = noteInfos.reduce((maxOctave, info) => {
        const octavePart = Number(info.key.split("/")[1]);
        if (Number.isNaN(octavePart)) {
          return maxOctave;
        }
        return Math.max(maxOctave, octavePart);
      }, 0);
      const staveNote = new StaveNote({
        clef: resolvedClef,
        keys: noteInfos.map((n) => n.key),
        duration: "w",
      });

      noteInfos.forEach((info, idx) => {
        if (info.accidental !== null) {
          staveNote.addModifier(new Accidental(info.accidental), idx);
        }
      });

      const voice = new Voice({ numBeats: 4, beatValue: 4 });
      voice.setStrict(false);
      voice.addTickables([staveNote]);

      new Formatter().joinVoices([voice]).format([voice], renderWidth - formatterWidthInset);
      voice.draw(context, stave);

      // Crop and scale the SVG down to a compact fixed height.
      // getBBox() must be called on the inner <g> (VexFlow's content wrapper)
      // rather than the <svg> element, which returns the full viewport bounds.
      const svgEl = container.querySelector("svg");
      const contentGroup = container.querySelector("svg > g") as SVGGElement | null;
      if (svgEl && contentGroup && typeof contentGroup.getBBox === "function") {
        const bbox = contentGroup.getBBox();
        // Add generous top room for high ledger lines, especially in upper/8va mode.
        const baseCropPadTop = displayMode === "upper" ? 48 : 26;
        const octaveOverflowPad = Math.max(0, highestRenderedOctave - 5) * 18;
        const cropPadTop = baseCropPadTop + octaveOverflowPad;
        const vbW = bbox.width + cropPadX * 2;
        const vbH = bbox.height + cropPadTop + cropPadBottom;
        svgEl.setAttribute("viewBox", `${bbox.x - cropPadX} ${bbox.y - cropPadTop} ${vbW} ${vbH}`);
        svgEl.setAttribute("preserveAspectRatio", "xMidYMid meet");
        svgEl.setAttribute("height", String(targetHeight));
        svgEl.setAttribute("width", String((vbW / vbH) * targetHeight));
        svgEl.style.display = "block";
        svgEl.style.overflow = "visible";
        svgEl.style.maxWidth = "100%";
        svgEl.style.height = "auto";
        svgEl.style.transformOrigin = "center center";

        const prefersReducedMotion =
          typeof window !== "undefined" &&
          typeof window.matchMedia === "function" &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (!prefersReducedMotion && typeof svgEl.animate === "function") {
          svgEl.animate(
            [
              { transform: `translateX(${slideDirection * 12}px)` },
              { transform: "translateX(0px)" },
            ],
            { duration: 180, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "both" },
          );
        }
      }
    })().catch(console.error);

    return () => {
      cancelled = true;
    };
  }, [
    match.notes,
    notationPreference,
    displayMode,
    renderWidth,
    renderHeight,
    staveY,
    staveWidthInset,
    formatterWidthInset,
    cropPadX,
    cropPadBottom,
    targetHeight,
  ]);

  // VexFlow renders in black by default; dark:invert flips to white in dark mode.
  return <div ref={containerRef} className="w-full max-w-52 overflow-visible dark:invert" />;
}

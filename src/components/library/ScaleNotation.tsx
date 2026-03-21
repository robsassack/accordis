"use client";

import { useEffect, useLayoutEffect, useState, useRef } from "react";
import { Accidental, Formatter, Renderer, Stave, StaveNote, Voice } from "vexflow";
import { pitchClassToIndex, type NotationPreference, type PitchClass } from "@/lib/piano";

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

function buildScaleNoteInfos(notes: PitchClass[], notationPreference: NotationPreference): NoteVexInfo[] {
  const infoMap = notationPreference === "flats" ? FLAT_NOTE_LETTERS : SHARP_NOTE_LETTERS;
  let octave = 4;

  return notes.map((note, index) => {
    if (index > 0) {
      const prevNote = notes[index - 1];
      if (pitchClassToIndex(note) <= pitchClassToIndex(prevNote)) {
        octave += 1;
      }
    }

    const { letter, accidental } = infoMap[note];
    return { key: `${letter}/${octave}`, accidental };
  });
}

function parseKeyToMidi(key: string): number | null {
  const match = key.match(/^([a-g])(b|#)?\/(-?\d+)$/i);
  if (!match) {
    return null;
  }

  const [, rawLetter, accidental, rawOctave] = match;
  const letterOffsets: Record<string, number> = {
    c: 0,
    d: 2,
    e: 4,
    f: 5,
    g: 7,
    a: 9,
    b: 11,
  };
  const letterOffset = letterOffsets[rawLetter.toLowerCase()];
  const octave = Number(rawOctave);
  if (letterOffset === undefined || Number.isNaN(octave)) {
    return null;
  }

  const accidentalOffset = accidental === "#" ? 1 : accidental === "b" ? -1 : 0;
  return (octave + 1) * 12 + letterOffset + accidentalOffset;
}

function parseNoteNameToMidi(noteName: string | null | undefined): number | null {
  if (!noteName) {
    return null;
  }

  const match = noteName.match(/^([A-G])(#?)(-?\d+)$/);
  if (!match) {
    return null;
  }

  const [, rawLetter, sharp, rawOctave] = match;
  const letterOffsets: Record<string, number> = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
  };
  const letterOffset = letterOffsets[rawLetter];
  const octave = Number(rawOctave);
  if (letterOffset === undefined || Number.isNaN(octave)) {
    return null;
  }

  const accidentalOffset = sharp === "#" ? 1 : 0;
  return (octave + 1) * 12 + letterOffset + accidentalOffset;
}

export function ScaleNotation({
  notes,
  notationPreference,
  activePlaybackNoteName,
}: {
  notes: PitchClass[];
  notationPreference: NotationPreference;
  activePlaybackNoteName?: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const notesKey = notes.join("|");
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const rootElement = document.documentElement;
    const syncDarkMode = () => {
      setIsDarkMode(rootElement.classList.contains("dark"));
    };

    syncDarkMode();
    const observer = new MutationObserver(syncDarkMode);
    observer.observe(rootElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || notes.length === 0) {
      return;
    }

    const containerWidth = container.clientWidth || 0;
    const useTwoLines = containerWidth > 0 && containerWidth < 430;
    const renderWidth = 640;
    const renderHeight = useTwoLines ? 220 : 140;
    const targetHeight = useTwoLines ? 132 : 84;
    const stagingContainer = document.createElement("div");
    stagingContainer.style.position = "absolute";
    stagingContainer.style.inset = "0";
    stagingContainer.style.visibility = "hidden";
    stagingContainer.style.pointerEvents = "none";
    container.appendChild(stagingContainer);

    const renderer = new Renderer(stagingContainer, Renderer.Backends.SVG);
    renderer.resize(renderWidth, renderHeight);
    const context = renderer.getContext();

    const noteInfos = buildScaleNoteInfos(notes, notationPreference);
    const activeMidi = parseNoteNameToMidi(activePlaybackNoteName);
    const buildStaveNotes = (infos: NoteVexInfo[]) => infos.map((info) => {
      const note = new StaveNote({
        clef: "treble",
        keys: [info.key],
        duration: "8",
      });

      const isActive = activeMidi !== null && parseKeyToMidi(info.key) === activeMidi;
      if (isActive) {
        const activeColor = isDarkMode ? "#fd7b38" : "#0284c7";
        note.setStyle({
          fillStyle: activeColor,
          strokeStyle: activeColor,
        });
      }

      if (info.accidental !== null) {
        note.addModifier(new Accidental(info.accidental), 0);
      }

      return note;
    });

    const drawLine = (
      infos: NoteVexInfo[],
      y: number,
      showClef: boolean,
    ) => {
      const stave = new Stave(0, y, renderWidth - 8);
      if (showClef) {
        stave.addClef("treble");
      }
      stave.setContext(context).draw();

      const staveNotes = buildStaveNotes(infos);
      const voice = new Voice({ numBeats: 4, beatValue: 4 });
      voice.setStrict(false);
      voice.addTickables(staveNotes);
      new Formatter().joinVoices([voice]).format([voice], renderWidth - (showClef ? 110 : 45));
      voice.draw(context, stave);
    };

    if (useTwoLines && noteInfos.length > 1) {
      const splitIndex = Math.ceil(noteInfos.length / 2);
      drawLine(noteInfos.slice(0, splitIndex), 26, true);
      drawLine(noteInfos.slice(splitIndex), 108, false);
    } else {
      drawLine(noteInfos, 26, true);
    }

    const svgEl = stagingContainer.querySelector("svg");
    const contentGroup = stagingContainer.querySelector("svg > g") as SVGGElement | null;
    if (svgEl && contentGroup && typeof contentGroup.getBBox === "function") {
      const bbox = contentGroup.getBBox();
      const padX = 8;
      const padTop = 16;
      const padBottom = 18;
      svgEl.setAttribute(
        "viewBox",
        `${bbox.x - padX} ${bbox.y - padTop} ${bbox.width + padX * 2} ${bbox.height + padTop + padBottom}`,
      );
      svgEl.setAttribute("preserveAspectRatio", "xMinYMid meet");
      svgEl.setAttribute("width", "100%");
      svgEl.setAttribute("height", String(targetHeight));
      svgEl.style.display = "block";
      svgEl.style.maxWidth = "100%";
      svgEl.style.height = `${targetHeight}px`;
    }

    const nextSvg = stagingContainer.querySelector("svg");
    if (nextSvg) {
      container.replaceChildren(nextSvg);
    } else {
      stagingContainer.remove();
    }

    return () => {
      stagingContainer.remove();
    };
  }, [notesKey, notationPreference, notes, activePlaybackNoteName, isDarkMode]);

  return (
    <div
      ref={containerRef}
      className="w-full overflow-visible dark:invert"
      aria-label="Scale notation"
      role="img"
    />
  );
}

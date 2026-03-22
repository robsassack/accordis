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
  const [containerWidth, setContainerWidth] = useState(0);

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

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const syncWidth = () => {
      setContainerWidth(Math.floor(container.clientWidth));
    };
    syncWidth();

    if (typeof ResizeObserver === "function") {
      const ro = new ResizeObserver((entries) => {
        setContainerWidth(Math.floor(entries[0]?.contentRect.width ?? 0));
      });
      ro.observe(container);
      return () => ro.disconnect();
    }

    window.addEventListener("resize", syncWidth);
    return () => {
      window.removeEventListener("resize", syncWidth);
    };
  }, []);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || notes.length === 0) {
      return;
    }

    const viewportWidth = typeof window === "undefined" ? 640 : window.innerWidth;
    const fallbackWidth = Math.max(Math.min(viewportWidth - 32, 640), 220);
    const effectiveWidth = containerWidth || container.clientWidth || fallbackWidth;
    const useTwoLines = effectiveWidth < 480;
    const renderWidth = Math.max(Math.floor(effectiveWidth) - 8, 180);
    const renderHeight = useTwoLines ? 290 : 190;
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
      noteStartXOverride?: number,
    ): number => {
      const staveWidth = Math.max(renderWidth - 8, 120);
      const formatterWidth = Math.max(staveWidth - 102, 48);
      const stave = new Stave(0, y, staveWidth);
      if (showClef) {
        stave.addClef("treble");
      }
      if (noteStartXOverride !== undefined) {
        stave.setNoteStartX(noteStartXOverride);
      }
      stave.setContext(context).draw();

      const staveNotes = buildStaveNotes(infos);
      const voice = new Voice({ numBeats: 4, beatValue: 4 });
      voice.setStrict(false);
      voice.addTickables(staveNotes);
      new Formatter().joinVoices([voice]).format([voice], formatterWidth);
      voice.draw(context, stave);

      return stave.getNoteStartX();
    };

    if (useTwoLines && noteInfos.length > 1) {
      const splitIndex = Math.ceil(noteInfos.length / 2);
      const noteStartX = drawLine(noteInfos.slice(0, splitIndex), 55, true);
      drawLine(noteInfos.slice(splitIndex), 165, false, noteStartX);
    } else {
      drawLine(noteInfos, 48, true);
    }

    const svgEl = stagingContainer.querySelector("svg");
    const contentGroups = Array.from(stagingContainer.querySelectorAll("svg > g")) as SVGGElement[];
    if (svgEl && contentGroups.length > 0) {
      const groupBounds = contentGroups
        .map((group) => (typeof group.getBBox === "function" ? group.getBBox() : null))
        .filter((bbox): bbox is DOMRect => (
          bbox !== null
            && Number.isFinite(bbox.x)
            && Number.isFinite(bbox.y)
            && Number.isFinite(bbox.width)
            && Number.isFinite(bbox.height)
        ));
      if (groupBounds.length === 0) {
        const nextSvg = stagingContainer.querySelector("svg");
        if (nextSvg) {
          container.replaceChildren(nextSvg);
        } else {
          stagingContainer.remove();
        }

        return () => {
          stagingContainer.remove();
        };
      }

      const minX = Math.min(...groupBounds.map((bbox) => bbox.x));
      const minY = Math.min(...groupBounds.map((bbox) => bbox.y));
      const maxX = Math.max(...groupBounds.map((bbox) => bbox.x + bbox.width));
      const maxY = Math.max(...groupBounds.map((bbox) => bbox.y + bbox.height));
      const bbox = {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      };
      const requestedTopTrim = 65;
      const lowerLineInfos = useTwoLines
        ? noteInfos.slice(Math.ceil(noteInfos.length / 2))
        : noteInfos;
      const lowerLineHasAccidentals = lowerLineInfos.some((info) => info.accidental !== null);
      const lowerLineLowestMidi = lowerLineInfos.reduce((lowest, info) => {
        const midi = parseKeyToMidi(info.key);
        if (midi === null) {
          return lowest;
        }
        return Math.min(lowest, midi);
      }, Number.POSITIVE_INFINITY);
      const lowerLineIsHighRegister = Number.isFinite(lowerLineLowestMidi) && lowerLineLowestMidi >= 67;
      const requestedBottomTrim = useTwoLines
        ? Math.max(
            16,
            (lowerLineHasAccidentals ? 30 : 40) + (lowerLineIsHighRegister ? -8 : 0),
          )
        : 50;
      const maxTotalTrim = Math.max(0, bbox.height - 24);
      let appliedTopTrim = Math.min(requestedTopTrim, maxTotalTrim);
      let appliedBottomTrim = Math.min(requestedBottomTrim, Math.max(0, maxTotalTrim - appliedTopTrim));
      if (useTwoLines) {
        // Keep mobile crops visually balanced, but stay top-biased so lower stems don't clip.
        const requestedTotalTrim = Math.min(maxTotalTrim, requestedTopTrim + requestedBottomTrim);
        const topBias = 0.62;
        appliedTopTrim = Math.min(requestedTotalTrim * topBias, maxTotalTrim);
        appliedBottomTrim = Math.min(
          requestedBottomTrim,
          requestedTotalTrim - appliedTopTrim,
          Math.max(0, maxTotalTrim - appliedTopTrim),
        );
      }
      const croppedY = bbox.y + appliedTopTrim;
      const croppedH = Math.max(24, bbox.height - appliedTopTrim - appliedBottomTrim);
      const padX = useTwoLines ? 10 : 14;
      const padTop = useTwoLines ? 2 : 4;
      const padBottom = useTwoLines ? 2 : 4;
      const vbW = bbox.width + padX * 2;
      const vbH = croppedH + padTop + padBottom;
      const baseVbX = bbox.x - padX;
      const baseVbY = croppedY - padTop;
      // VexFlow can leave a bit of horizontal slack in mobile/two-line mode.
      // Apply a small centered width boost only, and keep full vertical bounds to avoid clipping.
      const desiredMobileWidthBoost = useTwoLines ? 1.04 : 1;
      const minHorizontalInset = 1;
      const minViewBoxWidth = bbox.width + minHorizontalInset * 2;
      const maxSafeWidthBoost = minViewBoxWidth > 0 ? vbW / minViewBoxWidth : 1;
      const mobileWidthBoost = Math.max(1, Math.min(desiredMobileWidthBoost, maxSafeWidthBoost));
      const finalVbW = vbW / mobileWidthBoost;
      const finalVbH = vbH;
      const finalVbX = baseVbX + (vbW - finalVbW) / 2;
      const finalVbY = baseVbY;
      svgEl.setAttribute(
        "viewBox",
        `${finalVbX} ${finalVbY} ${finalVbW} ${finalVbH}`,
      );
      svgEl.setAttribute("preserveAspectRatio", "xMidYMid meet");
      svgEl.style.display = "block";
      svgEl.style.overflow = "hidden";

      const containerW = effectiveWidth > 0 ? effectiveWidth : fallbackWidth;
      // How tall would the content be if we fill the container width?
      const naturalHeight = Math.ceil(finalVbH * containerW / finalVbW);

      // Width-constrained: fill the container width and derive the exact needed height
      // from the cropped notation bounds so the content stays large with minimal whitespace.
      svgEl.setAttribute("width", "100%");
      svgEl.setAttribute("height", String(naturalHeight));
      svgEl.style.width = "100%";
      svgEl.style.height = `${naturalHeight}px`;
      svgEl.style.maxWidth = "100%";
      svgEl.style.margin = "";
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
  }, [notesKey, notationPreference, notes, activePlaybackNoteName, isDarkMode, containerWidth]);

  return (
    <div
      ref={containerRef}
      className="min-w-0 w-full overflow-visible dark:invert"
      aria-label="Scale notation"
      role="img"
    />
  );
}

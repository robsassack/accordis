"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useChordAudio } from "@/components/audio/ChordAudioProvider";
import { PianoKeyboard } from "@/components/piano/PianoKeyboard";
import { ChordNotation } from "@/components/results/ChordNotation";
import type { ChordMatch } from "@/lib/chord-types";
import {
  buildPianoKeys,
  formatMusicText,
  parseKeyId,
  pitchClassToIndex,
  type NotationPreference,
  type PitchClass,
} from "@/lib/piano";
import {
  CHORD_DEFINITIONS,
  CHORD_ROOT_PITCH_CLASSES,
  buildChordLibraryPath,
  buildChordPitchClasses,
  buildChordVoicingKeyIds,
  buildChordSearchText,
  formatChordInversionLabel,
  getChordDefinitionById,
  parseChordLibraryPath,
  type ChordDefinition,
  type ChordId,
} from "@/lib/chords";

const PLAYBACK_PIANO_KEYS = buildPianoKeys(4, 5);
const DEFAULT_CHORD_ID: ChordId = "major";
const DEFAULT_ROOT: PitchClass = "C";
const CHORD_LIBRARY_SESSION_STORAGE_KEY = "accordis-chord-library-session";
const DEFAULT_ROOT_NOTATION_PREFERENCE: NotationPreference = "sharps";
const DEFAULT_PLAYBACK_OCTAVE = 4;
const DEFAULT_INVERSION_INDEX = 0;
const MIN_PLAYBACK_OCTAVE = 4;
const MAX_PLAYBACK_OCTAVE = 5;
const NOTATION_OCTAVE_SHIFT_BY_CLEF: Record<"treble" | "bass", number> = {
  treble: 0,
  bass: -2,
};
const CHORD_LIBRARY_GROUPS: ReadonlyArray<{
  title: string;
  chordIds: readonly ChordId[];
}> = [
  { title: "Triads", chordIds: ["major", "minor", "diminished", "augmented", "suspended2", "suspended4"] },
  {
    title: "Seventh Family",
    chordIds: [
      "suspendedDominant7",
      "major6",
      "minor6",
      "dominant7",
      "dominant7Flat5",
      "dominant7Sharp5",
      "major7",
      "minorMajor7",
      "minor7",
      "halfDiminished7",
      "diminished7",
    ],
  },
  { title: "Ninth & Extended", chordIds: ["majorAdd9", "minorAdd9", "dominant9", "major9", "minor9", "major6Add9"] },
] as const;

type ChordLibrarySession = {
  selectedRoot: PitchClass;
  selectedChordId: ChordId;
  rootNotationPreference: NotationPreference;
  playbackOctave: number;
  inversionIndex: number;
};

type ChordLibrarySessionState = ChordLibrarySession & {
  hasRestored: boolean;
};

type ChordLibrarySessionAction =
  | { type: "restore"; session: ChordLibrarySession }
  | { type: "setSelectedRoot"; selectedRoot: PitchClass }
  | { type: "setSelectedChordId"; selectedChordId: ChordId }
  | { type: "toggleRootNotationPreference" }
  | { type: "setPlaybackOctave"; playbackOctave: number }
  | { type: "setInversionIndex"; inversionIndex: number };

let chordLibrarySessionCache: ChordLibrarySession | null = null;
let chordLibraryListScrollTopCache = 0;
let chordLibraryNotationClefCache: "treble" | "bass" = "treble";

export function resetChordLibrarySessionCacheForTests(): void {
  chordLibrarySessionCache = null;
  chordLibraryListScrollTopCache = 0;
  chordLibraryNotationClefCache = "treble";
}

function getDefaultChordLibrarySession(): ChordLibrarySession {
  return {
    selectedRoot: DEFAULT_ROOT,
    selectedChordId: DEFAULT_CHORD_ID,
    rootNotationPreference: DEFAULT_ROOT_NOTATION_PREFERENCE,
    playbackOctave: DEFAULT_PLAYBACK_OCTAVE,
    inversionIndex: DEFAULT_INVERSION_INDEX,
  };
}

function clampPlaybackOctave(value: number): number {
  return Math.min(MAX_PLAYBACK_OCTAVE, Math.max(MIN_PLAYBACK_OCTAVE, value));
}

function getInitialChordLibrarySession(): ChordLibrarySession {
  const defaultSession = getDefaultChordLibrarySession();

  if (typeof window === "undefined") {
    return defaultSession;
  }

  const storedSessionJson = window.localStorage.getItem(CHORD_LIBRARY_SESSION_STORAGE_KEY);
  if (!storedSessionJson) {
    return defaultSession;
  }

  try {
    const parsedSession = JSON.parse(storedSessionJson) as {
      selectedRoot?: string;
      selectedChordId?: string;
      rootNotationPreference?: string;
      playbackOctave?: number;
      inversionIndex?: number;
    };

    return {
      selectedRoot:
        (CHORD_ROOT_PITCH_CLASSES as readonly string[]).includes(parsedSession.selectedRoot ?? "")
          ? (parsedSession.selectedRoot as PitchClass)
          : defaultSession.selectedRoot,
      selectedChordId: CHORD_DEFINITIONS.some((definition) => definition.id === parsedSession.selectedChordId)
        ? (parsedSession.selectedChordId as ChordId)
        : defaultSession.selectedChordId,
      rootNotationPreference:
        parsedSession.rootNotationPreference === "sharps" || parsedSession.rootNotationPreference === "flats"
          ? parsedSession.rootNotationPreference
          : defaultSession.rootNotationPreference,
      playbackOctave:
        typeof parsedSession.playbackOctave === "number" &&
        Number.isFinite(parsedSession.playbackOctave)
          ? clampPlaybackOctave(Math.round(parsedSession.playbackOctave))
          : defaultSession.playbackOctave,
      inversionIndex:
        typeof parsedSession.inversionIndex === "number" &&
        Number.isFinite(parsedSession.inversionIndex) &&
        parsedSession.inversionIndex >= 0
          ? Math.floor(parsedSession.inversionIndex)
          : defaultSession.inversionIndex,
    };
  } catch {
    return defaultSession;
  }
}

function centerElementWithinScrollContainer(
  scrollContainer: HTMLElement,
  element: HTMLElement,
): void {
  const scrollContainerRect = scrollContainer.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();
  const maxScrollTop = Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight);
  const targetScrollTop =
    scrollContainer.scrollTop +
    (elementRect.top - scrollContainerRect.top) -
    (scrollContainer.clientHeight / 2 - element.clientHeight / 2);

  scrollContainer.scrollTop = Math.max(0, Math.min(targetScrollTop, maxScrollTop));
}

function normalizeSearchText(value: string): string {
  return value.toLowerCase().replaceAll("♯", "#").replaceAll("♭", "b").trim();
}

function areKeyIdListsEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((keyId, index) => keyId === right[index]);
}

function buildClefAdjustedVoicingKeyIds(
  voicingKeyIds: string[],
  clef: "treble" | "bass",
): string[] {
  const parsedVoicing = voicingKeyIds
    .map((keyId) => parseKeyId(keyId))
    .filter((parsed): parsed is NonNullable<ReturnType<typeof parseKeyId>> => parsed !== null);

  if (parsedVoicing.length === 0) {
    return voicingKeyIds;
  }

  const octaveShift = NOTATION_OCTAVE_SHIFT_BY_CLEF[clef];

  if (octaveShift === 0) {
    return parsedVoicing.map((parsed) => `${parsed.note}${parsed.octave}`);
  }

  return parsedVoicing.map((parsed) => `${parsed.note}${parsed.octave + octaveShift}`);
}

function chordLibrarySessionReducer(
  currentSession: ChordLibrarySessionState,
  action: ChordLibrarySessionAction,
): ChordLibrarySessionState {
  switch (action.type) {
    case "restore":
      return { ...action.session, hasRestored: true };
    case "setSelectedRoot":
      return { ...currentSession, selectedRoot: action.selectedRoot };
    case "setSelectedChordId":
      return { ...currentSession, selectedChordId: action.selectedChordId };
    case "toggleRootNotationPreference":
      return {
        ...currentSession,
        rootNotationPreference: currentSession.rootNotationPreference === "sharps" ? "flats" : "sharps",
      };
    case "setPlaybackOctave":
      return { ...currentSession, playbackOctave: action.playbackOctave };
    case "setInversionIndex":
      return { ...currentSession, inversionIndex: action.inversionIndex };
    default:
      return currentSession;
  }
}

export function ChordLibraryWorkspace() {
  const { isChordPlaying, playSelectedKeys } = useChordAudio();
  const pathname = usePathname();
  const router = useRouter();
  const chordSelectionFromPath = useMemo(() => parseChordLibraryPath(pathname), [pathname]);
  const initialChordSelectionFromPathRef = useRef(chordSelectionFromPath);
  const hasCachedSession = chordLibrarySessionCache !== null;
  const baseInitialSession = chordLibrarySessionCache ?? getDefaultChordLibrarySession();
  const initialSession = chordSelectionFromPath
    ? {
        ...baseInitialSession,
        selectedRoot: chordSelectionFromPath.root,
        selectedChordId: chordSelectionFromPath.chordId,
      }
    : baseInitialSession;
  const [searchQuery, setSearchQuery] = useState("");
  const [notationClef, setNotationClef] = useState<"treble" | "bass">(chordLibraryNotationClefCache);
  const [interactionSelectionOverride, setInteractionSelectionOverride] = useState<{
    root: PitchClass;
    chordId: ChordId;
  } | null>(null);
  const [session, dispatchSession] = useReducer(chordLibrarySessionReducer, {
    ...initialSession,
    hasRestored: hasCachedSession,
  });
  const { selectedRoot, selectedChordId, rootNotationPreference, playbackOctave, inversionIndex, hasRestored } =
    session;
  const chordListRef = useRef<HTMLDivElement>(null);
  const selectedChordOptionRef = useRef<HTMLButtonElement | null>(null);
  const hasPendingInteractionSelectionOverride =
    interactionSelectionOverride !== null &&
    pathname.startsWith("/library/chords") &&
    (!chordSelectionFromPath ||
      chordSelectionFromPath.root !== interactionSelectionOverride.root ||
      chordSelectionFromPath.chordId !== interactionSelectionOverride.chordId);
  const activeSelectedRoot =
    hasPendingInteractionSelectionOverride && interactionSelectionOverride
      ? interactionSelectionOverride.root
      : chordSelectionFromPath?.root ?? selectedRoot;
  const activeSelectedChordId =
    hasPendingInteractionSelectionOverride && interactionSelectionOverride
      ? interactionSelectionOverride.chordId
      : chordSelectionFromPath?.chordId ?? selectedChordId;
  const selectedChordDefinition = getChordDefinitionById(activeSelectedChordId);
  const inversionCount = selectedChordDefinition.intervals.length;
  const activeInversionIndex = ((inversionIndex % inversionCount) + inversionCount) % inversionCount;
  const activePlaybackOctave = clampPlaybackOctave(playbackOctave);
  const inversionLabel = formatChordInversionLabel(activeInversionIndex, selectedChordDefinition);
  const visibleKeyboardRange = useMemo(() => {
    const midiLikeValues = PLAYBACK_PIANO_KEYS.map((key) => key.octave * 12 + pitchClassToIndex(key.note));
    return {
      minMidiLike: Math.min(...midiLikeValues),
      maxMidiLike: Math.max(...midiLikeValues),
    };
  }, []);
  const selectedRootText = formatMusicText(activeSelectedRoot, rootNotationPreference);
  const selectedChordLabel = `${selectedRootText} ${selectedChordDefinition.name}`;
  const selectedChordSymbol = `${selectedRootText}${formatMusicText(selectedChordDefinition.suffix)}`;
  const selectedChordPitchClasses = buildChordPitchClasses(activeSelectedRoot, selectedChordDefinition);
  const selectedChordVoicingKeyIds = buildChordVoicingKeyIds(
    activeSelectedRoot,
    selectedChordDefinition,
    activeInversionIndex,
    activePlaybackOctave,
    visibleKeyboardRange,
  );
  const shiftedDownPlaybackOctave = clampPlaybackOctave(activePlaybackOctave - 1);
  const shiftedUpPlaybackOctave = clampPlaybackOctave(activePlaybackOctave + 1);
  const shiftedDownVoicingKeyIds = buildChordVoicingKeyIds(
    activeSelectedRoot,
    selectedChordDefinition,
    activeInversionIndex,
    shiftedDownPlaybackOctave,
    visibleKeyboardRange,
  );
  const shiftedUpVoicingKeyIds = buildChordVoicingKeyIds(
    activeSelectedRoot,
    selectedChordDefinition,
    activeInversionIndex,
    shiftedUpPlaybackOctave,
    visibleKeyboardRange,
  );
  const canShiftDown =
    shiftedDownPlaybackOctave !== activePlaybackOctave &&
    !areKeyIdListsEqual(shiftedDownVoicingKeyIds, selectedChordVoicingKeyIds);
  const canShiftUp =
    shiftedUpPlaybackOctave !== activePlaybackOctave &&
    !areKeyIdListsEqual(shiftedUpVoicingKeyIds, selectedChordVoicingKeyIds);
  const notationVoicingKeyIds = buildClefAdjustedVoicingKeyIds(selectedChordVoicingKeyIds, notationClef);
  const displayPianoKeys = useMemo(
    () => (notationClef === "bass" ? buildPianoKeys(2, 3) : buildPianoKeys(4, 5)),
    [notationClef],
  );
  const chordNotesText = selectedChordPitchClasses
    .map((pitchClass) => formatMusicText(pitchClass, rootNotationPreference))
    .join(", ");
  const chordVoicingText = notationVoicingKeyIds
    .map((keyId) => formatMusicText(keyId, rootNotationPreference))
    .join(", ");
  const semitoneText = selectedChordDefinition.intervals.join(", ");
  const formulaText = formatMusicText(selectedChordDefinition.formula);
  const bassPitchClass = parseKeyId(selectedChordVoicingKeyIds[0] ?? "")?.note ?? activeSelectedRoot;
  const slashSymbol =
    bassPitchClass === activeSelectedRoot
      ? null
      : `${selectedChordSymbol}/${formatMusicText(bassPitchClass, rootNotationPreference)}`;
  const chordNotationMatch: ChordMatch = {
    name: selectedChordLabel,
    symbol: selectedChordSymbol,
    root: activeSelectedRoot,
    quality: selectedChordDefinition.id,
    notes: selectedChordPitchClasses,
    inversionLabel,
    bass: bassPitchClass,
    slashSymbol,
    partialOmission: null,
  };

  const normalizedQuery = normalizeSearchText(searchQuery);
  const chordDefinitionById = useMemo(
    () => new Map<ChordId, ChordDefinition>(CHORD_DEFINITIONS.map((definition) => [definition.id, definition])),
    [],
  );
  const filteredChordDefinitions = useMemo(
    () =>
      normalizedQuery.length === 0
        ? CHORD_DEFINITIONS
        : CHORD_DEFINITIONS.filter((chordDefinition) =>
            buildChordSearchText(activeSelectedRoot, chordDefinition).includes(normalizedQuery),
          ),
    [activeSelectedRoot, normalizedQuery],
  );
  const filteredChordIdSet = useMemo(
    () => new Set<ChordId>(filteredChordDefinitions.map((definition) => definition.id)),
    [filteredChordDefinitions],
  );
  const groupedChordDefinitions = useMemo(
    () =>
      CHORD_LIBRARY_GROUPS.map((group) => ({
        title: group.title,
        chords: group.chordIds
          .map((chordId) => chordDefinitionById.get(chordId))
          .filter((definition): definition is ChordDefinition => Boolean(definition))
          .filter((definition) => filteredChordIdSet.has(definition.id)),
      })).filter((group) => group.chords.length > 0),
    [chordDefinitionById, filteredChordIdSet],
  );

  const handlePlayChord = useCallback(async (): Promise<void> => {
    await playSelectedKeys(notationVoicingKeyIds);
  }, [playSelectedKeys, notationVoicingKeyIds]);

  const handleKeyboardKeyClick = useCallback(
    (keyId: string) => {
      const parsed = parseKeyId(keyId);
      if (!parsed) {
        return;
      }

      const nextRoot = parsed.note;
      setInteractionSelectionOverride({ root: nextRoot, chordId: activeSelectedChordId });
      dispatchSession({ type: "setSelectedRoot", selectedRoot: nextRoot });
      dispatchSession({
        type: "setPlaybackOctave",
        playbackOctave: clampPlaybackOctave(parsed.octave),
      });
      if (pathname.startsWith("/library/chords")) {
        router.replace(buildChordLibraryPath(nextRoot, activeSelectedChordId), { scroll: false });
      }
    },
    [activeSelectedChordId, pathname, router],
  );

  const toggleRootNotationPreference = useCallback(() => {
    dispatchSession({ type: "toggleRootNotationPreference" });
  }, []);

  useEffect(() => {
    if (chordLibrarySessionCache !== null) {
      return;
    }

    const persistedChordLibrarySession = chordLibrarySessionCache ?? getInitialChordLibrarySession();
    const initialChordSelectionFromPath = initialChordSelectionFromPathRef.current;
    const restoredSession = initialChordSelectionFromPath
      ? {
          ...persistedChordLibrarySession,
          selectedRoot: initialChordSelectionFromPath.root,
          selectedChordId: initialChordSelectionFromPath.chordId,
        }
      : persistedChordLibrarySession;

    dispatchSession({ type: "restore", session: restoredSession });
  }, []);

  useEffect(() => {
    if (!interactionSelectionOverride) {
      return;
    }

    let timeoutId: number | null = null;
    if (!pathname.startsWith("/library/chords")) {
      timeoutId = window.setTimeout(() => {
        setInteractionSelectionOverride(null);
      }, 0);
    } else if (
      chordSelectionFromPath &&
      chordSelectionFromPath.root === interactionSelectionOverride.root &&
      chordSelectionFromPath.chordId === interactionSelectionOverride.chordId
    ) {
      timeoutId = window.setTimeout(() => {
        setInteractionSelectionOverride(null);
      }, 0);
    }

    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [interactionSelectionOverride, chordSelectionFromPath, pathname]);

  useEffect(() => {
    chordLibraryNotationClefCache = notationClef;
  }, [notationClef]);

  useEffect(() => {
    if (!hasRestored) {
      return;
    }

    chordLibrarySessionCache = {
      selectedRoot: activeSelectedRoot,
      selectedChordId: activeSelectedChordId,
      rootNotationPreference,
      playbackOctave: activePlaybackOctave,
      inversionIndex: activeInversionIndex,
    };

    window.localStorage.setItem(
      CHORD_LIBRARY_SESSION_STORAGE_KEY,
      JSON.stringify({
        selectedRoot: activeSelectedRoot,
        selectedChordId: activeSelectedChordId,
        rootNotationPreference,
        playbackOctave: activePlaybackOctave,
        inversionIndex: activeInversionIndex,
      }),
    );
  }, [
    hasRestored,
    activeSelectedRoot,
    activeSelectedChordId,
    rootNotationPreference,
    activePlaybackOctave,
    activeInversionIndex,
  ]);

  useEffect(() => {
    if (!pathname.startsWith("/library/chords") || chordSelectionFromPath) {
      return;
    }

    const expectedPath = buildChordLibraryPath(activeSelectedRoot, activeSelectedChordId);
    router.replace(expectedPath, { scroll: false });
  }, [activeSelectedRoot, activeSelectedChordId, pathname, router, chordSelectionFromPath]);

  useLayoutEffect(() => {
    const chordList = chordListRef.current;
    if (!chordList) {
      return;
    }

    chordList.scrollTop = chordLibraryListScrollTopCache;
  }, [pathname]);

  useLayoutEffect(() => {
    const chordList = chordListRef.current;
    if (!chordList || !chordSelectionFromPath || chordLibraryListScrollTopCache > 0) {
      return;
    }

    const selectedChordOption = selectedChordOptionRef.current;
    if (!selectedChordOption) {
      return;
    }

    centerElementWithinScrollContainer(chordList, selectedChordOption);
    chordLibraryListScrollTopCache = chordList.scrollTop;
  }, [activeSelectedChordId, activeSelectedRoot, pathname, chordSelectionFromPath]);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(17rem,22rem)_1fr]">
      <section className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold tracking-wide text-slate-600 dark:text-slate-300">Root Note</p>
          <button
            type="button"
            onClick={toggleRootNotationPreference}
            aria-label={`Toggle root accidental display (${rootNotationPreference === "sharps" ? "sharp" : "flat"} labels enabled)`}
            className="relative inline-flex h-8 shrink-0 cursor-pointer items-center rounded-full border border-slate-300 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900"
          >
            <span
              aria-hidden="true"
              className={`absolute inset-y-0.5 w-[calc(50%-2px)] rounded-full bg-slate-900 shadow-sm transition-transform duration-200 ease-out dark:bg-slate-100 ${
                rootNotationPreference === "sharps" ? "translate-x-0" : "translate-x-full"
              }`}
            />
            <span
              aria-hidden="true"
              className={`relative z-10 inline-flex h-full min-w-8 items-center justify-center rounded-full px-3 text-base leading-none font-semibold transition-colors duration-200 ${
                rootNotationPreference === "sharps"
                  ? "text-white dark:text-slate-900"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              }`}
            >
              ♯
            </span>
            <span
              aria-hidden="true"
              className={`relative z-10 inline-flex h-full min-w-8 items-center justify-center rounded-full px-3 text-base leading-none font-semibold transition-colors duration-200 ${
                rootNotationPreference === "flats"
                  ? "text-white dark:text-slate-900"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              }`}
            >
              ♭
            </span>
          </button>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-1 rounded-xl border border-slate-200 bg-white p-1 sm:grid-cols-6 dark:border-slate-800 dark:bg-slate-900">
          {CHORD_ROOT_PITCH_CLASSES.map((root) => {
            const isSelectedRoot = root === activeSelectedRoot;
            const rootText = formatMusicText(root, rootNotationPreference);

            return (
              <button
                key={root}
                type="button"
                aria-label={`Select root ${rootText}`}
                aria-pressed={isSelectedRoot}
                onClick={() => {
                  setInteractionSelectionOverride({ root, chordId: activeSelectedChordId });
                  dispatchSession({ type: "setSelectedRoot", selectedRoot: root });
                  if (pathname.startsWith("/library/chords")) {
                    router.replace(buildChordLibraryPath(root, activeSelectedChordId), {
                      scroll: false,
                    });
                  }
                }}
                className={`h-11 rounded-md px-1.5 text-center text-sm font-semibold transition-colors ${
                  isSelectedRoot
                    ? "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-100"
                    : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                }`}
              >
                {rootText}
              </button>
            );
          })}
        </div>

        <label
          htmlFor="chord-search"
          className="mt-4 mb-1 block text-xs font-semibold tracking-wide text-slate-600 dark:text-slate-300"
        >
          Chord List
        </label>
        <input
          id="chord-search"
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.currentTarget.value)}
          placeholder="Search chord name or symbol"
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-hidden ring-sky-500 transition focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          aria-label="Search chords"
        />
        <div
          ref={chordListRef}
          className="mt-3 max-h-110 overflow-y-auto rounded-xl border border-slate-200 bg-white px-1 pt-2 pb-1 dark:border-slate-800 dark:bg-slate-900"
          role="listbox"
          aria-label={`${selectedRootText} chord options`}
          onScroll={(event) => {
            chordLibraryListScrollTopCache = event.currentTarget.scrollTop;
          }}
        >
          {groupedChordDefinitions.length === 0 ? (
            <p className="px-3 py-4 text-sm text-slate-500 dark:text-slate-400">No chords match this search.</p>
          ) : (
            groupedChordDefinitions.map((group) => (
              <div key={group.title} className="mb-2">
                <p
                  role="presentation"
                  className="px-3 py-1 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
                >
                  {group.title}
                </p>
                {group.chords.map((chordDefinition) => {
                  const isSelected = chordDefinition.id === activeSelectedChordId;
                  const chordSymbol = `${selectedRootText}${formatMusicText(chordDefinition.suffix)}`;
                  return (
                    <button
                      key={`${activeSelectedRoot}-${chordDefinition.id}`}
                      ref={(node) => {
                        if (isSelected) {
                          selectedChordOptionRef.current = node;
                        }
                      }}
                      type="button"
                      role="option"
                      aria-label={`Select ${selectedRootText} ${chordDefinition.name} chord`}
                      aria-selected={isSelected}
                      onClick={() => {
                        setInteractionSelectionOverride({
                          root: activeSelectedRoot,
                          chordId: chordDefinition.id,
                        });
                        dispatchSession({ type: "setSelectedChordId", selectedChordId: chordDefinition.id });
                        if (pathname.startsWith("/library/chords")) {
                          router.replace(buildChordLibraryPath(activeSelectedRoot, chordDefinition.id), {
                            scroll: false,
                          });
                        }
                      }}
                      className={`mb-1 w-full rounded-lg py-2 pr-3 pl-6 text-left transition-colors ${
                        isSelected
                          ? "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-100"
                          : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                      }`}
                    >
                      <span className="block text-sm font-semibold">{chordDefinition.name}</span>
                      <span className="block text-xs font-medium opacity-80">{chordSymbol}</span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </section>

      <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{selectedChordLabel}</h2>
            <div className="mt-4 mb-4 flex flex-wrap gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 dark:border-slate-700 dark:bg-slate-800/60">
                <span className="px-1 text-[11px] font-semibold tracking-wide text-slate-600 uppercase dark:text-slate-300">
                  Shift
                </span>
                <button
                  type="button"
                  aria-label="Shift chord down one octave"
                  disabled={!canShiftDown}
                  onClick={() =>
                    dispatchSession({
                      type: "setPlaybackOctave",
                      playbackOctave: shiftedDownPlaybackOctave,
                    })
                  }
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold ${
                    !canShiftDown
                      ? "cursor-not-allowed border-slate-200 text-slate-300 dark:border-slate-700 dark:text-slate-600"
                      : "border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  ‹
                </button>
                <button
                  type="button"
                  aria-label="Shift chord up one octave"
                  disabled={!canShiftUp}
                  onClick={() =>
                    dispatchSession({
                      type: "setPlaybackOctave",
                      playbackOctave: shiftedUpPlaybackOctave,
                    })
                  }
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold ${
                    !canShiftUp
                      ? "cursor-not-allowed border-slate-200 text-slate-300 dark:border-slate-700 dark:text-slate-600"
                      : "border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  ›
                </button>
              </div>

              <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 dark:border-slate-700 dark:bg-slate-800/60">
                <span className="px-1 text-[11px] font-semibold tracking-wide text-slate-600 uppercase dark:text-slate-300">
                  Inversion
                </span>
                <button
                  type="button"
                  aria-label="Select previous inversion"
                  onClick={() =>
                    dispatchSession({
                      type: "setInversionIndex",
                      inversionIndex: (activeInversionIndex - 1 + inversionCount) % inversionCount,
                    })
                  }
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  ‹
                </button>
                <span className="min-w-24 text-center text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {inversionLabel}
                </span>
                <button
                  type="button"
                  aria-label="Select next inversion"
                  onClick={() =>
                    dispatchSession({
                      type: "setInversionIndex",
                      inversionIndex: (activeInversionIndex + 1) % inversionCount,
                    })
                  }
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  ›
                </button>
              </div>
            </div>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Symbol: {selectedChordSymbol}</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Notes: {chordNotesText}</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Voicing: {chordVoicingText}</p>
          </div>
          <button
            type="button"
            onClick={handlePlayChord}
            aria-label="Play selected chord"
            disabled={isChordPlaying}
            className={`ml-auto inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs leading-none font-semibold transition-colors duration-200 ${
              isChordPlaying
                ? "cursor-not-allowed border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            }`}
          >
            <svg aria-hidden="true" className="h-3 w-3 fill-current" viewBox="0 0 16 16">
              <path d="M4 3.3c0-.74.8-1.2 1.45-.83l6.8 3.97a.96.96 0 0 1 0 1.66l-6.8 3.97A.96.96 0 0 1 4 11.24V3.3z" />
            </svg>
          </button>
        </div>

        <div className="mb-4 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-950/40 sm:grid-cols-2">
          <p className="text-slate-700 dark:text-slate-200">
            <span className="font-semibold">Formula:</span> {formulaText}
          </p>
          <p className="text-slate-700 dark:text-slate-200">
            <span className="font-semibold">Semitones:</span> {semitoneText}
          </p>
        </div>
        <div className="mb-2 flex items-center justify-end">
          <div
            className="relative inline-grid grid-cols-2 overflow-hidden rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900"
            role="group"
            aria-label="Clef selection"
          >
            <span aria-hidden className="pointer-events-none absolute inset-1 z-0">
              <span
                className="block h-full w-1/2 rounded-md bg-slate-800 transition-transform duration-200 ease-out dark:bg-slate-100"
                style={{ transform: notationClef === "bass" ? "translateX(100%)" : "translateX(0%)" }}
              />
            </span>
            <button
              type="button"
              onClick={() => setNotationClef("treble")}
              aria-pressed={notationClef === "treble"}
              className={`relative z-10 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                notationClef === "treble"
                  ? "text-white dark:text-slate-900"
                  : "text-slate-600 hover:text-slate-800 dark:text-slate-300 dark:hover:text-slate-100"
              }`}
            >
              Treble
            </button>
            <button
              type="button"
              onClick={() => setNotationClef("bass")}
              aria-pressed={notationClef === "bass"}
              className={`relative z-10 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                notationClef === "bass"
                  ? "text-white dark:text-slate-900"
                  : "text-slate-600 hover:text-slate-800 dark:text-slate-300 dark:hover:text-slate-100"
              }`}
            >
              Bass
            </button>
          </div>
        </div>
        <div className="mb-4 flex min-h-27 items-center justify-center rounded-xl border border-slate-200/80 bg-white/80 px-2 py-1 dark:border-slate-800 dark:bg-slate-950/40">
          <ChordNotation
            match={chordNotationMatch}
            notationPreference={rootNotationPreference}
            displayMode={notationClef}
            voicingKeyIds={notationVoicingKeyIds}
          />
        </div>

        <PianoKeyboard
          keys={displayPianoKeys}
          selectedKeys={notationVoicingKeyIds}
          primaryMissingKeyId={null}
          secondaryMissingKeyId={null}
          onKeyClick={handleKeyboardKeyClick}
          notationPreference={rootNotationPreference}
          scrollCacheKey="library-chords"
        />
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Chord-tone highlights follow the selected root and quality.
        </p>
      </section>
    </div>
  );
}

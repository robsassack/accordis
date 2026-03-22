"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useScaleAudio } from "@/components/audio/ScaleAudioProvider";
import { PianoKeyboard } from "@/components/piano/PianoKeyboard";
import { ScaleNotation } from "@/components/library/ScaleNotation";
import {
  buildPianoKeys,
  formatMusicText,
  parseKeyId,
  type NotationPreference,
  type PitchClass,
} from "@/lib/piano";
import {
  SCALE_DEFINITIONS,
  SCALE_ROOT_PITCH_CLASSES,
  buildScaleLibraryPath,
  buildScalePitchClasses,
  buildScalePlaybackNoteNames,
  buildScaleSearchText,
  getScaleDefinitionById,
  parseScaleLibraryPath,
  type ScaleDefinition,
  type ScaleId,
  type ScalePlaybackDirection,
} from "@/lib/scales";

const PIANO_KEYS = buildPianoKeys(4, 5);
const DEFAULT_SCALE_ID: ScaleId = "major";
const DEFAULT_ROOT: PitchClass = "C";
const SCALE_LIBRARY_SESSION_STORAGE_KEY = "accordis-scale-library-session";
const DEFAULT_ROOT_NOTATION_PREFERENCE: NotationPreference = "sharps";
const DEFAULT_TEMPO_BPM = 120;
const DEFAULT_PLAYBACK_DIRECTION: ScalePlaybackDirection = "both";
const MIN_TEMPO_BPM = 80;
const MAX_TEMPO_BPM = 240;
const SCALE_LIBRARY_GROUPS: ReadonlyArray<{
  title: string;
  scaleIds: readonly ScaleId[];
}> = [
  { title: "Diatonic", scaleIds: ["major", "naturalMinor"] },
  { title: "Minor Variants", scaleIds: ["harmonicMinor", "melodicMinor"] },
  { title: "Pentatonic", scaleIds: ["majorPentatonic", "minorPentatonic"] },
  { title: "Blues", scaleIds: ["minorBlues", "majorBlues"] },
  { title: "Modes", scaleIds: ["dorian", "phrygian", "lydian", "mixolydian", "locrian"] },
  {
    title: "Symmetric",
    scaleIds: ["wholeTone", "diminishedHalfWhole", "diminishedWholeHalf"],
  },
] as const;

type ScaleLibrarySession = {
  selectedRoot: PitchClass;
  selectedScaleId: ScaleId;
  rootNotationPreference: NotationPreference;
  tempoBpm: number;
  playbackDirection: ScalePlaybackDirection;
};

type ScaleLibrarySessionState = ScaleLibrarySession & {
  hasRestored: boolean;
};

type ScaleLibrarySessionAction =
  | { type: "restore"; session: ScaleLibrarySession }
  | { type: "setSelectedRoot"; selectedRoot: PitchClass }
  | { type: "setSelectedScaleId"; selectedScaleId: ScaleId }
  | { type: "toggleRootNotationPreference" }
  | { type: "setTempoBpm"; tempoBpm: number }
  | { type: "setPlaybackDirection"; playbackDirection: ScalePlaybackDirection };

let scaleLibrarySessionCache: ScaleLibrarySession | null = null;
let scaleLibraryListScrollTopCache = 0;

export function resetScaleLibrarySessionCacheForTests(): void {
  scaleLibrarySessionCache = null;
  scaleLibraryListScrollTopCache = 0;
}

function getDefaultScaleLibrarySession(): ScaleLibrarySession {
  return {
    selectedRoot: DEFAULT_ROOT,
    selectedScaleId: DEFAULT_SCALE_ID,
    rootNotationPreference: DEFAULT_ROOT_NOTATION_PREFERENCE,
    tempoBpm: DEFAULT_TEMPO_BPM,
    playbackDirection: DEFAULT_PLAYBACK_DIRECTION,
  };
}

function getInitialScaleLibrarySession(): ScaleLibrarySession {
  const defaultSession = getDefaultScaleLibrarySession();

  if (typeof window === "undefined") {
    return defaultSession;
  }

  const storedSessionJson = window.localStorage.getItem(SCALE_LIBRARY_SESSION_STORAGE_KEY);
  if (!storedSessionJson) {
    return defaultSession;
  }

  try {
    const parsedSession = JSON.parse(storedSessionJson) as {
      selectedRoot?: string;
      selectedScaleId?: string;
      rootNotationPreference?: string;
      tempoBpm?: number;
      playbackDirection?: string;
    };

    return {
      selectedRoot:
        (SCALE_ROOT_PITCH_CLASSES as readonly string[]).includes(parsedSession.selectedRoot ?? "")
          ? (parsedSession.selectedRoot as PitchClass)
          : defaultSession.selectedRoot,
      selectedScaleId: SCALE_DEFINITIONS.some((definition) => definition.id === parsedSession.selectedScaleId)
        ? (parsedSession.selectedScaleId as ScaleId)
        : defaultSession.selectedScaleId,
      rootNotationPreference:
        parsedSession.rootNotationPreference === "sharps" ||
        parsedSession.rootNotationPreference === "flats"
          ? parsedSession.rootNotationPreference
          : defaultSession.rootNotationPreference,
      tempoBpm:
        typeof parsedSession.tempoBpm === "number" &&
        Number.isFinite(parsedSession.tempoBpm) &&
        parsedSession.tempoBpm >= MIN_TEMPO_BPM &&
        parsedSession.tempoBpm <= MAX_TEMPO_BPM
          ? parsedSession.tempoBpm
          : defaultSession.tempoBpm,
      playbackDirection:
        parsedSession.playbackDirection === "ascending" ||
        parsedSession.playbackDirection === "descending" ||
        parsedSession.playbackDirection === "both"
          ? parsedSession.playbackDirection
          : defaultSession.playbackDirection,
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

function scaleLibrarySessionReducer(
  currentSession: ScaleLibrarySessionState,
  action: ScaleLibrarySessionAction,
): ScaleLibrarySessionState {
  switch (action.type) {
    case "restore":
      return { ...action.session, hasRestored: true };
    case "setSelectedRoot":
      return { ...currentSession, selectedRoot: action.selectedRoot };
    case "setSelectedScaleId":
      return { ...currentSession, selectedScaleId: action.selectedScaleId };
    case "toggleRootNotationPreference":
      return {
        ...currentSession,
        rootNotationPreference: currentSession.rootNotationPreference === "sharps" ? "flats" : "sharps",
      };
    case "setTempoBpm":
      return { ...currentSession, tempoBpm: action.tempoBpm };
    case "setPlaybackDirection":
      return { ...currentSession, playbackDirection: action.playbackDirection };
    default:
      return currentSession;
  }
}

export function ScaleLibraryWorkspace() {
  const { isScalePlaying, playScaleNoteSequence } = useScaleAudio();
  const pathname = usePathname();
  const router = useRouter();
  const scaleSelectionFromPath = useMemo(() => parseScaleLibraryPath(pathname), [pathname]);
  const initialScaleSelectionFromPathRef = useRef(scaleSelectionFromPath);
  const hasCachedSession = scaleLibrarySessionCache !== null;
  const baseInitialSession = scaleLibrarySessionCache ?? getDefaultScaleLibrarySession();
  const initialSession = scaleSelectionFromPath
    ? {
        ...baseInitialSession,
        selectedRoot: scaleSelectionFromPath.root,
        selectedScaleId: scaleSelectionFromPath.scaleId,
      }
    : baseInitialSession;
  const [searchQuery, setSearchQuery] = useState("");
  const [activePlaybackNoteName, setActivePlaybackNoteName] = useState<string | null>(null);
  const [interactionSelectionOverride, setInteractionSelectionOverride] = useState<{
    root: PitchClass;
    scaleId: ScaleId;
  } | null>(null);
  const [session, dispatchSession] = useReducer(scaleLibrarySessionReducer, {
    ...initialSession,
    hasRestored: hasCachedSession,
  });
  const {
    selectedRoot,
    selectedScaleId,
    rootNotationPreference,
    tempoBpm,
    playbackDirection,
    hasRestored,
  } = session;
  const scaleListRef = useRef<HTMLDivElement>(null);
  const selectedScaleOptionRef = useRef<HTMLButtonElement | null>(null);
  const hasPendingInteractionSelectionOverride =
    interactionSelectionOverride !== null &&
    pathname.startsWith("/library/scales") &&
    (!scaleSelectionFromPath ||
      scaleSelectionFromPath.root !== interactionSelectionOverride.root ||
      scaleSelectionFromPath.scaleId !== interactionSelectionOverride.scaleId);
  const activeSelectedRoot =
    hasPendingInteractionSelectionOverride && interactionSelectionOverride
      ? interactionSelectionOverride.root
      : scaleSelectionFromPath?.root ?? selectedRoot;
  const activeSelectedScaleId =
    hasPendingInteractionSelectionOverride && interactionSelectionOverride
      ? interactionSelectionOverride.scaleId
      : scaleSelectionFromPath?.scaleId ?? selectedScaleId;
  const selectedScaleDefinition = getScaleDefinitionById(activeSelectedScaleId);
  const displayNotationPreference = rootNotationPreference;
  const selectedRootText = formatMusicText(activeSelectedRoot, rootNotationPreference);
  const selectedScaleLabel = `${selectedRootText} ${selectedScaleDefinition.name}`;
  const selectedScalePitchClasses = buildScalePitchClasses(activeSelectedRoot, selectedScaleDefinition);
  const notationPitchClasses =
    selectedScalePitchClasses.length > 0
      ? [...selectedScalePitchClasses, selectedScalePitchClasses[0]]
      : selectedScalePitchClasses;
  const selectedPitchClassSet = new Set(selectedScalePitchClasses);
  const keyboardSelectedKeyIds = PIANO_KEYS.filter((key) => selectedPitchClassSet.has(key.note)).map(
    (key) => `${key.note}${key.octave}`,
  );
  const scaleNotesText = selectedScalePitchClasses
    .map((pitchClass) => formatMusicText(pitchClass, displayNotationPreference))
    .join(", ");
  const semitoneText = selectedScaleDefinition.intervals.join(", ");
  const formulaText = formatMusicText(selectedScaleDefinition.formula);

  const normalizedQuery = normalizeSearchText(searchQuery);
  const scaleDefinitionById = useMemo(
    () => new Map<ScaleId, ScaleDefinition>(SCALE_DEFINITIONS.map((definition) => [definition.id, definition])),
    [],
  );
  const filteredScaleDefinitions = useMemo(
    () =>
      normalizedQuery.length === 0
        ? SCALE_DEFINITIONS
        : SCALE_DEFINITIONS.filter((scaleDefinition) =>
            buildScaleSearchText(activeSelectedRoot, scaleDefinition).includes(normalizedQuery),
          ),
    [activeSelectedRoot, normalizedQuery],
  );
  const filteredScaleIdSet = useMemo(
    () => new Set<ScaleId>(filteredScaleDefinitions.map((definition) => definition.id)),
    [filteredScaleDefinitions],
  );
  const groupedScaleDefinitions = useMemo(
    () =>
      SCALE_LIBRARY_GROUPS.map((group) => ({
        title: group.title,
        scales: group.scaleIds
          .map((scaleId) => scaleDefinitionById.get(scaleId))
          .filter((definition): definition is ScaleDefinition => Boolean(definition))
          .filter((definition) => filteredScaleIdSet.has(definition.id)),
      })).filter((group) => group.scales.length > 0),
    [filteredScaleIdSet, scaleDefinitionById],
  );

  const handlePlayScale = useCallback(async (): Promise<void> => {
    const noteNames = buildScalePlaybackNoteNames(
      activeSelectedRoot,
      selectedScaleDefinition,
      playbackDirection,
    );
    const stepSeconds = 60 / tempoBpm;
    setActivePlaybackNoteName(null);
    await playScaleNoteSequence(noteNames, stepSeconds, {
      onNotePlay: (noteName) => setActivePlaybackNoteName(noteName),
      onPlaybackEnd: () => setActivePlaybackNoteName(null),
    });
  }, [activeSelectedRoot, playScaleNoteSequence, playbackDirection, selectedScaleDefinition, tempoBpm]);

  const handleKeyboardKeyClick = useCallback((keyId: string) => {
    const parsed = parseKeyId(keyId);
    if (!parsed) {
      return;
    }

    setInteractionSelectionOverride({ root: parsed.note, scaleId: activeSelectedScaleId });
    dispatchSession({ type: "setSelectedRoot", selectedRoot: parsed.note });
    if (pathname.startsWith("/library/scales")) {
      window.history.replaceState(null, "", buildScaleLibraryPath(parsed.note, activeSelectedScaleId));
    }
  }, [activeSelectedScaleId, pathname]);

  const toggleRootNotationPreference = useCallback(() => {
    dispatchSession({ type: "toggleRootNotationPreference" });
  }, []);

  useEffect(() => {
    if (scaleLibrarySessionCache !== null) {
      return;
    }

    const persistedScaleLibrarySession = scaleLibrarySessionCache ?? getInitialScaleLibrarySession();
    const initialScaleSelectionFromPath = initialScaleSelectionFromPathRef.current;
    const restoredSession = initialScaleSelectionFromPath
      ? {
          ...persistedScaleLibrarySession,
          selectedRoot: initialScaleSelectionFromPath.root,
          selectedScaleId: initialScaleSelectionFromPath.scaleId,
        }
      : persistedScaleLibrarySession;

    dispatchSession({ type: "restore", session: restoredSession });
  }, []);

  useEffect(() => {
    if (!interactionSelectionOverride) {
      return;
    }

    let timeoutId: number | null = null;
    if (!pathname.startsWith("/library/scales")) {
      timeoutId = window.setTimeout(() => {
        setInteractionSelectionOverride(null);
      }, 0);
    } else if (
      scaleSelectionFromPath &&
      scaleSelectionFromPath.root === interactionSelectionOverride.root &&
      scaleSelectionFromPath.scaleId === interactionSelectionOverride.scaleId
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
  }, [interactionSelectionOverride, scaleSelectionFromPath, pathname]);

  useEffect(() => {
    if (!hasRestored) {
      return;
    }

    scaleLibrarySessionCache = {
      selectedRoot: activeSelectedRoot,
      selectedScaleId: activeSelectedScaleId,
      rootNotationPreference,
      tempoBpm,
      playbackDirection,
    };

    window.localStorage.setItem(
      SCALE_LIBRARY_SESSION_STORAGE_KEY,
      JSON.stringify({
        selectedRoot: activeSelectedRoot,
        selectedScaleId: activeSelectedScaleId,
        rootNotationPreference,
        tempoBpm,
        playbackDirection,
      }),
    );
  }, [
    hasRestored,
    activeSelectedRoot,
    activeSelectedScaleId,
    rootNotationPreference,
    tempoBpm,
    playbackDirection,
  ]);

  useEffect(() => {
    if (!pathname.startsWith("/library/scales") || scaleSelectionFromPath) {
      return;
    }

    const expectedPath = buildScaleLibraryPath(activeSelectedRoot, activeSelectedScaleId);
    router.replace(expectedPath, { scroll: false });
  }, [activeSelectedRoot, activeSelectedScaleId, pathname, router, scaleSelectionFromPath]);

  useLayoutEffect(() => {
    const scaleList = scaleListRef.current;
    if (!scaleList) {
      return;
    }

    scaleList.scrollTop = scaleLibraryListScrollTopCache;
  }, [pathname]);

  useLayoutEffect(() => {
    const scaleList = scaleListRef.current;
    if (!scaleList || !scaleSelectionFromPath || scaleLibraryListScrollTopCache > 0) {
      return;
    }

    const selectedScaleOption = selectedScaleOptionRef.current;
    if (!selectedScaleOption) {
      return;
    }

    centerElementWithinScrollContainer(scaleList, selectedScaleOption);
    scaleLibraryListScrollTopCache = scaleList.scrollTop;
  }, [activeSelectedScaleId, activeSelectedRoot, pathname, scaleSelectionFromPath]);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(17rem,22rem)_1fr]">
      <section className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold tracking-wide text-slate-600 dark:text-slate-300">
            Root Note
          </p>
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
          {SCALE_ROOT_PITCH_CLASSES.map((root) => {
            const isSelectedRoot = root === activeSelectedRoot;
            const rootText = formatMusicText(root, rootNotationPreference);

            return (
              <button
                key={root}
                type="button"
                aria-label={`Select root ${rootText}`}
                aria-pressed={isSelectedRoot}
                onClick={() => {
                  setInteractionSelectionOverride({ root, scaleId: activeSelectedScaleId });
                  dispatchSession({ type: "setSelectedRoot", selectedRoot: root });
                  if (pathname.startsWith("/library/scales")) {
                    router.replace(buildScaleLibraryPath(root, activeSelectedScaleId), {
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

        <label htmlFor="scale-search" className="mt-4 mb-1 block text-xs font-semibold tracking-wide text-slate-600 dark:text-slate-300">
          Scale List
        </label>
        <input
          id="scale-search"
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.currentTarget.value)}
          placeholder="Search scale name or mode"
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-hidden ring-sky-500 transition focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          aria-label="Search scales"
        />
        <div
          ref={scaleListRef}
          className="mt-3 max-h-110 overflow-y-auto rounded-xl border border-slate-200 bg-white px-1 pt-2 pb-1 dark:border-slate-800 dark:bg-slate-900"
          role="listbox"
          aria-label={`${selectedRootText} scale options`}
          onScroll={(event) => {
            scaleLibraryListScrollTopCache = event.currentTarget.scrollTop;
          }}
        >
          {groupedScaleDefinitions.length === 0 ? (
            <p className="px-3 py-4 text-sm text-slate-500 dark:text-slate-400">No scales match this search.</p>
          ) : (
            groupedScaleDefinitions.map((group) => (
              <div key={group.title} className="mb-2">
                <p
                  role="presentation"
                  className="px-3 py-1 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
                >
                  {group.title}
                </p>
                {group.scales.map((scaleDefinition) => {
                  const isSelected = scaleDefinition.id === activeSelectedScaleId;
                  return (
                    <button
                      key={`${activeSelectedRoot}-${scaleDefinition.id}`}
                      ref={(node) => {
                        if (isSelected) {
                          selectedScaleOptionRef.current = node;
                        }
                      }}
                      type="button"
                      role="option"
                      aria-label={`Select ${selectedRootText} ${scaleDefinition.name} scale`}
                      aria-selected={isSelected}
                      onClick={() => {
                        setInteractionSelectionOverride({ root: activeSelectedRoot, scaleId: scaleDefinition.id });
                        dispatchSession({ type: "setSelectedScaleId", selectedScaleId: scaleDefinition.id });
                        if (pathname.startsWith("/library/scales")) {
                          router.replace(
                            buildScaleLibraryPath(activeSelectedRoot, scaleDefinition.id),
                            { scroll: false },
                          );
                        }
                      }}
                      className={`mb-1 w-full rounded-lg py-2 pr-3 pl-6 text-left text-sm transition-colors ${
                        isSelected
                          ? "bg-sky-100 font-semibold text-sky-900 dark:bg-sky-900/40 dark:text-sky-100"
                          : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                      }`}
                    >
                      {scaleDefinition.name}
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
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{selectedScaleLabel}</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Notes: {scaleNotesText}</p>
          </div>
          <button
            type="button"
            onClick={handlePlayScale}
            aria-label="Play selected scale"
            disabled={isScalePlaying}
            className={`ml-auto inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs leading-none font-semibold transition-colors duration-200 ${
              isScalePlaying
                ? "cursor-not-allowed border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            }`}
          >
            <svg aria-hidden="true" className="h-3 w-3 fill-current" viewBox="0 0 16 16">
              <path d="M4 3.3c0-.74.8-1.2 1.45-.83l6.8 3.97a.96.96 0 0 1 0 1.66l-6.8 3.97A.96.96 0 0 1 4 11.24V3.3z" />
            </svg>
          </button>
        </div>
        <div className="mb-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-xs font-semibold tracking-wide text-slate-600 dark:text-slate-300">
            Direction
            <select
              value={playbackDirection}
              onChange={(event) =>
                dispatchSession({
                  type: "setPlaybackDirection",
                  playbackDirection: event.currentTarget.value as ScalePlaybackDirection,
                })
              }
              className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-800 outline-hidden ring-sky-500 transition focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              aria-label="Scale playback direction"
            >
              <option value="ascending">Ascending</option>
              <option value="descending">Descending</option>
              <option value="both">Asc + Desc</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs font-semibold tracking-wide text-slate-600 dark:text-slate-300 sm:col-span-2">
            Tempo ({tempoBpm} BPM)
            <input
              type="range"
              min={MIN_TEMPO_BPM}
              max={MAX_TEMPO_BPM}
              step={2}
              value={tempoBpm}
              onChange={(event) =>
                dispatchSession({
                  type: "setTempoBpm",
                  tempoBpm: Number(event.currentTarget.value),
                })
              }
              aria-label="Scale playback tempo"
              className="h-9"
            />
          </label>
        </div>

        <div className="mb-4 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-950/40 sm:grid-cols-2">
          <p className="text-slate-700 dark:text-slate-200">
            <span className="font-semibold">Formula:</span> {formulaText}
          </p>
          <p className="text-slate-700 dark:text-slate-200">
            <span className="font-semibold">Semitones:</span> {semitoneText}
          </p>
        </div>
        <div className="relative z-10 mb-4 flex min-h-27 items-center justify-center overflow-visible rounded-xl border border-slate-200/80 bg-white/80 px-2 py-0.5 dark:border-slate-800 dark:bg-slate-950/40">
          <ScaleNotation
            notes={notationPitchClasses}
            notationPreference={displayNotationPreference}
            activePlaybackNoteName={activePlaybackNoteName}
          />
        </div>

        <PianoKeyboard
          keys={PIANO_KEYS}
          selectedKeys={keyboardSelectedKeyIds}
          primaryMissingKeyId={null}
          secondaryMissingKeyId={null}
          onKeyClick={handleKeyboardKeyClick}
          notationPreference={displayNotationPreference}
          scrollCacheKey="library-scales"
        />
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Accidentals automatically follow the selected scale context.
        </p>
      </section>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { faMoon, faSun } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { detectChords, detectIntervals } from "@/lib/chord-detect";
import {
  buildPianoKeys,
  parseKeyId,
  pitchClassToIndex,
  uniquePitchClassesFromKeyIds,
  type NotationPreference,
  type PitchClass,
} from "@/lib/piano";
import { PianoKeyboard } from "@/components/piano/PianoKeyboard";
import { SelectionBar } from "@/components/piano/SelectionBar";
import { DetectedResults } from "@/components/results/DetectedResults";

const PIANO_KEYS = buildPianoKeys(4, 5);
const NOTATION_STORAGE_KEY = "accordis-notation-preference";
const THEME_STORAGE_KEY = "accordis-theme-preference";
const DEFAULT_NOTATION_PREFERENCE: NotationPreference = "sharps";
type ThemePreference = "light" | "dark";
type SelectionSource = "manual" | "midi";
type MidiConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "no-device"
  | "unsupported"
  | "error";
type PartialBadgeHighlight = {
  badgeId: string;
  missingNote: PitchClass;
  root: PitchClass;
};
const MIDI_RELEASE_BATCH_WINDOW_MS = 35;
const CHORD_STRUM_STEP_SECONDS = 0.05;
const CHORD_NOTE_DURATION = "1n";
const UPRIGHT_PIANO_SAMPLE_URLS = {
  A3: "A3vH.wav",
  A4: "A4vH.wav",
  A5: "A5vH.wav",
  A6: "A6vH.wav",
  A7: "A7vH.wav",
  B1: "B1vH.wav",
  B2: "B2vH.wav",
  B7: "B7vH.wav",
  C1: "C1vH.wav",
  C4: "C4vH.wav",
  C5: "C5vH.wav",
  C6: "C6vH.wav",
  C7: "C7vH.wav",
  "D#2": "Ds2vH.wav",
  "D#3": "Ds3vH.wav",
  "D#4": "Ds4vH.wav",
  "D#5": "Ds5vH.wav",
  "D#6": "Ds6vH.wav",
  "D#7": "Ds7vH.wav",
  "F#1": "Fs1vH.wav",
  "F#2": "Fs2vH.wav",
  "F#3": "Fs3vH.wav",
  "F#4": "Fs4vH.wav",
  "F#5": "Fs5vH.wav",
  "F#6": "Fs6vH.wav",
  "F#7": "Fs7vH.wav",
} as const;

const MIDI_NOTE_TO_KEY_ID = new Map<number, string>(
  PIANO_KEYS.map((key) => [
    (key.octave + 1) * 12 + pitchClassToIndex(key.note),
    `${key.note}${key.octave}`,
  ]),
);

export default function Home() {
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [selectionSource, setSelectionSource] = useState<SelectionSource>("manual");
  const [midiEnabled, setMidiEnabled] = useState(false);
  const [hasEnabledMidiBefore, setHasEnabledMidiBefore] = useState(false);
  const [hasAttemptedMidiEnable, setHasAttemptedMidiEnable] = useState(false);
  const [midiConnectionState, setMidiConnectionState] = useState<MidiConnectionState>("idle");
  const [notationPreference, setNotationPreference] =
    useState<NotationPreference>(DEFAULT_NOTATION_PREFERENCE);
  const [themePreference, setThemePreference] = useState<ThemePreference>("light");
  const [hasInitializedClientState, setHasInitializedClientState] = useState(false);
  const [isChordPlaying, setIsChordPlaying] = useState(false);
  const [hoveredPartialHighlight, setHoveredPartialHighlight] = useState<PartialBadgeHighlight | null>(
    null,
  );
  const [selectedPartialHighlight, setSelectedPartialHighlight] =
    useState<PartialBadgeHighlight | null>(null);
  const activeMidiNotesRef = useRef<Set<number>>(new Set<number>());
  const latchedMidiNotesRef = useRef<Set<number>>(new Set<number>());
  const releasedMidiBatchRef = useRef<Set<number>>(new Set<number>());
  const releaseBatchTimerRef = useRef<number | null>(null);
  const selectionSourceRef = useRef<SelectionSource>("manual");
  const chordSamplerRef = useRef<import("tone").Sampler | null>(null);
  const chordFilterRef = useRef<import("tone").Filter | null>(null);
  const chordVolumeRef = useRef<import("tone").Volume | null>(null);
  const toneModuleRef = useRef<typeof import("tone") | null>(null);
  const toneModulePromiseRef = useRef<Promise<typeof import("tone")> | null>(null);
  const toneAssetsReadyPromiseRef = useRef<Promise<void> | null>(null);
  const chordPlayingTimerRef = useRef<number | null>(null);

  useEffect(() => {
    selectionSourceRef.current = selectionSource;
  }, [selectionSource]);

  useEffect(() => {
    setHoveredPartialHighlight(null);
    setSelectedPartialHighlight(null);
  }, [selectedKeys]);

  useEffect(() => {
    return () => {
      chordSamplerRef.current?.dispose();
      chordSamplerRef.current = null;
      chordFilterRef.current?.dispose();
      chordFilterRef.current = null;
      chordVolumeRef.current?.dispose();
      chordVolumeRef.current = null;
      if (chordPlayingTimerRef.current !== null) {
        window.clearTimeout(chordPlayingTimerRef.current);
        chordPlayingTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      const midiSupported =
        typeof navigator !== "undefined" && typeof navigator.requestMIDIAccess === "function";
      setMidiConnectionState(midiSupported ? "idle" : "unsupported");

      const storedPreference = window.localStorage.getItem(NOTATION_STORAGE_KEY);
      if (storedPreference === "sharps" || storedPreference === "flats") {
        setNotationPreference(storedPreference);
      }

      const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (storedTheme === "light" || storedTheme === "dark") {
        setThemePreference(storedTheme);
      } else {
        const systemPrefersDark =
          typeof window.matchMedia === "function" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches;
        setThemePreference(systemPrefersDark ? "dark" : "light");
      }

      setHasInitializedClientState(true);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, []);

  useEffect(() => {
    if (!hasInitializedClientState) {
      return;
    }

    localStorage.setItem(NOTATION_STORAGE_KEY, notationPreference);
  }, [hasInitializedClientState, notationPreference]);

  useEffect(() => {
    if (!hasInitializedClientState) {
      return;
    }

    document.documentElement.classList.toggle("dark", themePreference === "dark");
    document.documentElement.style.colorScheme = themePreference;
    localStorage.setItem(THEME_STORAGE_KEY, themePreference);
  }, [hasInitializedClientState, themePreference]);

  const syncSelectedKeysFromMidi = useCallback((): void => {
    const midiNotesForSelection =
      activeMidiNotesRef.current.size > 0
        ? activeMidiNotesRef.current
        : releasedMidiBatchRef.current.size > 0
          ? releasedMidiBatchRef.current
          : latchedMidiNotesRef.current;
    const nextSelectedKeys = Array.from(midiNotesForSelection)
      .sort((a, b) => a - b)
      .map((midiNote) => MIDI_NOTE_TO_KEY_ID.get(midiNote))
      .filter((keyId): keyId is string => Boolean(keyId));
    setSelectedKeys(nextSelectedKeys);
  }, []);

  useEffect(() => {
    if (!midiEnabled || typeof navigator.requestMIDIAccess !== "function") {
      return;
    }

    let isDisposed = false;
    let midiAccess: MIDIAccess | null = null;
    const flushReleasedMidiBatch = (): void => {
      if (releasedMidiBatchRef.current.size > 0) {
        if (activeMidiNotesRef.current.size === 0) {
          latchedMidiNotesRef.current = new Set(releasedMidiBatchRef.current);
        }
        // Drop partial release batches that happened while other notes were still held.
        releasedMidiBatchRef.current.clear();
      }
      releaseBatchTimerRef.current = null;
      syncSelectedKeysFromMidi();
    };

    const handleMidiMessage = (event: MIDIMessageEvent): void => {
      if (!event.data || event.data.length < 2) {
        return;
      }

      const [status, noteNumber, velocity = 0] = event.data;
      const command = status & 0xf0;
      const isNoteOn = command === 0x90 && velocity > 0;
      const isNoteOff = command === 0x80 || (command === 0x90 && velocity === 0);

      if (!isNoteOn && !isNoteOff) {
        return;
      }

      if (!MIDI_NOTE_TO_KEY_ID.has(noteNumber)) {
        return;
      }

      if (isNoteOn && selectionSourceRef.current !== "midi") {
        activeMidiNotesRef.current.clear();
        latchedMidiNotesRef.current.clear();
        releasedMidiBatchRef.current.clear();
      }

      if (isNoteOn) {
        if (releaseBatchTimerRef.current !== null) {
          window.clearTimeout(releaseBatchTimerRef.current);
          releaseBatchTimerRef.current = null;
        }
        releasedMidiBatchRef.current.clear();
        const isStartingNewChord = activeMidiNotesRef.current.size === 0;
        if (isStartingNewChord) {
          latchedMidiNotesRef.current.clear();
        }
        activeMidiNotesRef.current.add(noteNumber);
        setSelectionSource("midi");
        syncSelectedKeysFromMidi();
      } else {
        activeMidiNotesRef.current.delete(noteNumber);
        releasedMidiBatchRef.current.add(noteNumber);
        if (releaseBatchTimerRef.current !== null) {
          window.clearTimeout(releaseBatchTimerRef.current);
        }
        releaseBatchTimerRef.current = window.setTimeout(
          flushReleasedMidiBatch,
          MIDI_RELEASE_BATCH_WINDOW_MS,
        );
        setSelectionSource("midi");
      }
    };

    const bindMidiInputs = (access: MIDIAccess): void => {
      let hasConnectedInput = false;

      access.inputs.forEach((input) => {
        hasConnectedInput = true;
        input.onmidimessage = handleMidiMessage;
      });

      setMidiConnectionState(hasConnectedInput ? "connected" : "no-device");
    };

    navigator
      .requestMIDIAccess()
      .then((access) => {
        if (isDisposed) {
          return;
        }

        midiAccess = access;
        bindMidiInputs(access);
        access.onstatechange = () => {
          bindMidiInputs(access);
        };
      })
      .catch(() => {
        if (!isDisposed) {
          setMidiConnectionState("error");
        }
      });

    return () => {
      isDisposed = true;
      if (!midiAccess) {
        return;
      }

      midiAccess.inputs.forEach((input) => {
        input.onmidimessage = null;
      });
      midiAccess.onstatechange = null;
      if (releaseBatchTimerRef.current !== null) {
        window.clearTimeout(releaseBatchTimerRef.current);
        releaseBatchTimerRef.current = null;
      }
    };
  }, [midiEnabled, syncSelectedKeysFromMidi]);

  function handleKeyClick(keyId: string): void {
    setSelectionSource("manual");
    if (releaseBatchTimerRef.current !== null) {
      window.clearTimeout(releaseBatchTimerRef.current);
      releaseBatchTimerRef.current = null;
    }
    activeMidiNotesRef.current.clear();
    latchedMidiNotesRef.current.clear();
    releasedMidiBatchRef.current.clear();
    setSelectedKeys((current) =>
      current.includes(keyId)
        ? current.filter((key) => key !== keyId)
        : [...current, keyId],
    );
  }

  function handleDeselectAll(): void {
    setSelectionSource("manual");
    if (releaseBatchTimerRef.current !== null) {
      window.clearTimeout(releaseBatchTimerRef.current);
      releaseBatchTimerRef.current = null;
    }
    activeMidiNotesRef.current.clear();
    latchedMidiNotesRef.current.clear();
    releasedMidiBatchRef.current.clear();
    setSelectedKeys([]);
  }

  function handleMidiToggle(): void {
    setHasAttemptedMidiEnable(true);
    setSelectionSource("manual");
    if (releaseBatchTimerRef.current !== null) {
      window.clearTimeout(releaseBatchTimerRef.current);
      releaseBatchTimerRef.current = null;
    }
    activeMidiNotesRef.current.clear();
    latchedMidiNotesRef.current.clear();
    releasedMidiBatchRef.current.clear();
    setSelectedKeys([]);

    if (typeof navigator.requestMIDIAccess !== "function") {
      return;
    }

    if (midiEnabled) {
      setMidiEnabled(false);
      setMidiConnectionState("idle");
      return;
    }

    setMidiEnabled(true);
    setHasEnabledMidiBefore(true);
    setMidiConnectionState("connecting");
  }

  const getToneModule = useCallback(async (): Promise<typeof import("tone")> => {
    if (toneModuleRef.current) {
      return toneModuleRef.current;
    }

    if (!toneModulePromiseRef.current) {
      toneModulePromiseRef.current = import("tone");
    }

    const toneModule = await toneModulePromiseRef.current;
    toneModuleRef.current = toneModule;
    return toneModule;
  }, []);

  const handlePlayChord = useCallback(async (): Promise<void> => {
    if (selectedKeys.length === 0) {
      return;
    }

    const parsedNotes = selectedKeys
      .map((keyId) => parseKeyId(keyId))
      .filter((parsed): parsed is NonNullable<typeof parsed> => parsed !== null)
      .sort((a, b) => a.midiLike - b.midiLike);
    const noteNames = parsedNotes.map((parsed) => `${parsed.note}${parsed.octave}`);

    if (noteNames.length === 0) {
      return;
    }

    const Tone = await getToneModule();
    await Tone.start();

    if (!chordFilterRef.current) {
      chordFilterRef.current = new Tone.Filter({
        type: "lowpass",
        frequency: 2400,
        rolloff: -24,
        Q: 0.6,
      });
    }

    if (!chordVolumeRef.current) {
      chordVolumeRef.current = new Tone.Volume(-8).toDestination();
    }

    if (chordFilterRef.current.numberOfOutputs > 0) {
      chordFilterRef.current.disconnect();
    }
    chordFilterRef.current.connect(chordVolumeRef.current);

    if (!chordSamplerRef.current) {
      chordSamplerRef.current = new Tone.Sampler({
        urls: UPRIGHT_PIANO_SAMPLE_URLS,
        baseUrl: "/samples/upright-piano-kw/",
        attack: 0.02,
        release: 1.5,
      });
      chordSamplerRef.current.connect(chordFilterRef.current);
      toneAssetsReadyPromiseRef.current = Tone.loaded();
    }

    if (toneAssetsReadyPromiseRef.current) {
      await toneAssetsReadyPromiseRef.current;
    }

    const now = Tone.now();
    if (chordPlayingTimerRef.current !== null) {
      window.clearTimeout(chordPlayingTimerRef.current);
    }
    setIsChordPlaying(true);
    chordSamplerRef.current.releaseAll(now);
    noteNames.forEach((noteName, index) => {
      const startTime = now + index * CHORD_STRUM_STEP_SECONDS;
      chordSamplerRef.current?.triggerAttackRelease(noteName, CHORD_NOTE_DURATION, startTime, 0.58);
    });
    const noteDurationSeconds = Tone.Time(CHORD_NOTE_DURATION).toSeconds();
    const strumTailSeconds = (noteNames.length - 1) * CHORD_STRUM_STEP_SECONDS;
    chordPlayingTimerRef.current = window.setTimeout(() => {
      setIsChordPlaying(false);
      chordPlayingTimerRef.current = null;
    }, Math.ceil((noteDurationSeconds + strumTailSeconds) * 1000));
  }, [getToneModule, selectedKeys]);

  const midiStatusText: Record<MidiConnectionState, string> = {
    idle: "",
    connecting: "MIDI: connecting...",
    connected: "MIDI: connected",
    "no-device": "MIDI: no device detected",
    unsupported: "MIDI unavailable",
    error: "MIDI failed",
  };
  const isUsingMidiInput = selectionSource === "midi";
  const midiToggleDisabled = midiConnectionState === "unsupported" && hasAttemptedMidiEnable;
  const midiStatusLine =
    midiConnectionState === "unsupported"
      ? hasAttemptedMidiEnable
        ? "MIDI unavailable."
        : ""
      : !midiEnabled
        ? hasEnabledMidiBefore
          ? "MIDI is off."
          : ""
        : `${midiStatusText[midiConnectionState]} • Input source: ${
            isUsingMidiInput ? "MIDI" : "On-screen keys"
          }`;

  const uniquePitchClasses = uniquePitchClassesFromKeyIds(selectedKeys);
  const intervalMatches = detectIntervals(selectedKeys);
  const chordMatches = detectChords(selectedKeys);
  const isDarkMode = themePreference === "dark";
  const activePartialHighlight = hoveredPartialHighlight ?? selectedPartialHighlight;
  const missingPitchClass = activePartialHighlight?.missingNote ?? null;
  const parsedSelectedKeys = selectedKeys
    .map((keyId) => parseKeyId(keyId))
    .filter((parsed): parsed is NonNullable<typeof parsed> => parsed !== null);
  const preferredMissingMidi =
    parsedSelectedKeys.length > 0
      ? Math.round(
          parsedSelectedKeys.reduce((sum, parsed) => sum + parsed.midiLike, 0) /
            parsedSelectedKeys.length,
        )
      : null;
  const keyCandidates = PIANO_KEYS.filter((key) => key.note === missingPitchClass);
  const keyIdWithMidi = keyCandidates.map((key) => ({
    keyId: `${key.note}${key.octave}`,
    midiLike: key.octave * 12 + pitchClassToIndex(key.note),
  }));
  const rootPositionMissingMidi = (() => {
    if (!activePartialHighlight || parsedSelectedKeys.length === 0) {
      return null;
    }

    const lowestRootSelection = parsedSelectedKeys
      .filter((parsed) => parsed.note === activePartialHighlight.root)
      .sort((a, b) => a.midiLike - b.midiLike)[0];
    if (!lowestRootSelection) {
      return null;
    }

    const rootToMissingInterval =
      (pitchClassToIndex(activePartialHighlight.missingNote) -
        pitchClassToIndex(activePartialHighlight.root) +
        12) %
      12;
    return lowestRootSelection.midiLike + (rootToMissingInterval === 0 ? 12 : rootToMissingInterval);
  })();
  const findClosestCandidateKeyId = (
    targetMidi: number | null,
    excludedKeyId: string | null = null,
  ): string | null => {
    const candidates = keyIdWithMidi.filter((candidate) => candidate.keyId !== excludedKeyId);
    if (candidates.length === 0) {
      return null;
    }

    if (targetMidi === null) {
      return candidates[0]?.keyId ?? null;
    }

    const closestCandidate = candidates.reduce((closest, candidate) =>
      Math.abs(candidate.midiLike - targetMidi) < Math.abs(closest.midiLike - targetMidi)
        ? candidate
        : closest,
    );
    return closestCandidate.keyId;
  };
  const primaryMissingKeyId = (() => {
    if (!missingPitchClass) {
      return null;
    }

    if (keyIdWithMidi.length === 0) {
      return null;
    }

    const rootPositionTargetMidi = rootPositionMissingMidi ?? preferredMissingMidi;
    return findClosestCandidateKeyId(rootPositionTargetMidi);
  })();
  const secondaryMissingKeyId = findClosestCandidateKeyId(preferredMissingMidi, primaryMissingKeyId);

  return (
    <main className="min-h-screen bg-linear-to-b from-slate-100 via-white to-sky-50 px-6 py-12 text-slate-900 transition-colors dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 dark:text-slate-100">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <header className="flex items-center justify-between gap-4">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            Accordis
          </p>
          <button
            type="button"
            onClick={() => setThemePreference(isDarkMode ? "light" : "dark")}
            aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
            title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            <FontAwesomeIcon icon={isDarkMode ? faSun : faMoon} className="h-4 w-4" />
          </button>
        </header>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900 sm:p-8">
          <SelectionBar
            selectedKeys={selectedKeys}
            onClear={handleDeselectAll}
            onPlayChord={handlePlayChord}
            isPlayActive={isChordPlaying}
            notationPreference={notationPreference}
            onNotationPreferenceChange={setNotationPreference}
            midiEnabled={midiEnabled}
            midiDisabled={midiToggleDisabled}
            onMidiToggle={handleMidiToggle}
          />
          <div className="mb-3 h-4">
            <p
              className={`overflow-hidden text-ellipsis whitespace-nowrap text-xs leading-4 text-slate-500 transition-opacity dark:text-slate-400 ${
                midiStatusLine ? "opacity-100" : "opacity-0"
              }`}
              aria-hidden={!midiStatusLine}
            >
              {midiStatusLine || "\u00A0"}
            </p>
          </div>

          <PianoKeyboard
            keys={PIANO_KEYS}
            selectedKeys={selectedKeys}
            primaryMissingKeyId={primaryMissingKeyId}
            secondaryMissingKeyId={secondaryMissingKeyId}
            onKeyClick={handleKeyClick}
            notationPreference={notationPreference}
          />

          <DetectedResults
            uniquePitchClasses={uniquePitchClasses}
            intervalMatches={intervalMatches}
            chordMatches={chordMatches}
            notationPreference={notationPreference}
            highlightedPartialBadgeId={selectedPartialHighlight?.badgeId ?? null}
            onPartialBadgeHoverChange={setHoveredPartialHighlight}
            onPartialBadgeSelect={(highlight) => {
              setSelectedPartialHighlight((currentHighlight) => {
                if (currentHighlight?.badgeId === highlight.badgeId) {
                  return null;
                }
                return highlight;
              });
            }}
          />
        </section>
      </div>
    </main>
  );
}

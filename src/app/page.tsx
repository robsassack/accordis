"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { faMoon, faSun } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { detectChords, detectIntervals } from "@/lib/chord-detect";
import {
  buildPianoKeys,
  pitchClassToIndex,
  uniquePitchClassesFromKeyIds,
  type NotationPreference,
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
const MIDI_RELEASE_BATCH_WINDOW_MS = 35;

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
  const activeMidiNotesRef = useRef<Set<number>>(new Set<number>());
  const latchedMidiNotesRef = useRef<Set<number>>(new Set<number>());
  const releasedMidiBatchRef = useRef<Set<number>>(new Set<number>());
  const releaseBatchTimerRef = useRef<number | null>(null);
  const selectionSourceRef = useRef<SelectionSource>("manual");

  useEffect(() => {
    selectionSourceRef.current = selectionSource;
  }, [selectionSource]);

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
            onKeyClick={handleKeyClick}
            notationPreference={notationPreference}
          />

          <DetectedResults
            uniquePitchClasses={uniquePitchClasses}
            intervalMatches={intervalMatches}
            chordMatches={chordMatches}
            notationPreference={notationPreference}
          />
        </section>
      </div>
    </main>
  );
}

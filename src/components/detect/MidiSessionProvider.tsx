"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { buildPianoKeys, pitchClassToIndex } from "@/lib/piano";
import { useDetectSession } from "@/components/detect/DetectSessionProvider";

type SelectionSource = "manual" | "midi";
type MidiConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "no-device"
  | "unsupported"
  | "error";

type MidiSessionContextValue = {
  midiEnabled: boolean;
  midiToggleDisabled: boolean;
  midiStatusLine: string;
  handleMidiToggle: () => void;
  beginManualSelection: () => void;
};

const PIANO_KEYS = buildPianoKeys(4, 5);
const MIDI_RELEASE_BATCH_WINDOW_MS = 35;

const MIDI_NOTE_TO_KEY_ID = new Map<number, string>(
  PIANO_KEYS.map((key) => [
    (key.octave + 1) * 12 + pitchClassToIndex(key.note),
    `${key.note}${key.octave}`,
  ]),
);

const MidiSessionContext = createContext<MidiSessionContextValue | null>(null);

export function MidiSessionProvider({ children }: { children: ReactNode }) {
  const [selectionSource, setSelectionSource] = useState<SelectionSource>("manual");
  const [midiEnabled, setMidiEnabled] = useState(false);
  const [hasEnabledMidiBefore, setHasEnabledMidiBefore] = useState(false);
  const [hasAttemptedMidiEnable, setHasAttemptedMidiEnable] = useState(false);
  const [midiConnectionState, setMidiConnectionState] = useState<MidiConnectionState>("idle");
  const activeMidiNotesRef = useRef<Set<number>>(new Set<number>());
  const latchedMidiNotesRef = useRef<Set<number>>(new Set<number>());
  const releasedMidiBatchRef = useRef<Set<number>>(new Set<number>());
  const releaseBatchTimerRef = useRef<number | null>(null);
  const selectionSourceRef = useRef<SelectionSource>("manual");
  const { setSelectedKeys } = useDetectSession();

  useEffect(() => {
    selectionSourceRef.current = selectionSource;
  }, [selectionSource]);

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
  }, [setSelectedKeys]);

  const clearMidiTrackingState = useCallback((): void => {
    if (releaseBatchTimerRef.current !== null) {
      window.clearTimeout(releaseBatchTimerRef.current);
      releaseBatchTimerRef.current = null;
    }
    activeMidiNotesRef.current.clear();
    latchedMidiNotesRef.current.clear();
    releasedMidiBatchRef.current.clear();
  }, []);

  const beginManualSelection = useCallback((): void => {
    setSelectionSource("manual");
    clearMidiTrackingState();
  }, [clearMidiTrackingState]);

  useEffect(() => {
    const midiSupported =
      typeof navigator !== "undefined" && typeof navigator.requestMIDIAccess === "function";
    setMidiConnectionState(midiSupported ? "idle" : "unsupported");
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

  function handleMidiToggle(): void {
    setHasAttemptedMidiEnable(true);
    beginManualSelection();
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

  return (
    <MidiSessionContext.Provider
      value={{
        midiEnabled,
        midiToggleDisabled,
        midiStatusLine,
        handleMidiToggle,
        beginManualSelection,
      }}
    >
      {children}
    </MidiSessionContext.Provider>
  );
}

export function useMidiSession() {
  const context = useContext(MidiSessionContext);
  if (!context) {
    throw new Error("useMidiSession must be used within MidiSessionProvider");
  }
  return context;
}

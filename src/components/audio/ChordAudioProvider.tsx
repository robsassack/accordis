"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { parseKeyId } from "@/lib/piano";

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

type ChordAudioContextValue = {
  isChordPlaying: boolean;
  playSelectedKeys: (selectedKeys: string[]) => Promise<void>;
};

const ChordAudioContext = createContext<ChordAudioContextValue | null>(null);

export function ChordAudioProvider({ children }: { children: ReactNode }) {
  const [isChordPlaying, setIsChordPlaying] = useState(false);
  const chordSamplerRef = useRef<import("tone").Sampler | null>(null);
  const chordFilterRef = useRef<import("tone").Filter | null>(null);
  const chordVolumeRef = useRef<import("tone").Volume | null>(null);
  const toneModuleRef = useRef<typeof import("tone") | null>(null);
  const toneModulePromiseRef = useRef<Promise<typeof import("tone")> | null>(null);
  const toneAssetsReadyPromiseRef = useRef<Promise<void> | null>(null);
  const chordPlayingTimerRef = useRef<number | null>(null);

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

  const playSelectedKeys = useCallback(
    async (selectedKeys: string[]): Promise<void> => {
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
    },
    [getToneModule],
  );

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

  return (
    <ChordAudioContext.Provider value={{ isChordPlaying, playSelectedKeys }}>
      {children}
    </ChordAudioContext.Provider>
  );
}

export function useChordAudio() {
  const context = useContext(ChordAudioContext);
  if (!context) {
    throw new Error("useChordAudio must be used within ChordAudioProvider");
  }
  return context;
}

"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { withBasePath } from "@/lib/base-path";

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

type ScaleAudioContextValue = {
  isScalePlaying: boolean;
  playScaleNoteSequence: (noteNames: string[], stepSeconds: number) => Promise<void>;
};

const ScaleAudioContext = createContext<ScaleAudioContextValue | null>(null);

export function ScaleAudioProvider({ children }: { children: ReactNode }) {
  const [isScalePlaying, setIsScalePlaying] = useState(false);
  const scaleSamplerRef = useRef<import("tone").Sampler | null>(null);
  const scaleFilterRef = useRef<import("tone").Filter | null>(null);
  const scaleVolumeRef = useRef<import("tone").Volume | null>(null);
  const toneModuleRef = useRef<typeof import("tone") | null>(null);
  const toneModulePromiseRef = useRef<Promise<typeof import("tone")> | null>(null);
  const toneAssetsReadyPromiseRef = useRef<Promise<void> | null>(null);
  const scalePlayingTimerRef = useRef<number | null>(null);

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

  const playScaleNoteSequence = useCallback(
    async (noteNames: string[], stepSeconds: number): Promise<void> => {
      if (noteNames.length === 0 || stepSeconds <= 0) {
        return;
      }

      const Tone = await getToneModule();
      await Tone.start();

      if (!scaleFilterRef.current) {
        scaleFilterRef.current = new Tone.Filter({
          type: "lowpass",
          frequency: 2600,
          rolloff: -24,
          Q: 0.55,
        });
      }

      if (!scaleVolumeRef.current) {
        scaleVolumeRef.current = new Tone.Volume(-9).toDestination();
      }

      if (scaleFilterRef.current.numberOfOutputs > 0) {
        scaleFilterRef.current.disconnect();
      }
      scaleFilterRef.current.connect(scaleVolumeRef.current);

      if (!scaleSamplerRef.current) {
        scaleSamplerRef.current = new Tone.Sampler({
          urls: UPRIGHT_PIANO_SAMPLE_URLS,
          baseUrl: withBasePath("/samples/upright-piano-kw/"),
          attack: 0.01,
          release: 1.2,
        });
        scaleSamplerRef.current.connect(scaleFilterRef.current);
        toneAssetsReadyPromiseRef.current = Tone.loaded();
      }

      if (toneAssetsReadyPromiseRef.current) {
        await toneAssetsReadyPromiseRef.current;
      }

      const noteDuration = Math.max(stepSeconds * 0.9, 0.14);
      const now = Tone.now();
      if (scalePlayingTimerRef.current !== null) {
        window.clearTimeout(scalePlayingTimerRef.current);
      }

      setIsScalePlaying(true);
      scaleSamplerRef.current.releaseAll(now);
      noteNames.forEach((noteName, index) => {
        scaleSamplerRef.current?.triggerAttackRelease(
          noteName,
          noteDuration,
          now + index * stepSeconds,
          0.56,
        );
      });

      const totalDurationSeconds = noteDuration + (noteNames.length - 1) * stepSeconds;
      scalePlayingTimerRef.current = window.setTimeout(() => {
        setIsScalePlaying(false);
        scalePlayingTimerRef.current = null;
      }, Math.ceil(totalDurationSeconds * 1000) + 40);
    },
    [getToneModule],
  );

  useEffect(() => {
    return () => {
      scaleSamplerRef.current?.dispose();
      scaleSamplerRef.current = null;
      scaleFilterRef.current?.dispose();
      scaleFilterRef.current = null;
      scaleVolumeRef.current?.dispose();
      scaleVolumeRef.current = null;
      if (scalePlayingTimerRef.current !== null) {
        window.clearTimeout(scalePlayingTimerRef.current);
        scalePlayingTimerRef.current = null;
      }
    };
  }, []);

  return (
    <ScaleAudioContext.Provider value={{ isScalePlaying, playScaleNoteSequence }}>
      {children}
    </ScaleAudioContext.Provider>
  );
}

export function useScaleAudio() {
  const context = useContext(ScaleAudioContext);
  if (!context) {
    throw new Error("useScaleAudio must be used within ScaleAudioProvider");
  }
  return context;
}

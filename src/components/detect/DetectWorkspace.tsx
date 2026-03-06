"use client";

import { useCallback, useEffect, useState } from "react";
import { detectChords, detectIntervals } from "@/lib/chord-detect";
import {
  buildPianoKeys,
  parseKeyId,
  pitchClassToIndex,
  uniquePitchClassesFromKeyIds,
  type PitchClass,
} from "@/lib/piano";
import { PianoKeyboard } from "@/components/piano/PianoKeyboard";
import { SelectionBar } from "@/components/piano/SelectionBar";
import { DetectedResults } from "@/components/results/DetectedResults";
import { useChordAudio } from "@/components/audio/ChordAudioProvider";
import { useDetectSession } from "@/components/detect/DetectSessionProvider";
import { useMidiSession } from "@/components/detect/MidiSessionProvider";

const PIANO_KEYS = buildPianoKeys(4, 5);
type PartialBadgeHighlight = {
  badgeId: string;
  missingNote: PitchClass;
  root: PitchClass;
};

export function DetectWorkspace() {
  const [hoveredPartialHighlight, setHoveredPartialHighlight] = useState<PartialBadgeHighlight | null>(
    null,
  );
  const [selectedPartialHighlight, setSelectedPartialHighlight] =
    useState<PartialBadgeHighlight | null>(null);
  const { isChordPlaying, playSelectedKeys } = useChordAudio();
  const { selectedKeys, setSelectedKeys, notationPreference, setNotationPreference } =
    useDetectSession();
  const { midiEnabled, midiToggleDisabled, midiStatusLine, handleMidiToggle, beginManualSelection } =
    useMidiSession();

  useEffect(() => {
    setHoveredPartialHighlight(null);
    setSelectedPartialHighlight(null);
  }, [selectedKeys]);

  function handleKeyClick(keyId: string): void {
    beginManualSelection();
    setSelectedKeys((current) =>
      current.includes(keyId) ? current.filter((key) => key !== keyId) : [...current, keyId],
    );
  }

  function handleDeselectAll(): void {
    beginManualSelection();
    setSelectedKeys([]);
  }

  const handlePlayChord = useCallback(async (): Promise<void> => {
    await playSelectedKeys(selectedKeys);
  }, [playSelectedKeys, selectedKeys]);

  const uniquePitchClasses = uniquePitchClassesFromKeyIds(selectedKeys);
  const intervalMatches = detectIntervals(selectedKeys);
  const chordMatches = detectChords(selectedKeys);
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
    <div id="mode-panel-detect" role="tabpanel" aria-labelledby="mode-tab-detect">
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
    </div>
  );
}

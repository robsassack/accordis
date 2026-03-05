import { useLayoutEffect, useRef, useState } from "react";
import { MIN_UNIQUE_NOTES_FOR_CHORD } from "@/lib/chord-detect";
import type { ChordMatch, IntervalMatch } from "@/lib/chord-types";
import { formatMusicText, type NotationPreference, type PitchClass } from "@/lib/piano";

type DetectedResultsProps = {
  uniquePitchClasses: PitchClass[];
  intervalMatches: IntervalMatch[];
  chordMatches: ChordMatch[];
  notationPreference: NotationPreference;
};

type BadgeWithTooltipProps = {
  id: string;
  label: string;
  explanation: string;
  className: string;
  isOpen: boolean;
  onOpen: (id: string) => void;
  onClose: () => void;
};

function BadgeWithTooltip({
  id,
  label,
  explanation,
  className,
  isOpen,
  onOpen,
  onClose,
}: BadgeWithTooltipProps) {
  const tooltipRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    if (!isOpen) return;

    const viewportPaddingPx = 8;
    const updateTooltipOffset = (): void => {
      const tooltipElement = tooltipRef.current;
      if (!tooltipElement) {
        return;
      }

      const rect = tooltipElement.getBoundingClientRect();
      let offsetPx = 0;
      if (rect.left < viewportPaddingPx) {
        offsetPx = viewportPaddingPx - rect.left;
      } else {
        const maxRight = window.innerWidth - viewportPaddingPx;
        if (rect.right > maxRight) {
          offsetPx = maxRight - rect.right;
        }
      }

      tooltipElement.style.transform = offsetPx === 0 ? "" : `translateX(${offsetPx}px)`;
    };

    updateTooltipOffset();
    window.addEventListener("resize", updateTooltipOffset);

    return () => {
      window.removeEventListener("resize", updateTooltipOffset);
    };
  }, [isOpen]);

  return (
    <span className="relative inline-flex shrink-0">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-describedby={isOpen ? `${id}-tooltip` : undefined}
        className={`${className} whitespace-nowrap`}
        onMouseEnter={() => onOpen(id)}
        onMouseLeave={onClose}
        onFocus={() => onOpen(id)}
        onBlur={onClose}
        onClick={() => onOpen(id)}
      >
        {label}
      </button>
      {isOpen ? (
        <span
          ref={tooltipRef}
          id={`${id}-tooltip`}
          role="tooltip"
          className="absolute right-0 top-full z-20 mt-1 w-52 max-w-[calc(100vw-1rem)] rounded-md border border-slate-300 bg-white px-2 py-1 text-left text-[11px] font-medium leading-snug text-slate-700 shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          {explanation}
        </span>
      ) : null}
    </span>
  );
}

export function DetectedResults({
  uniquePitchClasses,
  intervalMatches,
  chordMatches,
  notationPreference,
}: DetectedResultsProps) {
  const helperMessageClassName = "text-sm text-slate-600 dark:text-slate-400";
  const [openBadgeId, setOpenBadgeId] = useState<string | null>(null);
  const extensionByQuality: Record<ChordMatch["quality"], "Triad" | "7th" | "9th"> = {
    major: "Triad",
    minor: "Triad",
    diminished: "Triad",
    augmented: "Triad",
    suspended2: "Triad",
    suspended4: "Triad",
    majorAdd9: "9th",
    minorAdd9: "9th",
    suspendedDominant7: "7th",
    major6: "7th",
    minor6: "7th",
    dominant7: "7th",
    dominant7Flat5: "7th",
    dominant7Sharp5: "7th",
    major7: "7th",
    minorMajor7: "7th",
    minor7: "7th",
    halfDiminished7: "7th",
    diminished7: "7th",
    dominant9: "9th",
    major9: "9th",
    minor9: "9th",
    major6Add9: "9th",
  };
  const selectedPitchClassSet = new Set(uniquePitchClasses);
  const getOmittedNoteForMatch = (match: ChordMatch): PitchClass | null =>
    match.notes.find((note) => !selectedPitchClassSet.has(note)) ?? null;
  const getFifthNoteForMatch = (match: ChordMatch): PitchClass | null => match.notes[2] ?? null;

  return (
    <div className="mt-6 border-t border-slate-200 pt-6 dark:border-slate-800">
      <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Detected Chords</h2>
      {uniquePitchClasses.length === 0 ? (
        <p className={`mt-3 ${helperMessageClassName}`}>
          Select notes to see interval and chord details.
        </p>
      ) : uniquePitchClasses.length < MIN_UNIQUE_NOTES_FOR_CHORD ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {intervalMatches.map((match, index) => (
            <article
              key={`${match.symbol}-${match.notes.join("-")}`}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50 transition-all duration-300 ease-out starting:translate-y-2 starting:opacity-0"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  {formatMusicText(match.symbol, notationPreference)}
                </p>
                <BadgeWithTooltip
                  id={`interval-${index}-${match.symbol}`}
                  label="Interval"
                  explanation="Detected as an interval because fewer than 3 unique notes are selected."
                  className="rounded-full border border-sky-200 bg-sky-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-sky-800 dark:border-sky-800 dark:bg-sky-900/40 dark:text-sky-200"
                  isOpen={openBadgeId === `interval-${index}-${match.symbol}`}
                  onOpen={setOpenBadgeId}
                  onClose={() => setOpenBadgeId(null)}
                />
              </div>
              <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                {formatMusicText(match.name, notationPreference)}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Notes:{" "}
                {match.notes
                  .map((note) => formatMusicText(note, notationPreference))
                  .join(", ")}
              </p>
            </article>
          ))}
          <p className={`${helperMessageClassName} sm:col-span-2`}>
            Select at least {MIN_UNIQUE_NOTES_FOR_CHORD} unique notes to detect a chord.
          </p>
        </div>
      ) : chordMatches.length === 0 ? (
        <p className={`mt-3 ${helperMessageClassName}`}>No matching triad or seventh chord found yet.</p>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {chordMatches.map((match, index) => (
            <article
              key={`${match.symbol}-${match.slashSymbol ?? "root"}`}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50 transition-all duration-300 ease-out starting:translate-y-2 starting:opacity-0"
            >
              <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-start sm:justify-between">
                <p className="min-w-0 text-base font-semibold text-slate-900 dark:text-slate-100">
                  {formatMusicText(match.slashSymbol ?? match.symbol, notationPreference)}
                </p>
                <div className="-ml-1 -mt-1 mb-1 flex w-full flex-wrap items-center gap-x-1 gap-y-1 sm:ml-0 sm:mt-0 sm:mb-0 sm:w-auto sm:justify-end sm:gap-y-0">
                  <BadgeWithTooltip
                    id={`rank-${index}-${match.symbol}`}
                    label={index === 0 ? "Primary" : "Secondary"}
                    explanation={
                      index === 0
                        ? "Best-ranked interpretation for these selected notes."
                        : "Alternative interpretation that also matches these notes."
                    }
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ${
                      index === 0
                        ? "border border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                        : "border border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    }`}
                    isOpen={openBadgeId === `rank-${index}-${match.symbol}`}
                    onOpen={setOpenBadgeId}
                    onClose={() => setOpenBadgeId(null)}
                  />
                  {match.partialOmission === null ? (
                    <BadgeWithTooltip
                      id={`ext-${index}-${match.symbol}`}
                      label={extensionByQuality[match.quality]}
                      explanation={`This match is grouped as a ${extensionByQuality[
                        match.quality
                      ].toLowerCase()} chord family.`}
                      className="rounded-full border border-sky-200 bg-sky-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-sky-800 dark:border-sky-800 dark:bg-sky-900/40 dark:text-sky-200"
                      isOpen={openBadgeId === `ext-${index}-${match.symbol}`}
                      onOpen={setOpenBadgeId}
                      onClose={() => setOpenBadgeId(null)}
                    />
                  ) : null}
                  {match.symbol.includes("b5") || match.symbol.includes("#5") ? (
                    <BadgeWithTooltip
                      id={`alt-${index}-${match.symbol}`}
                      label="Altered"
                      explanation={`Chord symbol contains an altered fifth (${
                        match.symbol.includes("b5") ? "b5" : "#5"
                      }). Fifth key: ${formatMusicText(
                        getFifthNoteForMatch(match) ?? "unknown",
                        notationPreference,
                      )}.`}
                      className="rounded-full border border-rose-200 bg-rose-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-rose-800 dark:border-rose-800 dark:bg-rose-900/40 dark:text-rose-200"
                      isOpen={openBadgeId === `alt-${index}-${match.symbol}`}
                      onOpen={setOpenBadgeId}
                      onClose={() => setOpenBadgeId(null)}
                    />
                  ) : null}
                  {match.inversionLabel === "Root position" ? (
                    <BadgeWithTooltip
                      id={`inv-${index}-${match.symbol}`}
                      label="Root"
                      explanation={`Lowest selected note (${formatMusicText(
                        match.bass,
                        notationPreference,
                      )}) is the chord root.`}
                      className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      isOpen={openBadgeId === `inv-${index}-${match.symbol}`}
                      onOpen={setOpenBadgeId}
                      onClose={() => setOpenBadgeId(null)}
                    />
                  ) : (
                    <BadgeWithTooltip
                      id={`inv-${index}-${match.symbol}`}
                      label={match.inversionLabel}
                      explanation={`Lowest selected note produces ${match.inversionLabel.toLowerCase()} voicing.`}
                      className="rounded-full border border-violet-200 bg-violet-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-violet-800 dark:border-violet-800 dark:bg-violet-900/40 dark:text-violet-200"
                      isOpen={openBadgeId === `inv-${index}-${match.symbol}`}
                      onOpen={setOpenBadgeId}
                      onClose={() => setOpenBadgeId(null)}
                    />
                  )}
                  {match.partialOmission === null ? null : (
                    <BadgeWithTooltip
                      id={`partial-${index}-${match.symbol}`}
                      label={match.partialOmission === "fifth" ? "Partial: No 5th" : "Partial: No 7th"}
                      explanation={`Match inferred from an omitted ${
                        match.partialOmission === "fifth" ? "fifth" : "seventh"
                      }. Missing note: ${
                        formatMusicText(
                          getOmittedNoteForMatch(match) ?? "unknown",
                          notationPreference,
                        )
                      }.`}
                      className="rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-amber-800 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                      isOpen={openBadgeId === `partial-${index}-${match.symbol}`}
                      onOpen={setOpenBadgeId}
                      onClose={() => setOpenBadgeId(null)}
                    />
                  )}
                </div>
              </div>
              <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                {formatMusicText(match.name, notationPreference)}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Notes:{" "}
                {match.notes
                  .map((note) => formatMusicText(note, notationPreference))
                  .join(", ")}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

import { MIN_UNIQUE_NOTES_FOR_CHORD } from "@/lib/chord-detect";
import type { ChordMatch, IntervalMatch } from "@/lib/chord-types";
import { formatMusicText, type PitchClass } from "@/lib/piano";

type DetectedResultsProps = {
  uniquePitchClasses: PitchClass[];
  intervalMatches: IntervalMatch[];
  chordMatches: ChordMatch[];
};

export function DetectedResults({
  uniquePitchClasses,
  intervalMatches,
  chordMatches,
}: DetectedResultsProps) {
  const helperMessageClassName = "text-sm text-slate-600";

  return (
    <div className="mt-8 border-t border-slate-200 pt-6">
      <h2 className="text-lg font-semibold text-slate-800">Detected Chords</h2>
      {uniquePitchClasses.length === 0 ? (
        <p className={`mt-3 ${helperMessageClassName}`}>
          Select notes to see interval and chord details.
        </p>
      ) : uniquePitchClasses.length < MIN_UNIQUE_NOTES_FOR_CHORD ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {intervalMatches.map((match) => (
            <article
              key={`${match.symbol}-${match.notes.join("-")}`}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4 transition-all duration-300 ease-out starting:translate-y-2 starting:opacity-0"
            >
              <p className="text-base font-semibold text-slate-900">{formatMusicText(match.symbol)}</p>
              <p className="mt-1 text-sm text-slate-700">{formatMusicText(match.name)}</p>
              <p className="mt-1 text-xs text-slate-500">
                Notes: {match.notes.map(formatMusicText).join(", ")}
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
          {chordMatches.map((match) => (
            <article
              key={`${match.symbol}-${match.slashSymbol ?? "root"}`}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4 transition-all duration-300 ease-out starting:translate-y-2 starting:opacity-0"
            >
              <p className="text-base font-semibold text-slate-900">
                {formatMusicText(match.slashSymbol ?? match.symbol)}
              </p>
              <p className="mt-1 text-sm text-slate-700">{formatMusicText(match.name)}</p>
              <p className="mt-1 text-sm text-slate-600">{match.inversionLabel}</p>
              <p className="mt-1 text-xs text-slate-500">
                Notes: {match.notes.map(formatMusicText).join(", ")}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

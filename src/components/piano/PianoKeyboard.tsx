import { useEffect, useMemo, useRef, useState } from "react";
import { formatMusicText, type NotationPreference, type PianoKey } from "@/lib/piano";

type PianoKeyboardProps = {
  keys: PianoKey[];
  selectedKeys: string[];
  primaryMissingKeyId: string | null;
  secondaryMissingKeyId: string | null;
  onKeyClick: (keyId: string) => void;
  notationPreference: NotationPreference;
  blackKeyWidthPercent?: number;
  blackKeyGapReductionPx?: number;
};

export function PianoKeyboard({
  keys,
  selectedKeys,
  primaryMissingKeyId,
  secondaryMissingKeyId,
  onKeyClick,
  notationPreference,
  blackKeyWidthPercent = 4.8,
  blackKeyGapReductionPx = 2.5,
}: PianoKeyboardProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const showScrollHintRef = useRef(true);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);
  const [showScrollHint, setShowScrollHint] = useState(true);
  const selectedKeySet = useMemo(() => new Set(selectedKeys), [selectedKeys]);
  const whiteKeys = useMemo(() => keys.filter((key) => !key.isSharp), [keys]);
  const blackKeys = useMemo(() => {
    const whiteKeyCount = whiteKeys.length;
    const whiteKeyWidth = 100 / whiteKeyCount;
    const positionedBlackKeys: Array<{ key: PianoKey; left: number }> = [];
    let whiteKeysBefore = 0;

    for (const key of keys) {
      if (key.isSharp) {
        const center = whiteKeysBefore * whiteKeyWidth;
        const left = center - blackKeyWidthPercent / 2;
        positionedBlackKeys.push({ key, left });
        continue;
      }

      whiteKeysBefore += 1;
    }

    return positionedBlackKeys;
  }, [blackKeyWidthPercent, keys, whiteKeys.length]);
  const formattedKeyLabels = useMemo(
    () =>
      new Map(
        keys.map((key) => [
          `${key.note}${key.octave}`,
          formatMusicText(`${key.note}${key.octave}`, notationPreference),
        ]),
      ),
    [keys, notationPreference],
  );
  const mobileRightMaskStyle = useMemo(
    () =>
      showRightFade
        ? {
            WebkitMaskImage: "linear-gradient(to right, black 0%, black calc(100% - 24px), transparent 100%)",
            maskImage: "linear-gradient(to right, black 0%, black calc(100% - 24px), transparent 100%)",
          }
        : undefined,
    [showRightFade],
  );

  useEffect(() => {
    showScrollHintRef.current = showScrollHint;
  }, [showScrollHint]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }

    function updateFadeVisibility(): void {
      const currentContainer = scrollContainerRef.current;
      if (!currentContainer) {
        return;
      }

      const maxScrollLeft = currentContainer.scrollWidth - currentContainer.clientWidth;
      const edgeTolerancePx = 2;
      setShowLeftFade(currentContainer.scrollLeft > edgeTolerancePx);
      setShowRightFade(currentContainer.scrollLeft < maxScrollLeft - edgeTolerancePx);

      if (currentContainer.scrollLeft > 8 && showScrollHintRef.current) {
        showScrollHintRef.current = false;
        setShowScrollHint(false);
      }
    }

    updateFadeVisibility();
    container.addEventListener("scroll", updateFadeVisibility, { passive: true });
    window.addEventListener("resize", updateFadeVisibility);

    return () => {
      container.removeEventListener("scroll", updateFadeVisibility);
      window.removeEventListener("resize", updateFadeVisibility);
    };
  }, [keys.length]);

  return (
    <div className="relative pb-2">
      <div className="mb-2 h-4 sm:hidden">
        <p
          className={`text-xs font-medium text-slate-500 transition-opacity dark:text-slate-400 duration-200 ${
            showScrollHint ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden={!showScrollHint}
        >
          Swipe to scroll keys →
        </p>
      </div>
      <div className="relative">
        {showLeftFade ? (
          <div className="pointer-events-none absolute inset-y-0 -left-px z-20 w-5 bg-linear-to-r from-white via-white/70 to-transparent dark:from-slate-900 dark:via-slate-900/70 sm:hidden" />
        ) : null}
        <div
          ref={scrollContainerRef}
          className="overflow-x-auto pb-2 sm:overflow-visible"
          style={mobileRightMaskStyle}
        >
          <div className="relative h-44 w-[200%] min-w-148 select-none sm:mx-auto sm:h-56 sm:w-full sm:min-w-0 sm:max-w-4xl">
          <div className="absolute inset-x-0 bottom-0 flex h-44 sm:h-55">
            {whiteKeys.map((key) => {
              const id = `${key.note}${key.octave}`;
              const isSelected = selectedKeySet.has(id);
              const isPrimaryMissing = primaryMissingKeyId === id;
              const isSecondaryMissing = secondaryMissingKeyId === id;
              const isMissing = isPrimaryMissing || isSecondaryMissing;

              return (
                <button
                  key={id}
                  type="button"
                  data-key-id={id}
                  data-missing={isMissing ? "true" : undefined}
                  data-missing-primary={isPrimaryMissing ? "true" : undefined}
                  data-missing-secondary={isSecondaryMissing ? "true" : undefined}
                  onClick={() => onKeyClick(id)}
                  className={`relative h-full flex-1 rounded-b-md border border-slate-300 pb-3 text-xs font-medium transition dark:border-slate-700 ${
                    isSelected
                      ? "bg-sky-100 text-sky-900 dark:bg-sky-900/50 dark:text-sky-100"
                      : isPrimaryMissing
                        ? "bg-amber-200 text-amber-900 ring-2 ring-inset ring-amber-400 dark:bg-amber-700/50 dark:text-amber-100 dark:ring-amber-500"
                      : isSecondaryMissing
                        ? "bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-700"
                      : "bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  }`}
                  aria-label={`Select ${formattedKeyLabels.get(id)}`}
                >
                  <span className="absolute bottom-3 left-1/2 -translate-x-1/2">
                    {formattedKeyLabels.get(id)}
                  </span>
                </button>
              );
            })}
          </div>

          {blackKeys.map(({ key, left }) => {
            const id = `${key.note}${key.octave}`;
            const isSelected = selectedKeySet.has(id);
            const isPrimaryMissing = primaryMissingKeyId === id;
            const isSecondaryMissing = secondaryMissingKeyId === id;
            const isMissing = isPrimaryMissing || isSecondaryMissing;

            return (
              <button
                key={id}
                type="button"
                data-key-id={id}
                data-missing={isMissing ? "true" : undefined}
                data-missing-primary={isPrimaryMissing ? "true" : undefined}
                data-missing-secondary={isSecondaryMissing ? "true" : undefined}
                onClick={() => onKeyClick(id)}
                className={`absolute z-10 h-28 rounded-b-md border-x border-b border-slate-900 text-[10px] font-medium text-white transition dark:border-slate-950 sm:mt-1 sm:h-35 ${
                  isSelected
                    ? "bg-sky-700 dark:bg-sky-600"
                    : isPrimaryMissing
                      ? "bg-amber-500 text-amber-950 ring-2 ring-amber-300 dark:bg-amber-400 dark:text-amber-950 dark:ring-amber-200"
                    : isSecondaryMissing
                      ? "bg-amber-700 text-amber-100 ring-1 ring-amber-500 dark:bg-amber-800 dark:text-amber-200 dark:ring-amber-600"
                      : "bg-slate-900 hover:bg-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
                }`}
                style={{
                  left: `calc(${left}% - ${blackKeyGapReductionPx}px)`,
                  width: `calc(${blackKeyWidthPercent}% + ${blackKeyGapReductionPx * 2}px)`,
                }}
                aria-label={`Select ${formattedKeyLabels.get(id)}`}
              >
                <span className="mt-20 inline-block sm:mt-24">
                  {formattedKeyLabels.get(id)}
                </span>
              </button>
            );
          })}
          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { formatMusicText, type NotationPreference, type PianoKey } from "@/lib/piano";

type PianoKeyboardProps = {
  keys: PianoKey[];
  selectedKeys: string[];
  onKeyClick: (keyId: string) => void;
  notationPreference: NotationPreference;
  blackKeyWidthPercent?: number;
  blackKeyGapReductionPx?: number;
};

export function PianoKeyboard({
  keys,
  selectedKeys,
  onKeyClick,
  notationPreference,
  blackKeyWidthPercent = 4.8,
  blackKeyGapReductionPx = 2.5,
}: PianoKeyboardProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);
  const [showScrollHint, setShowScrollHint] = useState(true);
  const whiteKeys = keys.filter((key) => !key.isSharp);
  const blackKeys = keys
    .map((key, index) => ({ key, index }))
    .filter(({ key }) => key.isSharp);
  const whiteKeyCount = whiteKeys.length;
  const mobileRightMaskStyle =
    showRightFade
      ? {
          WebkitMaskImage: "linear-gradient(to right, black 0%, black calc(100% - 24px), transparent 100%)",
          maskImage: "linear-gradient(to right, black 0%, black calc(100% - 24px), transparent 100%)",
        }
      : undefined;

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

      if (currentContainer.scrollLeft > 8 && showScrollHint) {
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
  }, [keys.length, showScrollHint]);

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
              const isSelected = selectedKeys.includes(id);

              return (
                <button
                  key={id}
                  type="button"
                  data-key-id={id}
                  onClick={() => onKeyClick(id)}
                  className={`relative h-full flex-1 rounded-b-md border border-slate-300 pb-3 text-xs font-medium transition dark:border-slate-700 ${
                    isSelected
                      ? "bg-sky-100 text-sky-900 dark:bg-sky-900/50 dark:text-sky-100"
                      : "bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  }`}
                  aria-label={`Select ${formatMusicText(id, notationPreference)}`}
                >
                  <span className="absolute bottom-3 left-1/2 -translate-x-1/2">
                    {formatMusicText(id, notationPreference)}
                  </span>
                </button>
              );
            })}
          </div>

          {blackKeys.map(({ key, index }) => {
            const id = `${key.note}${key.octave}`;
            const isSelected = selectedKeys.includes(id);
            const whiteKeysBefore = keys
              .slice(0, index)
              .filter((pianoKey) => !pianoKey.isSharp).length;
            const whiteKeyWidth = 100 / whiteKeyCount;
            const center = whiteKeysBefore * whiteKeyWidth;
            const left = center - blackKeyWidthPercent / 2;

            return (
              <button
                key={id}
                type="button"
                data-key-id={id}
                onClick={() => onKeyClick(id)}
                className={`absolute z-10 h-28 rounded-b-md border-x border-b border-slate-900 text-[10px] font-medium text-white transition dark:border-slate-950 sm:mt-1 sm:h-35 ${
                  isSelected ? "bg-sky-700 dark:bg-sky-600" : "bg-slate-900 hover:bg-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
                }`}
                style={{
                  left: `calc(${left}% - ${blackKeyGapReductionPx}px)`,
                  width: `calc(${blackKeyWidthPercent}% + ${blackKeyGapReductionPx * 2}px)`,
                }}
                aria-label={`Select ${formatMusicText(id, notationPreference)}`}
              >
                <span className="mt-20 inline-block sm:mt-24">
                  {formatMusicText(id, notationPreference)}
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

import { formatMusicText, type PianoKey } from "@/lib/piano";

type PianoKeyboardProps = {
  keys: PianoKey[];
  selectedKeys: string[];
  onKeyClick: (keyId: string) => void;
  blackKeyWidthPercent?: number;
  blackKeyGapReductionPx?: number;
};

export function PianoKeyboard({
  keys,
  selectedKeys,
  onKeyClick,
  blackKeyWidthPercent = 4.8,
  blackKeyGapReductionPx = 2.5,
}: PianoKeyboardProps) {
  const whiteKeys = keys.filter((key) => !key.isSharp);
  const blackKeys = keys
    .map((key, index) => ({ key, index }))
    .filter(({ key }) => key.isSharp);
  const whiteKeyCount = whiteKeys.length;

  return (
    <div className="pb-2">
      <div className="relative mx-auto h-44 w-full max-w-4xl select-none sm:h-56">
        <div className="absolute inset-x-0 bottom-0 flex h-[180px] sm:h-[220px]">
          {whiteKeys.map((key) => {
            const id = `${key.note}${key.octave}`;
            const isSelected = selectedKeys.includes(id);

            return (
              <button
                key={id}
                type="button"
                onClick={() => onKeyClick(id)}
                className={`relative h-full flex-1 rounded-b-md border border-slate-300 pb-3 text-xs font-medium transition ${
                  isSelected
                    ? "bg-sky-100 text-sky-900"
                    : "bg-white text-slate-700 hover:bg-slate-100"
                }`}
                aria-label={`Select ${id}`}
              >
                <span className="absolute bottom-3 left-1/2 -translate-x-1/2">
                  {formatMusicText(id)}
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
              onClick={() => onKeyClick(id)}
              className={`absolute z-10 mt-1 h-[112px] rounded-b-md border-x border-b border-slate-900 text-[10px] font-medium text-white transition sm:h-[140px] ${
                isSelected ? "bg-sky-700" : "bg-slate-900 hover:bg-slate-700"
              }`}
              style={{
                left: `calc(${left}% - ${blackKeyGapReductionPx}px)`,
                width: `calc(${blackKeyWidthPercent}% + ${blackKeyGapReductionPx * 2}px)`,
              }}
              aria-label={`Select ${id}`}
            >
              <span className="mt-24 inline-block">{formatMusicText(id)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

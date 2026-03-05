import { faArrowRotateLeft } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { formatMusicText, type NotationPreference } from "@/lib/piano";

type SelectionBarProps = {
  selectedKeys: string[];
  onClear: () => void;
  notationPreference: NotationPreference;
  onNotationPreferenceChange: (notationPreference: NotationPreference) => void;
};

export function SelectionBar({
  selectedKeys,
  onClear,
  notationPreference,
  onNotationPreferenceChange,
}: SelectionBarProps) {
  const hasSelectedKeys = selectedKeys.length > 0;
  const isSharps = notationPreference === "sharps";

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div className="rounded-full bg-sky-100 px-4 py-2 text-sm font-medium text-sky-800">
        Current:{" "}
        {hasSelectedKeys
          ? selectedKeys.map((key) => formatMusicText(key, notationPreference)).join(", ")
          : "None"}
      </div>
      <div className="flex items-center gap-2">
        <div className="relative inline-flex h-8 rounded-full border border-slate-300 bg-white p-0.5">
          <span
            aria-hidden="true"
            className={`absolute inset-y-0.5 w-[calc(50%-2px)] rounded-full bg-slate-900 shadow-sm transition-transform duration-200 ease-out ${
              isSharps ? "translate-x-0" : "translate-x-full"
            }`}
          />
          <button
            type="button"
            onClick={() => onNotationPreferenceChange("sharps")}
            aria-label="Use sharps notation"
            aria-pressed={isSharps}
            className={`relative z-10 h-full min-w-8 rounded-full px-3 text-xs font-semibold transition-colors duration-200 ${
              isSharps ? "text-white" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            ♯
          </button>
          <button
            type="button"
            onClick={() => onNotationPreferenceChange("flats")}
            aria-label="Use flats notation"
            aria-pressed={!isSharps}
            className={`relative z-10 h-full min-w-8 rounded-full px-3 text-xs font-semibold transition-colors duration-200 ${
              !isSharps ? "text-white" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            ♭
          </button>
        </div>
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear selected keys"
          disabled={!hasSelectedKeys}
          className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold transition-colors duration-200 ${
            hasSelectedKeys
              ? "border-slate-300 text-slate-700 hover:bg-slate-100"
              : "cursor-not-allowed border-slate-200 text-slate-300"
          }`}
        >
          <FontAwesomeIcon icon={faArrowRotateLeft} className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

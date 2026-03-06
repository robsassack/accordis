import { faArrowRotateLeft, faPlay } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { formatMusicText, type NotationPreference } from "@/lib/piano";

type SelectionBarProps = {
  selectedKeys: string[];
  onClear: () => void;
  onPlayChord: () => void;
  isPlayActive: boolean;
  notationPreference: NotationPreference;
  onNotationPreferenceChange: (notationPreference: NotationPreference) => void;
  midiEnabled: boolean;
  midiDisabled: boolean;
  onMidiToggle: () => void;
};

export function SelectionBar({
  selectedKeys,
  onClear,
  onPlayChord,
  isPlayActive,
  notationPreference,
  onNotationPreferenceChange,
  midiEnabled,
  midiDisabled,
  onMidiToggle,
}: SelectionBarProps) {
  const hasSelectedKeys = selectedKeys.length > 0;
  const isSharps = notationPreference === "sharps";
  const toggleNotationPreference = () => {
    onNotationPreferenceChange(isSharps ? "flats" : "sharps");
  };
  const midiButtonLabel = midiEnabled ? "Disable MIDI" : "Enable MIDI";
  const currentSelectionText = hasSelectedKeys
    ? selectedKeys.map((key) => formatMusicText(key, notationPreference)).join(", ")
    : "None";

  return (
    <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="w-full rounded-2xl bg-sky-100 px-4 py-2 text-sm font-medium text-sky-800 dark:bg-sky-950/60 dark:text-sky-200 sm:w-auto sm:rounded-full">
        <span className="block truncate sm:overflow-visible sm:text-clip sm:whitespace-normal">
          Current: {currentSelectionText}
        </span>
      </div>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onMidiToggle}
          aria-label={midiEnabled ? "Disable MIDI input" : "Enable MIDI input"}
          disabled={midiDisabled}
          className={`inline-flex h-8 w-32 shrink-0 items-center justify-center gap-1.5 rounded-full border px-3 text-xs leading-none font-semibold transition-colors duration-200 ${
            midiDisabled
              ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-600"
              : midiEnabled
              ? "border-emerald-300 bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:border-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200 dark:hover:bg-emerald-900/70"
              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="h-3 w-3 fill-current"
          >
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <rect x="4" y="6" width="2.5" height="10" className="fill-white dark:fill-slate-900" />
            <rect x="7.25" y="6" width="2.5" height="10" className="fill-white dark:fill-slate-900" />
            <rect x="10.5" y="6" width="2.5" height="10" className="fill-white dark:fill-slate-900" />
            <rect x="13.75" y="6" width="2.5" height="10" className="fill-white dark:fill-slate-900" />
            <rect x="17" y="6" width="2.5" height="10" className="fill-white dark:fill-slate-900" />
          </svg>
          <span className="whitespace-nowrap">{midiButtonLabel}</span>
        </button>
        <button
          type="button"
          onClick={onPlayChord}
          aria-label="Play selected chord"
          disabled={!hasSelectedKeys}
          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs leading-none font-semibold transition-colors duration-200 ${
            hasSelectedKeys && isPlayActive
              ? "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200"
              : hasSelectedKeys
              ? "border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-600"
          }`}
        >
          <FontAwesomeIcon icon={faPlay} className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={toggleNotationPreference}
          aria-label={`Switch to ${isSharps ? "flats" : "sharps"} notation`}
          className="relative inline-flex h-8 cursor-pointer items-center rounded-full border border-slate-300 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900"
        >
          <span
            aria-hidden="true"
            className={`absolute inset-y-0.5 w-[calc(50%-2px)] rounded-full bg-slate-900 shadow-sm transition-transform duration-200 ease-out dark:bg-slate-100 ${
              isSharps ? "translate-x-0" : "translate-x-full"
            }`}
          />
          <span
            aria-hidden="true"
            className={`relative z-10 inline-flex h-full min-w-8 items-center justify-center rounded-full px-3 text-base leading-none font-semibold transition-colors duration-200 ${
              isSharps ? "text-white dark:text-slate-900" : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            }`}
          >
            ♯
          </span>
          <span
            aria-hidden="true"
            className={`relative z-10 inline-flex h-full min-w-8 items-center justify-center rounded-full px-3 text-base leading-none font-semibold transition-colors duration-200 ${
              !isSharps ? "text-white dark:text-slate-900" : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            }`}
          >
            ♭
          </span>
        </button>
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear selected keys"
          disabled={!hasSelectedKeys}
          className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold transition-colors duration-200 ${
            hasSelectedKeys
              ? "border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              : "cursor-not-allowed border-slate-200 text-slate-300 dark:border-slate-800 dark:text-slate-600"
          }`}
        >
          <FontAwesomeIcon icon={faArrowRotateLeft} className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

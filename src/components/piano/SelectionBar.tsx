import { faArrowRotateLeft } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { formatMusicText } from "@/lib/piano";

type SelectionBarProps = {
  selectedKeys: string[];
  onClear: () => void;
};

export function SelectionBar({ selectedKeys, onClear }: SelectionBarProps) {
  const hasSelectedKeys = selectedKeys.length > 0;

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div className="rounded-full bg-sky-100 px-4 py-2 text-sm font-medium text-sky-800">
        Current: {hasSelectedKeys ? selectedKeys.map(formatMusicText).join(", ") : "None"}
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
  );
}

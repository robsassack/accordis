import Link from "next/link";

type ModeSwitcherProps = {
  activeMode: "detect" | "library";
  libraryHref?: "/library/scales" | "/library/chords";
};

export function ModeSwitcher({ activeMode, libraryHref = "/library/scales" }: ModeSwitcherProps) {
  return (
    <div
      role="tablist"
      aria-label="Workspace mode"
      className="relative inline-grid grid-cols-2 rounded-full border border-slate-300 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800"
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-white shadow-sm transition-transform duration-200 ease-out dark:bg-slate-100 ${
          activeMode === "detect" ? "translate-x-0" : "translate-x-full"
        }`}
      />
      <Link
        href="/detect"
        role="tab"
        id="mode-tab-detect"
        aria-selected={activeMode === "detect"}
        aria-controls="mode-panel-detect"
        className={`relative z-10 rounded-full px-4 py-1.5 text-center text-sm font-semibold transition-colors ${
          activeMode === "detect"
            ? "text-slate-900 dark:text-slate-900"
            : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
        }`}
      >
        Detect
      </Link>
      <Link
        href={libraryHref}
        role="tab"
        id="mode-tab-library"
        aria-selected={activeMode === "library"}
        aria-controls="mode-panel-library"
        className={`relative z-10 rounded-full px-4 py-1.5 text-center text-sm font-semibold transition-colors ${
          activeMode === "library"
            ? "text-slate-900 dark:text-slate-900"
            : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
        }`}
      >
        Library
      </Link>
    </div>
  );
}

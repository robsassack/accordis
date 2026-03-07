import Link from "next/link";
import { ChordLibraryWorkspace } from "@/components/library/ChordLibraryWorkspace";
import { ScaleLibraryWorkspace } from "@/components/library/ScaleLibraryWorkspace";

type LibraryContentProps = {
  activeSection: "scales" | "chords";
};

export function LibraryContent({ activeSection }: LibraryContentProps) {
  return (
    <div id="mode-panel-library" role="tabpanel" aria-labelledby="mode-tab-library">
      <nav className="mb-4 flex gap-2" aria-label="Library section">
        <Link
          href="/library/scales"
          className={`rounded-full border px-3 py-1 text-sm font-semibold transition-colors ${
            activeSection === "scales"
              ? "border-sky-300 bg-sky-100 text-sky-800 dark:border-sky-700 dark:bg-sky-900/40 dark:text-sky-200"
              : "border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          Scales
        </Link>
        <Link
          href="/library/chords"
          className={`rounded-full border px-3 py-1 text-sm font-semibold transition-colors ${
            activeSection === "chords"
              ? "border-sky-300 bg-sky-100 text-sky-800 dark:border-sky-700 dark:bg-sky-900/40 dark:text-sky-200"
              : "border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          Chords
        </Link>
      </nav>

      {activeSection === "scales" ? <ScaleLibraryWorkspace /> : <ChordLibraryWorkspace />}
    </div>
  );
}

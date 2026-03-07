import { LibraryContent } from "@/components/library/LibraryContent";
import {
  buildChordLibraryPath,
  CHORD_DEFINITIONS,
  CHORD_ROOT_PITCH_CLASSES,
} from "@/lib/chords";

export function generateStaticParams(): Array<{ root: string; chord: string }> {
  return CHORD_ROOT_PITCH_CLASSES.flatMap((root) =>
    CHORD_DEFINITIONS.map((definition) => {
      const [, , , rootSegment, chordSegment] = buildChordLibraryPath(root, definition.id).split("/");
      return { root: rootSegment, chord: chordSegment };
    }),
  );
}

export default function LibraryChordDetailPage() {
  return <LibraryContent activeSection="chords" />;
}

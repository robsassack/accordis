import { LibraryContent } from "@/components/library/LibraryContent";
import {
  buildScaleLibraryPath,
  SCALE_DEFINITIONS,
  SCALE_ROOT_PITCH_CLASSES,
} from "@/lib/scales";

export function generateStaticParams(): Array<{ root: string; scale: string }> {
  return SCALE_ROOT_PITCH_CLASSES.flatMap((root) =>
    SCALE_DEFINITIONS.map((definition) => {
      const [, , , rootSegment, scaleSegment] = buildScaleLibraryPath(root, definition.id).split("/");
      return { root: rootSegment, scale: scaleSegment };
    }),
  );
}

export default function LibraryScaleDetailPage() {
  return <LibraryContent activeSection="scales" />;
}

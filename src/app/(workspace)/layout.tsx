"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ChordAudioProvider } from "@/components/audio/ChordAudioProvider";
import { DetectSessionProvider } from "@/components/detect/DetectSessionProvider";
import { MidiSessionProvider } from "@/components/detect/MidiSessionProvider";
import { AppShell } from "@/components/layout/AppShell";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const activeMode = pathname.startsWith("/library") ? "library" : "detect";
  const [lastLibraryHref, setLastLibraryHref] = useState<"/library/scales" | "/library/chords">(
    "/library/scales",
  );

  useEffect(() => {
    if (pathname.startsWith("/library/chords")) {
      setLastLibraryHref("/library/chords");
      return;
    }

    if (pathname.startsWith("/library/scales")) {
      setLastLibraryHref("/library/scales");
    }
  }, [pathname]);

  return (
    <ChordAudioProvider>
      <DetectSessionProvider>
        <MidiSessionProvider>
          <AppShell activeMode={activeMode} libraryHref={lastLibraryHref}>
            {children}
          </AppShell>
        </MidiSessionProvider>
      </DetectSessionProvider>
    </ChordAudioProvider>
  );
}

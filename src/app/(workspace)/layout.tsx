"use client";

import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ChordAudioProvider } from "@/components/audio/ChordAudioProvider";
import { ScaleAudioProvider } from "@/components/audio/ScaleAudioProvider";
import { DetectSessionProvider } from "@/components/detect/DetectSessionProvider";
import { MidiSessionProvider } from "@/components/detect/MidiSessionProvider";
import { AppShell } from "@/components/layout/AppShell";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const activeMode = pathname.startsWith("/library") ? "library" : "detect";
  const [lastLibraryHref, setLastLibraryHref] = useState("/library/scales");

  if (pathname.startsWith("/library/") && lastLibraryHref !== pathname) {
    setLastLibraryHref(pathname);
  }

  return (
    <ChordAudioProvider>
      <ScaleAudioProvider>
        <DetectSessionProvider>
          <MidiSessionProvider>
            <AppShell activeMode={activeMode} libraryHref={lastLibraryHref}>
              {children}
            </AppShell>
          </MidiSessionProvider>
        </DetectSessionProvider>
      </ScaleAudioProvider>
    </ChordAudioProvider>
  );
}

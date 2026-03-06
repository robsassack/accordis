import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WorkspaceLayout from "@/app/(workspace)/layout";
import { DetectWorkspace } from "@/components/detect/DetectWorkspace";
import { LibraryContent } from "@/components/library/LibraryContent";

const pathnameState = vi.hoisted(() => ({ current: "/detect" }));

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => pathnameState.current),
}));

function WorkspaceHarness() {
  if (pathnameState.current.startsWith("/library/chords")) {
    return (
      <WorkspaceLayout>
        <LibraryContent activeSection="chords" />
      </WorkspaceLayout>
    );
  }

  if (pathnameState.current.startsWith("/library")) {
    return (
      <WorkspaceLayout>
        <LibraryContent activeSection="scales" />
      </WorkspaceLayout>
    );
  }

  return (
    <WorkspaceLayout>
      <DetectWorkspace />
    </WorkspaceLayout>
  );
}

describe("Workspace routing persistence", () => {
  const originalRequestMIDIAccess = navigator.requestMIDIAccess;

  beforeEach(() => {
    pathnameState.current = "/detect";
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    if (originalRequestMIDIAccess) {
      navigator.requestMIDIAccess = originalRequestMIDIAccess;
    } else {
      delete (navigator as { requestMIDIAccess?: Navigator["requestMIDIAccess"] }).requestMIDIAccess;
    }
  });

  it("remembers the last library subsection in the mode switcher link", () => {
    pathnameState.current = "/library/chords";
    const { rerender } = render(<WorkspaceHarness />);

    pathnameState.current = "/detect";
    rerender(<WorkspaceHarness />);

    expect(screen.getByRole("tab", { name: "Library" })).toHaveAttribute("href", "/library/chords");
  });

  it("preserves selected keys when switching between detect and library routes", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<WorkspaceHarness />);

    await user.click(screen.getByRole("button", { name: "Select C4" }));
    await user.click(screen.getByRole("button", { name: "Select E4" }));
    expect(screen.getByText("Current: C4, E4")).toBeInTheDocument();

    pathnameState.current = "/library/scales";
    rerender(<WorkspaceHarness />);
    expect(screen.getByText("Scale library UI coming next.")).toBeInTheDocument();

    pathnameState.current = "/detect";
    rerender(<WorkspaceHarness />);
    expect(screen.getByText("Current: C4, E4")).toBeInTheDocument();
  });

  it("keeps MIDI enabled when navigating away from and back to detect", async () => {
    const user = userEvent.setup();
    const fakeMidiAccess = {
      inputs: new Map<string, MIDIInput>(),
      onstatechange: null,
    } as unknown as MIDIAccess;
    navigator.requestMIDIAccess = vi.fn().mockResolvedValue(fakeMidiAccess);

    const { rerender } = render(<WorkspaceHarness />);

    await user.click(screen.getByRole("button", { name: "Enable MIDI input" }));
    await screen.findByText("MIDI: no device detected • Input source: On-screen keys");
    expect(screen.getByRole("button", { name: "Disable MIDI input" })).toBeInTheDocument();

    pathnameState.current = "/library/scales";
    rerender(<WorkspaceHarness />);

    pathnameState.current = "/detect";
    rerender(<WorkspaceHarness />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Disable MIDI input" })).toBeInTheDocument();
    });
    expect(screen.getByText("MIDI: no device detected • Input source: On-screen keys")).toBeInTheDocument();
  });
});

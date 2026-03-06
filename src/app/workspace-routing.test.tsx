import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WorkspaceLayout from "@/app/(workspace)/layout";
import { DetectWorkspace } from "@/components/detect/DetectWorkspace";
import { LibraryContent } from "@/components/library/LibraryContent";
import { resetScaleLibrarySessionCacheForTests } from "@/components/library/ScaleLibraryWorkspace";

const pathnameState = vi.hoisted(() => ({ current: "/detect" }));
const replaceState = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => pathnameState.current),
  useRouter: vi.fn(() => ({ replace: replaceState.replace })),
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
    replaceState.replace.mockReset();
    localStorage.clear();
    resetScaleLibrarySessionCacheForTests();
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
    expect(screen.getByRole("searchbox", { name: "Search scales" })).toBeInTheDocument();

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

  it("preserves selected scale settings when switching between library and detect routes", async () => {
    const user = userEvent.setup();
    pathnameState.current = "/library/scales";
    const { rerender } = render(<WorkspaceHarness />);

    await user.click(screen.getByRole("button", { name: /Toggle root accidental display/ }));
    await user.click(screen.getByRole("button", { name: "Select root D♭" }));
    await user.click(screen.getByRole("option", { name: "Select D♭ Major scale" }));

    await user.selectOptions(screen.getByRole("combobox", { name: "Scale playback direction" }), "descending");
    const tempoSlider = screen.getByRole("slider", { name: "Scale playback tempo" });
    fireEvent.change(tempoSlider, { target: { value: "120" } });

    expect(screen.getByRole("heading", { name: "D♭ Major" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Scale playback direction" })).toHaveValue("descending");
    expect(screen.getByRole("slider", { name: "Scale playback tempo" })).toHaveValue("120");

    pathnameState.current = "/detect";
    rerender(<WorkspaceHarness />);

    pathnameState.current = "/library/scales";
    rerender(<WorkspaceHarness />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "D♭ Major" })).toBeInTheDocument();
    });
    expect(screen.getByRole("combobox", { name: "Scale playback direction" })).toHaveValue("descending");
    expect(screen.getByRole("slider", { name: "Scale playback tempo" })).toHaveValue("120");
  });

  it("loads a scale directly from a per-scale path", async () => {
    pathnameState.current = "/library/scales/d-sharp/mixolydian";
    render(<WorkspaceHarness />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "D♯ Mixolydian" })).toBeInTheDocument();
    });
  });

  it("keeps the scale list scroll position after selecting a scale route", async () => {
    const user = userEvent.setup();
    pathnameState.current = "/library/scales";
    const { rerender } = render(<WorkspaceHarness />);

    const listboxBeforeSelection = screen.getByRole("listbox", { name: /scale options/i });
    listboxBeforeSelection.scrollTop = 420;
    fireEvent.scroll(listboxBeforeSelection);

    await user.click(screen.getByRole("option", { name: "Select C Diminished (Whole-Half) scale" }));
    expect(replaceState.replace).toHaveBeenCalledWith("/library/scales/c/diminishedWholeHalf", {
      scroll: false,
    });

    pathnameState.current = "/library/scales/c/diminishedWholeHalf";
    rerender(<WorkspaceHarness />);

    const listboxAfterNavigation = screen.getByRole("listbox", { name: /scale options/i });
    expect(listboxAfterNavigation.scrollTop).toBe(420);
  });

  it("canonicalizes invalid per-scale paths back to the selected scale path", async () => {
    pathnameState.current = "/library/scales/invalid-root/major";
    render(<WorkspaceHarness />);

    await waitFor(() => {
      expect(replaceState.replace).toHaveBeenCalledWith("/library/scales/c/major", {
        scroll: false,
      });
    });
  });
});

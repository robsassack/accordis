import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ChordLibraryWorkspace,
  resetChordLibrarySessionCacheForTests,
} from "@/components/library/ChordLibraryWorkspace";

const replaceState = vi.hoisted(() => ({ replace: vi.fn() }));
const pathnameState = vi.hoisted(() => ({ current: "/library/chords" }));
const chordAudioState = vi.hoisted(() => ({
  isChordPlaying: false,
  playSelectedKeys: vi.fn(async () => undefined),
}));

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => pathnameState.current),
  useRouter: vi.fn(() => ({ replace: replaceState.replace })),
}));

vi.mock("@/components/audio/ChordAudioProvider", () => ({
  useChordAudio: () => chordAudioState,
}));

function renderChordWorkspace() {
  return render(<ChordLibraryWorkspace />);
}

describe("ChordLibraryWorkspace", () => {
  beforeEach(() => {
    pathnameState.current = "/library/chords";
    localStorage.clear();
    replaceState.replace.mockReset();
    chordAudioState.isChordPlaying = false;
    chordAudioState.playSelectedKeys.mockReset();
    resetChordLibrarySessionCacheForTests();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows a default selected chord with notes and formula details", async () => {
    renderChordWorkspace();

    expect(await screen.findByRole("heading", { name: "C Major" })).toBeInTheDocument();
    expect(screen.getByText("Symbol: C")).toBeInTheDocument();
    expect(screen.getByText("Notes: C, E, G")).toBeInTheDocument();
    expect(screen.getByText("Voicing: C4, E4, G4")).toBeInTheDocument();
    expect(screen.getByText(/Formula:/)).toBeInTheDocument();
    expect(screen.getByText(/Semitones:/)).toBeInTheDocument();
  });

  it("updates notation, root, and chord quality selections", async () => {
    const user = userEvent.setup();
    renderChordWorkspace();
    await screen.findByRole("heading", { name: "C Major" });

    await user.click(screen.getByRole("button", { name: /Toggle root accidental display/ }));
    await user.click(screen.getByRole("button", { name: "Select root D♭" }));
    await user.click(screen.getByRole("option", { name: "Select D♭ Minor chord" }));

    expect(screen.getByRole("heading", { name: "D♭ Minor" })).toBeInTheDocument();
    expect(screen.getByText("Notes: D♭, E, A♭")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Toggle root accidental display/ }));

    expect(screen.getByRole("heading", { name: "C♯ Minor" })).toBeInTheDocument();
    expect(screen.getByText("Notes: C♯, E, G♯")).toBeInTheDocument();
  });

  it("shows grouped chord headers with selectable chords under each group", async () => {
    renderChordWorkspace();

    await screen.findByRole("heading", { name: "C Major" });

    expect(screen.getByText("Triads")).toBeInTheDocument();
    expect(screen.getByText("Seventh Family")).toBeInTheDocument();
    expect(screen.getByText("Ninth & Extended")).toBeInTheDocument();

    expect(screen.queryByRole("option", { name: "Triads" })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Select C Major chord" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Select C Dominant 7 chord" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Select C Major 9 chord" })).toBeInTheDocument();
  });

  it("filters the chord list by search text", async () => {
    const user = userEvent.setup();
    renderChordWorkspace();
    await screen.findByRole("heading", { name: "C Major" });

    await user.type(screen.getByRole("searchbox", { name: "Search chords" }), "maj9");

    expect(screen.getByRole("option", { name: "Select C Major 9 chord" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Select C Minor chord" })).not.toBeInTheDocument();
  });

  it("updates the route when selecting a chord from the list", async () => {
    const user = userEvent.setup();
    renderChordWorkspace();
    await screen.findByRole("heading", { name: "C Major" });

    await user.click(screen.getByRole("option", { name: "Select C Major 7 chord" }));

    expect(replaceState.replace).toHaveBeenCalledWith("/library/chords/c/major7", { scroll: false });
  });

  it("supports separate inversion and octave controls for voicing", async () => {
    const user = userEvent.setup();
    renderChordWorkspace();
    await screen.findByRole("heading", { name: "C Major" });

    expect(screen.getByText("Voicing: C4, E4, G4")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Select next inversion" }));
    expect(screen.getByText("Voicing: E4, G4, C5")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Shift chord down one octave" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Shift chord up one octave" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Shift chord up one octave" }));
    expect(screen.getByText("Voicing: E4, G4, C5")).toBeInTheDocument();
  });

  it("updates shift to match the octave of a clicked keyboard key", async () => {
    const user = userEvent.setup();
    renderChordWorkspace();
    await screen.findByRole("heading", { name: "C Major" });

    expect(screen.getByText("Voicing: C4, E4, G4")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Select C5" }));

    expect(screen.getByText("Voicing: C5, E5, G5")).toBeInTheDocument();
  });

  it("applies clicked key root/shift immediately even before pathname updates", async () => {
    const user = userEvent.setup();
    pathnameState.current = "/library/chords/c/major";
    renderChordWorkspace();
    await screen.findByRole("heading", { name: "C Major" });

    await user.click(screen.getByRole("button", { name: "Select C5" }));
    expect(screen.getByText("Voicing: C5, E5, G5")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Select B4" }));
    expect(screen.getByRole("heading", { name: "B Major" })).toBeInTheDocument();
    expect(screen.getByText("Voicing: B4, D♯5, F♯5")).toBeInTheDocument();
    expect(replaceState.replace).toHaveBeenLastCalledWith("/library/chords/b/major", {
      scroll: false,
    });
  });

  it("shows C6add9 root voicing with the 9th above the octave", async () => {
    const user = userEvent.setup();
    renderChordWorkspace();
    await screen.findByRole("heading", { name: "C Major" });

    await user.click(screen.getByRole("option", { name: "Select C 6th Add 9 chord" }));

    expect(screen.getByText("Voicing: C4, E4, G4, A4, D5")).toBeInTheDocument();
  });

  it("restores saved shift and inversion settings from the chord library session", async () => {
    localStorage.setItem(
      "accordis-chord-library-session",
      JSON.stringify({
        selectedRoot: "C",
        selectedChordId: "major",
        rootNotationPreference: "sharps",
        playbackOctave: 5,
        inversionIndex: 2,
      }),
    );

    renderChordWorkspace();

    expect(await screen.findByRole("heading", { name: "C Major" })).toBeInTheDocument();
    expect(screen.getByText("2nd inversion")).toBeInTheDocument();
    expect(screen.getByText("Voicing: G4, C5, E5")).toBeInTheDocument();
  });

  it("persists updated shift and inversion settings after user interaction", async () => {
    const user = userEvent.setup();
    renderChordWorkspace();
    await screen.findByRole("heading", { name: "C Major" });

    await user.click(screen.getByRole("button", { name: "Shift chord up one octave" }));
    await user.click(screen.getByRole("button", { name: "Select next inversion" }));

    const savedSessionJson = localStorage.getItem("accordis-chord-library-session");
    expect(savedSessionJson).not.toBeNull();
    const savedSession = JSON.parse(savedSessionJson ?? "{}");

    expect(savedSession.inversionIndex).toBe(1);
    expect(savedSession.playbackOctave).toBe(5);
  });

  it("uses the current shifted/inverted voicing when playing the selected chord", async () => {
    const user = userEvent.setup();
    renderChordWorkspace();
    await screen.findByRole("heading", { name: "C Major" });

    await user.click(screen.getByRole("button", { name: "Select next inversion" }));
    await user.click(screen.getByRole("button", { name: "Shift chord up one octave" }));
    await user.click(screen.getByRole("button", { name: "Play selected chord" }));

    expect(chordAudioState.playSelectedKeys).toHaveBeenCalledWith(["E4", "G4", "C5"]);
  });

  it("supports chord symbol search across sharps and flats", async () => {
    const user = userEvent.setup();
    renderChordWorkspace();
    await screen.findByRole("heading", { name: "C Major" });

    const searchInput = screen.getByRole("searchbox", { name: "Search chords" });

    await user.type(searchInput, "c6add9");
    expect(screen.getByRole("option", { name: "Select C 6th Add 9 chord" })).toBeInTheDocument();

    await user.clear(searchInput);
    await user.click(screen.getByRole("button", { name: /Toggle root accidental display/ }));
    await user.click(screen.getByRole("button", { name: "Select root D♭" }));
    await user.type(searchInput, "dbmaj9");

    expect(screen.getByRole("option", { name: "Select D♭ Major 9 chord" })).toBeInTheDocument();
  });
});

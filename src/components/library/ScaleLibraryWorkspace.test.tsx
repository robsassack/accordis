import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScaleAudioProvider } from "@/components/audio/ScaleAudioProvider";
import {
  ScaleLibraryWorkspace,
  resetScaleLibrarySessionCacheForTests,
} from "@/components/library/ScaleLibraryWorkspace";

const toneMockState = vi.hoisted(() => {
  const samplerInstances: Array<{
    connect: ReturnType<typeof vi.fn>;
    releaseAll: ReturnType<typeof vi.fn>;
    triggerAttackRelease: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
  }> = [];
  const filterInstances: Array<{
    numberOfOutputs: number;
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
  }> = [];
  const volumeInstances: Array<{
    connect: ReturnType<typeof vi.fn>;
    toDestination: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
  }> = [];

  class MockSampler {
    connect = vi.fn();
    releaseAll = vi.fn();
    triggerAttackRelease = vi.fn();
    dispose = vi.fn();

    constructor() {
      samplerInstances.push(this);
    }
  }

  class MockFilter {
    numberOfOutputs = 1;
    connect = vi.fn();
    disconnect = vi.fn();
    dispose = vi.fn();

    constructor() {
      filterInstances.push(this);
    }
  }

  class MockVolume {
    connect = vi.fn();
    toDestination = vi.fn(() => this);
    dispose = vi.fn();

    constructor() {
      volumeInstances.push(this);
    }
  }

  const start = vi.fn(async () => undefined);
  const loaded = vi.fn(async () => undefined);
  const now = vi.fn(() => 0);

  return {
    samplerInstances,
    filterInstances,
    volumeInstances,
    start,
    loaded,
    now,
    module: {
      Sampler: MockSampler,
      Filter: MockFilter,
      Volume: MockVolume,
      start,
      loaded,
      now,
    },
  };
});

vi.mock("tone", () => toneMockState.module);

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/library/scales"),
  useRouter: vi.fn(() => ({ replace: vi.fn() })),
}));

function renderScaleWorkspace() {
  return render(
    <ScaleAudioProvider>
      <ScaleLibraryWorkspace />
    </ScaleAudioProvider>,
  );
}

describe("ScaleLibraryWorkspace", () => {
  beforeEach(() => {
    localStorage.clear();
    resetScaleLibrarySessionCacheForTests();
    toneMockState.samplerInstances.length = 0;
    toneMockState.filterInstances.length = 0;
    toneMockState.volumeInstances.length = 0;
    toneMockState.start.mockClear();
    toneMockState.loaded.mockClear();
    toneMockState.now.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows a default selected scale with notes and formula details", async () => {
    renderScaleWorkspace();

    expect(await screen.findByRole("heading", { name: "C Major" })).toBeInTheDocument();
    expect(screen.getByText("Notes: C, D, E, F, G, A, B")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Scale notation" })).toBeInTheDocument();
    expect(screen.getByText(/Formula:/)).toBeInTheDocument();
    expect(screen.getByText(/Semitones:/)).toBeInTheDocument();
  });

  it("auto-switches accidentals to match the selected scale context", async () => {
    const user = userEvent.setup();
    renderScaleWorkspace();
    await screen.findByRole("heading", { name: "C Major" });

    await user.click(screen.getByRole("button", { name: "Select root D" }));
    await user.click(screen.getByRole("option", { name: "Select D Natural Minor scale" }));

    expect(screen.getByRole("heading", { name: "D Natural Minor" })).toBeInTheDocument();
    expect(screen.getByText("Notes: D, E, F, G, A, A♯, C")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Toggle root accidental display/ }));
    await user.click(screen.getByRole("button", { name: "Select root D♭" }));
    await user.click(screen.getByRole("option", { name: "Select D♭ Major scale" }));

    expect(screen.getByRole("heading", { name: "D♭ Major" })).toBeInTheDocument();
    expect(screen.getByText("Notes: D♭, E♭, F, G♭, A♭, B♭, C")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Toggle root accidental display/ }));

    expect(screen.getByRole("heading", { name: "C♯ Major" })).toBeInTheDocument();
    expect(screen.getByText("Notes: C♯, D♯, F, F♯, G♯, A♯, C")).toBeInTheDocument();
  });

  it("plays the selected scale in sequence using the tone sampler", async () => {
    const user = userEvent.setup();
    renderScaleWorkspace();
    await screen.findByRole("heading", { name: "C Major" });
    const playButton = screen.getByRole("button", { name: "Play selected scale" });

    expect(playButton).toBeEnabled();
    await user.click(playButton);

    await waitFor(() => {
      expect(toneMockState.start).toHaveBeenCalledTimes(1);
    });
    expect(playButton).toBeDisabled();

    expect(toneMockState.samplerInstances.length).toBe(1);
    const samplerInstance = toneMockState.samplerInstances[0];
    expect(samplerInstance.triggerAttackRelease).toHaveBeenCalled();
    expect(samplerInstance.triggerAttackRelease.mock.calls[0]?.[0]).toBe("C4");
    expect(samplerInstance.triggerAttackRelease.mock.calls.length).toBeGreaterThan(8);
  });

  it("shows grouped scale headers with selectable scales under each group", async () => {
    renderScaleWorkspace();

    await screen.findByRole("heading", { name: "C Major" });

    expect(screen.getByText("Diatonic")).toBeInTheDocument();
    expect(screen.getByText("Minor Variants")).toBeInTheDocument();
    expect(screen.getByText("Pentatonic")).toBeInTheDocument();
    expect(screen.getByText("Modes")).toBeInTheDocument();

    expect(screen.queryByRole("option", { name: "Diatonic" })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Select C Major scale" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Select C Harmonic Minor scale" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Select C Minor Blues scale" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Select C Locrian scale" })).toBeInTheDocument();
  });

  it("supports shifting controls and uses the selected octave when playing", async () => {
    const user = userEvent.setup();
    renderScaleWorkspace();
    await screen.findByRole("heading", { name: "C Major" });

    const upOctaveButton = screen.getByRole("button", { name: "+8va" });
    const trebleButton = screen.getByRole("button", { name: "Treble" });
    const bassButton = screen.getByRole("button", { name: "Bass" });
    const lowerOctaveButton = screen.getByRole("button", { name: "-8vb" });

    expect(upOctaveButton).toHaveAttribute("aria-pressed", "false");
    expect(trebleButton).toHaveAttribute("aria-pressed", "true");
    expect(bassButton).toHaveAttribute("aria-pressed", "false");
    expect(lowerOctaveButton).toHaveAttribute("aria-pressed", "false");

    await user.click(upOctaveButton);
    expect(upOctaveButton).toHaveAttribute("aria-pressed", "true");
    expect(trebleButton).toHaveAttribute("aria-pressed", "false");

    await user.click(screen.getByRole("button", { name: "Play selected scale" }));

    await waitFor(() => {
      expect(toneMockState.start).toHaveBeenCalledTimes(1);
    });
    expect(toneMockState.samplerInstances[0]?.triggerAttackRelease.mock.calls[0]?.[0]).toBe("C5");
  });

  it("plays scales in bass register when bass mode is selected", async () => {
    const user = userEvent.setup();
    renderScaleWorkspace();
    await screen.findByRole("heading", { name: "C Major" });

    await user.click(screen.getByRole("button", { name: "Bass" }));
    await user.click(screen.getByRole("button", { name: "Play selected scale" }));

    await waitFor(() => {
      expect(toneMockState.start).toHaveBeenCalledTimes(1);
    });
    expect(toneMockState.samplerInstances[0]?.triggerAttackRelease.mock.calls[0]?.[0]).toBe("C3");
  });
});

import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  const Time = vi.fn(() => ({ toSeconds: () => 1 }));

  return {
    samplerInstances,
    filterInstances,
    volumeInstances,
    start,
    loaded,
    now,
    Time,
    module: {
      Sampler: MockSampler,
      Filter: MockFilter,
      Volume: MockVolume,
      start,
      loaded,
      now,
      Time,
    },
  };
});

vi.mock("tone", () => toneMockState.module);

const pathnameState = vi.hoisted(() => ({ current: "/detect" }));

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => pathnameState.current),
}));

import WorkspaceLayout from "@/app/(workspace)/layout";
import { DetectWorkspace } from "@/components/detect/DetectWorkspace";

function renderDetectRoute() {
  return render(
    <WorkspaceLayout>
      <DetectWorkspace />
    </WorkspaceLayout>,
  );
}

describe("Detect workspace route", () => {
  const originalRequestMIDIAccess = navigator.requestMIDIAccess;
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    cleanup();
    document.documentElement.classList.remove("dark");
    document.documentElement.style.colorScheme = "";
    document.head
      .querySelectorAll('link[data-test-favicon="true"]')
      .forEach((link) => {
        link.remove();
      });
    if (originalMatchMedia) {
      window.matchMedia = originalMatchMedia;
    } else {
      const testWindow = window as unknown as { matchMedia?: Window["matchMedia"] };
      delete testWindow.matchMedia;
    }
    if (originalRequestMIDIAccess) {
      navigator.requestMIDIAccess = originalRequestMIDIAccess;
    } else {
      delete (navigator as { requestMIDIAccess?: Navigator["requestMIDIAccess"] }).requestMIDIAccess;
    }
  });

  beforeEach(() => {
    pathnameState.current = "/detect";
    localStorage.clear();
    toneMockState.samplerInstances.length = 0;
    toneMockState.filterInstances.length = 0;
    toneMockState.volumeInstances.length = 0;
    toneMockState.start.mockClear();
    toneMockState.loaded.mockClear();
    toneMockState.now.mockClear();
    toneMockState.Time.mockClear();
  });

  it("shows detected chord info as keys are selected and clears selection", async () => {
    const user = userEvent.setup();

    renderDetectRoute();

    expect(screen.getByText("Current: None")).toBeInTheDocument();
    expect(
      screen.getByText("Select notes to see interval and chord details."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Select C4" }));
    await user.click(screen.getByRole("button", { name: "Select E4" }));
    await user.click(screen.getByRole("button", { name: "Select G4" }));

    expect(screen.getByText("C Major")).toBeInTheDocument();
    expect(screen.getAllByText("Root").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Clear selected keys" }));

    expect(screen.getByText("Current: None")).toBeInTheDocument();
    expect(
      screen.getByText("Select notes to see interval and chord details."),
    ).toBeInTheDocument();
  });

  it("renders mode links to detect and library routes", () => {
    renderDetectRoute();

    expect(screen.getByRole("tab", { name: "Detect" })).toHaveAttribute("href", "/detect");
    expect(screen.getByRole("tab", { name: "Library" })).toHaveAttribute("href", "/library/scales");
  });

  it("allows switching display notation from sharps to flats", async () => {
    const user = userEvent.setup();

    renderDetectRoute();

    await user.click(screen.getByRole("button", { name: "Clear selected keys" }));
    await user.click(screen.getByRole("button", { name: "Select C♯4" }));
    await user.click(screen.getByRole("button", { name: "Select F4" }));
    await user.click(screen.getByRole("button", { name: "Select G♯4" }));

    expect(screen.getByText("C♯ Major")).toBeInTheDocument();
    expect(screen.getByText("Current: C♯4, F4, G♯4")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Switch to flats notation" }));

    expect(screen.getByText("D♭ Major")).toBeInTheDocument();
    expect(screen.getByText("Current: D♭4, F4, A♭4")).toBeInTheDocument();
    expect(localStorage.getItem("accordis-notation-preference")).toBe("flats");
  });

  it("shows slash notation for a dominant seventh inversion with omitted fifth", async () => {
    const user = userEvent.setup();

    renderDetectRoute();

    await user.click(screen.getByRole("button", { name: "Clear selected keys" }));
    await user.click(screen.getByRole("button", { name: "Select F♯4" }));
    await user.click(screen.getByRole("button", { name: "Select C5" }));
    await user.click(screen.getByRole("button", { name: "Select D5" }));

    expect(screen.getByText("D7/F♯")).toBeInTheDocument();
    expect(screen.getByText("D Dominant 7")).toBeInTheDocument();
    expect(screen.getAllByText("1st inversion").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Partial: No 5th").length).toBeGreaterThan(0);
  });

  it("shows partial omitted-seventh labels for seventh chord interpretations", async () => {
    const user = userEvent.setup();

    renderDetectRoute();

    await user.click(screen.getByRole("button", { name: "Clear selected keys" }));
    await user.click(screen.getByRole("button", { name: "Select D4" }));
    await user.click(screen.getByRole("button", { name: "Select F♯4" }));
    await user.click(screen.getByRole("button", { name: "Select A4" }));

    expect(screen.getByText("D Major")).toBeInTheDocument();
    expect(screen.getAllByText("Partial: No 7th").length).toBeGreaterThan(0);
  });

  it("shows primary/secondary ranking badges and triad extension badge", async () => {
    const user = userEvent.setup();

    renderDetectRoute();

    await user.click(screen.getByRole("button", { name: "Clear selected keys" }));
    await user.click(screen.getByRole("button", { name: "Select C4" }));
    await user.click(screen.getByRole("button", { name: "Select E4" }));
    await user.click(screen.getByRole("button", { name: "Select G4" }));

    expect(screen.getAllByText("Primary").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Secondary").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Triad").length).toBeGreaterThan(0);
  });

  it("allows switching detected chord notation positions", async () => {
    const user = userEvent.setup();

    renderDetectRoute();

    await user.click(screen.getByRole("button", { name: "Clear selected keys" }));
    await user.click(screen.getByRole("button", { name: "Select C4" }));
    await user.click(screen.getByRole("button", { name: "Select E4" }));
    await user.click(screen.getByRole("button", { name: "Select G4" }));

    const upOctaveButton = screen.getByRole("button", { name: "+8va" });
    const trebleButton = screen.getByRole("button", { name: "Treble" });
    const bassButton = screen.getByRole("button", { name: "Bass" });
    const downOctaveButton = screen.getByRole("button", { name: "-8va" });

    expect(upOctaveButton).toHaveAttribute("aria-pressed", "false");
    expect(trebleButton).toHaveAttribute("aria-pressed", "true");
    expect(bassButton).toHaveAttribute("aria-pressed", "false");
    expect(downOctaveButton).toHaveAttribute("aria-pressed", "false");

    await user.click(upOctaveButton);
    expect(upOctaveButton).toHaveAttribute("aria-pressed", "true");
    expect(trebleButton).toHaveAttribute("aria-pressed", "false");
    expect(bassButton).toHaveAttribute("aria-pressed", "false");
    expect(downOctaveButton).toHaveAttribute("aria-pressed", "false");

    await user.click(bassButton);
    expect(upOctaveButton).toHaveAttribute("aria-pressed", "false");
    expect(trebleButton).toHaveAttribute("aria-pressed", "false");
    expect(bassButton).toHaveAttribute("aria-pressed", "true");
    expect(downOctaveButton).toHaveAttribute("aria-pressed", "false");

    await user.click(downOctaveButton);
    expect(downOctaveButton).toHaveAttribute("aria-pressed", "true");
    expect(upOctaveButton).toHaveAttribute("aria-pressed", "false");
    expect(trebleButton).toHaveAttribute("aria-pressed", "false");
    expect(bassButton).toHaveAttribute("aria-pressed", "false");

    await user.click(trebleButton);
    expect(trebleButton).toHaveAttribute("aria-pressed", "true");
    expect(bassButton).toHaveAttribute("aria-pressed", "false");
    expect(upOctaveButton).toHaveAttribute("aria-pressed", "false");
    expect(downOctaveButton).toHaveAttribute("aria-pressed", "false");
  });

  it("shows altered badge for altered-fifth chord detections", async () => {
    const user = userEvent.setup();

    renderDetectRoute();

    await user.click(screen.getByRole("button", { name: "Clear selected keys" }));
    await user.click(screen.getByRole("button", { name: "Select C4" }));
    await user.click(screen.getByRole("button", { name: "Select E4" }));
    await user.click(screen.getByRole("button", { name: "Select F♯4" }));
    await user.click(screen.getByRole("button", { name: "Select A♯4" }));

    expect(screen.getByText("C7♭5")).toBeInTheDocument();
    expect(screen.getAllByText("Altered").length).toBeGreaterThan(0);
  });

  it("shows 9th extension badge for ninth chord detections", async () => {
    const user = userEvent.setup();

    renderDetectRoute();

    await user.click(screen.getByRole("button", { name: "Clear selected keys" }));
    await user.click(screen.getByRole("button", { name: "Select C4" }));
    await user.click(screen.getByRole("button", { name: "Select D4" }));
    await user.click(screen.getByRole("button", { name: "Select E4" }));
    await user.click(screen.getByRole("button", { name: "Select G4" }));
    await user.click(screen.getByRole("button", { name: "Select A♯4" }));

    expect(screen.getByText("C9")).toBeInTheDocument();
    expect(screen.getAllByText("9th").length).toBeGreaterThan(0);
  });

  it("shows 9th extension badge for add9 chord detections", async () => {
    const user = userEvent.setup();

    renderDetectRoute();

    await user.click(screen.getByRole("button", { name: "Clear selected keys" }));
    await user.click(screen.getByRole("button", { name: "Select F4" }));
    await user.click(screen.getByRole("button", { name: "Select G4" }));
    await user.click(screen.getByRole("button", { name: "Select A4" }));
    await user.click(screen.getByRole("button", { name: "Select C5" }));

    expect(screen.getByText("Fadd9")).toBeInTheDocument();
    expect(screen.getAllByText("9th").length).toBeGreaterThan(0);
  });

  it("shows a badge explanation popup when a badge is clicked", async () => {
    const user = userEvent.setup();

    renderDetectRoute();

    await user.click(screen.getByRole("button", { name: "Clear selected keys" }));
    await user.click(screen.getByRole("button", { name: "Select C4" }));
    await user.click(screen.getByRole("button", { name: "Select E4" }));
    await user.click(screen.getByRole("button", { name: "Select G4" }));

    await user.click(screen.getAllByRole("button", { name: "Primary" })[0]);

    expect(
      screen.getByText("Best-ranked interpretation for these selected notes."),
    ).toBeInTheDocument();
  });

  it("shows omitted note in partial badge explanation popup", async () => {
    const user = userEvent.setup();

    renderDetectRoute();

    await user.click(screen.getByRole("button", { name: "Clear selected keys" }));
    await user.click(screen.getByRole("button", { name: "Select F♯4" }));
    await user.click(screen.getByRole("button", { name: "Select C5" }));
    await user.click(screen.getByRole("button", { name: "Select D5" }));

    await user.click(screen.getAllByRole("button", { name: "Partial: No 5th" })[0]);

    expect(screen.getByText("Match inferred from an omitted fifth. Missing note: A.")).toBeInTheDocument();
  });

  it("highlights a missing key while hovering a partial badge", async () => {
    const user = userEvent.setup();

    renderDetectRoute();

    await user.click(screen.getByRole("button", { name: "Clear selected keys" }));
    await user.click(screen.getByRole("button", { name: "Select F♯4" }));
    await user.click(screen.getByRole("button", { name: "Select C5" }));
    await user.click(screen.getByRole("button", { name: "Select D5" }));

    const partialBadge = screen.getAllByRole("button", { name: "Partial: No 5th" })[0];
    const rootPositionKey = screen.getByRole("button", { name: "Select A5" });
    const inversionKey = screen.getByRole("button", { name: "Select A4" });

    expect(rootPositionKey).not.toHaveAttribute("data-missing-primary", "true");
    expect(inversionKey).not.toHaveAttribute("data-missing-secondary", "true");
    await user.hover(partialBadge);
    expect(rootPositionKey).toHaveAttribute("data-missing-primary", "true");
    expect(inversionKey).toHaveAttribute("data-missing-secondary", "true");
    await user.unhover(partialBadge);
    expect(rootPositionKey).not.toHaveAttribute("data-missing-primary", "true");
    expect(inversionKey).not.toHaveAttribute("data-missing-secondary", "true");
  });

  it("keeps a missing key highlighted after clicking a partial badge", async () => {
    const user = userEvent.setup();

    renderDetectRoute();

    await user.click(screen.getByRole("button", { name: "Clear selected keys" }));
    await user.click(screen.getByRole("button", { name: "Select F♯4" }));
    await user.click(screen.getByRole("button", { name: "Select C5" }));
    await user.click(screen.getByRole("button", { name: "Select D5" }));

    const partialBadge = screen.getAllByRole("button", { name: "Partial: No 5th" })[0];
    const rootPositionKey = screen.getByRole("button", { name: "Select A5" });
    const inversionKey = screen.getByRole("button", { name: "Select A4" });

    await user.click(partialBadge);
    await user.unhover(partialBadge);
    expect(rootPositionKey).toHaveAttribute("data-missing-primary", "true");
    expect(inversionKey).toHaveAttribute("data-missing-secondary", "true");

    await user.click(partialBadge);
    await user.unhover(partialBadge);
    expect(rootPositionKey).not.toHaveAttribute("data-missing-primary", "true");
    expect(inversionKey).not.toHaveAttribute("data-missing-secondary", "true");
  });

  it("highlights one primary key and at most one secondary key for a partial chord badge", async () => {
    const user = userEvent.setup();

    renderDetectRoute();

    await user.click(screen.getByRole("button", { name: "Clear selected keys" }));
    await user.click(screen.getByRole("button", { name: "Select C4" }));
    await user.click(screen.getByRole("button", { name: "Select E4" }));
    await user.click(screen.getByRole("button", { name: "Select G4" }));

    const partialBadges = screen.getAllByRole("button", { name: "Partial: No 7th" });
    expect(partialBadges.length).toBeGreaterThan(0);

    await user.click(partialBadges[0]);
    const keys = screen.getAllByRole("button");
    const primaryKeys = keys.filter((key) => key.getAttribute("data-missing-primary") === "true");
    const secondaryKeys = keys.filter((key) => key.getAttribute("data-missing-secondary") === "true");
    expect(primaryKeys).toHaveLength(1);
    expect(secondaryKeys.length).toBeLessThanOrEqual(1);
  });

  it("shows fifth key in altered badge explanation popup", async () => {
    const user = userEvent.setup();

    renderDetectRoute();

    await user.click(screen.getByRole("button", { name: "Clear selected keys" }));
    await user.click(screen.getByRole("button", { name: "Select C4" }));
    await user.click(screen.getByRole("button", { name: "Select E4" }));
    await user.click(screen.getByRole("button", { name: "Select F♯4" }));
    await user.click(screen.getByRole("button", { name: "Select A♯4" }));

    await user.click(screen.getAllByRole("button", { name: "Altered" })[0]);

    expect(
      screen.getByText("Chord symbol contains an altered fifth (b5). Fifth key: F♯."),
    ).toBeInTheDocument();
  });

  it("plays selected notes and disposes Tone resources on unmount", async () => {
    const user = userEvent.setup();

    const { unmount } = renderDetectRoute();
    const playButton = screen.getByRole("button", { name: "Play selected chord" });

    expect(playButton).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Select C4" }));
    await user.click(screen.getByRole("button", { name: "Select E4" }));
    expect(playButton).toBeEnabled();

    await user.click(playButton);
    expect(playButton).toBeDisabled();

    await waitFor(() => {
      expect(toneMockState.start).toHaveBeenCalledTimes(1);
      expect(toneMockState.loaded).toHaveBeenCalledTimes(1);
      expect(toneMockState.samplerInstances[0]?.triggerAttackRelease).toHaveBeenCalledTimes(2);
    });

    expect(toneMockState.samplerInstances[0]?.releaseAll).toHaveBeenCalledWith(0);
    expect(toneMockState.samplerInstances[0]?.triggerAttackRelease).toHaveBeenNthCalledWith(
      1,
      "C4",
      "1n",
      0,
      0.58,
    );
    expect(toneMockState.samplerInstances[0]?.triggerAttackRelease).toHaveBeenNthCalledWith(
      2,
      "E4",
      "1n",
      0.05,
      0.58,
    );

    unmount();
    expect(toneMockState.samplerInstances[0]?.dispose).toHaveBeenCalledTimes(1);
    expect(toneMockState.filterInstances[0]?.dispose).toHaveBeenCalledTimes(1);
    expect(toneMockState.volumeInstances[0]?.dispose).toHaveBeenCalledTimes(1);
  });

  it("loads, toggles, and persists dark theme preference", async () => {
    const user = userEvent.setup();
    localStorage.setItem("accordis-theme-preference", "dark");
    const initialIconLink = document.createElement("link");
    initialIconLink.rel = "icon";
    initialIconLink.href = "/logo_light.png";
    initialIconLink.setAttribute("data-test-favicon", "true");
    document.head.appendChild(initialIconLink);

    renderDetectRoute();

    const themeToggle = await screen.findByRole("button", { name: "Switch to light mode" });
    await waitFor(() => {
      expect(document.documentElement).toHaveClass("dark");
      expect(document.documentElement.style.colorScheme).toBe("dark");
      expect(initialIconLink.href).toContain("/logo_light.png");
      expect(document.querySelector('link[data-accordis-theme-favicon="true"]')).toBeNull();
    });

    await user.click(themeToggle);

    await screen.findByRole("button", { name: "Switch to dark mode" });
    expect(document.documentElement).not.toHaveClass("dark");
    expect(document.documentElement.style.colorScheme).toBe("light");
    expect(localStorage.getItem("accordis-theme-preference")).toBe("light");
    expect(initialIconLink.href).toContain("/logo_light.png");
    expect(document.querySelector('link[data-accordis-theme-favicon="true"]')).toBeNull();
  });

  it("uses system dark preference when no saved theme exists", async () => {
    (window as Window & { matchMedia?: Window["matchMedia"] }).matchMedia = vi
      .fn()
      .mockImplementation((query: string) => ({
        matches: query === "(prefers-color-scheme: dark)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

    renderDetectRoute();

    await screen.findByRole("button", { name: "Switch to light mode" });
    await waitFor(() => {
      expect(document.documentElement).toHaveClass("dark");
      expect(localStorage.getItem("accordis-theme-preference")).toBe("dark");
    });
  });

  it("shows unsupported MIDI text only after attempting to enable MIDI", async () => {
    const user = userEvent.setup();
    delete (navigator as { requestMIDIAccess?: Navigator["requestMIDIAccess"] }).requestMIDIAccess;

    renderDetectRoute();
    const midiToggleButton = screen.getByRole("button", { name: "Enable MIDI input" });

    expect(screen.queryByText("MIDI unavailable.")).not.toBeInTheDocument();
    expect(midiToggleButton).not.toBeDisabled();

    await user.click(midiToggleButton);
    expect(screen.getByText("MIDI unavailable.")).toBeInTheDocument();
    expect(midiToggleButton).toBeDisabled();
  });

  it("shows no-device status when MIDI is enabled without connected inputs", async () => {
    const user = userEvent.setup();
    const fakeMidiAccess = {
      inputs: new Map<string, MIDIInput>(),
      onstatechange: null,
    } as unknown as MIDIAccess;
    navigator.requestMIDIAccess = vi.fn().mockResolvedValue(fakeMidiAccess);

    renderDetectRoute();
    await user.click(screen.getByRole("button", { name: "Enable MIDI input" }));

    await screen.findByText("MIDI: no device detected • Input source: On-screen keys");
  });

  it("shows failed status when enabling MIDI errors", async () => {
    const user = userEvent.setup();
    navigator.requestMIDIAccess = vi.fn().mockRejectedValue(new Error("No MIDI permissions"));

    renderDetectRoute();
    await user.click(screen.getByRole("button", { name: "Enable MIDI input" }));

    await screen.findByText("MIDI failed • Input source: On-screen keys");
  });

  it("updates MIDI status when device connection changes after enabling", async () => {
    const user = userEvent.setup();
    const fakeInput = {
      onmidimessage: null,
    } as unknown as MIDIInput;
    const mutableInputs = new Map<string, MIDIInput>();
    const fakeMidiAccess = {
      get inputs() {
        return mutableInputs;
      },
      onstatechange: null,
    } as unknown as MIDIAccess;
    navigator.requestMIDIAccess = vi.fn().mockResolvedValue(fakeMidiAccess);

    renderDetectRoute();
    await user.click(screen.getByRole("button", { name: "Enable MIDI input" }));
    await screen.findByText("MIDI: no device detected • Input source: On-screen keys");

    mutableInputs.set("input-1", fakeInput);
    await act(async () => {
      fakeMidiAccess.onstatechange?.({} as MIDIConnectionEvent);
    });

    await screen.findByText("MIDI: connected • Input source: On-screen keys");
    expect(fakeInput.onmidimessage).not.toBeNull();
  });

  it("latches MIDI chord notes after release and resets when a new chord starts", async () => {
    const user = userEvent.setup();
    const fakeInput = {
      onmidimessage: null,
    } as unknown as MIDIInput;
    const fakeMidiAccess = {
      inputs: new Map<string, MIDIInput>([["input-1", fakeInput]]),
      onstatechange: null,
    } as unknown as MIDIAccess;
    const requestMIDIAccessMock = vi.fn().mockResolvedValue(fakeMidiAccess);
    navigator.requestMIDIAccess = requestMIDIAccessMock;

    renderDetectRoute();
    expect(screen.queryByText("MIDI is off.")).not.toBeInTheDocument();
    expect(requestMIDIAccessMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Select C4" }));
    await user.click(screen.getByRole("button", { name: "Select E4" }));
    await user.click(screen.getByRole("button", { name: "Select G4" }));

    expect(screen.getByText("Current: C4, E4, G4")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Enable MIDI input" }));
    await screen.findByText("MIDI: connected • Input source: On-screen keys");
    expect(requestMIDIAccessMock).toHaveBeenCalledTimes(1);
    expect(fakeInput.onmidimessage).not.toBeNull();
    expect(screen.getByText("Current: None")).toBeInTheDocument();

    await act(async () => {
      fakeInput.onmidimessage?.({
        data: new Uint8Array([0x90, 62, 100]),
      } as MIDIMessageEvent);
    });
    expect(screen.getByText("Current: D4")).toBeInTheDocument();
    expect(screen.getByText("MIDI: connected • Input source: MIDI")).toBeInTheDocument();

    await act(async () => {
      fakeInput.onmidimessage?.({
        data: new Uint8Array([0x90, 65, 100]),
      } as MIDIMessageEvent);
    });
    expect(screen.getByText("Current: D4, F4")).toBeInTheDocument();

    await act(async () => {
      fakeInput.onmidimessage?.({
        data: new Uint8Array([0x80, 62, 0]),
      } as MIDIMessageEvent);
    });
    await screen.findByText("Current: F4");

    await act(async () => {
      fakeInput.onmidimessage?.({
        data: new Uint8Array([0x90, 62, 100]),
      } as MIDIMessageEvent);
    });
    expect(screen.getByText("Current: D4, F4")).toBeInTheDocument();

    await act(async () => {
      fakeInput.onmidimessage?.({
        data: new Uint8Array([0x90, 69, 100]),
      } as MIDIMessageEvent);
    });
    expect(screen.getByText("Current: D4, F4, A4")).toBeInTheDocument();

    await act(async () => {
      fakeInput.onmidimessage?.({
        data: new Uint8Array([0x80, 69, 0]),
      } as MIDIMessageEvent);
    });
    await screen.findByText("Current: D4, F4");

    await act(async () => {
      fakeInput.onmidimessage?.({
        data: new Uint8Array([0x80, 62, 0]),
      } as MIDIMessageEvent);
      fakeInput.onmidimessage?.({
        data: new Uint8Array([0x80, 65, 0]),
      } as MIDIMessageEvent);
    });
    await screen.findByText("Current: D4, F4");

    await act(async () => {
      fakeInput.onmidimessage?.({
        data: new Uint8Array([0x90, 67, 100]),
      } as MIDIMessageEvent);
    });
    expect(screen.getByText("Current: G4")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Disable MIDI input" }));
    expect(screen.getByText("MIDI is off.")).toBeInTheDocument();
  });
});

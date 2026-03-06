import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";

describe("Home page", () => {
  const originalRequestMIDIAccess = navigator.requestMIDIAccess;

  afterEach(() => {
    cleanup();
    if (originalRequestMIDIAccess) {
      navigator.requestMIDIAccess = originalRequestMIDIAccess;
    } else {
      delete (navigator as { requestMIDIAccess?: Navigator["requestMIDIAccess"] }).requestMIDIAccess;
    }
  });

  beforeEach(() => {
    localStorage.clear();
  });

  it("shows detected chord info as keys are selected and clears selection", async () => {
    const user = userEvent.setup();

    render(<Home />);

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

  it("allows switching display notation from sharps to flats", async () => {
    const user = userEvent.setup();

    render(<Home />);

    await user.click(screen.getByRole("button", { name: "Clear selected keys" }));
    await user.click(screen.getByRole("button", { name: "Select C♯4" }));
    await user.click(screen.getByRole("button", { name: "Select F4" }));
    await user.click(screen.getByRole("button", { name: "Select G♯4" }));

    expect(screen.getByText("C♯ Major")).toBeInTheDocument();
    expect(screen.getByText("Current: C♯4, F4, G♯4")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Use flats notation" }));

    expect(screen.getByText("D♭ Major")).toBeInTheDocument();
    expect(screen.getByText("Current: D♭4, F4, A♭4")).toBeInTheDocument();
    expect(localStorage.getItem("accordis-notation-preference")).toBe("flats");
  });

  it("shows slash notation for a dominant seventh inversion with omitted fifth", async () => {
    const user = userEvent.setup();

    render(<Home />);

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

    render(<Home />);

    await user.click(screen.getByRole("button", { name: "Clear selected keys" }));
    await user.click(screen.getByRole("button", { name: "Select D4" }));
    await user.click(screen.getByRole("button", { name: "Select F♯4" }));
    await user.click(screen.getByRole("button", { name: "Select A4" }));

    expect(screen.getByText("D Major")).toBeInTheDocument();
    expect(screen.getAllByText("Partial: No 7th").length).toBeGreaterThan(0);
  });

  it("shows primary/secondary ranking badges and triad extension badge", async () => {
    const user = userEvent.setup();

    render(<Home />);

    await user.click(screen.getByRole("button", { name: "Clear selected keys" }));
    await user.click(screen.getByRole("button", { name: "Select C4" }));
    await user.click(screen.getByRole("button", { name: "Select E4" }));
    await user.click(screen.getByRole("button", { name: "Select G4" }));

    expect(screen.getAllByText("Primary").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Secondary").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Triad").length).toBeGreaterThan(0);
  });

  it("shows altered badge for altered-fifth chord detections", async () => {
    const user = userEvent.setup();

    render(<Home />);

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

    render(<Home />);

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

    render(<Home />);

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

    render(<Home />);

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

    render(<Home />);

    await user.click(screen.getByRole("button", { name: "Clear selected keys" }));
    await user.click(screen.getByRole("button", { name: "Select F♯4" }));
    await user.click(screen.getByRole("button", { name: "Select C5" }));
    await user.click(screen.getByRole("button", { name: "Select D5" }));

    await user.click(screen.getAllByRole("button", { name: "Partial: No 5th" })[0]);

    expect(screen.getByText("Match inferred from an omitted fifth. Missing note: A.")).toBeInTheDocument();
  });

  it("shows fifth key in altered badge explanation popup", async () => {
    const user = userEvent.setup();

    render(<Home />);

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

  it("shows unsupported MIDI text only after attempting to enable MIDI", async () => {
    const user = userEvent.setup();
    delete (navigator as { requestMIDIAccess?: Navigator["requestMIDIAccess"] }).requestMIDIAccess;

    render(<Home />);
    const midiToggleButton = screen.getByRole("button", { name: "Enable MIDI input" });

    expect(screen.queryByText("MIDI unavailable.")).not.toBeInTheDocument();
    expect(midiToggleButton).not.toBeDisabled();

    await user.click(midiToggleButton);
    expect(screen.getByText("MIDI unavailable.")).toBeInTheDocument();
    expect(midiToggleButton).toBeDisabled();
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

    render(<Home />);
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

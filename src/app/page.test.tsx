import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Home from "@/app/page";

describe("Home page", () => {
  afterEach(() => {
    cleanup();
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
});

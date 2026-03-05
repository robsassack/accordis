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
    expect(screen.getByText("Root")).toBeInTheDocument();

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
    expect(screen.getByText("1st inversion")).toBeInTheDocument();
    expect(screen.getByText("Partial: No 5th")).toBeInTheDocument();
  });
});

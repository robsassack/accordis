import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import Home from "@/app/page";

describe("Home page", () => {
  it("shows detected chord info as keys are selected and clears selection", async () => {
    const user = userEvent.setup();

    render(<Home />);

    expect(screen.getByText("Current: C4")).toBeInTheDocument();
    expect(
      screen.getByText("Select at least 3 unique notes to detect a chord."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Select E4" }));
    await user.click(screen.getByRole("button", { name: "Select G4" }));

    expect(screen.getByText("C Major")).toBeInTheDocument();
    expect(screen.getByText("Root position")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear selected keys" }));

    expect(screen.getByText("Current: None")).toBeInTheDocument();
    expect(
      screen.getByText("Select notes to see interval and chord details."),
    ).toBeInTheDocument();
  });
});

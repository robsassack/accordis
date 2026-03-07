import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const replaceState = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ replace: replaceState.replace })),
}));

import HomePage from "@/app/page";

describe("root page redirect", () => {
  beforeEach(() => {
    replaceState.replace.mockReset();
  });

  it("redirects / to /detect", async () => {
    render(<HomePage />);

    await waitFor(() => {
      expect(replaceState.replace).toHaveBeenCalledWith("/detect");
    });
  });
});

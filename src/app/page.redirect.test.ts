import { describe, expect, it, vi } from "vitest";

const redirectMock = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
);

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import HomePage from "@/app/page";

describe("root page redirect", () => {
  it("redirects / to /detect", () => {
    expect(() => HomePage()).toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/detect");
  });
});

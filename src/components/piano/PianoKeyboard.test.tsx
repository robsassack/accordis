import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  PianoKeyboard,
  resetPianoKeyboardUiCachesForTests,
} from "@/components/piano/PianoKeyboard";
import { buildPianoKeys } from "@/lib/piano";

describe("PianoKeyboard mobile scroll behavior", () => {
  const keys = buildPianoKeys(4, 5);
  let originalScrollWidthDescriptor: PropertyDescriptor | undefined;
  let originalClientWidthDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    resetPianoKeyboardUiCachesForTests();
    originalScrollWidthDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "scrollWidth",
    );
    originalClientWidthDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "clientWidth",
    );
    Object.defineProperty(HTMLElement.prototype, "scrollWidth", {
      configurable: true,
      get: () => 1000,
    });
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get: () => 300,
    });
  });

  afterEach(() => {
    cleanup();
    resetPianoKeyboardUiCachesForTests();

    if (originalScrollWidthDescriptor) {
      Object.defineProperty(
        HTMLElement.prototype,
        "scrollWidth",
        originalScrollWidthDescriptor,
      );
    }
    if (originalClientWidthDescriptor) {
      Object.defineProperty(
        HTMLElement.prototype,
        "clientWidth",
        originalClientWidthDescriptor,
      );
    }
  });

  it("restores horizontal scroll position after remount when cache key is stable", () => {
    const { container, unmount } = render(
      <PianoKeyboard
        keys={keys}
        selectedKeys={[]}
        primaryMissingKeyId={null}
        secondaryMissingKeyId={null}
        onKeyClick={() => {}}
        notationPreference="sharps"
        scrollCacheKey="library-chords"
      />,
    );

    const firstScrollContainer = container.querySelector(".overflow-x-auto");
    expect(firstScrollContainer).not.toBeNull();
    if (!firstScrollContainer) {
      return;
    }

    firstScrollContainer.scrollLeft = 180;
    fireEvent.scroll(firstScrollContainer);
    unmount();

    const { container: secondContainer } = render(
      <PianoKeyboard
        keys={keys}
        selectedKeys={[]}
        primaryMissingKeyId={null}
        secondaryMissingKeyId={null}
        onKeyClick={() => {}}
        notationPreference="sharps"
        scrollCacheKey="library-chords"
      />,
    );

    const secondScrollContainer = secondContainer.querySelector(".overflow-x-auto");
    expect(secondScrollContainer).not.toBeNull();
    expect(secondScrollContainer?.scrollLeft).toBe(180);
  });

  it("keeps the swipe hint dismissed after remount with the same cache key", () => {
    const { container, unmount } = render(
      <PianoKeyboard
        keys={keys}
        selectedKeys={[]}
        primaryMissingKeyId={null}
        secondaryMissingKeyId={null}
        onKeyClick={() => {}}
        notationPreference="sharps"
        scrollCacheKey="library-scales"
      />,
    );

    const firstScrollContainer = container.querySelector(".overflow-x-auto");
    expect(firstScrollContainer).not.toBeNull();
    if (!firstScrollContainer) {
      return;
    }

    firstScrollContainer.scrollLeft = 120;
    fireEvent.scroll(firstScrollContainer);
    expect(screen.getByText("Swipe to scroll keys →")).toHaveAttribute("aria-hidden", "true");
    unmount();

    render(
      <PianoKeyboard
        keys={keys}
        selectedKeys={[]}
        primaryMissingKeyId={null}
        secondaryMissingKeyId={null}
        onKeyClick={() => {}}
        notationPreference="sharps"
        scrollCacheKey="library-scales"
      />,
    );

    expect(screen.getByText("Swipe to scroll keys →")).toHaveAttribute("aria-hidden", "true");
  });
});

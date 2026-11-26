import { describe, expect, it, vi } from "vitest";
import type { ScrollView, View } from "react-native";

vi.mock("@/constants/platform", () => ({
  isWeb: false,
  isNative: true,
}));

import { scrollSidebarToRowNode } from "./sidebar-reveal-context";

describe("scrollSidebarToRowNode (native Fabric fallback)", () => {
  it("prefers ScrollView.getInnerViewRef() over numeric getInnerViewNode() and centers the row", () => {
    const innerHostRef = { __fabricHostInstance: true };
    const scrollTo = vi.fn();
    const scrollView = {
      getInnerViewRef: vi.fn(() => innerHostRef),
      getInnerViewNode: vi.fn(() => 42),
      scrollTo,
    } as unknown as ScrollView;

    const measureLayout = vi.fn(
      (
        relativeTo: unknown,
        onSuccess: (x: number, y: number, width: number, height: number) => void,
      ) => {
        expect(relativeTo).toBe(innerHostRef);
        onSuccess(0, 600, 260, 40);
      },
    );
    const rowNode = { measureLayout } as unknown as View;

    const ok = scrollSidebarToRowNode({
      rowNode,
      scrollViewRef: { current: scrollView },
      viewportHeight: 400,
    });

    expect(ok).toBe(true);
    expect(measureLayout).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ y: 420, animated: true });
  });
});

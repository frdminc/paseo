import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  resolveRevealSidebarPlan,
  SIDEBAR_REVEAL_HIGHLIGHT_MS,
  SIDEBAR_REVEAL_REQUEST_TIMEOUT_MS,
  useSidebarRevealStore,
} from "./sidebar-reveal-store";

describe("sidebar-reveal-store", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useSidebarRevealStore.getState().clearHighlight();
    const current = useSidebarRevealStore.getState().request;
    if (current) {
      useSidebarRevealStore.getState().clearRequest(current.requestId);
    }
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("queues a reveal request, highlights the row, and auto-clears the highlight after timeout", () => {
    const requestId = useSidebarRevealStore.getState().requestReveal({
      serverId: "srv_1",
      workspaceId: "wks_42",
    });

    expect(requestId).not.toBeNull();
    expect(useSidebarRevealStore.getState().request).toEqual({
      requestId,
      serverId: "srv_1",
      workspaceId: "wks_42",
      workspaceKey: "srv_1:wks_42",
    });
    expect(useSidebarRevealStore.getState().highlightedWorkspaceKey).toBe("srv_1:wks_42");

    // Clearing the scroll request keeps the highlight visible until the pulse expires
    useSidebarRevealStore.getState().clearRequest(requestId!);
    expect(useSidebarRevealStore.getState().request).toBeNull();
    expect(useSidebarRevealStore.getState().highlightedWorkspaceKey).toBe("srv_1:wks_42");

    vi.advanceTimersByTime(SIDEBAR_REVEAL_HIGHLIGHT_MS);
    expect(useSidebarRevealStore.getState().highlightedWorkspaceKey).toBeNull();
  });

  it("auto-expires unconsumed reveal requests so an unmounted list cannot leave them stuck", () => {
    useSidebarRevealStore.getState().requestReveal({
      serverId: "srv_1",
      workspaceId: "wks_unmounted",
    });
    expect(useSidebarRevealStore.getState().request).not.toBeNull();

    vi.advanceTimersByTime(SIDEBAR_REVEAL_REQUEST_TIMEOUT_MS);
    expect(useSidebarRevealStore.getState().request).toBeNull();
  });

  it("does not let an earlier timer clear a newer reveal highlight", () => {
    const firstId = useSidebarRevealStore.getState().requestReveal({
      serverId: "srv_1",
      workspaceId: "wks_1",
    });
    vi.advanceTimersByTime(SIDEBAR_REVEAL_HIGHLIGHT_MS / 2);

    const secondId = useSidebarRevealStore.getState().requestReveal({
      serverId: "srv_1",
      workspaceId: "wks_2",
    });
    expect(secondId).not.toBe(firstId);

    // Passing the original deadline must not clear the second highlight
    vi.advanceTimersByTime(SIDEBAR_REVEAL_HIGHLIGHT_MS / 2 + 50);
    expect(useSidebarRevealStore.getState().highlightedWorkspaceKey).toBe("srv_1:wks_2");

    // Passing the second deadline clears it
    vi.advanceTimersByTime(SIDEBAR_REVEAL_HIGHLIGHT_MS);
    expect(useSidebarRevealStore.getState().highlightedWorkspaceKey).toBeNull();
  });

  it("ignores blank serverId or workspaceId", () => {
    expect(
      useSidebarRevealStore.getState().requestReveal({ serverId: "", workspaceId: "wks_1" }),
    ).toBeNull();
    expect(
      useSidebarRevealStore.getState().requestReveal({ serverId: "srv_1", workspaceId: "   " }),
    ).toBeNull();
    expect(useSidebarRevealStore.getState().request).toBeNull();
  });
});

describe("resolveRevealSidebarPlan", () => {
  const baseInput = {
    serverId: "srv_1",
    workspaceKey: "srv_1:wks_1",
    groupMode: "project" as const,
    hostFilters: [] as string[],
    resolvedProjectFilters: [] as string[],
    labelFilter: { labels: [] as string[] },
    showBackground: false,
    isBackgroundWorkspace: false,
    excludedByLabelFilter: false,
    isPinned: false,
    projectViewKey: "proj_1",
    statusGroupKey: "running",
    collapsedPinned: false,
    collapsedProjectKeys: new Set<string>(),
    collapsedWorkspaceGroupKeys: new Set<string>(),
  };

  it("expands a collapsed project in project mode", () => {
    const plan = resolveRevealSidebarPlan({
      ...baseInput,
      collapsedProjectKeys: new Set(["proj_1"]),
    });
    expect(plan).toEqual({
      includeHostServerId: null,
      includeProjectViewKey: null,
      clearLabelFilter: false,
      enableShowBackground: false,
      expandPinnedSection: false,
      expandProjectViewKey: "proj_1",
      expandWorkspaceGroupKey: null,
    });
  });

  it("expands the pinned section instead of the project when the workspace is pinned", () => {
    const plan = resolveRevealSidebarPlan({
      ...baseInput,
      isPinned: true,
      collapsedPinned: true,
      collapsedProjectKeys: new Set(["proj_1"]),
    });
    expect(plan.expandPinnedSection).toBe(true);
    expect(plan.expandProjectViewKey).toBeNull();
  });

  it("expands a collapsed status group in status mode", () => {
    const plan = resolveRevealSidebarPlan({
      ...baseInput,
      groupMode: "status",
      collapsedWorkspaceGroupKeys: new Set(["running"]),
    });
    expect(plan.expandWorkspaceGroupKey).toBe("running");
    expect(plan.expandProjectViewKey).toBeNull();
  });

  it("widens host, project, background, and label filters only when they hide the target", () => {
    expect(
      resolveRevealSidebarPlan({
        ...baseInput,
        hostFilters: ["srv_other"],
        resolvedProjectFilters: ["proj_other"],
        isBackgroundWorkspace: true,
        showBackground: false,
        labelFilter: { labels: ["bug"] },
        excludedByLabelFilter: false,
      }),
    ).toMatchObject({
      includeHostServerId: "srv_1",
      includeProjectViewKey: "proj_1",
      enableShowBackground: true,
      // Must NOT prematurely wipe labelFilter while host/hydration is still pending
      clearLabelFilter: false,
    });

    // Clears label filter only when the target is hydrated and proven excluded by it
    expect(
      resolveRevealSidebarPlan({
        ...baseInput,
        labelFilter: { labels: ["bug"] },
        excludedByLabelFilter: true,
      }),
    ).toMatchObject({
      includeHostServerId: null,
      includeProjectViewKey: null,
      enableShowBackground: false,
      clearLabelFilter: true,
    });
  });
});

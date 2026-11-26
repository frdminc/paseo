import { beforeEach, describe, expect, it } from "vitest";
import { revealWorkspaceInSidebar } from "./use-reveal-workspace-in-sidebar";
import { usePanelStore } from "@/stores/panel-store";
import { useSidebarRevealStore } from "@/stores/sidebar-reveal-store";
import {
  setPinnedCollapsed,
  setWorkspaceGroupCollapsed,
} from "@/stores/sidebar-collapsed-sections-store/state";

describe("revealWorkspaceInSidebar", () => {
  beforeEach(() => {
    useSidebarRevealStore.getState().clearHighlight();
    const pending = useSidebarRevealStore.getState().request;
    if (pending) {
      useSidebarRevealStore.getState().clearRequest(pending.requestId);
    }
    usePanelStore.setState((state) => ({
      ...state,
      desktop: { agentListOpen: false, focusModeEnabled: true },
      mobilePanel: { target: "agent", revision: 0 },
    }));
  });

  it("exits focus mode, opens the desktop sidebar, and queues a reveal request", () => {
    const requestId = revealWorkspaceInSidebar({
      serverId: "srv_1",
      workspaceId: "wks_10",
      isCompact: false,
    });

    expect(requestId).not.toBeNull();
    expect(usePanelStore.getState().desktop.focusModeEnabled).toBe(false);
    expect(usePanelStore.getState().desktop.agentListOpen).toBe(true);
    expect(useSidebarRevealStore.getState().request).toEqual({
      requestId,
      serverId: "srv_1",
      workspaceId: "wks_10",
      workspaceKey: "srv_1:wks_10",
    });
    expect(useSidebarRevealStore.getState().highlightedWorkspaceKey).toBe("srv_1:wks_10");
  });

  it("opens the mobile sidebar drawer on compact layouts", () => {
    const requestId = revealWorkspaceInSidebar({
      serverId: "srv_1",
      workspaceId: "wks_10",
      isCompact: true,
    });

    expect(requestId).not.toBeNull();
    expect(usePanelStore.getState().mobilePanel.target).toBe("agent-list");
  });

  it("opens the overlay sidebar drawer on wide layouts when leftSidebar is overlay", () => {
    usePanelStore.setState((state) => ({
      ...state,
      layout: { isCompact: false, leftSidebar: "overlay" },
      desktop: { agentListOpen: true, focusModeEnabled: false },
      mobilePanel: { target: "agent", revision: 0 },
    }));

    const requestId = revealWorkspaceInSidebar({
      serverId: "srv_1",
      workspaceId: "wks_10",
      isCompact: false,
    });

    expect(requestId).not.toBeNull();
    expect(usePanelStore.getState().mobilePanel.target).toBe("agent-list");
  });
});

describe("sidebar-collapsed-sections-store idempotent setters", () => {
  it("sets pinned and workspace group collapsed state idempotently", () => {
    const initial = {
      collapsedProjectKeys: new Set<string>(),
      collapsedWorkspaceGroupKeys: new Set<string>(["running"]),
      collapsedPinned: true,
    };

    const expandedPinned = setPinnedCollapsed(initial, false);
    expect(expandedPinned.collapsedPinned).toBe(false);
    expect(setPinnedCollapsed(expandedPinned, false)).toBe(expandedPinned);

    const expandedGroup = setWorkspaceGroupCollapsed(initial, "running", false);
    expect(expandedGroup.collapsedWorkspaceGroupKeys.has("running")).toBe(false);
    expect(setWorkspaceGroupCollapsed(expandedGroup, "running", false)).toBe(expandedGroup);
  });
});

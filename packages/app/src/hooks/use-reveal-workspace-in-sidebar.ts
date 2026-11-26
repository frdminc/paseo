import { useCallback } from "react";
import { useIsCompactFormFactor } from "@/constants/layout";
import { usePanelStore } from "@/stores/panel-store";
import { useSessionStore } from "@/stores/session-store";
import { useSidebarRevealStore } from "@/stores/sidebar-reveal-store";
import { resolveWorkspaceMapKeyByIdentity } from "@/utils/workspace-identity";

function canonicalizeRevealWorkspaceId(serverId: string, workspaceId: string): string {
  const workspaces = useSessionStore.getState().sessions[serverId]?.workspaces;
  const mapKey = resolveWorkspaceMapKeyByIdentity({ workspaces, workspaceId });
  if (!mapKey || !workspaces) {
    return workspaceId;
  }
  return workspaces.get(mapKey)?.id ?? mapKey;
}

/**
 * Reveals a workspace in the left sidebar: exits focus mode if active, opens the sidebar (both
 * docked and overlay presentations across wide and compact layouts), and queues a reveal request
 * so the sidebar widens blocking filters, expands collapsed sections, scrolls to the row, and
 * highlights it.
 */
export function revealWorkspaceInSidebar(input: {
  serverId: string;
  workspaceId: string;
  isCompact: boolean;
}): number | null {
  const { serverId, workspaceId, isCompact } = input;
  const resolvedWorkspaceId = canonicalizeRevealWorkspaceId(serverId, workspaceId);
  const requestId = useSidebarRevealStore
    .getState()
    .requestReveal({ serverId, workspaceId: resolvedWorkspaceId });
  if (requestId === null) {
    return null;
  }
  const panelStore = usePanelStore.getState();
  if (panelStore.desktop.focusModeEnabled) {
    panelStore.exitFocusMode();
  }
  // On wide layouts where the sidebar cannot share width (e.g. narrow desktop window with
  // Explorer open), the sidebar renders as an overlay driven by `mobilePanel.target`.
  if (!isCompact && usePanelStore.getState().layout.leftSidebar === "overlay") {
    panelStore.showMobileAgentList();
  } else {
    panelStore.openAgentListForLayout({ isCompact });
  }
  return requestId;
}

export function useRevealWorkspaceInSidebar(
  serverId: string | null,
  workspaceId: string | null,
): () => void {
  const isCompact = useIsCompactFormFactor();
  return useCallback(() => {
    if (!serverId || !workspaceId) {
      return;
    }
    revealWorkspaceInSidebar({ serverId, workspaceId, isCompact });
  }, [isCompact, serverId, workspaceId]);
}

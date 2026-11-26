import { useCallback } from "react";
import { useSidebarWorkspacePinController } from "@/hooks/use-sidebar-workspace-pin";
import { useHostFeature } from "@/runtime/host-features";
import { useWorkspaceFields } from "@/stores/session-store-hooks";
import { buildWorkspaceTabPersistenceKey } from "@/workspace-tabs/model";

export interface WorkspacePinToggleState {
  canPin: boolean;
  isPinned: boolean;
  togglePin: () => boolean;
}

/**
 * Shared pin/unpin controller for any workspace (header button, header overflow menu,
 * and the global keyboard shortcut).
 *
 * Projects the descriptor `id` and `pinnedAt` narrowly so pin state changes don't re-render on
 * gitRuntime/diffStat ticks, and resolves the opaque route id to the descriptor id so sidebar rows,
 * header buttons, and keyboard shortcuts agree on one identity and one in-flight guard.
 */
export function useWorkspacePinToggle(
  serverId: string | null,
  routeWorkspaceId: string | null,
): WorkspacePinToggleState {
  const fields = useWorkspaceFields(serverId, routeWorkspaceId, (workspace) => ({
    id: workspace.id,
    pinnedAt: workspace.pinnedAt ?? null,
  }));
  const supportsPinning = useHostFeature(serverId, "workspacePinning");
  const toggleWorkspacePin = useSidebarWorkspacePinController();

  const canPin = serverId !== null && fields !== null && supportsPinning;
  const isPinned = fields?.pinnedAt != null;

  const togglePin = useCallback(() => {
    if (!serverId || !fields || !supportsPinning) {
      return false;
    }
    const workspaceKey = buildWorkspaceTabPersistenceKey({
      serverId,
      workspaceId: fields.id,
    });
    if (!workspaceKey) {
      return false;
    }
    toggleWorkspacePin({
      serverId,
      workspaceId: fields.id,
      workspaceKey,
      pinnedAt: fields.pinnedAt,
    });
    return true;
  }, [fields, serverId, supportsPinning, toggleWorkspacePin]);

  return { canPin, isPinned, togglePin };
}

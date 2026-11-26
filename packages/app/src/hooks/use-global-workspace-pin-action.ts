import { useKeyboardActionHandler } from "@/hooks/use-keyboard-action-handler";
import { useWorkspacePinToggle } from "@/hooks/use-workspace-pin-toggle";
import type { KeyboardActionId } from "@/keyboard/keyboard-action-dispatcher";
import { useActiveWorkspaceSelection } from "@/stores/navigation-active-workspace-store";

const WORKSPACE_PIN_ACTIONS: readonly KeyboardActionId[] = ["workspace.pin"];

// The pin shortcut used to live on the sidebar row, so it disappeared whenever the row was not
// rendered — a collapsed project or status group, a collapsed Pinned section, or focus mode.
// It belongs here instead: one registration keyed on the active route selection.
//
// "Active workspace" means the route selection, not a focused pane. Those are equivalent today
// (panes belong to the routed workspace, and /settings parses to no selection, which correctly
// disables the handler). Revisit this if panes ever span workspaces.
export function useGlobalWorkspacePinAction() {
  const selection = useActiveWorkspaceSelection();
  const { canPin, togglePin } = useWorkspacePinToggle(
    selection?.serverId ?? null,
    selection?.workspaceId ?? null,
  );

  useKeyboardActionHandler({
    handlerId: "workspace-pin-global",
    actions: WORKSPACE_PIN_ACTIONS,
    enabled: canPin,
    priority: 0,
    handle: togglePin,
  });
}

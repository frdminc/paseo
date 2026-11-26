import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { LocateFixed, Pin } from "lucide-react-native";
import { withUnistyles } from "react-native-unistyles";
import { HeaderToggleButton } from "@/components/headers/header-toggle-button";
import {
  extraMutedIconColorMapping,
  iconButtonChromeGlyphSize,
  mutedIconColorMapping,
} from "@/components/ui/icon-button-chrome";
import { useRevealWorkspaceInSidebar } from "@/hooks/use-reveal-workspace-in-sidebar";
import { useShortcutKeys } from "@/hooks/use-shortcut-keys";
import { useWorkspacePinToggle } from "@/hooks/use-workspace-pin-toggle";
import type { Theme } from "@/styles/theme";

const ThemedPin = withUnistyles(Pin);
const ThemedLocateFixed = withUnistyles(LocateFixed);

const pinnedIconColorMapping = (theme: Theme) => ({
  color: theme.colors.accentBright,
  fill: theme.colors.accentBright,
});

const EMPTY_SHORTCUT_KEYS: never[] = [];

function resolvePinIconColorMapping(isPinned: boolean, hovered: boolean) {
  if (isPinned) {
    return pinnedIconColorMapping;
  }
  return hovered ? mutedIconColorMapping : extraMutedIconColorMapping;
}

export function useWorkspaceHeaderPinAndReveal(input: {
  serverId: string;
  workspaceId: string;
  descriptorId?: string | null;
}) {
  const serverIdOrNull = input.serverId || null;
  const workspaceIdOrNull = input.workspaceId || null;
  const { canPin, isPinned, togglePin } = useWorkspacePinToggle(serverIdOrNull, workspaceIdOrNull);
  const resolvedRevealWorkspaceId = input.descriptorId ?? workspaceIdOrNull;
  const canRevealInSidebar = Boolean(serverIdOrNull && resolvedRevealWorkspaceId);
  const revealInSidebar = useRevealWorkspaceInSidebar(serverIdOrNull, resolvedRevealWorkspaceId);

  return {
    canPin,
    isPinned,
    onTogglePin: togglePin,
    canRevealInSidebar,
    onRevealInSidebar: revealInSidebar,
    menuRevealInSidebar: canRevealInSidebar ? revealInSidebar : undefined,
  };
}

export interface WorkspaceHeaderQuickActionsProps {
  canPin: boolean;
  isPinned: boolean;
  onTogglePin: () => void;
  canRevealInSidebar: boolean;
  onRevealInSidebar: () => void;
}

/**
 * One-click Pin/Unpin and Reveal-in-sidebar controls placed beside the workspace header menu
 * on wide layouts so users managing 30+ workspaces can pin or locate the current window
 * immediately without hunting through collapsed sidebar sections.
 */
export function WorkspaceHeaderQuickActions({
  canPin,
  isPinned,
  onTogglePin,
  canRevealInSidebar,
  onRevealInSidebar,
}: WorkspaceHeaderQuickActionsProps) {
  const { t } = useTranslation();
  const pinShortcutKeys = useShortcutKeys("pin-workspace");
  const primaryPinKeys = useMemo(
    () => pinShortcutKeys?.[0] ?? EMPTY_SHORTCUT_KEYS,
    [pinShortcutKeys],
  );
  const pinAccessibilityState = useMemo(() => ({ selected: isPinned }), [isPinned]);
  const glyphSize = iconButtonChromeGlyphSize("large");

  const renderPinIcon = useCallback(
    ({ hovered }: { hovered: boolean }) => (
      <ThemedPin
        size={glyphSize}
        strokeWidth={1.6}
        uniProps={resolvePinIconColorMapping(isPinned, hovered)}
      />
    ),
    [glyphSize, isPinned],
  );

  const renderRevealIcon = useCallback(
    ({ hovered }: { hovered: boolean }) => (
      <ThemedLocateFixed
        size={glyphSize}
        strokeWidth={1.6}
        uniProps={hovered ? mutedIconColorMapping : extraMutedIconColorMapping}
      />
    ),
    [glyphSize],
  );

  return (
    <>
      {canPin ? (
        <HeaderToggleButton
          testID="workspace-header-pin-button"
          onPress={onTogglePin}
          tooltipLabel={
            isPinned
              ? t("workspace.header.actions.unpinWorkspace")
              : t("workspace.header.actions.pinWorkspace")
          }
          tooltipKeys={primaryPinKeys}
          tooltipSide="bottom"
          accessibilityRole="button"
          accessibilityLabel={
            isPinned
              ? t("workspace.header.actions.unpinWorkspace")
              : t("workspace.header.actions.pinWorkspace")
          }
          accessibilityState={pinAccessibilityState}
        >
          {renderPinIcon}
        </HeaderToggleButton>
      ) : null}
      {canRevealInSidebar ? (
        <HeaderToggleButton
          testID="workspace-header-reveal-in-sidebar-button"
          onPress={onRevealInSidebar}
          tooltipLabel={t("workspace.header.actions.revealInSidebar")}
          tooltipKeys={EMPTY_SHORTCUT_KEYS}
          tooltipSide="bottom"
          accessibilityRole="button"
          accessibilityLabel={t("workspace.header.actions.revealInSidebar")}
        >
          {renderRevealIcon}
        </HeaderToggleButton>
      ) : null}
    </>
  );
}

import {
  buildPaseoDeepLinkRoute,
  parsePaseoDeepLink,
  type PaseoDeepLink,
} from "@getpaseo/protocol/deep-link";
import { getHostRuntimeStore } from "@/runtime/host-runtime";
import { useWorkspaceLayoutStore } from "@/stores/workspace-layout-store";
import { paseoDeepLinkToWorkspaceTabTarget } from "@/utils/paseo-deep-link";
import { prepareWorkspaceTab, type PrepareWorkspaceTabDeps } from "@/utils/prepare-workspace-tab";

export interface NativeIntentDeps {
  deferOpenTab?: PrepareWorkspaceTabDeps["openTab"];
  hasKnownHostWhenReady?: (serverId: string) => boolean;
}

function defaultHasKnownHostWhenReady(serverId: string): boolean {
  const store = getHostRuntimeStore();
  // Before the host registry finishes loading on cold start, allow deferring the tab so
  // startup restore can consume it once hosts load. Once ready, reject unknown hosts.
  if (store.getHostRegistryStatus() !== "ready") {
    return true;
  }
  return store.getHosts().some((host) => host.serverId === serverId);
}

/**
 * Rewrites external `paseo://h/...` workspace-tab URLs on iOS/Android into Expo Router's
 * canonical host workspace route while seeding the requested tab in `pendingOpenByWorkspace`.
 * Leaves agent routes, pairing offers, and all other paths untouched.
 */
export function resolveNativeIntentPath(path: string, deps: NativeIntentDeps = {}): string {
  const link: PaseoDeepLink | null = parsePaseoDeepLink(path);
  if (!link) {
    return path;
  }

  const route = buildPaseoDeepLinkRoute(link);
  if (link.kind === "agent" || link.kind === "workspace") {
    return route;
  }

  const hasKnownHost = deps.hasKnownHostWhenReady ?? defaultHasKnownHostWhenReady;
  if (!hasKnownHost(link.serverId)) {
    return route;
  }

  const deferOpenTab = deps.deferOpenTab ?? useWorkspaceLayoutStore.getState().deferOpenTab;
  prepareWorkspaceTab(
    {
      serverId: link.serverId,
      workspaceId: link.workspaceId,
      target: paseoDeepLinkToWorkspaceTabTarget(link),
    },
    { openTab: deferOpenTab },
  );
  return route;
}

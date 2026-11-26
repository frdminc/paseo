import { useEffect, useState } from "react";
import {
  buildPaseoDeepLink,
  parsePaseoDeepLink,
  type PaseoDeepLink,
} from "@getpaseo/protocol/deep-link";
import { useToast } from "@/contexts/toast-context";
import { listenToDesktopEvent } from "@/desktop/electron/events";
import { getDesktopHost } from "@/desktop/host";
import { useStableEvent } from "@/hooks/use-stable-event";
import { useHostRegistryLoaded } from "@/runtime/host-runtime";
import { openPaseoDeepLink } from "@/utils/paseo-deep-link";

type DesktopDeepLinkEventPayload =
  | PaseoDeepLink
  | {
      kind?: unknown;
      serverId?: unknown;
      agentId?: unknown;
      workspaceId?: unknown;
      terminalId?: unknown;
      path?: unknown;
      lineStart?: unknown;
      lineEnd?: unknown;
      focusPath?: unknown;
      sha?: unknown;
      pluginId?: unknown;
      panelId?: unknown;
    };

function normalizeDesktopDeepLinkPayload(
  payload: DesktopDeepLinkEventPayload | null,
): PaseoDeepLink | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  // Legacy agent-only payloads from older desktop main processes omit `kind`.
  const normalizedInput: PaseoDeepLink =
    payload.kind === undefined
      ? {
          kind: "agent",
          serverId: typeof payload.serverId === "string" ? payload.serverId : "",
          agentId: typeof payload.agentId === "string" ? payload.agentId : "",
        }
      : (payload as PaseoDeepLink);

  // Re-validate all IPC payloads through the canonical builder + parser so malformed data
  // (including legacy payloads) cannot bypass deep-link invariants.
  try {
    const candidate = buildPaseoDeepLink(normalizedInput);
    return parsePaseoDeepLink(candidate);
  } catch {
    return null;
  }
}

export function AgentNavigationListener() {
  const toast = useToast();
  const hostRegistryLoaded = useHostRegistryLoaded();
  const [bufferedTargets, setBufferedTargets] = useState<PaseoDeepLink[]>([]);

  const handleDesktopDeepLink = useStableEvent((payload: DesktopDeepLinkEventPayload | null) => {
    const target = normalizeDesktopDeepLinkPayload(payload);
    if (!target) {
      return;
    }
    if (!hostRegistryLoaded) {
      setBufferedTargets((current) => [...current.slice(-7), target]);
      return;
    }
    openPaseoDeepLink(target, { toast });
  });

  useEffect(() => {
    if (!hostRegistryLoaded || bufferedTargets.length === 0) {
      return;
    }
    const targets = bufferedTargets;
    setBufferedTargets([]);
    for (const target of targets) {
      openPaseoDeepLink(target, { toast });
    }
  }, [bufferedTargets, hostRegistryLoaded, toast]);

  useEffect(() => {
    if (!hostRegistryLoaded) {
      return;
    }
    const host = getDesktopHost();
    const ready = host?.agentNavigation?.ready;
    if (typeof host?.events?.on !== "function" || typeof ready !== "function") {
      return;
    }

    let disposed = false;
    let unlisten: (() => void) | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = async () => {
      let dispose: (() => void) | null = null;
      try {
        dispose = await listenToDesktopEvent<DesktopDeepLinkEventPayload>(
          "open-agent",
          handleDesktopDeepLink,
        );
        if (disposed) {
          dispose();
          return;
        }
        unlisten = dispose;
        const pending = await ready();
        if (!disposed && pending) {
          handleDesktopDeepLink(pending as DesktopDeepLinkEventPayload);
        }
      } catch {
        dispose?.();
        if (unlisten === dispose) {
          unlisten = null;
        }
        if (!disposed) {
          retryTimer = setTimeout(() => void connect(), 1_000);
        }
      }
    };

    void connect();

    return () => {
      disposed = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
      unlisten?.();
    };
  }, [handleDesktopDeepLink, hostRegistryLoaded]);

  return null;
}

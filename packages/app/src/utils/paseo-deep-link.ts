import {
  buildPaseoDeepLink,
  normalizeDeepLinkRelativePath,
  parsePaseoDeepLink,
  type PaseoDeepLink,
} from "@getpaseo/protocol/deep-link";
import type { ToastApi } from "@/components/toast-host";
import { i18n } from "@/i18n/i18next";
import { getHostRuntimeStore } from "@/runtime/host-runtime";
import { navigateToWorkspace } from "@/stores/navigation-active-workspace-store";
import { navigateToAgent } from "@/utils/navigate-to-agent";
import { resolveWorkspaceFilePaths } from "@/workspace/file-open";
import type { WorkspaceTabTarget } from "@/workspace-tabs/model";

export type OpenPaseoDeepLinkResult =
  | { ok: true; link: PaseoDeepLink }
  | { ok: false; reason: "invalid" }
  | { ok: false; reason: "unknown_host"; serverId: string };

export interface OpenPaseoDeepLinkDeps {
  hasHost?: (serverId: string) => boolean;
  openAgent?: (input: { serverId: string; agentId: string; pin?: boolean }) => void;
  openWorkspace?: (input: {
    serverId: string;
    workspaceId: string;
    target?: WorkspaceTabTarget;
  }) => void;
  toast?: ToastApi | null;
}

export function paseoDeepLinkToWorkspaceTabTarget(
  link: Exclude<PaseoDeepLink, { kind: "agent" | "workspace" }>,
): WorkspaceTabTarget {
  switch (link.kind) {
    case "terminal":
      return { kind: "terminal", terminalId: link.terminalId };
    case "file":
      return {
        kind: "file",
        path: link.path,
        ...(link.lineStart !== undefined ? { lineStart: link.lineStart } : {}),
        ...(link.lineEnd !== undefined ? { lineEnd: link.lineEnd } : {}),
      };
    case "changes":
      return {
        kind: "working_diff",
        ...(link.focusPath ? { focusPath: link.focusPath } : {}),
      };
    case "commit_diff":
      return { kind: "commit_diff", sha: link.sha };
    case "pull_request":
      return { kind: "pull_request" };
    case "plugin":
      return link.agentId
        ? {
            kind: "plugin",
            pluginId: link.pluginId,
            panelId: link.panelId,
            context: "agent",
            agentId: link.agentId,
          }
        : {
            kind: "plugin",
            pluginId: link.pluginId,
            panelId: link.panelId,
            context: "workspace",
          };
  }
}

function resolveTabRelativePath(path: string, workspaceRoot?: string | null): string | null {
  const trimmedRoot = workspaceRoot?.trim();
  if (trimmedRoot) {
    const resolved = resolveWorkspaceFilePaths({ path, workspaceRoot: trimmedRoot });
    if (!resolved?.relativePath) {
      return null;
    }
    return normalizeDeepLinkRelativePath(resolved.relativePath);
  }
  return normalizeDeepLinkRelativePath(path);
}

/**
 * Builds a canonical `paseo://h/...` deep link for a durable, cross-device workspace tab,
 * or `null` when the tab is ephemeral, client-local (e.g. browser), or outside the workspace root.
 */
function workspaceTabTargetToDeepLink(input: {
  serverId: string;
  workspaceId: string;
  target: WorkspaceTabTarget;
  workspaceRoot?: string | null;
}): PaseoDeepLink | null {
  const { serverId, workspaceId, target, workspaceRoot } = input;
  switch (target.kind) {
    case "agent":
      return { kind: "agent", serverId, agentId: target.agentId };
    case "terminal":
      return { kind: "terminal", serverId, workspaceId, terminalId: target.terminalId };
    case "file": {
      const relativePath = resolveTabRelativePath(target.path, workspaceRoot);
      if (!relativePath) {
        return null;
      }
      return {
        kind: "file",
        serverId,
        workspaceId,
        path: relativePath,
        ...(target.lineStart !== undefined ? { lineStart: target.lineStart } : {}),
        ...(target.lineEnd !== undefined ? { lineEnd: target.lineEnd } : {}),
      };
    }
    case "working_diff": {
      const focusPath = target.focusPath
        ? resolveTabRelativePath(target.focusPath, workspaceRoot)
        : null;
      return { kind: "changes", serverId, workspaceId, ...(focusPath ? { focusPath } : {}) };
    }
    case "commit_diff":
      return { kind: "commit_diff", serverId, workspaceId, sha: target.sha };
    case "pull_request":
      return { kind: "pull_request", serverId, workspaceId };
    case "plugin":
      return {
        kind: "plugin",
        serverId,
        workspaceId,
        pluginId: target.pluginId,
        panelId: target.panelId,
        ...(target.context === "agent" ? { agentId: target.agentId } : {}),
      };
    default:
      return null;
  }
}

/**
 * Builds a canonical `paseo://` deep link for a workspace tab target, or returns `null` for
 * ephemeral / unaddressable tab kinds (`draft`, `new_tab`, `browser`, `setup`, `files`,
 * `changes_tree`, `provider_subagent`).
 */
export function buildWorkspaceTabDeepLink(input: {
  serverId: string;
  workspaceId: string;
  target: WorkspaceTabTarget;
  workspaceRoot?: string | null;
}): string | null {
  const serverId = input.serverId.trim();
  const workspaceId = input.workspaceId.trim();
  if (!serverId || !workspaceId) {
    return null;
  }
  const deepLink = workspaceTabTargetToDeepLink({
    serverId,
    workspaceId,
    target: input.target,
    workspaceRoot: input.workspaceRoot,
  });
  if (!deepLink) {
    return null;
  }
  try {
    return buildPaseoDeepLink(deepLink);
  } catch {
    return null;
  }
}

function defaultHasHost(serverId: string): boolean {
  return getHostRuntimeStore()
    .getHosts()
    .some((host) => host.serverId === serverId);
}

export function openPaseoDeepLink(
  input: string | PaseoDeepLink,
  deps: OpenPaseoDeepLinkDeps = {},
): OpenPaseoDeepLinkResult {
  const link = typeof input === "string" ? parsePaseoDeepLink(input) : input;
  if (!link) {
    return { ok: false, reason: "invalid" };
  }

  const hasHost = deps.hasHost ?? defaultHasHost;
  if (!hasHost(link.serverId)) {
    deps.toast?.error(
      i18n.t("workspace.tabs.toasts.unknownHostLink", {
        hostId: link.serverId,
        defaultValue: `Host "${link.serverId}" is not connected to this Paseo app.`,
      }),
    );
    return { ok: false, reason: "unknown_host", serverId: link.serverId };
  }

  if (link.kind === "agent") {
    (deps.openAgent ?? navigateToAgent)({
      serverId: link.serverId,
      agentId: link.agentId,
      pin: true,
    });
    return { ok: true, link };
  }

  const openWorkspace = deps.openWorkspace ?? navigateToWorkspace;
  if (link.kind === "workspace") {
    openWorkspace({ serverId: link.serverId, workspaceId: link.workspaceId });
    return { ok: true, link };
  }

  openWorkspace({
    serverId: link.serverId,
    workspaceId: link.workspaceId,
    target: paseoDeepLinkToWorkspaceTabTarget(link),
  });
  return { ok: true, link };
}

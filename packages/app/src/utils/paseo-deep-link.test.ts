import { describe, expect, it, vi } from "vitest";
import {
  buildWorkspaceTabDeepLink,
  openPaseoDeepLink,
  paseoDeepLinkToWorkspaceTabTarget,
} from "./paseo-deep-link";

describe("paseo deep link app helpers", () => {
  it("builds canonical links for durable tab kinds and returns null for non-linkable tabs", () => {
    expect(
      buildWorkspaceTabDeepLink({
        serverId: "srv_1",
        workspaceId: "wks_1",
        target: { kind: "agent", agentId: "agt_1" },
      }),
    ).toBe("paseo://h/srv_1/agent/agt_1");

    expect(
      buildWorkspaceTabDeepLink({
        serverId: "srv_1",
        workspaceId: "wks_1",
        target: { kind: "terminal", terminalId: "trm_1" },
      }),
    ).toBe("paseo://h/srv_1/workspace/wks_1/terminal/trm_1");

    expect(
      buildWorkspaceTabDeepLink({
        serverId: "srv_1",
        workspaceId: "wks_1",
        workspaceRoot: "/repo",
        target: { kind: "file", path: "/repo/docs/spec (v2).md", lineStart: 4, lineEnd: 8 },
      }),
    ).toBe("paseo://h/srv_1/workspace/wks_1/file?path=docs%2Fspec%20%28v2%29.md&line=4&endLine=8");

    // File outside workspace root is not linkable.
    expect(
      buildWorkspaceTabDeepLink({
        serverId: "srv_1",
        workspaceId: "wks_1",
        workspaceRoot: "/repo",
        target: { kind: "file", path: "/etc/hosts" },
      }),
    ).toBeNull();

    expect(
      buildWorkspaceTabDeepLink({
        serverId: "srv_1",
        workspaceId: "wks_1",
        target: { kind: "working_diff", focusPath: "src/app.ts" },
      }),
    ).toBe("paseo://h/srv_1/workspace/wks_1/changes?path=src%2Fapp.ts");

    expect(
      buildWorkspaceTabDeepLink({
        serverId: "srv_1",
        workspaceId: "wks_1",
        target: { kind: "commit_diff", sha: "4201a4de" },
      }),
    ).toBe("paseo://h/srv_1/workspace/wks_1/commit/4201a4de");

    expect(
      buildWorkspaceTabDeepLink({
        serverId: "srv_1",
        workspaceId: "wks_1",
        target: { kind: "pull_request" },
      }),
    ).toBe("paseo://h/srv_1/workspace/wks_1/pull-request");

    expect(
      buildWorkspaceTabDeepLink({
        serverId: "srv_1",
        workspaceId: "wks_1",
        target: {
          kind: "plugin",
          pluginId: "progress",
          panelId: "board",
          context: "agent",
          agentId: "agt_2",
        },
      }),
    ).toBe("paseo://h/srv_1/workspace/wks_1/plugin/progress/board?agentId=agt_2");

    // Ephemeral & client-local tab kinds return null.
    for (const target of [
      { kind: "browser" as const, browserId: "br_1" },
      { kind: "draft" as const, draftId: "dr_1" },
      { kind: "new_tab" as const },
      { kind: "setup" as const, workspaceId: "wks_1" },
      { kind: "files" as const },
      { kind: "changes_tree" as const },
    ]) {
      expect(
        buildWorkspaceTabDeepLink({ serverId: "srv_1", workspaceId: "wks_1", target }),
      ).toBeNull();
    }
  });

  it("maps deep links to workspace tab targets", () => {
    expect(
      paseoDeepLinkToWorkspaceTabTarget({
        kind: "plugin",
        serverId: "srv_1",
        workspaceId: "wks_1",
        pluginId: "p1",
        panelId: "panel1",
      }),
    ).toEqual({ kind: "plugin", pluginId: "p1", panelId: "panel1", context: "workspace" });

    expect(
      paseoDeepLinkToWorkspaceTabTarget({
        kind: "file",
        serverId: "srv_1",
        workspaceId: "wks_1",
        path: "src/index.ts",
        lineStart: 10,
      }),
    ).toEqual({ kind: "file", path: "src/index.ts", lineStart: 10 });
  });

  it("routes agent, workspace, and tab deep links for known hosts", () => {
    const openAgent = vi.fn();
    const openWorkspace = vi.fn();
    const deps = { hasHost: (id: string) => id === "srv_1", openAgent, openWorkspace };

    expect(openPaseoDeepLink("paseo://h/srv_1/agent/agt_1", deps)).toEqual({
      ok: true,
      link: { kind: "agent", serverId: "srv_1", agentId: "agt_1" },
    });
    expect(openAgent).toHaveBeenCalledWith({ serverId: "srv_1", agentId: "agt_1", pin: true });

    expect(openPaseoDeepLink("paseo://h/srv_1/workspace/wks_1/terminal/trm_9", deps)).toEqual({
      ok: true,
      link: { kind: "terminal", serverId: "srv_1", workspaceId: "wks_1", terminalId: "trm_9" },
    });
    expect(openWorkspace).toHaveBeenCalledWith({
      serverId: "srv_1",
      workspaceId: "wks_1",
      target: { kind: "terminal", terminalId: "trm_9" },
    });

    expect(openPaseoDeepLink("paseo://h/srv_1/workspace/wks_1", deps)).toEqual({
      ok: true,
      link: { kind: "workspace", serverId: "srv_1", workspaceId: "wks_1" },
    });
    expect(openWorkspace).toHaveBeenCalledWith({ serverId: "srv_1", workspaceId: "wks_1" });
  });

  it("rejects unknown hosts with an error toast and never navigates", () => {
    const openAgent = vi.fn();
    const openWorkspace = vi.fn();
    const toast = { show: vi.fn(), copied: vi.fn(), error: vi.fn() };

    const result = openPaseoDeepLink("paseo://h/unknown_srv/workspace/wks_1/terminal/trm_1", {
      hasHost: () => false,
      openAgent,
      openWorkspace,
      toast,
    });

    expect(result).toEqual({ ok: false, reason: "unknown_host", serverId: "unknown_srv" });
    expect(openAgent).not.toHaveBeenCalled();
    expect(openWorkspace).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledTimes(1);
  });

  it("returns invalid for malformed URLs", () => {
    const openWorkspace = vi.fn();
    expect(
      openPaseoDeepLink("paseo://h/srv_1/workspace/wks_1/file?path=../secret", {
        hasHost: () => true,
        openWorkspace,
      }),
    ).toEqual({ ok: false, reason: "invalid" });
    expect(openWorkspace).not.toHaveBeenCalled();
  });
});

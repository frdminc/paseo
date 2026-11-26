import { describe, expect, it, vi } from "vitest";
import { resolveNativeIntentPath } from "./native-intent";

describe("resolveNativeIntentPath", () => {
  it("passes non-tab and non-paseo paths through unchanged", () => {
    const deferOpenTab = vi.fn();
    expect(resolveNativeIntentPath("/settings/general", { deferOpenTab })).toBe(
      "/settings/general",
    );
    expect(resolveNativeIntentPath("paseo://pair#offer=abc", { deferOpenTab })).toBe(
      "paseo://pair#offer=abc",
    );
    expect(resolveNativeIntentPath("relay://connect", { deferOpenTab })).toBe("relay://connect");
    expect(deferOpenTab).not.toHaveBeenCalled();
  });

  it("rewrites agent and workspace deep links without queuing a workspace tab", () => {
    const deferOpenTab = vi.fn();
    expect(resolveNativeIntentPath("paseo://h/srv_1/agent/agt_1", { deferOpenTab })).toBe(
      "/h/srv_1/agent/agt_1",
    );
    expect(resolveNativeIntentPath("paseo://h/srv_1/workspace/wks_1", { deferOpenTab })).toBe(
      "/h/srv_1/workspace/wks_1",
    );
    expect(deferOpenTab).not.toHaveBeenCalled();
  });

  it("defers the tab target and rewrites workspace-tab deep links to the workspace route", () => {
    const deferOpenTab = vi.fn().mockReturnValue(null);
    expect(
      resolveNativeIntentPath("paseo://h/srv_1/workspace/wks_1/terminal/trm_9", { deferOpenTab }),
    ).toBe("/h/srv_1/workspace/wks_1");
    expect(deferOpenTab).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceKey: "srv_1:wks_1",
        target: { kind: "terminal", terminalId: "trm_9" },
        intent: "reveal",
      }),
    );
  });

  it("defers file deep links with line numbers", () => {
    const deferOpenTab = vi.fn().mockReturnValue(null);
    expect(
      resolveNativeIntentPath(
        "paseo://h/srv_1/workspace/wks_1/file?path=src%2Fapp.ts&line=12&endLine=20",
        { deferOpenTab },
      ),
    ).toBe("/h/srv_1/workspace/wks_1");
    expect(deferOpenTab).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceKey: "srv_1:wks_1",
        target: { kind: "file", path: "src/app.ts", lineStart: 12, lineEnd: 20 },
        intent: "reveal",
      }),
    );
  });

  it("skips deferOpenTab when the host registry is ready and the host is unknown", () => {
    const deferOpenTab = vi.fn().mockReturnValue(null);
    expect(
      resolveNativeIntentPath("paseo://h/srv_unknown/workspace/wks_1/terminal/trm_9", {
        deferOpenTab,
        hasKnownHostWhenReady: () => false,
      }),
    ).toBe("/h/srv_unknown/workspace/wks_1");
    expect(deferOpenTab).not.toHaveBeenCalled();
  });
});

import { describe, expect, it } from "vitest";
import {
  buildPaseoDeepLink,
  buildPaseoDeepLinkRoute,
  decodeWorkspaceIdSegment,
  encodeWorkspaceIdSegment,
  isPaseoDeepLinkUrl,
  normalizeDeepLinkRelativePath,
  parsePaseoDeepLink,
  type PaseoDeepLink,
} from "./deep-link.js";

describe("paseo deep links", () => {
  const roundTripCases: Array<{ name: string; target: PaseoDeepLink; expectedUrl: string }> = [
    {
      name: "agent target delegates to canonical agent deep link",
      target: { kind: "agent", serverId: "srv_1", agentId: "agt_abc" },
      expectedUrl: "paseo://h/srv_1/agent/agt_abc",
    },
    {
      name: "workspace target",
      target: { kind: "workspace", serverId: "srv_1", workspaceId: "wks_main" },
      expectedUrl: "paseo://h/srv_1/workspace/wks_main",
    },
    {
      name: "terminal target",
      target: {
        kind: "terminal",
        serverId: "srv_1",
        workspaceId: "wks_main",
        terminalId: "trm_42",
      },
      expectedUrl: "paseo://h/srv_1/workspace/wks_main/terminal/trm_42",
    },
    {
      name: "file target with RFC 3986 encoding for parentheses and spaces",
      target: {
        kind: "file",
        serverId: "srv_1",
        workspaceId: "wks_main",
        path: "docs/spec (v2).md",
        lineStart: 12,
        lineEnd: 24,
      },
      expectedUrl:
        "paseo://h/srv_1/workspace/wks_main/file?path=docs%2Fspec%20%28v2%29.md&line=12&endLine=24",
    },
    {
      name: "file target with single line",
      target: {
        kind: "file",
        serverId: "srv_1",
        workspaceId: "wks_main",
        path: "src/index.ts",
        lineStart: 7,
      },
      expectedUrl: "paseo://h/srv_1/workspace/wks_main/file?path=src%2Findex.ts&line=7",
    },
    {
      name: "changes target without focusPath",
      target: { kind: "changes", serverId: "srv_1", workspaceId: "wks_main" },
      expectedUrl: "paseo://h/srv_1/workspace/wks_main/changes",
    },
    {
      name: "changes target with focusPath",
      target: {
        kind: "changes",
        serverId: "srv_1",
        workspaceId: "wks_main",
        focusPath: "packages/app/src/index.ts",
      },
      expectedUrl:
        "paseo://h/srv_1/workspace/wks_main/changes?path=packages%2Fapp%2Fsrc%2Findex.ts",
    },
    {
      name: "commit diff target",
      target: {
        kind: "commit_diff",
        serverId: "srv_1",
        workspaceId: "wks_main",
        sha: "4201a4de3",
      },
      expectedUrl: "paseo://h/srv_1/workspace/wks_main/commit/4201a4de3",
    },
    {
      name: "pull request target",
      target: { kind: "pull_request", serverId: "srv_1", workspaceId: "wks_main" },
      expectedUrl: "paseo://h/srv_1/workspace/wks_main/pull-request",
    },
    {
      name: "workspace-scoped plugin panel target",
      target: {
        kind: "plugin",
        serverId: "srv_1",
        workspaceId: "wks_main",
        pluginId: "my-plugin",
        panelId: "dashboard",
      },
      expectedUrl: "paseo://h/srv_1/workspace/wks_main/plugin/my-plugin/dashboard",
    },
    {
      name: "agent-scoped plugin panel target",
      target: {
        kind: "plugin",
        serverId: "srv_1",
        workspaceId: "wks_main",
        pluginId: "my-plugin",
        panelId: "inspector",
        agentId: "agt_9",
      },
      expectedUrl: "paseo://h/srv_1/workspace/wks_main/plugin/my-plugin/inspector?agentId=agt_9",
    },
  ];

  for (const testCase of roundTripCases) {
    it(`round-trips ${testCase.name}`, () => {
      const url = buildPaseoDeepLink(testCase.target);
      expect(url).toBe(testCase.expectedUrl);
      expect(parsePaseoDeepLink(url)).toEqual(testCase.target);
      expect(isPaseoDeepLinkUrl(url)).toBe(true);
    });
  }

  it("encodes non-URL-safe workspace IDs with b64_ matching host-routes", () => {
    const encoded = encodeWorkspaceIdSegment("/Users/dev/my repo");
    expect(encoded.startsWith("b64_")).toBe(true);
    expect(decodeWorkspaceIdSegment(encoded)).toBe("/Users/dev/my repo");

    const target: PaseoDeepLink = {
      kind: "terminal",
      serverId: "srv_1",
      workspaceId: "/Users/dev/my repo",
      terminalId: "trm_1",
    };
    const url = buildPaseoDeepLink(target);
    expect(url).toBe(`paseo://h/srv_1/workspace/${encoded}/terminal/trm_1`);
    expect(parsePaseoDeepLink(url)).toEqual(target);
  });

  it("omits redundant endLine when equal to lineStart", () => {
    const url = buildPaseoDeepLink({
      kind: "file",
      serverId: "srv_1",
      workspaceId: "wks_1",
      path: "README.md",
      lineStart: 10,
      lineEnd: 10,
    });
    expect(url).toBe("paseo://h/srv_1/workspace/wks_1/file?path=README.md&line=10");
  });

  it("builds Expo Router-safe routes for agent and workspace targets", () => {
    expect(buildPaseoDeepLinkRoute({ kind: "agent", serverId: "srv_1", agentId: "agt_1" })).toBe(
      "/h/srv_1/agent/agt_1",
    );
    expect(
      buildPaseoDeepLinkRoute({
        kind: "terminal",
        serverId: "srv_1",
        workspaceId: "wks_1",
        terminalId: "trm_1",
      }),
    ).toBe("/h/srv_1/workspace/wks_1");
  });

  it("rejects absolute paths, home paths, backslashes, and traversal in file/changes paths", () => {
    const badPaths = [
      "",
      "/",
      "/etc/passwd",
      "//server/share/a.ts",
      "C:/Windows/win.ini",
      "~/secret",
      "~",
      "../outside.ts",
      "a/../../outside.ts",
      "src\\file.ts",
      "C:secret.txt",
      "src/\u0000evil.ts",
    ];
    for (const badPath of badPaths) {
      expect(normalizeDeepLinkRelativePath(badPath)).toBeNull();
      expect(
        parsePaseoDeepLink(
          `paseo://h/srv_1/workspace/wks_1/file?path=${encodeURIComponent(badPath)}`,
        ),
      ).toBeNull();
      expect(
        parsePaseoDeepLink(
          `paseo://h/srv_1/workspace/wks_1/changes?path=${encodeURIComponent(badPath)}`,
        ),
      ).toBeNull();
    }
  });

  it("rejects malformed, unauthorized, or unknown deep links", () => {
    const invalidUrls = [
      "",
      "https://h/srv/workspace/wks",
      "paseo://app/h/srv/workspace/wks",
      "paseo://user@h/srv/workspace/wks",
      "paseo://h:8080/srv/workspace/wks",
      "paseo://h/srv/workspace/wks#hash",
      "paseo://h/srv/workspace/wks/",
      "paseo://h/srv/workspace/wks?extra=1",
      "paseo://h/srv/workspace/wks/terminal/t1?extra=1",
      "paseo://h/srv/workspace/wks/terminal/",
      "paseo://h/srv/workspace/wks/file",
      "paseo://h/srv/workspace/wks/file?path=a.ts&endLine=5",
      "paseo://h/srv/workspace/wks/file?path=a.ts&line=10&endLine=5",
      "paseo://h/srv/workspace/wks/file?path=a.ts&line=0",
      "paseo://h/srv/workspace/wks/file?path=a.ts&line=abc",
      "paseo://h/srv/workspace/wks/file?path=a.ts&path=b.ts",
      "paseo://h/srv/workspace/wks/commit/not-a-sha!",
      "paseo://h/srv/workspace/wks/commit/abc",
      "paseo://h/srv/workspace/wks/unknown/123",
      "paseo://h/srv/workspace/wks/browser/br_1",
      "paseo://h/srv/workspace/wks/plugin/only-one",
      "paseo://h/srv/workspace/wks/plugin/p1/pan1?agentId=",
      "paseo://h/srv/workspace/wks/pull-request?foo=bar",
      "paseo://h/%2e%2e/workspace/wks_1",
      "paseo://h/srv_1/workspace/%2e%2e",
      "paseo://h/srv_1/workspace/b64_Li4",
      "paseo://h/%2e%2e/agent/%2e%2e",
      "paseo://h/srv_1/agent/agt%00evil",
      "paseo://h/srv%0a/agent/agt_1",
      "paseo://h//srv_1///agent//agt_1/",
      " paseo://h/srv_1/workspace/wks_1",
      "paseo://h/srv_1/workspace/wks_1?",
      "paseo://h/srv_1/workspace/wks_1#",
      `paseo://h/srv/workspace/${"a".repeat(5000)}`,
    ];
    for (const candidate of invalidUrls) {
      expect(parsePaseoDeepLink(candidate), candidate).toBeNull();
    }
  });
});

import { describe, expect, it } from "vitest";
import {
  AgentNavigationInbox,
  parseAgentDeepLinkFromArgv,
  parseDeepLinkFromArgv,
} from "./agent-navigation.js";

describe("desktop agent navigation", () => {
  it("finds an agent deep link among Electron launch arguments", () => {
    expect(
      parseAgentDeepLinkFromArgv([
        "/Applications/Paseo.app/Contents/MacOS/Paseo",
        "--no-sandbox",
        "paseo://h/server-1/agent/agent-2",
      ]),
    ).toEqual({ serverId: "server-1", agentId: "agent-2" });
  });

  it("finds any valid Paseo workspace/tab deep link among Electron launch arguments", () => {
    expect(
      parseDeepLinkFromArgv([
        "/Applications/Paseo.app/Contents/MacOS/Paseo",
        "--no-sandbox",
        "paseo://h/server-1/workspace/wks_1/terminal/trm_9",
      ]),
    ).toEqual({
      kind: "terminal",
      serverId: "server-1",
      workspaceId: "wks_1",
      terminalId: "trm_9",
    });

    expect(
      parseDeepLinkFromArgv([
        "/Applications/Paseo.app/Contents/MacOS/Paseo",
        "paseo://h/server-1/workspace/wks_1/file?path=src%2Fapp.ts&line=12",
      ]),
    ).toEqual({
      kind: "file",
      serverId: "server-1",
      workspaceId: "wks_1",
      path: "src/app.ts",
      lineStart: 12,
    });

    expect(
      parseDeepLinkFromArgv([
        "/Applications/Paseo.app/Contents/MacOS/Paseo",
        "paseo://h/server-1/workspace/wks_1/file?path=../secret",
      ]),
    ).toBeNull();
  });

  it("holds navigation until the existing renderer is ready", () => {
    const inbox = new AgentNavigationInbox();
    const target = { kind: "agent" as const, serverId: "server-1", agentId: "agent-2" };

    expect(inbox.deliverOrQueue(7, target)).toBeNull();
    expect(inbox.windowReady(7)).toEqual(target);
    expect(inbox.deliverOrQueue(7, target)).toEqual(target);
  });

  it("returns only the newest navigation queued during startup", () => {
    const inbox = new AgentNavigationInbox();

    inbox.deliverOrQueue(7, { kind: "agent", serverId: "server-1", agentId: "agent-1" });
    inbox.deliverOrQueue(7, {
      kind: "terminal",
      serverId: "server-1",
      workspaceId: "wks_1",
      terminalId: "trm_2",
    });

    expect(inbox.windowReady(7)).toEqual({
      kind: "terminal",
      serverId: "server-1",
      workspaceId: "wks_1",
      terminalId: "trm_2",
    });
    expect(inbox.windowReady(7)).toBeNull();
  });
});

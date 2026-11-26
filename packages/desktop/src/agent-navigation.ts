import { parseAgentDeepLink, type AgentDeepLinkTarget } from "@getpaseo/protocol/agent-deep-link";
import { parsePaseoDeepLink, type PaseoDeepLink } from "@getpaseo/protocol/deep-link";

export function parseAgentDeepLinkFromArgv(argv: string[]): AgentDeepLinkTarget | null {
  for (const arg of argv) {
    const target = parseAgentDeepLink(arg);
    if (target) {
      return target;
    }
  }
  return null;
}

export function parseDeepLinkFromArgv(argv: string[]): PaseoDeepLink | null {
  for (const arg of argv) {
    const target = parsePaseoDeepLink(arg);
    if (target) {
      return target;
    }
  }
  return null;
}

export class AgentNavigationInbox<TTarget = PaseoDeepLink> {
  private readonly readyWindows = new Set<number>();
  private readonly pendingByWindow = new Map<number, TTarget>();

  windowLoading(webContentsId: number): void {
    this.readyWindows.delete(webContentsId);
  }

  windowReady(webContentsId: number): TTarget | null {
    this.readyWindows.add(webContentsId);
    const pending = this.pendingByWindow.get(webContentsId) ?? null;
    this.pendingByWindow.delete(webContentsId);
    return pending;
  }

  deliverOrQueue(webContentsId: number, target: TTarget): TTarget | null {
    if (this.readyWindows.has(webContentsId)) {
      return target;
    }
    this.pendingByWindow.set(webContentsId, target);
    return null;
  }

  removeWindow(webContentsId: number): void {
    this.readyWindows.delete(webContentsId);
    this.pendingByWindow.delete(webContentsId);
  }
}

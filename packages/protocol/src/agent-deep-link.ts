export interface AgentDeepLinkTarget {
  serverId: string;
  agentId: string;
}

const MAX_AGENT_DEEP_LINK_LENGTH = 4096;

function hasControlChars(value: string): boolean {
  for (const ch of value) {
    const code = ch.codePointAt(0);
    if (code === undefined) continue;
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

function normalizeSegment(value: string): string | null {
  if (hasControlChars(value)) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed === "." || trimmed === "..") {
    return null;
  }
  return trimmed;
}

/** RFC 3986 encoding (also encodes ! ' ( ) * so links never break CommonMark delimiters). */
function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function normalizeAgentDeepLinkTarget(target: AgentDeepLinkTarget): AgentDeepLinkTarget {
  const serverId = normalizeSegment(target.serverId);
  const agentId = normalizeSegment(target.agentId);
  if (!serverId || !agentId) {
    throw new Error("Agent deep links require a valid server ID and agent ID.");
  }
  return { serverId, agentId };
}

export function buildAgentDeepLinkRoute(
  target: AgentDeepLinkTarget,
): `/h/${string}/agent/${string}` {
  const { serverId, agentId } = normalizeAgentDeepLinkTarget(target);
  return `/h/${encodeRfc3986(serverId)}/agent/${encodeRfc3986(agentId)}`;
}

export function buildAgentDeepLink(target: AgentDeepLinkTarget): string {
  return `paseo:/${buildAgentDeepLinkRoute(target)}`;
}

function isValidAgentDeepLinkUrl(url: URL): boolean {
  if (
    url.protocol !== "paseo:" ||
    url.hostname !== "h" ||
    url.username ||
    url.password ||
    url.port ||
    url.search ||
    url.hash
  ) {
    return false;
  }
  return !(url.pathname.includes("//") || (url.pathname.length > 1 && url.pathname.endsWith("/")));
}

export function parseAgentDeepLink(input: string): AgentDeepLinkTarget | null {
  if (
    typeof input !== "string" ||
    input.length === 0 ||
    input.length > MAX_AGENT_DEEP_LINK_LENGTH ||
    input !== input.trim() ||
    hasControlChars(input) ||
    input.includes("#") ||
    input.includes("?")
  ) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }

  if (!isValidAgentDeepLinkUrl(url)) {
    return null;
  }

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length !== 3 || segments[1] !== "agent") {
    return null;
  }

  try {
    const serverId = normalizeSegment(decodeURIComponent(segments[0] ?? ""));
    const agentId = normalizeSegment(decodeURIComponent(segments[2] ?? ""));
    return serverId && agentId ? { serverId, agentId } : null;
  } catch {
    return null;
  }
}

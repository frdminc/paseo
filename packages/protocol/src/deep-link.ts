import {
  buildAgentDeepLink,
  buildAgentDeepLinkRoute,
  parseAgentDeepLink,
} from "./agent-deep-link.js";

export type PaseoDeepLink =
  | { kind: "agent"; serverId: string; agentId: string }
  | { kind: "workspace"; serverId: string; workspaceId: string }
  | { kind: "terminal"; serverId: string; workspaceId: string; terminalId: string }
  | {
      kind: "file";
      serverId: string;
      workspaceId: string;
      path: string;
      lineStart?: number;
      lineEnd?: number;
    }
  | { kind: "changes"; serverId: string; workspaceId: string; focusPath?: string }
  | { kind: "commit_diff"; serverId: string; workspaceId: string; sha: string }
  | { kind: "pull_request"; serverId: string; workspaceId: string }
  | {
      kind: "plugin";
      serverId: string;
      workspaceId: string;
      pluginId: string;
      panelId: string;
      agentId?: string;
    };

const MAX_DEEP_LINK_LENGTH = 4096;
const BASE64_WORKSPACE_ID_PREFIX = "b64_";
const URL_SAFE_WORKSPACE_ID = /^[A-Za-z0-9._~-]+$/;
const POSITIVE_INTEGER = /^[1-9]\d*$/;
const COMMIT_SHA = /^[0-9a-f]{4,64}$/i;
const WINDOWS_DRIVE_PREFIX = /^[A-Za-z]:/;

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

function normalizeWorkspaceId(value: string): string | null {
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

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function encodeBase64UrlUtf8(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let output = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0;
    const b1 = bytes[i + 1] ?? 0;
    const b2 = bytes[i + 2] ?? 0;
    const triplet = (b0 << 16) | (b1 << 8) | b2;
    output += BASE64_ALPHABET[(triplet >> 18) & 0x3f];
    output += BASE64_ALPHABET[(triplet >> 12) & 0x3f];
    if (i + 1 < bytes.length) {
      output += BASE64_ALPHABET[(triplet >> 6) & 0x3f];
    }
    if (i + 2 < bytes.length) {
      output += BASE64_ALPHABET[triplet & 0x3f];
    }
  }
  return output;
}

function decodeBase64UrlUtf8(input: string): string | null {
  if (!input || !/^[A-Za-z0-9_-]+$/.test(input) || input.length % 4 === 1) {
    return null;
  }
  const bytes: number[] = [];
  for (let i = 0; i < input.length; i += 4) {
    const c0 = BASE64_ALPHABET.indexOf(input[i] ?? "");
    const c1 = BASE64_ALPHABET.indexOf(input[i + 1] ?? "");
    const c2 = i + 2 < input.length ? BASE64_ALPHABET.indexOf(input[i + 2] ?? "") : -1;
    const c3 = i + 3 < input.length ? BASE64_ALPHABET.indexOf(input[i + 3] ?? "") : -1;
    if (c0 < 0 || c1 < 0) return null;
    bytes.push((c0 << 2) | (c1 >> 4));
    if (c2 >= 0) {
      bytes.push(((c1 & 0x0f) << 4) | (c2 >> 2));
      if (c3 >= 0) {
        bytes.push(((c2 & 0x03) << 6) | c3);
      }
    }
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes));
  } catch {
    return null;
  }
}

export function encodeWorkspaceIdSegment(workspaceId: string): string {
  const normalized = normalizeWorkspaceId(workspaceId);
  if (!normalized) {
    throw new Error("Workspace deep links require a valid workspace ID.");
  }
  if (
    URL_SAFE_WORKSPACE_ID.test(normalized) &&
    !normalized.startsWith(BASE64_WORKSPACE_ID_PREFIX)
  ) {
    return normalized;
  }
  return `${BASE64_WORKSPACE_ID_PREFIX}${encodeBase64UrlUtf8(normalized)}`;
}

export function decodeWorkspaceIdSegment(segment: string): string | null {
  const normalized = normalizeWorkspaceId(segment);
  if (!normalized) {
    return null;
  }
  if (normalized.startsWith(BASE64_WORKSPACE_ID_PREFIX)) {
    const payload = normalized.slice(BASE64_WORKSPACE_ID_PREFIX.length);
    const decoded = decodeBase64UrlUtf8(payload);
    if (!decoded) return null;
    return normalizeWorkspaceId(decoded);
  }
  return normalized.includes("/") ? null : normalized;
}

/**
 * Validates and normalizes a workspace-relative POSIX path for deep links.
 * Rejects absolute paths, home-relative paths, backslashes, control characters,
 * and `..` traversal segments so deep links remain strictly workspace-scoped.
 */
export function normalizeDeepLinkRelativePath(value: string): string | null {
  if (hasControlChars(value)) {
    return null;
  }
  const trimmed = value.trim();
  if (
    !trimmed ||
    trimmed.includes("\\") ||
    trimmed.startsWith("/") ||
    trimmed === "~" ||
    trimmed.startsWith("~/") ||
    WINDOWS_DRIVE_PREFIX.test(trimmed)
  ) {
    return null;
  }
  const rawSegments = trimmed.split("/");
  const cleanSegments: string[] = [];
  for (const segment of rawSegments) {
    if (!segment || segment === ".") {
      continue;
    }
    if (segment === "..") {
      return null;
    }
    cleanSegments.push(segment);
  }
  return cleanSegments.length > 0 ? cleanSegments.join("/") : null;
}

function parsePositiveLineParam(value: string | null): number | null {
  if (value === null) return null;
  if (!POSITIVE_INTEGER.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseSingleSearchParams(
  search: string,
  allowedKeys: ReadonlySet<string>,
): Map<string, string> | null {
  const result = new Map<string, string>();
  if (!search) {
    return result;
  }
  const params = new URLSearchParams(search);
  for (const [key, value] of params.entries()) {
    if (!allowedKeys.has(key) || result.has(key)) {
      return null;
    }
    result.set(key, value);
  }
  return result;
}

function decodePathSegment(raw: string): string | null {
  if (!raw) return null;
  try {
    return normalizeSegment(decodeURIComponent(raw));
  } catch {
    return null;
  }
}

export function buildPaseoDeepLinkRoute(target: PaseoDeepLink): string {
  if (target.kind === "agent") {
    return buildAgentDeepLinkRoute(target);
  }
  const serverId = normalizeSegment(target.serverId);
  if (!serverId) {
    throw new Error("Paseo deep links require a non-empty server ID.");
  }
  const encodedWorkspaceId = encodeWorkspaceIdSegment(target.workspaceId);
  return `/h/${encodeRfc3986(serverId)}/workspace/${encodeRfc3986(encodedWorkspaceId)}`;
}

function buildFileDeepLink(
  baseUrl: string,
  target: Extract<PaseoDeepLink, { kind: "file" }>,
): string {
  const relativePath = normalizeDeepLinkRelativePath(target.path);
  if (!relativePath) {
    throw new Error("File deep links require a valid workspace-relative POSIX path.");
  }
  const queryParts = [`path=${encodeRfc3986(relativePath)}`];
  if (target.lineStart !== undefined) {
    if (!Number.isSafeInteger(target.lineStart) || target.lineStart <= 0) {
      throw new Error("File deep link lineStart must be a positive integer.");
    }
    queryParts.push(`line=${target.lineStart}`);
    if (target.lineEnd !== undefined) {
      if (!Number.isSafeInteger(target.lineEnd) || target.lineEnd < target.lineStart) {
        throw new Error("File deep link lineEnd must be >= lineStart.");
      }
      if (target.lineEnd !== target.lineStart) {
        queryParts.push(`endLine=${target.lineEnd}`);
      }
    }
  }
  return `${baseUrl}/file?${queryParts.join("&")}`;
}

function buildChangesDeepLink(
  baseUrl: string,
  target: Extract<PaseoDeepLink, { kind: "changes" }>,
): string {
  if (target.focusPath === undefined) {
    return `${baseUrl}/changes`;
  }
  const relativePath = normalizeDeepLinkRelativePath(target.focusPath);
  if (!relativePath) {
    throw new Error("Changes deep link focusPath must be a valid workspace-relative path.");
  }
  return `${baseUrl}/changes?path=${encodeRfc3986(relativePath)}`;
}

function buildPluginDeepLink(
  baseUrl: string,
  target: Extract<PaseoDeepLink, { kind: "plugin" }>,
): string {
  const pluginId = normalizeSegment(target.pluginId);
  const panelId = normalizeSegment(target.panelId);
  if (!pluginId || !panelId) {
    throw new Error("Plugin panel deep links require a plugin ID and panel ID.");
  }
  const path = `${baseUrl}/plugin/${encodeRfc3986(pluginId)}/${encodeRfc3986(panelId)}`;
  if (target.agentId !== undefined) {
    const agentId = normalizeSegment(target.agentId);
    if (!agentId) {
      throw new Error("Plugin panel deep link agentId must be non-empty when provided.");
    }
    return `${path}?agentId=${encodeRfc3986(agentId)}`;
  }
  return path;
}

export function buildPaseoDeepLink(target: PaseoDeepLink): string {
  if (target.kind === "agent") {
    return buildAgentDeepLink(target);
  }
  const baseUrl = `paseo:/${buildPaseoDeepLinkRoute(target)}`;
  switch (target.kind) {
    case "workspace":
      return baseUrl;
    case "terminal": {
      const terminalId = normalizeSegment(target.terminalId);
      if (!terminalId) {
        throw new Error("Terminal deep links require a non-empty terminal ID.");
      }
      return `${baseUrl}/terminal/${encodeRfc3986(terminalId)}`;
    }
    case "file":
      return buildFileDeepLink(baseUrl, target);
    case "changes":
      return buildChangesDeepLink(baseUrl, target);
    case "commit_diff": {
      const sha = normalizeSegment(target.sha);
      if (!sha || !COMMIT_SHA.test(sha)) {
        throw new Error("Commit diff deep links require a valid commit SHA.");
      }
      return `${baseUrl}/commit/${encodeRfc3986(sha)}`;
    }
    case "pull_request":
      return `${baseUrl}/pull-request`;
    case "plugin":
      return buildPluginDeepLink(baseUrl, target);
    default:
      throw new Error("Unsupported deep link target kind.");
  }
}

const NO_PARAMS = new Set<string>();
const FILE_PARAMS = new Set<string>(["path", "line", "endLine"]);
const CHANGES_PARAMS = new Set<string>(["path"]);
const PLUGIN_PARAMS = new Set<string>(["agentId"]);

function parseFileDeepLink(
  serverId: string,
  workspaceId: string,
  search: string,
): PaseoDeepLink | null {
  const params = parseSingleSearchParams(search, FILE_PARAMS);
  const rawPath = params?.get("path");
  const path = rawPath ? normalizeDeepLinkRelativePath(rawPath) : null;
  if (!params || !path) {
    return null;
  }

  const rawLine = params.get("line");
  const rawEndLine = params.get("endLine");
  if (rawEndLine !== undefined && rawLine === undefined) {
    return null;
  }
  const lineStart = rawLine !== undefined ? parsePositiveLineParam(rawLine) : undefined;
  if (rawLine !== undefined && lineStart === null) {
    return null;
  }
  const lineEnd = rawEndLine !== undefined ? parsePositiveLineParam(rawEndLine) : undefined;
  if (rawEndLine !== undefined && (lineEnd == null || lineStart == null || lineEnd < lineStart)) {
    return null;
  }

  return {
    kind: "file",
    serverId,
    workspaceId,
    path,
    ...(lineStart != null ? { lineStart } : {}),
    ...(lineEnd != null ? { lineEnd } : {}),
  };
}

function parseChangesDeepLink(
  serverId: string,
  workspaceId: string,
  search: string,
): PaseoDeepLink | null {
  const params = parseSingleSearchParams(search, CHANGES_PARAMS);
  if (!params) return null;
  const rawPath = params.get("path");
  if (rawPath === undefined) {
    return { kind: "changes", serverId, workspaceId };
  }
  const focusPath = normalizeDeepLinkRelativePath(rawPath);
  return focusPath ? { kind: "changes", serverId, workspaceId, focusPath } : null;
}

function parsePluginDeepLink(
  serverId: string,
  workspaceId: string,
  segments: readonly string[],
  search: string,
): PaseoDeepLink | null {
  const params = parseSingleSearchParams(search, PLUGIN_PARAMS);
  const pluginId = decodePathSegment(segments[4] ?? "");
  const panelId = decodePathSegment(segments[5] ?? "");
  if (!params || !pluginId || !panelId) return null;
  const rawAgentId = params.get("agentId");
  if (rawAgentId === undefined) {
    return { kind: "plugin", serverId, workspaceId, pluginId, panelId };
  }
  const agentId = normalizeSegment(rawAgentId);
  return agentId ? { kind: "plugin", serverId, workspaceId, pluginId, panelId, agentId } : null;
}

function parseTerminalDeepLink(
  serverId: string,
  workspaceId: string,
  segments: readonly string[],
  search: string,
): PaseoDeepLink | null {
  if (segments.length !== 5 || !parseSingleSearchParams(search, NO_PARAMS)) return null;
  const terminalId = decodePathSegment(segments[4] ?? "");
  return terminalId ? { kind: "terminal", serverId, workspaceId, terminalId } : null;
}

function parseCommitDeepLink(
  serverId: string,
  workspaceId: string,
  segments: readonly string[],
  search: string,
): PaseoDeepLink | null {
  if (segments.length !== 5 || !parseSingleSearchParams(search, NO_PARAMS)) return null;
  const sha = decodePathSegment(segments[4] ?? "");
  return sha && COMMIT_SHA.test(sha) ? { kind: "commit_diff", serverId, workspaceId, sha } : null;
}

function parseWorkspaceSubDeepLink(
  serverId: string,
  workspaceId: string,
  segments: readonly string[],
  search: string,
): PaseoDeepLink | null {
  switch (segments[3]) {
    case "terminal":
      return parseTerminalDeepLink(serverId, workspaceId, segments, search);
    case "file":
      return segments.length === 4 ? parseFileDeepLink(serverId, workspaceId, search) : null;
    case "changes":
      return segments.length === 4 ? parseChangesDeepLink(serverId, workspaceId, search) : null;
    case "commit":
      return parseCommitDeepLink(serverId, workspaceId, segments, search);
    case "pull-request":
      return segments.length === 4 && parseSingleSearchParams(search, NO_PARAMS)
        ? { kind: "pull_request", serverId, workspaceId }
        : null;
    case "plugin":
      return segments.length === 6
        ? parsePluginDeepLink(serverId, workspaceId, segments, search)
        : null;
    default:
      return null;
  }
}

function isValidHostDeepLinkUrl(url: URL): boolean {
  if (
    url.protocol !== "paseo:" ||
    url.hostname !== "h" ||
    url.username ||
    url.password ||
    url.port ||
    url.hash
  ) {
    return false;
  }
  // Reject raw empty path segments like `//` or trailing `/` on non-root paths.
  return !(url.pathname.includes("//") || (url.pathname.length > 1 && url.pathname.endsWith("/")));
}

export function parsePaseoDeepLink(input: string): PaseoDeepLink | null {
  if (
    typeof input !== "string" ||
    input.length === 0 ||
    input.length > MAX_DEEP_LINK_LENGTH ||
    input !== input.trim() ||
    hasControlChars(input) ||
    input.includes("#") ||
    input.endsWith("?")
  ) {
    return null;
  }

  const agentTarget = parseAgentDeepLink(input);
  if (agentTarget) {
    return { kind: "agent", ...agentTarget };
  }

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (!isValidHostDeepLinkUrl(url)) {
    return null;
  }

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length < 3 || segments[1] !== "workspace") {
    return null;
  }

  const serverId = decodePathSegment(segments[0] ?? "");
  const rawWorkspaceSegment = decodePathSegment(segments[2] ?? "");
  const workspaceId = rawWorkspaceSegment ? decodeWorkspaceIdSegment(rawWorkspaceSegment) : null;
  if (!serverId || !workspaceId) {
    return null;
  }

  if (segments.length === 3) {
    return parseSingleSearchParams(url.search, NO_PARAMS)
      ? { kind: "workspace", serverId, workspaceId }
      : null;
  }

  return parseWorkspaceSubDeepLink(serverId, workspaceId, segments, url.search);
}

export function isPaseoDeepLinkUrl(input: string): boolean {
  return parsePaseoDeepLink(input) !== null;
}

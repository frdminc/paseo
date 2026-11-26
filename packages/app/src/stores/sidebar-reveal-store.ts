import { create } from "zustand";
import {
  hasActiveSidebarLabelFilter,
  type SidebarGroupMode,
  type SidebarLabelFilter,
} from "@/stores/sidebar-view-store";
import { buildWorkspaceTabPersistenceKey } from "@/workspace-tabs/model";

export const SIDEBAR_REVEAL_HIGHLIGHT_MS = 2_200;
export const SIDEBAR_REVEAL_REQUEST_TIMEOUT_MS = 2_000;

export interface SidebarRevealRequest {
  requestId: number;
  serverId: string;
  workspaceId: string;
  workspaceKey: string;
}

export interface SidebarRevealState {
  request: SidebarRevealRequest | null;
  highlightedWorkspaceKey: string | null;
  highlightRequestId: number;
  requestReveal: (input: { serverId: string; workspaceId: string }) => number | null;
  clearRequest: (requestId: number) => void;
  clearHighlight: (requestId?: number) => void;
}

let nextRequestId = 1;
let highlightTimeout: ReturnType<typeof setTimeout> | null = null;
let requestTimeout: ReturnType<typeof setTimeout> | null = null;

function clearScheduledHighlightTimeout() {
  if (highlightTimeout !== null) {
    clearTimeout(highlightTimeout);
    highlightTimeout = null;
  }
}

function clearScheduledRequestTimeout() {
  if (requestTimeout !== null) {
    clearTimeout(requestTimeout);
    requestTimeout = null;
  }
}

export const useSidebarRevealStore = create<SidebarRevealState>()((set) => ({
  request: null,
  highlightedWorkspaceKey: null,
  highlightRequestId: 0,

  requestReveal: ({ serverId, workspaceId }) => {
    const workspaceKey = buildWorkspaceTabPersistenceKey({ serverId, workspaceId });
    if (!workspaceKey) {
      return null;
    }
    const requestId = nextRequestId++;
    clearScheduledHighlightTimeout();
    clearScheduledRequestTimeout();
    set({
      request: { requestId, serverId, workspaceId, workspaceKey },
      highlightedWorkspaceKey: workspaceKey,
      highlightRequestId: requestId,
    });
    // Bound the pending request lifetime so an unmounted list (e.g. active plugin sidebar view or
    // initial skeleton) cannot keep the reveal effect armed or hijack a later mount.
    requestTimeout = setTimeout(() => {
      requestTimeout = null;
      set((state) => (state.request?.requestId === requestId ? { request: null } : state));
    }, SIDEBAR_REVEAL_REQUEST_TIMEOUT_MS);
    highlightTimeout = setTimeout(() => {
      highlightTimeout = null;
      set((state) =>
        state.highlightRequestId === requestId ? { highlightedWorkspaceKey: null } : state,
      );
    }, SIDEBAR_REVEAL_HIGHLIGHT_MS);
    return requestId;
  },

  clearRequest: (requestId) =>
    set((state) => {
      if (state.request?.requestId !== requestId) {
        return state;
      }
      clearScheduledRequestTimeout();
      return { request: null };
    }),

  clearHighlight: (requestId) => {
    clearScheduledHighlightTimeout();
    set((state) => {
      if (requestId !== undefined && state.highlightRequestId !== requestId) {
        return state;
      }
      return state.highlightedWorkspaceKey === null ? state : { highlightedWorkspaceKey: null };
    });
  },
}));

/**
 * Narrow boolean subscription so only the single revealed row re-renders when a reveal highlight
 * starts and ends — all other rows in a 30+ workspace sidebar remain untouched.
 */
export function useIsSidebarWorkspaceRevealHighlighted(workspaceKey: string): boolean {
  return useSidebarRevealStore((state) => state.highlightedWorkspaceKey === workspaceKey);
}

export interface RevealSidebarPlanInput {
  serverId: string;
  workspaceKey: string;
  groupMode: SidebarGroupMode;
  hostFilters: readonly string[];
  resolvedProjectFilters: readonly string[];
  labelFilter: SidebarLabelFilter;
  showBackground: boolean;
  isBackgroundWorkspace: boolean;
  /** True only when the target workspace is hydrated and proven excluded by `labelFilter`. */
  excludedByLabelFilter: boolean;
  isPinned: boolean;
  projectViewKey: string | null;
  statusGroupKey: string | null;
  collapsedPinned: boolean;
  collapsedProjectKeys: ReadonlySet<string>;
  collapsedWorkspaceGroupKeys: ReadonlySet<string>;
}

export interface RevealSidebarPlan {
  includeHostServerId: string | null;
  includeProjectViewKey: string | null;
  clearLabelFilter: boolean;
  enableShowBackground: boolean;
  expandPinnedSection: boolean;
  expandProjectViewKey: string | null;
  expandWorkspaceGroupKey: string | null;
}

/**
 * Computes the minimal, non-destructive sidebar filter and section-collapse changes needed to
 * guarantee a target workspace row is mounted and visible before scrolling to it.
 */
export function resolveRevealSidebarPlan(input: RevealSidebarPlanInput): RevealSidebarPlan {
  const includeHostServerId =
    input.hostFilters.length > 0 && !input.hostFilters.includes(input.serverId)
      ? input.serverId
      : null;

  const includeProjectViewKey =
    input.projectViewKey !== null &&
    input.resolvedProjectFilters.length > 0 &&
    !input.resolvedProjectFilters.includes(input.projectViewKey)
      ? input.projectViewKey
      : null;

  const enableShowBackground = input.isBackgroundWorkspace && !input.showBackground;

  // Only clear label filters when the target workspace is already hydrated and proven excluded
  // by the active label filter — never while waiting for another host's directory to hydrate.
  const clearLabelFilter =
    input.excludedByLabelFilter && hasActiveSidebarLabelFilter(input.labelFilter);

  const expandPinnedSection = input.isPinned && input.collapsedPinned;

  const expandProjectViewKey =
    !input.isPinned &&
    input.groupMode === "project" &&
    input.projectViewKey !== null &&
    input.collapsedProjectKeys.has(input.projectViewKey)
      ? input.projectViewKey
      : null;

  const expandWorkspaceGroupKey =
    !input.isPinned &&
    input.groupMode !== "project" &&
    input.statusGroupKey !== null &&
    input.collapsedWorkspaceGroupKeys.has(input.statusGroupKey)
      ? input.statusGroupKey
      : null;

  return {
    includeHostServerId,
    includeProjectViewKey,
    clearLabelFilter,
    enableShowBackground,
    expandPinnedSection,
    expandProjectViewKey,
    expandWorkspaceGroupKey,
  };
}

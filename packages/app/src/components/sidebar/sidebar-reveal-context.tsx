import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { View, type ScrollView } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { isWeb } from "@/constants/platform";

interface SidebarRevealRowRegistry {
  registerRowNode: (workspaceKey: string, node: View | null, previousNode?: View | null) => void;
  getRowNode: (workspaceKey: string) => View | null;
}

const SidebarRevealRowRegistryContext = createContext<SidebarRevealRowRegistry | null>(null);

export function SidebarRevealRowRegistryProvider({ children }: { children: ReactNode }) {
  const nodesRef = useRef<Map<string, View>>(new Map());

  const registerRowNode = useCallback(
    (workspaceKey: string, node: View | null, previousNode?: View | null) => {
      if (node) {
        nodesRef.current.set(workspaceKey, node);
      } else if (!previousNode || nodesRef.current.get(workspaceKey) === previousNode) {
        nodesRef.current.delete(workspaceKey);
      }
    },
    [],
  );

  const getRowNode = useCallback((workspaceKey: string) => {
    return nodesRef.current.get(workspaceKey) ?? null;
  }, []);

  const value = useMemo(() => ({ registerRowNode, getRowNode }), [getRowNode, registerRowNode]);

  return (
    <SidebarRevealRowRegistryContext.Provider value={value}>
      {children}
    </SidebarRevealRowRegistryContext.Provider>
  );
}

export function useSidebarRevealRowRegistry(): SidebarRevealRowRegistry | null {
  return useContext(SidebarRevealRowRegistryContext);
}

/**
 * Returns a ref callback that registers the workspace row's container `View` with the sidebar
 * reveal registry (without clobbering a replacement mount) and optionally forwards to a secondary
 * ref such as `draggable-flatlist`'s `setActivatorNodeRef`.
 */
export function useMergedSidebarRevealRowRef(
  workspaceKey: string,
  secondaryRef?: ((node: unknown) => void) | null,
): (node: View | null) => void {
  const registry = useSidebarRevealRowRegistry();
  const lastNodeRef = useRef<View | null>(null);
  return useCallback(
    (node: View | null) => {
      const previousNode = lastNodeRef.current;
      lastNodeRef.current = node;
      registry?.registerRowNode(workspaceKey, node, previousNode);
      if (secondaryRef) {
        secondaryRef(node);
      }
    },
    [registry, secondaryRef, workspaceKey],
  );
}

function prefersReducedMotionWeb(): boolean {
  if (!isWeb || typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

interface WebScrollableElement {
  scrollTop: number;
  clientHeight: number;
  getBoundingClientRect?: () => { top: number; height: number };
  scrollTo?: (options: { top: number; behavior?: "auto" | "smooth" }) => void;
}

function resolveWebScrollContainer(scrollView: ScrollView | null): WebScrollableElement | null {
  if (!scrollView) {
    return null;
  }
  const withNode = scrollView as unknown as {
    getScrollableNode?: () => unknown;
  };
  const candidate = (
    typeof withNode.getScrollableNode === "function" ? withNode.getScrollableNode() : scrollView
  ) as WebScrollableElement | null;
  if (
    candidate &&
    typeof candidate.getBoundingClientRect === "function" &&
    typeof candidate.scrollTo === "function"
  ) {
    return candidate;
  }
  return null;
}

function scrollSidebarWeb(rowNode: View, scrollView: ScrollView | null): boolean {
  const rowEl = rowNode as unknown as {
    getBoundingClientRect?: () => { top: number; height: number };
  };
  const container = resolveWebScrollContainer(scrollView);
  if (!container || typeof rowEl.getBoundingClientRect !== "function") {
    return false;
  }
  const rowRect = rowEl.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect?.();
  // When the compact mobile drawer is still hidden (`display: none`), client rects are 0x0.
  // Return `false` so the caller retries on subsequent animation frames once the drawer opens.
  if (
    !containerRect ||
    rowRect.height <= 0 ||
    containerRect.height <= 0 ||
    container.clientHeight <= 0
  ) {
    return false;
  }
  // Scroll only the sidebar container vertically, never outer/horizontal ancestors.
  const relativeTop = rowRect.top - containerRect.top + container.scrollTop;
  const targetTop = Math.max(0, relativeTop - containerRect.height / 2 + rowRect.height / 2);
  container.scrollTo?.({
    top: targetTop,
    behavior: prefersReducedMotionWeb() ? "auto" : "smooth",
  });
  return true;
}

/**
 * Scrolls the sidebar list so `rowNode` is centered in view, using direct scroll-container
 * math on web (avoiding `display: none` no-ops and outer ancestor scrolling) and React Native
 * `measureLayout` against an explicit `collapsable={false}` content container on native.
 */
export function scrollSidebarToRowNode(input: {
  rowNode: View;
  scrollViewRef: MutableRefObject<ScrollView | null>;
  scrollContentRef?: MutableRefObject<View | null>;
  viewportHeight: number;
}): boolean {
  const { rowNode, scrollViewRef, scrollContentRef, viewportHeight } = input;

  if (isWeb) {
    return scrollSidebarWeb(rowNode, scrollViewRef.current);
  }

  const scrollView = scrollViewRef.current;
  if (!scrollView) {
    return false;
  }
  const relativeContainer =
    scrollContentRef?.current ??
    (scrollView as unknown as { getInnerViewNode?: () => unknown }).getInnerViewNode?.();
  const measureLayout = (
    rowNode as unknown as {
      measureLayout?: (
        relativeToNativeNode: unknown,
        onSuccess: (x: number, y: number, width: number, height: number) => void,
        onFail: () => void,
      ) => void;
    }
  ).measureLayout;

  if (relativeContainer && typeof measureLayout === "function") {
    measureLayout(
      relativeContainer,
      (_x, y, _width, height) => {
        const targetY =
          viewportHeight > 0 ? Math.max(0, y - viewportHeight / 2 + height / 2) : Math.max(0, y);
        scrollView.scrollTo({ y: targetY, animated: true });
      },
      () => {},
    );
    return true;
  }

  return false;
}

/**
 * Non-interactive accent ring overlaid on a sidebar workspace row while it is being revealed.
 * Uses absolute positioning so highlighting never shifts row text or layout.
 */
export function SidebarRevealHighlightOverlay({ workspaceKey }: { workspaceKey: string }) {
  return (
    <View
      pointerEvents="none"
      style={styles.overlay}
      testID={`sidebar-workspace-reveal-highlight-${workspaceKey}`}
    />
  );
}

const styles = StyleSheet.create((theme) => ({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.accentBright,
    zIndex: 2,
  },
}));

// lib/floating-dock-store.ts
// Lightweight global store for coordinating floating tools (Prompt Viewer & Quick Action)
// in edge-docking and horizontal-expanding modes.

export type DockSide = "left" | "right";

export type FloatingDockPosition = {
    left: number;
    top: number;
    dockSide?: DockSide;
};

export type ActiveFloatingTool = "none" | "quick-action" | "prompt-viewer";
export type PrimaryFloatingTool = "quick-action" | "prompt-viewer";

const PRIMARY_TOOL_STORAGE_KEY = "phone_primary_floating_tool";
const ANCHOR_STORAGE_KEY = "phone_floating_dock_anchor";

function getInitialPrimaryTool(): PrimaryFloatingTool {
    if (typeof window === "undefined") return "quick-action";
    try {
        const stored = localStorage.getItem(PRIMARY_TOOL_STORAGE_KEY);
        if (stored === "prompt-viewer" || stored === "quick-action") return stored;
    } catch {
        // ignore
    }
    return "quick-action";
}

function getInitialAnchor(): FloatingDockPosition | null {
    if (typeof window === "undefined") return null;
    try {
        const stored = localStorage.getItem(ANCHOR_STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            if (typeof parsed?.left === "number" && typeof parsed?.top === "number") {
                return parsed;
            }
        }
    } catch {
        // ignore
    }
    return null;
}

export type FloatingDockState = {
    isDocked: boolean;
    isExpanded: boolean;
    dockSide: DockSide;
    anchorPosition: FloatingDockPosition | null;
    activeTool: ActiveFloatingTool;
    primaryTool: PrimaryFloatingTool;
};

const _initialAnchor = getInitialAnchor();
let _dockState: FloatingDockState = {
    isDocked: true,
    isExpanded: false,
    dockSide: _initialAnchor?.dockSide || "right",
    anchorPosition: _initialAnchor,
    activeTool: "none",
    primaryTool: getInitialPrimaryTool(),
};

const _listeners = new Set<() => void>();
let _autoCollapseTimer: ReturnType<typeof setTimeout> | null = null;

function notifyListeners() {
    _listeners.forEach(fn => fn());
}

export function getFloatingDockState(): FloatingDockState {
    return _dockState;
}

export function subscribeFloatingDockState(fn: () => void): () => void {
    _listeners.add(fn);
    return () => {
        _listeners.delete(fn);
    };
}

export function setFloatingDockAnchor(pos: FloatingDockPosition | null): void {
    const nextDockSide = pos?.dockSide || _dockState.dockSide;
    if (
        _dockState.anchorPosition?.left === pos?.left &&
        _dockState.anchorPosition?.top === pos?.top &&
        _dockState.dockSide === nextDockSide
    ) {
        return;
    }
    if (pos) {
        try {
            localStorage.setItem(ANCHOR_STORAGE_KEY, JSON.stringify(pos));
        } catch {
            // ignore
        }
    }
    _dockState = {
        ..._dockState,
        dockSide: nextDockSide,
        anchorPosition: pos,
    };
    notifyListeners();
}

export function clampFloatingDockAnchor(parentWidth: number, parentHeight: number): void {
    const pos = _dockState.anchorPosition;
    if (!pos || !(parentWidth > 0) || !(parentHeight > 0)) return;
    const size = 56;
    const edge = 18;
    const margin = 12;
    const side: DockSide = pos.dockSide ?? (pos.left + size / 2 < parentWidth / 2 ? "left" : "right");
    const left = side === "left" ? edge : Math.max(edge, parentWidth - size - edge);
    const top = Math.min(Math.max(pos.top, margin), Math.max(margin, parentHeight - size - margin));
    if (left === pos.left && top === pos.top && side === _dockState.dockSide) return;
    setFloatingDockAnchor({ left, top, dockSide: side });
}

export function setFloatingDockSide(side: DockSide): void {
    if (_dockState.dockSide === side) return;
    _dockState = {
        ..._dockState,
        dockSide: side,
    };
    notifyListeners();
}

export function setActiveFloatingTool(tool: ActiveFloatingTool): void {
    clearCollapseTimer();
    const nextPrimary = tool === "none" ? _dockState.primaryTool : tool;
    if (tool !== "none") {
        try {
            localStorage.setItem(PRIMARY_TOOL_STORAGE_KEY, tool);
        } catch {
            // ignore
        }
    }
    if (_dockState.activeTool === tool && _dockState.primaryTool === nextPrimary) return;
    _dockState = {
        ..._dockState,
        activeTool: tool,
        primaryTool: nextPrimary,
        isDocked: true,
        isExpanded: false,
    };
    notifyListeners();
}

function clearCollapseTimer() {
    if (_autoCollapseTimer) {
        clearTimeout(_autoCollapseTimer);
        _autoCollapseTimer = null;
    }
}

export function expandFloatingDock(): void {
    clearCollapseTimer();
    _dockState = {
        ..._dockState,
        isDocked: false,
        isExpanded: true,
        activeTool: "none",
    };
    notifyListeners();

    _autoCollapseTimer = setTimeout(() => {
        collapseFloatingDock();
    }, 5000);
}

export function collapseFloatingDock(): void {
    clearCollapseTimer();
    if (_dockState.isDocked && !_dockState.isExpanded && _dockState.activeTool === "none") return;
    _dockState = {
        ..._dockState,
        isDocked: true,
        isExpanded: false,
        activeTool: "none",
    };
    notifyListeners();
}

export function setFloatingDockActive(): void {
    clearCollapseTimer();
    _dockState = {
        ..._dockState,
        isDocked: false,
        isExpanded: false,
    };
    notifyListeners();
}

export function resetFloatingDock(): void {
    clearCollapseTimer();
    _dockState = {
        isDocked: true,
        isExpanded: false,
        dockSide: "right",
        anchorPosition: null,
        activeTool: "none",
        primaryTool: getInitialPrimaryTool(),
    };
    notifyListeners();
}

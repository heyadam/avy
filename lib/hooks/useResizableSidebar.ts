"use client";

import { useState, useCallback, useEffect, useRef, type RefObject } from "react";

export interface ResizableSidebarConfig {
  /** Minimum width in pixels */
  minWidth: number;
  /** Maximum width in pixels */
  maxWidth: number;
  /** Default width in pixels */
  defaultWidth: number;
  /** localStorage key for persisting width */
  storageKey: string;
  /** Direction of resize handle: 'left' means handle is on left edge (right sidebar), 'right' means handle is on right edge (left sidebar) */
  handlePosition: "left" | "right";
}

export interface ResizableSidebarResult {
  /** Current width */
  width: number;
  /** Whether the sidebar is currently being resized */
  isResizing: boolean;
  /** Ref to attach to the sidebar container */
  sidebarRef: RefObject<HTMLDivElement | null>;
  /** Handler to attach to resize handle's onMouseDown */
  startResizing: (e: React.MouseEvent) => void;
}

/**
 * Hook for managing resizable sidebar state and interactions.
 * Handles:
 * - Width state with localStorage persistence
 * - Mouse drag resize interactions
 * - Cursor style during resize
 */
export function useResizableSidebar(config: ResizableSidebarConfig): ResizableSidebarResult {
  const { minWidth, maxWidth, defaultWidth, storageKey, handlePosition } = config;

  // Initialize width from localStorage or default
  const [width, setWidth] = useState(() => {
    if (typeof window === "undefined") return defaultWidth;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= minWidth && parsed <= maxWidth) {
        return parsed;
      }
    }
    return defaultWidth;
  });

  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Persist width to localStorage
  useEffect(() => {
    localStorage.setItem(storageKey, width.toString());
  }, [width, storageKey]);

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback(
    (e: MouseEvent) => {
      if (!isResizing || !sidebarRef.current) return;

      const sidebarRect = sidebarRef.current.getBoundingClientRect();

      // Calculate new width based on handle position
      const newWidth = handlePosition === "left"
        ? sidebarRect.right - e.clientX  // Right sidebar: width = right edge - mouse X
        : e.clientX - sidebarRect.left;  // Left sidebar: width = mouse X - left edge

      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setWidth(newWidth);
      }
    },
    [isResizing, handlePosition, minWidth, maxWidth]
  );

  // Add/remove global event listeners during resize
  useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", resize);
      document.addEventListener("mouseup", stopResizing);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", resize);
      document.removeEventListener("mouseup", stopResizing);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, resize, stopResizing]);

  return {
    width,
    isResizing,
    sidebarRef,
    startResizing,
  };
}

"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import type { Node, Edge } from "@xyflow/react";
import { isNuxComplete } from "@/components/Flow/WelcomeDialog";

const STORAGE_KEY = "avy-show-templates-modal";

interface UseTemplatesModalOptions {
  isLoaded: boolean;
  nodes: Node[];
  edges: Edge[];
}

interface UseTemplatesModalReturn {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  dismissPermanently: () => void;
}

/**
 * Check if templates modal should be shown (safe to call during render).
 * Returns true if the user has NOT checked "Don't show again".
 */
function shouldShowTemplatesModal(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

/**
 * Unified hook for managing the templates modal state.
 * Handles open/close state, auto-open logic, and persistence.
 */
export function useTemplatesModal({
  isLoaded,
  nodes,
  edges,
}: UseTemplatesModalOptions): UseTemplatesModalReturn {
  const [isOpen, setIsOpen] = useState(false);
  const hasAutoOpenedRef = useRef(false);

  // Auto-open when API keys are loaded, NUX is complete, the user has not
  // permanently dismissed the modal, and the canvas is empty.
  const shouldAutoOpen =
    isLoaded &&
    isNuxComplete() &&
    shouldShowTemplatesModal() &&
    nodes.length === 0 &&
    edges.length === 0;

  // Auto-open on mount when conditions are met
  useEffect(() => {
    if (shouldAutoOpen && !hasAutoOpenedRef.current) {
      hasAutoOpenedRef.current = true;
      setIsOpen(true);
    }
  }, [shouldAutoOpen]);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const dismissPermanently = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, "false");
    } catch {
      // localStorage unavailable
    }
    setIsOpen(false);
  }, []);

  return {
    isOpen,
    open,
    close,
    dismissPermanently,
  };
}

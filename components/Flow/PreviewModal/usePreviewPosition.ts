"use client";

import { useState, useCallback, useEffect } from "react";
import type { PreviewPosition } from "./types";

const STORAGE_KEY = "preview-modal-position";
const MIN_WIDTH = 280;
const MIN_HEIGHT = 200;

function getDefaultPosition(): PreviewPosition {
  if (typeof window === "undefined") {
    return { x: 0, y: 80, width: 320, height: 400 };
  }
  return {
    x: window.innerWidth - 340,
    y: 80,
    width: 320,
    height: 400,
  };
}

function loadPosition(): PreviewPosition {
  if (typeof window === "undefined") return getDefaultPosition();
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }
  return getDefaultPosition();
}

export function usePreviewPosition() {
  const [position, setPosition] = useState<PreviewPosition>(loadPosition);

  // Persist to sessionStorage
  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(position));
  }, [position]);

  // Handle window resize to keep modal in bounds
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => ({
        ...prev,
        x: Math.min(prev.x, window.innerWidth - prev.width),
        y: Math.min(prev.y, window.innerHeight - prev.height),
      }));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX - position.x;
      const startY = e.clientY - position.y;

      const handleDrag = (moveEvent: MouseEvent) => {
        setPosition((prev) => ({
          ...prev,
          x: Math.max(
            0,
            Math.min(moveEvent.clientX - startX, window.innerWidth - prev.width)
          ),
          y: Math.max(
            0,
            Math.min(moveEvent.clientY - startY, window.innerHeight - prev.height)
          ),
        }));
      };

      const handleDragEnd = () => {
        document.removeEventListener("mousemove", handleDrag);
        document.removeEventListener("mouseup", handleDragEnd);
      };

      document.addEventListener("mousemove", handleDrag);
      document.addEventListener("mouseup", handleDragEnd);
    },
    [position.x, position.y]
  );

  const handleResizeStart = useCallback(
    (e: React.MouseEvent, corner: string) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startY = e.clientY;
      const startPos = { ...position };

      const handleResize = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;

        setPosition((prev) => {
          const newPos = { ...prev };

          if (corner.includes("right")) {
            newPos.width = Math.max(MIN_WIDTH, startPos.width + deltaX);
          }
          if (corner.includes("bottom")) {
            newPos.height = Math.max(MIN_HEIGHT, startPos.height + deltaY);
          }
          if (corner.includes("left")) {
            const newWidth = Math.max(MIN_WIDTH, startPos.width - deltaX);
            newPos.x = startPos.x + (startPos.width - newWidth);
            newPos.width = newWidth;
          }
          if (corner.includes("top")) {
            const newHeight = Math.max(MIN_HEIGHT, startPos.height - deltaY);
            newPos.y = startPos.y + (startPos.height - newHeight);
            newPos.height = newHeight;
          }

          // Constrain to viewport
          newPos.x = Math.max(0, Math.min(newPos.x, window.innerWidth - newPos.width));
          newPos.y = Math.max(0, Math.min(newPos.y, window.innerHeight - newPos.height));

          return newPos;
        });
      };

      const handleResizeEnd = () => {
        document.removeEventListener("mousemove", handleResize);
        document.removeEventListener("mouseup", handleResizeEnd);
      };

      document.addEventListener("mousemove", handleResize);
      document.addEventListener("mouseup", handleResizeEnd);
    },
    [position]
  );

  return { position, handleDragStart, handleResizeStart };
}

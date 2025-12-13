/**
 * Centralized constants for the application.
 * Keeps magic values in one place for maintainability.
 */

// ============================================================================
// SIDEBAR DIMENSIONS
// ============================================================================

export const AUTOPILOT_SIDEBAR = {
  MIN_WIDTH: 320,
  MAX_WIDTH: 600,
  DEFAULT_WIDTH: 380,
  STORAGE_KEY: "autopilot-sidebar-width",
} as const;

export const RESPONSES_SIDEBAR = {
  MIN_WIDTH: 240,
  MAX_WIDTH: 800,
  DEFAULT_WIDTH: 340,
  STORAGE_KEY: "responses-sidebar-width",
} as const;

// ============================================================================
// NODE DIMENSIONS
// ============================================================================

export const NODE_DIMENSIONS = {
  DEFAULT_WIDTH: 240,
  PROMPT_NODE_WIDTH: 240,
  IMAGE_NODE_WIDTH: 240,
} as const;

// ============================================================================
// CSS CLASSES
// ============================================================================

export const CSS_CLASSES = {
  /** Applied to interactive elements in nodes to prevent drag */
  NO_DRAG: "nodrag",
  /** Applied to React Flow pane during selection */
  IS_SELECTING: "is-selecting",
  /** Applied to nodes added via autopilot */
  AUTOPILOT_ADDED: "autopilot-added",
} as const;

// ============================================================================
// DOM SELECTORS
// ============================================================================

export const DOM_SELECTORS = {
  REACT_FLOW_PANE: ".react-flow__pane",
} as const;

// ============================================================================
// HANDLE STYLES (React Flow node handles)
// ============================================================================

export const HANDLE_STYLE = {
  /** Handle background colors by data type */
  COLORS: {
    STRING: "bg-gray-600",
    IMAGE: "bg-gray-600",
    DEFAULT: "bg-gray-600",
  },
  /** Common handle classes */
  BASE_CLASS: "!bg-gray-600 !w-2.5 !h-2.5 !border-2 !border-background !shadow-sm",
} as const;

// ============================================================================
// DATA TYPES (for edge coloring)
// ============================================================================

export const DATA_TYPES = {
  STRING: "string",
  IMAGE: "image",
  RESPONSE: "response",
  DEFAULT: "default",
} as const;

// ============================================================================
// EDGE TYPES
// ============================================================================

export const EDGE_TYPE = {
  COLORED: "colored",
} as const;

// ============================================================================
// EXECUTION
// ============================================================================

export const EXECUTION = {
  /** Fit view padding for React Flow */
  FIT_VIEW_PADDING: 0.2,
} as const;

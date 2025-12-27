/**
 * Global registry for nodes awaiting user input during flow execution.
 * Used when a node (like AudioInputNode) needs to wait for user interaction
 * before continuing the flow.
 */

/** Audio data passed from AudioInputNode when recording completes */
export interface AudioInputData {
  buffer: string;
  mimeType: string;
  duration?: number;
}

type PendingResolver<T = unknown> = (data: T | null) => void;
const pendingInputs = new Map<string, { resolve: PendingResolver }>();

export const pendingInputRegistry = {
  /**
   * Called by execution engine to wait for user input on a node.
   * Returns a Promise that resolves with the data when resolveInput() is called.
   * Returns null if cancelled via clear().
   */
  waitForInput<T = unknown>(nodeId: string): Promise<T | null> {
    return new Promise((resolve) => {
      pendingInputs.set(nodeId, { resolve: resolve as PendingResolver });
    });
  },

  /**
   * Called by node component when user input is complete.
   * Resolves the waiting Promise with the provided data.
   */
  resolveInput<T = unknown>(nodeId: string, data: T): void {
    const pending = pendingInputs.get(nodeId);
    if (pending) {
      pending.resolve(data);
      pendingInputs.delete(nodeId);
    }
  },

  /**
   * Check if a node is currently awaiting input.
   */
  isWaiting(nodeId: string): boolean {
    return pendingInputs.has(nodeId);
  },

  /**
   * Clear all pending inputs. Called on flow cancel or reset.
   * Resolves all promises with null to signal cancellation.
   */
  clear(): void {
    for (const [, pending] of pendingInputs) {
      pending.resolve(null);
    }
    pendingInputs.clear();
  },
};

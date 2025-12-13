"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type {
  ApiKeys,
  ApiKeysContextValue,
  ProviderId,
  ApiKeyStatus,
} from "./types";
import { loadApiKeys, saveApiKeys, clearApiKeys } from "./storage";

const PROVIDER_LABELS: Record<ProviderId, string> = {
  openai: "OpenAI",
  google: "Google Gemini",
  anthropic: "Anthropic",
};

const ApiKeysContext = createContext<ApiKeysContextValue | null>(null);

export function ApiKeysProvider({ children }: { children: ReactNode }) {
  const [keys, setKeys] = useState<ApiKeys>({});
  const [isDevMode] = useState(
    () => process.env.NEXT_PUBLIC_DEV_MODE === "true"
  );

  // Load keys from localStorage on mount
  useEffect(() => {
    setKeys(loadApiKeys());
  }, []);

  // Save keys to localStorage when they change
  useEffect(() => {
    saveApiKeys(keys);
  }, [keys]);

  const setKey = useCallback((provider: ProviderId, key: string) => {
    setKeys((prev) => ({ ...prev, [provider]: key }));
  }, []);

  const removeKey = useCallback((provider: ProviderId) => {
    setKeys((prev) => {
      const next = { ...prev };
      delete next[provider];
      return next;
    });
  }, []);

  const clearAllKeys = useCallback(() => {
    setKeys({});
    clearApiKeys();
  }, []);

  const getKeyStatuses = useCallback((): ApiKeyStatus[] => {
    return (Object.keys(PROVIDER_LABELS) as ProviderId[]).map((provider) => ({
      provider,
      label: PROVIDER_LABELS[provider],
      hasKey: !!keys[provider] || isDevMode,
    }));
  }, [keys, isDevMode]);

  const hasRequiredKey = useCallback(
    (provider: ProviderId): boolean => {
      return isDevMode || !!keys[provider];
    },
    [keys, isDevMode]
  );

  return (
    <ApiKeysContext.Provider
      value={{
        keys,
        setKey,
        removeKey,
        clearAllKeys,
        getKeyStatuses,
        hasRequiredKey,
        isDevMode,
      }}
    >
      {children}
    </ApiKeysContext.Provider>
  );
}

export function useApiKeys() {
  const context = useContext(ApiKeysContext);
  if (!context) {
    throw new Error("useApiKeys must be used within an ApiKeysProvider");
  }
  return context;
}

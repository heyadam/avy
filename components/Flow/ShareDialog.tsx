"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Copy,
  Check,
  Loader2,
  AlertTriangle,
  Globe,
  Key,
} from "lucide-react";
import { getUserKeysStatus, updatePublishSettings } from "@/lib/flows/api";
import { useAuth } from "@/lib/auth";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flowId: string | null;
  flowName: string;
  /** Flow's share_token (populated once the flow is published) */
  shareToken?: string | null;
  /** Current owner-funded execution setting */
  useOwnerKeys?: boolean;
  /** Callback when owner keys setting changes */
  onOwnerKeysChange?: (enabled: boolean) => void;
  /** Callback to save the flow (for unsaved flows) */
  onSaveFlow?: (name: string) => Promise<string | null>;
  /** True while flow is being saved */
  isSaving?: boolean;
}

export function ShareDialog({
  open,
  onOpenChange,
  flowId,
  flowName,
  shareToken,
  useOwnerKeys: initialUseOwnerKeys = false,
  onOwnerKeysChange,
  onSaveFlow,
  isSaving = false,
}: ShareDialogProps) {
  const { user } = useAuth();
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedMcpUrl, setCopiedMcpUrl] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Save flow state (for when flow is not saved yet)
  const [saveName, setSaveName] = useState(flowName || "My Flow");

  // Owner-funded execution state
  const [useOwnerKeys, setUseOwnerKeys] = useState(initialUseOwnerKeys);
  const [hasStoredKeys, setHasStoredKeys] = useState(false);
  const [isLoadingKeyStatus, setIsLoadingKeyStatus] = useState(false);
  const [isTogglingOwnerKeys, setIsTogglingOwnerKeys] = useState(false);

  // Reset state when dialog opens with new props
  useEffect(() => {
    if (open) {
      setUseOwnerKeys(initialUseOwnerKeys);
      setSaveName(flowName || "My Flow");
      setError(null);
    }
  }, [open, initialUseOwnerKeys, flowName]);

  // Fetch owner key status when dialog opens with a saved flow
  useEffect(() => {
    if (open && flowId) {
      setIsLoadingKeyStatus(true);
      getUserKeysStatus()
        .then((status) => {
          const hasKeys = !!(
            status.hasOpenai ||
            status.hasGoogle ||
            status.hasAnthropic
          );
          setHasStoredKeys(hasKeys);
        })
        .finally(() => setIsLoadingKeyStatus(false));
    }
  }, [open, flowId]);

  const mcpUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/mcp`
      : "/api/mcp";

  const handleCopyToken = async () => {
    if (!shareToken) return;
    await navigator.clipboard.writeText(shareToken);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const handleCopyMcpUrl = async () => {
    await navigator.clipboard.writeText(mcpUrl);
    setCopiedMcpUrl(true);
    setTimeout(() => setCopiedMcpUrl(false), 2000);
  };

  const handleToggleOwnerKeys = async (enabled: boolean) => {
    if (!flowId) return;

    setIsTogglingOwnerKeys(true);
    setError(null);

    try {
      const result = await updatePublishSettings(flowId, {
        useOwnerKeys: enabled,
      });
      if (result.success) {
        setUseOwnerKeys(enabled);
        onOwnerKeysChange?.(enabled);
      } else {
        setError(result.error || "Failed to update owner keys setting");
      }
    } catch (err) {
      console.error("Failed to update owner keys setting:", err);
      setError("Failed to update setting");
    } finally {
      setIsTogglingOwnerKeys(false);
    }
  };

  const handleSaveFlow = async () => {
    if (!onSaveFlow || !saveName.trim()) return;

    setError(null);
    const savedFlowId = await onSaveFlow(saveName.trim());

    if (savedFlowId) {
      // Flow saved successfully - close dialog, user can reopen to see share settings
      onOpenChange(false);
    }
  };

  // Not signed in
  if (!user) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md bg-neutral-900 border-neutral-700 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Share flow
            </DialogTitle>
            <DialogDescription className="text-neutral-400">
              Sign in to share your flow.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-6">
            <AlertTriangle className="h-12 w-12 text-amber-500" />
            <p className="text-center text-neutral-300">
              You need to be signed in to save and share flows.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Flow not saved yet - show save form
  if (!flowId) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md bg-neutral-900 border-neutral-700 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Share flow
            </DialogTitle>
            <DialogDescription className="text-neutral-400">
              Name your flow to save it and get a share token.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-md text-red-400 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-neutral-300">Flow name</Label>
              <Input
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && saveName.trim() && !isSaving) {
                    handleSaveFlow();
                  }
                }}
                placeholder="Enter a name for your flow..."
                className="bg-neutral-800 border-neutral-600 text-white placeholder:text-neutral-500"
                autoFocus
                disabled={isSaving}
              />
            </div>

            <p className="text-sm text-neutral-400">
              Your flow will be saved to the cloud with a share token you can use with the MCP server.
            </p>

            <Button
              onClick={handleSaveFlow}
              disabled={!saveName.trim() || isSaving}
              className="w-full"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Globe className="h-4 w-4 mr-2" />
                  Save flow
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Flow is saved - show share settings
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-neutral-900 border-neutral-700 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Share flow
          </DialogTitle>
          <DialogDescription className="text-neutral-400">
            Run &ldquo;{flowName}&rdquo; programmatically via the MCP server
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-md text-red-400 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* MCP URL */}
          <div className="space-y-2">
            <Label className="text-neutral-300">MCP endpoint</Label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={mcpUrl}
                className="bg-neutral-800 border-neutral-600 text-neutral-200 font-mono text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopyMcpUrl}
                className="shrink-0 bg-neutral-800 border-neutral-600 hover:bg-neutral-700"
              >
                {copiedMcpUrl ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Share Token */}
          {shareToken ? (
            <div className="space-y-2">
              <Label className="text-neutral-300">Share token</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={shareToken}
                  className="bg-neutral-800 border-neutral-600 text-neutral-200 font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyToken}
                  className="shrink-0 bg-neutral-800 border-neutral-600 hover:bg-neutral-700"
                >
                  {copiedToken ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-neutral-500">
                Pass this token to <code className="text-neutral-300">run_flow</code> or{" "}
                <code className="text-neutral-300">get_flow_info</code>.
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-md text-amber-400 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Share token not available. Try refreshing the page.</span>
            </div>
          )}

          {/* Warning */}
          <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-md text-amber-400 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Anyone with this token can run your flow. Treat it like a password.
            </span>
          </div>

          {/* Owner-funded execution toggle */}
          <div className="space-y-3 pt-3 border-t border-neutral-700">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  Owner-funded execution
                </Label>
                <p className="text-xs text-neutral-400 mt-1">
                  Use your API keys when the flow runs via MCP
                </p>
              </div>
              <Switch
                checked={useOwnerKeys}
                onCheckedChange={handleToggleOwnerKeys}
                disabled={
                  !hasStoredKeys || isLoadingKeyStatus || isTogglingOwnerKeys
                }
              />
            </div>
            {!hasStoredKeys && !isLoadingKeyStatus && (
              <p className="text-xs text-amber-400">
                Store your API keys in Settings to enable this feature.
              </p>
            )}
            {isLoadingKeyStatus && (
              <p className="text-xs text-neutral-500">
                Checking stored keys...
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

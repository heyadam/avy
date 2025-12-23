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
  ExternalLink,
  Loader2,
  AlertTriangle,
  Globe,
  Key,
} from "lucide-react";
import { publishFlow, unpublishFlow } from "@/lib/flows/api";
import { useAuth } from "@/lib/auth";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flowId: string | null;
  flowName: string;
  initialLiveId?: string | null;
  initialShareToken?: string | null;
}

export function ShareDialog({
  open,
  onOpenChange,
  flowId,
  flowName,
  initialLiveId,
  initialShareToken,
}: ShareDialogProps) {
  const { user } = useAuth();
  const [isPublishing, setIsPublishing] = useState(false);
  const [isUnpublishing, setIsUnpublishing] = useState(false);
  const [liveId, setLiveId] = useState<string | null>(initialLiveId || null);
  const [shareToken, setShareToken] = useState<string | null>(
    initialShareToken || null
  );
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when dialog opens with new props
  useEffect(() => {
    if (open) {
      setLiveId(initialLiveId || null);
      setShareToken(initialShareToken || null);
      setError(null);
    }
  }, [open, initialLiveId, initialShareToken]);

  const isPublished = liveId && shareToken;
  const shareUrl = isPublished
    ? `${window.location.origin}/${liveId}/${shareToken}`
    : null;

  const handlePublish = async () => {
    if (!flowId) {
      setError("Flow must be saved before publishing");
      return;
    }

    setIsPublishing(true);
    setError(null);

    const result = await publishFlow(flowId);

    if (result.success && result.live_id && result.share_token) {
      setLiveId(result.live_id);
      setShareToken(result.share_token);
    } else {
      setError(result.error || "Failed to publish flow");
    }

    setIsPublishing(false);
  };

  const handleUnpublish = async () => {
    if (!flowId) return;

    setIsUnpublishing(true);
    setError(null);

    const result = await unpublishFlow(flowId);

    if (result.success) {
      setLiveId(null);
      setShareToken(null);
    } else {
      setError(result.error || "Failed to unpublish flow");
    }

    setIsUnpublishing(false);
  };

  const handleCopy = async () => {
    if (!shareUrl) return;

    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenInNewTab = () => {
    if (!shareUrl) return;
    window.open(shareUrl, "_blank");
  };

  // Not signed in
  if (!user) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md bg-neutral-900 border-neutral-700 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Go Live
            </DialogTitle>
            <DialogDescription className="text-neutral-400">
              Sign in to share your flow with others.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-6">
            <AlertTriangle className="h-12 w-12 text-amber-500" />
            <p className="text-center text-neutral-300">
              You need to be signed in to publish and share flows.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Flow not saved yet
  if (!flowId) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md bg-neutral-900 border-neutral-700 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Go Live
            </DialogTitle>
            <DialogDescription className="text-neutral-400">
              Save your flow first to share it with others.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-6">
            <AlertTriangle className="h-12 w-12 text-amber-500" />
            <p className="text-center text-neutral-300">
              Please save your flow before publishing.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-neutral-900 border-neutral-700 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            {isPublished ? "Share Link" : "Go Live"}
          </DialogTitle>
          <DialogDescription className="text-neutral-400">
            {isPublished
              ? `Share "${flowName}" with collaborators`
              : `Publish "${flowName}" to get a shareable link`}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-md text-red-400 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {isPublished ? (
          <div className="space-y-4">
            {/* Share URL */}
            <div className="space-y-2">
              <Label className="text-neutral-300">Share URL</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={shareUrl || ""}
                  className="bg-neutral-800 border-neutral-600 text-neutral-200 font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopy}
                  className="shrink-0 bg-neutral-800 border-neutral-600 hover:bg-neutral-700"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleOpenInNewTab}
                  className="shrink-0 bg-neutral-800 border-neutral-600 hover:bg-neutral-700"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Warning */}
            <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-md text-amber-400 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Anyone with this link can edit your flow, including prompts and
                settings. Only share with people you trust.
              </span>
            </div>

            {/* Live ID display */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-400">Live ID</span>
              <span className="font-mono text-neutral-200">{liveId}</span>
            </div>

            {/* Unpublish */}
            <div className="pt-2 border-t border-neutral-700">
              <Button
                variant="destructive"
                onClick={handleUnpublish}
                disabled={isUnpublishing}
                className="w-full"
              >
                {isUnpublishing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Unpublishing...
                  </>
                ) : (
                  "Unpublish Flow"
                )}
              </Button>
              <p className="text-xs text-neutral-500 mt-2 text-center">
                This will revoke access for all collaborators
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-neutral-300">
              Publishing your flow will generate a unique link that you can
              share with collaborators. They&apos;ll be able to view and edit
              the flow in real-time.
            </p>

            <Button
              onClick={handlePublish}
              disabled={isPublishing}
              className="w-full"
            >
              {isPublishing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Publishing...
                </>
              ) : (
                <>
                  <Globe className="h-4 w-4 mr-2" />
                  Publish & Get Link
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

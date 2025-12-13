"use client";

import { Button } from "@/components/ui/button";
import { Play, RotateCcw, Loader2 } from "lucide-react";
import { SettingsDialog } from "../SettingsDialog";

interface ResponsesHeaderProps {
  onRun: () => void;
  onReset: () => void;
  isRunning: boolean;
  keyError?: string | null;
}

export function ResponsesHeader({ onRun, onReset, isRunning, keyError }: ResponsesHeaderProps) {
  return (
    <div className="flex flex-col border-b shrink-0">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <span className="text-sm font-medium">Responses</span>
        <div className="flex items-center gap-1.5">
          <SettingsDialog />
          <Button
            variant="outline"
            size="icon-sm"
            onClick={onReset}
            disabled={isRunning}
            title="Reset"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            onClick={onRun}
            disabled={isRunning}
            size="sm"
          >
            {isRunning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Run
          </Button>
        </div>
      </div>
      {keyError && (
        <div className="px-4 pb-3">
          <p className="text-xs text-red-500">{keyError}</p>
        </div>
      )}
    </div>
  );
}

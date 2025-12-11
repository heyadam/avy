"use client";

import { useEffect, useRef, useState } from "react";
import { PreviewEntry } from "./PreviewEntry";
import type { PreviewEntry as PreviewEntryType } from "./types";

interface PreviewContentProps {
  entries: PreviewEntryType[];
}

export function PreviewContent({ entries }: PreviewContentProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [userScrolled, setUserScrolled] = useState(false);

  // Auto-scroll to bottom on new entries (unless user has scrolled up)
  useEffect(() => {
    if (!userScrolled && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries, userScrolled]);

  // Reset user scroll flag when entries are cleared
  useEffect(() => {
    if (entries.length === 0) {
      setUserScrolled(false);
    }
  }, [entries.length]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const atBottom = scrollHeight - scrollTop - clientHeight < 20;
    setUserScrolled(!atBottom);
  };

  if (entries.length === 0) {
    return (
      <div className="p-4">
        <p className="text-sm text-muted-foreground text-center">
          Run a flow to see output here
        </p>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="p-3 space-y-2 overflow-auto"
    >
      {entries.map((entry) => (
        <PreviewEntry key={entry.id} entry={entry} />
      ))}
    </div>
  );
}

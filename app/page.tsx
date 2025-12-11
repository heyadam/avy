"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const AgentFlow = dynamic(
  () => import("@/components/Flow/AgentFlow").then((mod) => ({ default: mod.AgentFlow })),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 flex items-center justify-center bg-muted">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading flow editor...</p>
        </div>
      </div>
    ),
  }
);

export default function Home() {
  return <AgentFlow />;
}

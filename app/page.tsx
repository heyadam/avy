'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const AvalancheMap = dynamic(
  () => import('@/components/Map/AvalancheMap').then(mod => ({ default: mod.AvalancheMap })),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 flex items-center justify-center bg-muted">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading map...</p>
        </div>
      </div>
    ),
  }
);

export default function Home() {
  return <AvalancheMap />;
}

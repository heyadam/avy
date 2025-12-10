'use client';

import { Popup } from 'react-map-gl/mapbox';
import type { AvalancheZoneProperties } from '@/types/avalanche';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AvalanchePopupProps {
  longitude: number;
  latitude: number;
  properties: AvalancheZoneProperties;
  onClose: () => void;
}

const dangerLevelDisplay: Record<number, { label: string; className: string }> = {
  [-1]: { label: 'No Rating', className: 'bg-muted text-muted-foreground' },
  0: { label: 'No Rating', className: 'bg-muted text-muted-foreground' },
  1: { label: 'Low', className: 'bg-green-500 text-white' },
  2: { label: 'Moderate', className: 'bg-yellow-400 text-black' },
  3: { label: 'Considerable', className: 'bg-orange-500 text-white' },
  4: { label: 'High', className: 'bg-red-600 text-white' },
  5: { label: 'Extreme', className: 'bg-black text-white' },
};

export function AvalanchePopup({
  longitude,
  latitude,
  properties,
  onClose
}: AvalanchePopupProps) {
  const dangerInfo = dangerLevelDisplay[properties.danger_level] ?? dangerLevelDisplay[-1];

  return (
    <Popup
      longitude={longitude}
      latitude={latitude}
      anchor="bottom"
      onClose={onClose}
      closeButton={true}
      closeOnClick={false}
      maxWidth="320px"
    >
      <div className="p-4 sm:p-3">
        <h3 className="font-bold text-lg sm:text-base text-card-foreground mb-1 pr-8">
          {properties.name}
        </h3>

        <p className="text-sm text-muted-foreground mb-3 sm:mb-2">
          {properties.center}
        </p>

        <Badge
          className={cn(
            "px-4 py-2 sm:px-3 sm:py-1 text-base sm:text-sm mb-4 sm:mb-3 border-transparent",
            dangerInfo.className
          )}
        >
          Danger: {dangerInfo.label}
        </Badge>

        {properties.travel_advice && (
          <div className="mb-4 sm:mb-3">
            <h4 className="font-semibold text-sm text-card-foreground mb-1">Travel Advice</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {properties.travel_advice}
            </p>
          </div>
        )}

        <Button asChild className="w-full" size="lg">
          <a
            href={properties.link}
            target="_blank"
            rel="noopener noreferrer"
          >
            View Full Forecast
          </a>
        </Button>
      </div>
    </Popup>
  );
}

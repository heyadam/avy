'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Map, { Source, Layer, NavigationControl, GeolocateControl } from 'react-map-gl/mapbox';
import type { MapMouseEvent, MapGeoJSONFeature } from 'react-map-gl/mapbox';
import type { GeolocateControl as GeolocateControlType } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Loader2 } from 'lucide-react';

import { AvalanchePopup } from './AvalanchePopup';
import { avalancheFillLayer, avalancheLineLayer } from './map-layers';
import type { AvalancheGeoJSON, AvalancheZoneProperties, HoverInfo, ClickInfo } from '@/types/avalanche';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
const AVALANCHE_API_URL = 'https://api.avalanche.org/v2/public/products/map-layer';

const DEFAULT_VIEW_STATE = {
  longitude: -110,
  latitude: 45,
  zoom: 4,
  pitch: 0,
  bearing: 0,
};

const MAX_INITIAL_ZOOM = 8;

export function AvalancheMap() {
  const [geoJsonData, setGeoJsonData] = useState<AvalancheGeoJSON | null>(null);
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
  const [clickInfo, setClickInfo] = useState<ClickInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialViewState, setInitialViewState] = useState(DEFAULT_VIEW_STATE);
  const [locationLoaded, setLocationLoaded] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const geolocateRef = useRef<GeolocateControlType>(null);

  // Detect touch device to hide hover tooltip on mobile
  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  // Request user's location on mount
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setInitialViewState({
            longitude: position.coords.longitude,
            latitude: position.coords.latitude,
            zoom: MAX_INITIAL_ZOOM,
            pitch: 0,
            bearing: 0,
          });
          setLocationLoaded(true);
        },
        () => {
          // User denied or error - use default view
          setLocationLoaded(true);
        },
        { enableHighAccuracy: false, timeout: 5000 }
      );
    } else {
      setLocationLoaded(true);
    }
  }, []);

  // Fetch avalanche data
  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const response = await fetch(AVALANCHE_API_URL);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data: AvalancheGeoJSON = await response.json();
        setGeoJsonData(data);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch avalanche data:', err);
        setError('Failed to load avalanche data. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  const onHover = useCallback((event: MapMouseEvent) => {
    const feature = event.features?.[0] as MapGeoJSONFeature | undefined;

    if (feature && feature.properties) {
      const props = feature.properties as unknown as AvalancheZoneProperties;
      setHoverInfo({
        longitude: event.lngLat.lng,
        latitude: event.lngLat.lat,
        properties: props,
      });
    } else {
      setHoverInfo(null);
    }
  }, []);

  const onClick = useCallback((event: MapMouseEvent) => {
    const feature = event.features?.[0] as MapGeoJSONFeature | undefined;

    if (feature && feature.properties) {
      const props = feature.properties as unknown as AvalancheZoneProperties;
      setClickInfo({
        longitude: event.lngLat.lng,
        latitude: event.lngLat.lat,
        properties: props,
      });
    }
  }, []);

  const closePopup = useCallback(() => {
    setClickInfo(null);
  }, []);

  const cursor = useMemo(() => {
    return hoverInfo ? 'pointer' : 'grab';
  }, [hoverInfo]);

  // Trigger geolocate control when map loads to show user location dot
  const onMapLoad = useCallback(() => {
    geolocateRef.current?.trigger();
  }, []);

  if (isLoading || !locationLoaded) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-muted">
        <div className="text-center px-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">
            {!locationLoaded ? 'Getting your location...' : 'Loading avalanche data...'}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-muted px-4">
        <Card className="max-w-md w-full text-center">
          <CardContent>
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Map
      mapboxAccessToken={MAPBOX_TOKEN}
      initialViewState={initialViewState}
      style={{ width: '100vw', height: '100vh' }}
      mapStyle="mapbox://styles/mapbox/outdoors-v12"
      interactiveLayerIds={['avalanche-zones-fill']}
      onMouseMove={onHover}
      onMouseLeave={() => setHoverInfo(null)}
      onClick={onClick}
      cursor={cursor}
      onLoad={onMapLoad}
    >
      <GeolocateControl
        ref={geolocateRef}
        position="top-right"
        trackUserLocation
        showUserLocation
        fitBoundsOptions={{ maxZoom: MAX_INITIAL_ZOOM }}
      />
      <NavigationControl position="top-right" />

      {geoJsonData && (
        <Source id="avalanche-data" type="geojson" data={geoJsonData}>
          <Layer {...avalancheFillLayer} />
          <Layer {...avalancheLineLayer} />
        </Source>
      )}

      {/* Hide hover tooltip on touch devices - they don't have hover */}
      {hoverInfo && !clickInfo && !isTouchDevice && (
        <Card
          className="absolute pointer-events-none px-3 py-2 text-sm z-10 gap-1"
          style={{ left: 10, top: 10 }}
        >
          <p className="font-semibold">{hoverInfo.properties.name}</p>
          <p className="text-muted-foreground">Danger: {hoverInfo.properties.danger}</p>
        </Card>
      )}

      {clickInfo && (
        <AvalanchePopup
          longitude={clickInfo.longitude}
          latitude={clickInfo.latitude}
          properties={clickInfo.properties}
          onClose={closePopup}
        />
      )}
    </Map>
  );
}

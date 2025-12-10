# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server (http://localhost:3000)
npm run build    # Production build
npm run lint     # Run ESLint
```

## Environment Setup

Requires `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` environment variable for Mapbox functionality.

## Architecture

This is a Next.js 16 application displaying avalanche danger zones on an interactive map. Single-page app using the App Router.

### Key Components

- **`app/page.tsx`**: Entry point, dynamically imports AvalancheMap with SSR disabled (Mapbox requires browser APIs)
- **`components/Map/AvalancheMap.tsx`**: Main map component using react-map-gl/mapbox. Fetches GeoJSON from avalanche.org API, handles geolocation, click/hover interactions
- **`components/Map/AvalanchePopup.tsx`**: Popup displaying zone details and danger level
- **`components/Map/map-layers.ts`**: Mapbox layer definitions for fill and line styling
- **`types/avalanche.ts`**: TypeScript types for avalanche API response (GeoJSON features with danger levels, travel advice, etc.)

### UI Framework

Uses shadcn/ui components (`components/ui/`) with Tailwind CSS v4. The `cn()` utility in `lib/utils.ts` merges class names.

### External API

Fetches from `https://api.avalanche.org/v2/public/products/map-layer` - returns GeoJSON FeatureCollection with avalanche zones. See `api-docs.md` for full API documentation including danger levels (1-5 scale) and zone properties.

### Path Aliases

`@/*` maps to project root (e.g., `@/components/Map/AvalancheMap`).

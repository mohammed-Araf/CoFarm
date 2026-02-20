# Task.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

C0Farm is a distributed farm intelligence platform for monitoring farm sensor nodes. The application features:
- Real-time sensor data visualization with time-based simulation
- Infinite canvas for geographic node visualization (lat/lng to x/y projection)
- Multi-user system where users can see other nodes but only interact with their own
- Supabase authentication and row-level security

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript (strict mode)
- **UI**: React 19.2 with React Compiler enabled
- **Styling**: Tailwind CSS v4
- **Backend**: Supabase (PostgreSQL with RLS)
- **Maps**: Leaflet + React-Leaflet
- **Data Parsing**: PapaParser (CSV upload)

## Development Commands

```bash
# Development server (http://localhost:3000)
npm run dev

# Production build
npm run build

# Start production server
npm start

# Lint
npm run lint
```

## Architecture

### Application Structure

```
src/
├── app/                       # Next.js App Router pages
│   ├── page.tsx              # Root redirect based on auth
│   ├── login/page.tsx        # Authentication (sign in/up)
│   ├── dashboard/            # Main dashboard (protected)
│   │   ├── page.tsx          # Dashboard layout with 3-panel UI
│   │   └── components/       # Dashboard-specific components
│   │       ├── InfiniteCanvas.tsx       # Geographic node canvas
│   │       ├── NodeMap.tsx              # Leaflet map view
│   │       ├── NodeDetailView.tsx       # Individual node detail
│   │       ├── NodeDiscoveryPanel.tsx   # Right panel with sim controls
│   │       └── AlertsPanel.tsx          # Left panel with alerts feed
│   └── nodes/new/page.tsx    # Node registration (manual or CSV)
├── lib/
│   ├── supabase.ts           # Supabase client initialization
│   └── simulator.ts          # Time-based sensor reading simulation
└── middleware.ts             # Auth token check for protected routes
```

### Database Schema (supabase/schema.sql)

- **users**: User profiles linked to Supabase Auth
- **nodes**: Sensor stick locations (lat/lng/elevation) with user ownership
- **sensor_data**: Time-series readings (soil, air, water metrics)
- **alerts**: Generated from readings (pest, drought, frost, anomaly)

**Key RLS Policies**:
- Users can view their own nodes and sensor data
- All users can see all nodes on the map (for discovery)
- Users can only insert their own nodes

### Authentication Flow

1. Root page (`/`) checks auth and redirects to `/dashboard` or `/login`
2. Middleware checks for Supabase auth cookie on protected routes
3. Dashboard checks for nodes and redirects to `/nodes/new` if user has none
4. Users must be authenticated to access `/dashboard` and `/nodes/*`

### Simulation System

The simulator (`lib/simulator.ts`) generates realistic time-based sensor data with diurnal patterns:

- **Time-based readings**: `generateTimeBasedReading(nodeId, simMinutes)` where `simMinutes` is 0-1439 (representing 00:00 to 23:59)
- **Diurnal patterns**: Solar irradiance peaks at noon, temperature peaks at 14:00, humidity inversely correlates with solar angle
- **Node-specific variation**: Each node has consistent but slightly different readings based on node_id seed
- **Alert generation**: `checkForAlerts(reading)` creates alerts for extreme conditions (heat, drought, frost, TVOC)

Dashboard simulation state:
- `simMinutes`: Current simulated time (0-1439)
- `simSpeed`: Multiplier for simulation speed (1x, 2x, 4x)
- `isPlaying`: Whether simulation is running

### InfiniteCanvas Component

Custom canvas-based visualization that converts geographic coordinates (lat/lng) to a flat x/y plane:

- **Coordinate system**: 1 canvas unit = 10 meters
- **Reference point**: Mean of own nodes used as origin
- **Camera**: Pan, zoom (0.05x to 10x), stored in refs for animation performance
- **Features**:
  - Grid overlay (80-unit squares)
  - Connection lines between own nodes
  - Scale bar (1km reference)
  - Hover states with tooltips
  - Node click for detail view (own nodes only)
  - Zoom towards mouse position

Color coding:
- Green: Own nodes (online)
- Blue: Other users' nodes
- Red: Infected nodes
- Gray: Offline nodes

### Node Status Types

- `online`: Normal operation
- `offline`: Not responding
- `infected`: Compromised/infected (future feature)

## Configuration

### Environment Variables (.env)

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Next.js Config

- React Compiler is enabled (`reactCompiler: true`)
- Uses Babel plugin for React Compiler optimization

### TypeScript Config

- Strict mode enabled
- Path alias: `@/*` maps to `./src/*`
- Target: ES2017

## Key Implementation Details

### Client-Side Only Components

All pages use `'use client'` directive due to:
- Supabase client-side auth
- Canvas rendering (InfiniteCanvas)
- React state for simulation
- Browser-specific APIs (ResizeObserver, requestAnimationFrame)

### CSV Upload Format

The node registration page accepts CSV with columns:
- `node_id` (optional, auto-generated if empty)
- `latitude` (required)
- `longitude` (required)
- `elevation_m` (optional)

### Styling Patterns

The app uses a custom glassmorphism design system:
- `.gradient-bg`: Dark gradient background
- `.glass-card`: Frosted glass effect cards
- Green/Emerald color scheme for primary actions
- Tailwind v4 PostCSS setup

### Zoom Prevention

Dashboard prevents browser page zoom via wheel event listener:
```typescript
if (e.ctrlKey || e.metaKey) {
  e.preventDefault();
}
```

This allows InfiniteCanvas to handle zoom independently.

## Common Development Patterns

### Supabase Queries

```typescript
// Fetch user's own nodes
const { data } = await supabase
  .from('nodes')
  .select('*')
  .eq('user_id', user.id);

// Fetch all other nodes (for map display)
const { data } = await supabase
  .from('nodes')
  .select('node_id, latitude, longitude, elevation_m, status, user_id')
  .neq('user_id', user.id);
```

### Coordinate Conversion

Use the `latLngToXY()` helper in InfiniteCanvas to convert geographic coordinates to canvas space:

```typescript
const METERS_PER_DEG_LAT = 111320;
const UNIT_METERS = 10;
```

## Testing the Simulation

1. Create an account and add nodes via `/nodes/new`
2. Use the simulation controls in the right panel to play/pause and adjust speed
3. Select a node to view its time-based sensor readings
4. Alerts are generated automatically when readings exceed thresholds

## Future Considerations

- The `infected` status and node infection mechanics are defined in the schema but not yet implemented in the UI
- Alert system currently generates alerts in-memory; may want to persist to database
- Sensor data table exists but readings are currently simulated client-side only

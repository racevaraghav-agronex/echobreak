# Echobreak — Acoustic Traffic Intelligence

Echobreak is a full-stack (MERN + Socket.IO + MapLibre GL JS) navigation platform that layers
acoustic-anomaly detection, predictive congestion, advisory speed pacing, and FIFO
recovery guidance on top of a real turn-by-turn navigation experience.

## ⚠️ Security note (read first)

This project was scaffolded from an `.env` you shared in chat, which contained a real
MongoDB Atlas password, JWT secret, and admin password. **Rotate all three** (MongoDB
Atlas → Database Access → edit user password; generate a new random `JWT_SECRET`;
change `ADMIN_PASSWORD`) before using this anywhere beyond your own local machine —
those values should be treated as already exposed.

## Architecture

```
echobreak/
├── backend/     Express + MongoDB + Socket.IO API
└── frontend/    React (Vite) + MapLibre GL JS map client
```

See inline comments in `backend/services/*` for exactly which pieces are real external
providers (OSRM routing, Nominatim geocoding) vs. Echobreak's own logic (risk engine,
congestion prediction, pacing, FIFO recovery).

## What's implemented end-to-end

- **Auth**: signup/login (email or phone) against MongoDB, bcrypt hashing, JWT, a
  dedicated admin login path via `ADMIN_EMAIL`/`ADMIN_PASSWORD`, exact
  "Account not found! Please create an account first." messaging.
- **Map & search**: MapLibre GL JS + OpenStreetMap-compatible raster tiles, live
  `watchPosition` geolocation, clustered GeoJSON sources, dynamic layer controls,
  map click coordinates with backend reverse geocoding, Nominatim-backed autocomplete
  search with debounce/recents, quick category search, and nearby named OSM features.
- **Directions**: OSRM-backed routing with alternatives, vehicle-mode-aware profiles,
  distance/ETA, and an Echobreak Route Risk badge per route.
- **Live navigation**: GPS watch, turn-by-turn HUD, browser speech-synthesis voice
  guidance with de-duplication, off-route detection against route geometry, automatic
  rerouting, arrival detection.
- **Acoustic intelligence**: the browser can run a local Web Audio spectral heuristic
  and sends only an event type and confidence to `/api/traffic/acoustic-event`; raw
  microphone audio is never uploaded or stored. The black nearby-vehicle marker is
  thresholded and smoothed, and does not claim exact distance or direction.
- **Realtime vehicle state**: authenticated Socket.IO sessions update an anonymous
  in-memory vehicle state with validation, rate limiting, heartbeat refresh, stale
  cleanup, and 5 km spatial filtering. Peer clients receive no user ID or profile.
- **Predictive safety**: active vehicle count, average speed, speed variance, sudden
  slowdowns, recent safety events, and time-to-collision contribute to bounded advisory
  recommendations. Outputs are risk estimates, never accident or congestion guarantees.
- **Predictive congestion & pacing**: `/api/traffic/predict` and `/api/traffic/pacing`
  turn recent event density into a congestion factor and an advisory (never
  vehicle-controlling) pacing instruction.
- **FIFO recovery**: `/api/traffic/recovery` tracks per-segment recovery stages
  (queue detected → controlled sequential advisory → flow recovery).
- **🏴 Untracked traffic**: clearly separate marker/style from connected-user markers,
  always phrased as "potential untracked traffic nearby," never tied to an identity.
- **Admin dashboard**: your original `AdminDashboard.jsx` design, now wired to real
  `/api/traffic/users` and `/api/traffic/stats` (also mirrored at `/api/admin/*`
  with more detail), polling every 8s, with a live green pulse for online users.
- **Socket.IO**: `user:location`, `acoustic:event`, `risk:update`, `pacing:update`,
  `recovery:update/end`, `traffic:update`, `vehicle:update`, and `safety:event` all
  wired between server and client.

## Prerequisites

- Node.js 18+
- A MongoDB connection string (Atlas or local)
- A modern browser (Chrome/Edge/Safari) for Geolocation + SpeechSynthesis support

## Setup

```bash
cd echobreak
npm run install:all
```

MapLibre is installed in `frontend/package.json`. For a frontend-only setup:

```bash
cd frontend
npm install maplibre-gl
npm run dev
```

Optional `frontend/.env` overrides:

```env
VITE_MAP_STYLE_URL=
VITE_OSM_TILE_URL=https://tile.openstreetmap.org/{z}/{x}/{y}.png
VITE_GEOCODING_PROVIDER=backend
VITE_ROUTING_PROVIDER=backend
```

Search autocomplete is intentionally limited to a nearby radius (`GEOCODING_SEARCH_RADIUS_KM`,
50 km by default) and starts after two characters. This prevents short partial queries
from showing unrelated out-of-area locations; users can still select a full destination
through routing after it appears in the local result set.

The default style uses OpenStreetMap-compatible tiles and displays attribution. Public
OSM tiles, Nominatim, Overpass, and the OSRM demo server are suitable for development
and low-volume testing only. Follow their rate limits and identification requirements;
for production traffic, use a permitted commercial tile/geocoding/routing provider or
self-host the required services. Do not remove OSM attribution when OSM data is used.

### Backend `.env`

`backend/.env` already exists with the values you originally shared, so it will run
as-is locally — but again, rotate those credentials first. `backend/.env.example`
shows the shape for a fresh setup:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string_here
JWT_SECRET=replace_with_a_long_random_string
JWT_EXPIRES_IN=7d
ADMIN_EMAIL=admin@echobreak.com
ADMIN_PASSWORD=change_this_password
CLIENT_ORIGIN=http://localhost:5173
ROUTING_API_KEY=
GEOCODING_API_KEY=
OVERPASS_URL=https://overpass-api.de/api/interpreter
VEHICLE_STATE_TTL_MS=45000
VEHICLE_UPDATE_INTERVAL_MS=750
```

Routing/geocoding work out of the box against free public OSRM/Nominatim instances —
`ROUTING_API_KEY` / `GEOCODING_API_KEY` are only needed if you swap in a commercial
provider (Mapbox, ORS, Google) for production traffic-aware routing at scale. Nearby
OSM feature discovery uses the public Overpass API; set `OVERPASS_URL` to a
self-hosted or approved Overpass instance for production volume. Keep the visible
OpenStreetMap attribution in place and follow each provider's usage policy.

## Running (development)

```bash
# terminal 1
npm run dev:backend     # http://localhost:5000

# terminal 2
npm run dev:frontend    # http://localhost:5173
```

Open http://localhost:5173, sign up, allow location permission, and search a
destination. Log in with `ADMIN_EMAIL`/`ADMIN_PASSWORD` from `.env` to reach
`/admin`.

Run the anonymous multi-vehicle simulator in another terminal after the backend is up:

```bash
cd backend
npm run simulate
```

Use `SIMULATION_COUNT`, `SIMULATION_LAT`, and `SIMULATION_LNG` to change the scenario.
Run backend unit tests with `npm test`. The simulator uses the same Socket.IO contract
and does not create fake database users.

## Running (production)

```bash
cd frontend && npm run build   # outputs frontend/dist
cd ../backend && npm start
```

Serve `frontend/dist` from your static host / CDN / reverse proxy, and point
`VITE_API_BASE_URL` / `VITE_SOCKET_URL` (frontend env vars) at your deployed backend
URL before building.

## Data trust labeling

Every `TrafficLog` entry is tagged `confirmed` (direct user reports), `estimated`
(acoustic-derived), or `predicted` (congestion model output) — the UI never presents
estimated/predicted data as confirmed real-world traffic, and risk/hazard language is
always probabilistic ("potential hazard detected," "elevated collision-risk signal")
rather than a guarantee.

## Troubleshooting

- **"Account not found!" on a real account** — you're logging in with the wrong
  field; the same input is checked as both email and phone, so double-check spelling.
- **Routing/search fails** — the public OSRM/Nominatim demo servers have low rate
  limits; if you see frequent 502s, self-host OSRM or add a commercial routing key.
- **No voice guidance** — some mobile browsers require a user gesture before
  `speechSynthesis` will speak; tap anywhere on screen once navigation starts.
- **Socket events not arriving** — check `CLIENT_ORIGIN` in `backend/.env` matches
  the frontend's actual origin exactly (including port).

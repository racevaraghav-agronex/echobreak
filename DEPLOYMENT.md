# EchoBreak Production Deployment Guide (Netlify Only)

This guide outlines how to deploy EchoBreak entirely on **Netlify** with **MongoDB Atlas** as the sole external database.

---

## 1. Architecture Overview (Netlify-Only)

```
GitHub Repository
       ↓
Netlify
   ├── React/Vite SPA (frontend/dist)
   ├── Netlify Functions (netlify/functions/api.js wrapping existing Express API)
   └── SPA routing & Netlify proxy rules (/api/* -> Netlify Function)

MongoDB Atlas (External Database)
       ↑
   Mongoose models (User, TrafficLog) connected via MONGO_URI
```

- **Frontend**: React + Vite SPA with Tailwind CSS, MapLibre GL JS, and OpenStreetMap. Built to `frontend/dist`.
- **API Backend**: Existing Express REST API with authentication (`/api/auth`), traffic logging (`/api/traffic`), and admin routes (`/api/admin`).
- **Serverless Bridge**: `netlify/functions/api.js` powered by `serverless-http` handles all incoming `/api/*` routes directly on Netlify.
- **Production Database**: MongoDB Atlas cluster storing User accounts, hashed credentials, and historical Traffic logs.
- **No Third-Party Hosting**: Requires no external backend host (Render, Railway, AWS, or Heroku are NOT used).

---

## 2. Environment Variables Checklist

Configure these variables in **Netlify Site Configuration → Environment Variables**:

### Required Production Secrets
| Variable | Description | Example Placeholder |
|---|---|---|
| `MONGO_URI` | Real MongoDB Atlas connection string | `your_mongodb_atlas_connection_string` |
| `JWT_SECRET` | Cryptographically strong secret key for auth tokens | `your_secure_random_secret` |
| `ADMIN_EMAIL` | Dedicated administrator email for dashboard access | `admin@echobreak.com` |
| `ADMIN_PASSWORD` | Administrator password | `your_secure_admin_password` |

### Recommended Runtime Configurations
| Variable | Description | Value |
|---|---|---|
| `CLIENT_ORIGIN` | Allowed CORS origin (your Netlify domain) | `https://your-site.netlify.app` |
| `JWT_EXPIRES_IN` | Auth token expiration | `7d` |
| `VITE_API_BASE_URL` | Frontend API base URL | `/api` |
| `VITE_SOCKET_URL` | Socket.IO server URL | `https://your-site.netlify.app` |

### Optional Commercial Provider Overrides
> **Note**: EchoBreak uses the public OSRM server, Nominatim geocoding, and OpenStreetMap tiles by default. No API keys are required for routing, geocoding, or map rendering.
- `ROUTING_API_KEY` (Optional override if swapping to a commercial routing provider)
- `GEOCODING_API_KEY` (Optional override if swapping to a commercial geocoding provider)
- `VITE_MAP_STYLE_URL` (Optional custom MapLibre style JSON URL)
- `VITE_OSM_TILE_URL` (Optional custom tile provider URL)

---

## 3. Netlify Deployment Steps

1. **Push Repository to GitHub**:
   Ensure all changes are committed and pushed to your GitHub repository.
2. **Import Project in Netlify**:
   - Go to [Netlify App](https://app.netlify.com/) → **Add new site** → **Import an existing project**.
   - Select your GitHub repository.
3. **Verify Build Settings**:
   - **Base directory**: (Leave blank / root)
   - **Build command**: `npm run build`
   - **Publish directory**: `frontend/dist`
   - **Functions directory**: `netlify/functions`
   *(Netlify automatically detects these from `netlify.toml`)*
4. **Set Environment Variables**:
   In Netlify Site Settings → **Environment Variables**, set:
   - `MONGO_URI`
   - `JWT_SECRET`
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD`
   - `CLIENT_ORIGIN` (Optional, e.g. `https://<your-site-name>.netlify.app`)
5. **Deploy Site**:
   Click **Deploy site**. Netlify runs `npm run build`, publishes `frontend/dist`, deploys `netlify/functions/api.js`, and sets up the redirect rules defined in `netlify.toml` and `_redirects`.

---

## 4. Socket.IO & Real-Time Architecture Limitation

- **Netlify Serverless Behavior**: Netlify Functions run as short-lived AWS Lambda executions that terminate after returning an HTTP response. Because serverless functions cannot maintain long-lived, continuous bidirectional TCP/WebSocket connections, live Socket.IO room subscriptions are limited in a purely serverless Netlify environment.
- **Preservation of Socket.IO Code**: All existing EchoBreak Socket.IO client and server code is 100% preserved (not removed, not faked, and not polling-replaced).
- **Graceful Client Fallback**: The client Socket.IO utility handles disconnection gracefully without breaking navigation, maps, safety scoring, or routing.

---

## 5. Local Build & Test Verification

```bash
# Install dependencies
npm install

# Build frontend bundle
npm run build

# Start local server (serves frontend SPA and backend API on port 3000)
npm start
```

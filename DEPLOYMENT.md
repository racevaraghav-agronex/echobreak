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

### Production Environment Variables Summary
| Variable | Status | Description | Safe Default / Fallback |
|---|---|---|---|
| `MONGO_URI` | **REQUIRED** in production | MongoDB Atlas connection string | In-memory store (in local dev/preview) |
| `JWT_SECRET` | **REQUIRED** in production | Secure secret for auth token signatures | Internal fallback in local dev/preview |
| `ADMIN_EMAIL` | **REQUIRED** in production | Administrator email for admin portal | `admin@echobreak.com` |
| `ADMIN_PASSWORD` | **REQUIRED** in production | Administrator password for admin portal | `admin123` in local dev/preview |
| `CLIENT_ORIGIN` | Recommended | Allowed CORS origin (e.g. `https://<site>.netlify.app`) | Automatically permits Netlify and same-origin |
| `JWT_EXPIRES_IN` | Optional | Auth token lifetime | `7d` |
| `VITE_API_BASE_URL` | Optional | API base URL for frontend | `/api` |
| `VITE_SOCKET_URL` | Optional | Socket server URL for frontend | Current window origin |

> **Public Open-Source Stack**: EchoBreak uses the public OpenStreetMap Nominatim service for geocoding and the public OSRM server for routing out of the box. No third-party API keys (`GEOCODING_API_KEY`, `ROUTING_API_KEY`) are needed or used by executable code.


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

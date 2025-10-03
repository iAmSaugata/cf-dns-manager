# Cloudflare DNS Manager

Single-container web app to manage Cloudflare DNS records (A, AAAA, CNAME, TXT, MX, NS, PTR).
- Backend: Node.js (Express, ES modules)
- Frontend: React + Vite (no Bootstrap/Tailwind)
- Debug logs enabled by default
- Desktop-first UI, dark soothing theme with simple 3D hover buttons
- Restricted (read-only) records (locked or managed by apps/Argo) are not editable/deletable
- Proxy toggle only for A/AAAA/CNAME; others are DNS-only
- Comments are shown with a 📜 tooltip beside the Name

## Configuration

Create a `.env` file (or use env vars) with:
```
APP_PASSWORD=changeme
CF_API_TOKEN=cf_xxx_with_zone_read_dns_edit
PORT=8080
```

Required Cloudflare token scopes: **Zone: Read**, **DNS: Edit**.

## Run locally (Docker)

```bash
docker compose up --build
# Open http://localhost:8080
# Login with APP_PASSWORD
```

## Run locally (Node only)

```bash
# backend
cd server
npm install
node index.mjs

# frontend
cd ../frontend
npm install
npm run dev
```

> In production, the Docker image serves the frontend from the backend via `server/public`.

## Endpoints (all require APP_PASSWORD via `x-app-password` header or `app_password` cookie)

- `GET /api/health`
- `GET /api/zones`
- `GET /api/zone/:zoneId/dns_records`
- `POST /api/zone/:zoneId/dns_records`
- `PUT /api/zone/:zoneId/dns_records/:id`
- `DELETE /api/zone/:zoneId/dns_records/:id`

Errors from Cloudflare API are forwarded as JSON.

## UI Notes

- Desktop-first; enforced min viewport width of 1200px on mobile
- Zone Selection title always shows **Cloudflare DNS Manager**
- DNS Management header shows `DNS Manager for Zone ZONENAME` (ZONENAME in ALL CAPS & highlighted)
- Browser tab title changes to the active zone (CAPS)
- Table: `Select | Type | Name | Content | TTL | Proxy | Priority (MX only) | Actions`
- Proxy: toggle for A/AAAA/CNAME, "DNS-only" for others
- "Proxied" label appears for proxied records
- Comments displayed via 📜 icon tooltip
- Delete buttons are red shades only
- No multi-select; no "Delete Selected"
- Add/Edit/Delete use floating modals; Save/Cancel aligned right and disabled during requests

## Packaging

This repository contains a multi-stage Dockerfile and a `docker-compose.yml` to run as a single container.

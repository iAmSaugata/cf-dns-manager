# Cloudflare DNS Manager

Single-container app to manage Cloudflare DNS (A, AAAA, CNAME, TXT, MX, NS, PTR).  
Backend: Node.js (Express). Frontend: React + Vite. Docker: Node 20 Alpine.

## Features
- Login protected (password via `APP_PASSWORD`) – sent as `x-app-password` header or `app_password` cookie.
- Zone selection (skipped when only one zone is available).
- DNS management with search, filter, proxy toggle (A/AAAA/CNAME), MX priority, comments (📜 tooltip).
- Restricted/readonly records (no Edit/Delete).
- Desktop-first UI (min width 1200px), dark soothing theme, 3D hover buttons, row hover shadow/scale.
- Full debug logging of every request and upstream call.
- Runs both API and UI from **one** container.

## Config
Create `.env` (or set env vars):
```
APP_PASSWORD=changeme
CF_API_TOKEN=your_cloudflare_token
PORT=8080
```
Token requires scopes: **Zone:Read**, **DNS:Edit**.

## Local dev (Docker)
```bash
docker compose up --build
# open http://localhost:8080
```

## Local dev (without Docker)
```bash
# 1) build frontend
cd frontend
npm install
npm run build

# 2) run server
cd ../server
npm install
npm run dev
# open http://localhost:8080
```

## Endpoints (all require password unless /api/health)
- `GET /api/health`
- `GET /api/zones`
- `GET /api/zone/:zoneId/dns_records` (A, AAAA, CNAME, TXT, MX, NS, PTR)
- `POST /api/zone/:zoneId/dns_records`
- `PUT /api/zone/:zoneId/dns_records/:id`
- `DELETE /api/zone/:zoneId/dns_records/:id`

Cloudflare errors are forwarded as JSON. See `server/src/cloudflare.js` for API wrappers.

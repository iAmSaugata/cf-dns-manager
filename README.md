# Cloudflare DNS Manager

Single-container app (Node.js + React) to manage Cloudflare DNS records (A, AAAA, CNAME, TXT, MX, NS, PTR).
Frontend (React+Vite) and backend (Express) are built into one Docker image.

## Features
- Login gated via **APP_PASSWORD** (header `x-app-password` or cookie `app_password`).
- Manage records: A/AAAA/CNAME/TXT/MX/NS/PTR.
- MX priority support (column + form field).
- Proxy toggle for A/AAAA/CNAME only; others are DNS-only.
- Read-only records (🔒) cannot be edited or deleted.
- Comments displayed via 📜 tooltip beside the Name.
- Desktop-first UI with custom dark gradient styling and 3D buttons.
- Full debug logs of every request and Cloudflare API call.

## Configuration
Environment variables:
- `APP_PASSWORD` – Password to access UI/API (required).
- `CF_API_TOKEN` – Cloudflare API token with **Zone:Read** and **DNS:Edit** (required).

## Run with Docker Compose
```bash
docker compose up --build
```
App will be available on http://localhost:8080

## Manual build
```bash
# Build frontend
cd frontend && npm ci && npm run build && cd ..
# Build backend
cd backend && npm ci && cd ..
# Run
node backend/server.mjs
```

## Endpoints (all require APP_PASSWORD)
- `GET /api/health`
- `GET /api/zones`
- `GET /api/zone/:zoneId/dns_records` (A, AAAA, CNAME, TXT, MX, NS, PTR)
- `POST /api/zone/:zoneId/dns_records`
- `PUT /api/zone/:zoneId/dns_records/:id`
- `DELETE /api/zone/:zoneId/dns_records/:id`

## Notes
- Desktop-only view is enforced (≥ 1200px width).
- Footer: **Powered by Cloudflare DNS API • © iAmSaugata**.
- All actions logged to console by default.

# Cloudflare DNS Manager

Single-container app (Node.js + React) to manage Cloudflare DNS records (A, AAAA, CNAME, TXT, MX, NS, PTR).

## Features
- Login gate with single password (`APP_PASSWORD`), accepted via header or cookie.
- List / create / edit / delete records.
- Proxy toggle for A/AAAA/CNAME, DNS-only for TXT/MX/NS/PTR.
- MX priority support.
- Optional comment displayed with 📜 tooltip.
- Read-only detection for Cloudflare-managed/locked records.
- Desktop-first custom UI with 3D hover buttons.
- Full debug logs of requests and upstream Cloudflare API calls.

## Tech
- Backend: Node.js (Express, ES Modules, dotenv, node-fetch, cors, morgan)
- Frontend: React + Vite (no Bootstrap/Tailwind)
- Container: Multi-stage Dockerfile (Node 20 Alpine)

## Config
Set environment variables:
- `APP_PASSWORD` — password to access the UI/API
- `CF_API_TOKEN` — Cloudflare API token with **Zone:Read** and **DNS:Edit**

Optional: `PORT` (default 8080).

Create a `.env` (for local dev) based on `backend/.env.example` or export envs.

## Local Development
```bash
# Build & run container
docker compose up --build

# Open the app
http://localhost:8080
```
Login using `APP_PASSWORD`.

## API (all require APP_PASSWORD)
- `GET /api/health`
- `GET /api/zones`
- `GET /api/zone/:zoneId/dns_records`
- `POST /api/zone/:zoneId/dns_records`
- `PUT /api/zone/:zoneId/dns_records/:id`
- `DELETE /api/zone/:zoneId/dns_records/:id`

Password can be sent via header `x-app-password` or cookie `app_password`.

## Notes
- TTL value `1` is treated as "Auto-like". Set an explicit TTL in seconds otherwise.
- Read-only rows hide Edit/Delete.
- Desktop view is enforced with min-width 1200px.
- Footer shows: `Powered by Cloudflare DNS API • © iAmSaugata`.

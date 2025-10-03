# Cloudflare DNS Manager

Single-container web app to manage Cloudflare DNS records (A, AAAA, CNAME, TXT, MX, NS, PTR) with a React (Vite) frontend and Node.js (Express) backend.

## Features
- Desktop-first UI (enforced >=1200px width on mobile)
- Dark gradient header panels; light, non-white background
- 3D-style buttons with hover brighten
- Centered login & zone selection cards
- Zone plan/type badge; compact zone list
- DNS table: Select | Type | Name | Content | TTL | Proxy | Priority (MX) | Actions
- Proxy toggle supported for A/AAAA/CNAME; all others show DNS-only
- 📜 tooltip next to Name when a comment exists
- Bulk delete with confirmation; "Delete Selected" disabled until rows selected
- Read-only / restricted items (locked or "managed") show 🔒 (no Edit/Delete/Select)
- Full debug logging of every request and upstream API call

## Environment
- `APP_PASSWORD` – required for all `/api/*` endpoints (via header `x-app-password` or cookie `app_password`).
- `CF_API_TOKEN` – Cloudflare API token with `Zone:Read` and `DNS:Edit`.
- Optional: `PORT`, `CF_ACCOUNT_ID`

## Quick Start

```bash
# 1) Copy env and set secrets
cp .env.example .env
# edit .env to set APP_PASSWORD and CF_API_TOKEN

# 2) Build & run
docker compose up --build -d

# App at http://localhost:8080
```

## Dev Flow
- Frontend in `frontend/`
- Backend in `backend/`
- Multi-stage `Dockerfile` builds frontend and runs server
- `docker-compose.yml` for convenience

## API (proxied to Cloudflare)
- `GET /api/health`
- `GET /api/zones`
- `GET /api/zone/:zoneId/dns_records`
- `POST /api/zone/:zoneId/dns_records`
- `PUT /api/zone/:zoneId/dns_records/:id`
- `DELETE /api/zone/:zoneId/dns_records/:id`
All require `APP_PASSWORD`.

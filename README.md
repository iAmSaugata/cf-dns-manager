
# Cloudflare DNS Manager

Single-container app (Node.js + React) to manage Cloudflare DNS records (A, AAAA, CNAME, TXT, MX, NS, PTR).  
Desktop-first UI with dark gradient panels and 3D-style buttons. Proxied toggle for A/AAAA/CNAME, comments tooltip (📜), and support for restricted/locked records.

## Features
- One container for API + UI (Node 20 Alpine)
- Auth required for all `/api/*` via `APP_PASSWORD` (header `x-app-password` or cookie `app_password`)
- Cloudflare API token auth (scopes: Zones:Read, DNS:Edit)
- CRUD for A/AAAA/CNAME/TXT/MX/NS/PTR (priority for MX)
- Restricted records (no edit/delete, show 🔒): mark with `[LOCKED]` in comment **or** list names in `RESTRICTED_NAMES` env
- Full debug logs of requests and upstream calls
- Desktop-only UI (min width 1200px). Delete buttons are red. Hover shadow/scale rows. Footer: “Powered by Cloudflare DNS API • © iAmSaugata”.

## Quick start (Docker)
Create `.env` in project root:
```env
APP_PASSWORD=changeme
CF_API_TOKEN=your_cf_api_token_with_zones_read_dns_edit
RESTRICTED_NAMES=example.com,login.example.com
```
Build & run:
```bash
docker compose up --build -d
# open http://localhost:8080
```

## Local dev (two terminals)
```bash
# backend
cd backend
cp .env.example .env  # set APP_PASSWORD and CF_API_TOKEN
npm install
npm run dev

# frontend
cd ../frontend
npm install
npm run dev
# open http://localhost:5173
```

## API Overview
All routes require `x-app-password: <APP_PASSWORD>` or cookie `app_password`.
- `GET /api/health`
- `GET /api/zones`
- `GET /api/zone/:zoneId/dns_records`
- `POST /api/zone/:zoneId/dns_records`
- `PUT /api/zone/:zoneId/dns_records/:id`
- `DELETE /api/zone/:zoneId/dns_records/:id`

Errors from Cloudflare are forwarded as JSON with HTTP status.

## UI Notes
- Login page with centered card (Clear / Reload / Login).
- Zone selection: compact cards with plan/type badge, hover shadow/scale.
- DNS management page: title “DNS Manager for Zone ZONENAME” (caps), tab title updates.
- Toolbar: filter/search, Clear, **Delete Selected** (disabled until selection), Add Record.
- Table: Select | Type | Name | Content | TTL | Proxy | Priority (MX) | Actions
  - Proxy toggle only for A/AAAA/CNAME; others show "DNS only".
  - 📜 beside Name when comment exists (title tooltip).
  - Restricted records show 🔒 instead of checkbox and hide Edit/Delete.
- Add/Edit modal: Type, Name, Content, TTL, Proxy (label “PROXY” above), Priority (MX only), Comment.
- Bulk delete: Confirmation modal lists items; disabled until selection.

## Build notes
- Vite builds into `backend/public` and Express serves the SPA + API in one container.
- Node 20 Alpine multi-stage Dockerfile.

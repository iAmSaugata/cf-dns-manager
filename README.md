# Cloudflare DNS Manager

Single-container app (Node.js + React/Vite) to manage Cloudflare DNS records (A, AAAA, CNAME, TXT, MX, NS, PTR).
Desktop-first UI with compact center-aligned cards, hover shadows, and 3D-style buttons.

## Features
- Login with `APP_PASSWORD` (via header `x-app-password` or cookie `app_password`)
- List Cloudflare zones and DNS records (A/AAAA/CNAME/TXT/MX/NS/PTR only)
- Add / Edit / Delete records (proxy toggle for A/AAAA/CNAME; DNS-only for TXT/MX/NS/PTR)
- MX priority support
- Comments shown via 📜 tooltip next to the name
- Read-only/locked records cannot be edited or deleted
- Bulk delete with **Delete Selected** (disabled until items selected)
- Full debug logs of every request and upstream API call
- Desktop-first (≥1200px), enforced on mobile

## Configuration
Create `.env`:
```
APP_PASSWORD=changeme
CF_API_TOKEN=your_cloudflare_token_with_zone_read_dns_edit
PORT=8080
```
Required Cloudflare token scopes: **Zone:Read** and **DNS:Edit**.

## Local Run
```bash
docker compose up --build
# then open http://localhost:8080
```

## Endpoints (all require password)
- `GET /api/health`
- `GET /api/zones`
- `GET /api/zone/:zoneId/dns_records`
- `POST /api/zone/:zoneId/dns_records`
- `PUT /api/zone/:zoneId/dns_records/:id`
- `DELETE /api/zone/:zoneId/dns_records/:id`

Password is passed via header `x-app-password` or cookie `app_password`.

## Packaging
This repository is ready-to-run in a single Docker container using a multi-stage build on Node 20 Alpine.

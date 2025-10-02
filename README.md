# CF DNS Manager v16

Desktop-focused React + Express app to browse and edit Cloudflare DNS.
All UI items requested are implemented: centered login/zone, compact buttons, toolbar alignment, proxy rules, confirmation modal, PROXY label above toggle, title sync, and the 📜 tooltip icon (ℹ️/ⓘ removed).

## What’s new in v16
- Zone selection compact and centered; shows zone type with hover shadow.
- Toolbar: Search/Filter (left) + Clear + Delete Selected on far right (disabled until a selection).
- Add Record on its own line.
- Delete confirmation modal lists all selected records (type + name + content).
- Add Record modal shows **PROXY** label above toggle.
- Proxy rules: toggle enabled for **A/AAAA/CNAME**, forced DNS-only for **TXT/MX/NS/PTR**.
- Title bar & browser tab show selected `ZONE.COM` in CAPS; reset on **Change Zone**.
- Proxy toggle bug fixed by syncing state back into the edit modal.
- UI is desktop-only, scales down on small screens via min-width.
- Buttons compact with consistent subtle 3D effect.
- Tooltip icon replaced with 📜 globally; no ℹ️ or ⓘ anywhere.

## Quick start

```bash
# 1) Prepare env
cp .env.example .env
# edit .env with APP_PASSWORD and CF_API_TOKEN

# 2) Run with docker
docker compose up --build -d

# 3) Open
http://localhost:5000
```

## Env
- `APP_PASSWORD` — app gate for /api
- `CF_API_TOKEN` — Cloudflare API token with Zone:Read and DNS:Edit
- `PORT` — default 5000

## Dev
```bash
npm install
npm run build
npm start
# or, develop frontend:
npm --prefix frontend run dev
```

# CF DNS Manager (v6-full)

Single-container app (Node.js + Vite React) to manage Cloudflare DNS:
- Login with APP_PASSWORD (env), token via CF_API_TOKEN
- Zone auto-load when only one zone exists
- Full CRUD for DNS records with comments
- Filters + search; bulk select and delete (with modal confirmation)
- Buttons styled like "DNS Alias Creator for Secure DNS"
- Container logs include Cloudflare request lines and CRUD actions

## Run
```bash
docker compose up --build -d
# open http://localhost:5000
```

## Env
- `APP_PASSWORD` – required
- `CF_API_TOKEN` – Cloudflare token (Zone:Read, DNS:Edit)
- `PORT` – default 5000

## Screens (sample)
- Login centered
- Zone picker
- Records grid with inline edit and info ⓘ tooltip
- Delete confirmation modal (single & bulk)

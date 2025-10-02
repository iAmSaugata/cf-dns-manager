# CF DNS Manager (v14.2 full)

Single-container app to manage Cloudflare DNS records.

## Run
```bash
docker compose up --build -d
# open http://localhost:5000
```
Env: `APP_PASSWORD` (required), `CF_API_TOKEN` (Zone:Read, DNS:Edit).

# CF DNS Manager (v15 full)

- Zone selection like v14-full2 (simple list with inline Open)
- Buttons smaller than before
- Proxy toggle switch for A/AAAA/CNAME (disabled for TXT/MX/NS/PTR)
- Selected zone highlighted in header
- Mobile responsive (stacked controls + mobile list view)
- Legacy ⓘ removed; only ℹ️ used for comments

## Run
```bash
docker compose up --build -d
# http://localhost:5000
```
Set env: `APP_PASSWORD`, `CF_API_TOKEN` (Zone:Read, DNS:Edit).

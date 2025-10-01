# Cloudflare DNS Manager — Single Container v2

Single Node.js project serving both API and React frontend.

## Run
```bash
unzip cf-dns-manager-single-v2.zip
cd cf-dns-manager-single-v2
docker compose up --build
```
Open http://localhost:5000

## Auth
- Backend requires `APP_PASSWORD` (set in docker-compose).
- Frontend login asks only for password.
- Backend injects `CF_API_TOKEN` (Cloudflare API Token with Zone:Read + DNS:Edit).

## Zone Handling
- If only one zone in account → auto loads that zone.
- If multiple zones → zone picker dropdown.
- Top banner shows: **DNS Manager for Zone ABC.COM**

## Footer
All pages include footer:  
`Powered by Cloudflare DNS API • © iAmSaugata`

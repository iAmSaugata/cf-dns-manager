# Cloudflare DNS Manager

Single-container app to manage Cloudflare DNS records (A, AAAA, CNAME, TXT, MX, NS, PTR).

### New UI tweaks
- Zone list: "Open" button centered; helper text removed.
- Search toolbar: single-line row (Type, search box, Clear).
- Top toolbar: **Delete Selected** (left) and **Add Record** (right).
- Priority pills for MX are shown next to Content (no separate column).
- Bouncy page scroll disabled.

## Run
```bash
cp .env.example .env
# set APP_PASSWORD and CF_API_TOKEN
docker compose up --build -d
# open http://localhost:8080
```

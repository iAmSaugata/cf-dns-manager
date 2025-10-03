# Cloudflare DNS Manager (v2)

- Proxy toggle is a slider next to the "Proxy" label (A/AAAA/CNAME only).
- Modal fields aligned using a grid layout; Priority shows **N/A** when not applicable.
- Delete confirmation lists **type, name, and content**; simple, no hover effects.
- Dark mode available from the footer toggle; header is slightly lighter in dark mode. Preference persists via `localStorage`.
- Read-only entries (`meta.read_only: true`) show a **lock** instead of a checkbox and Edit/Delete are disabled (still visible).
- Pages fit the current screen (no forced 1200px width).

## Run
```bash
cp .env.example .env
# set APP_PASSWORD and CF_API_TOKEN
docker compose up --build -d
# open http://localhost:8080
```

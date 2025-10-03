# Cloudflare DNS Manager (dark mode + UI refinements)

- Dark Mode toggle in footer (remembered across sessions).
- Add/Edit modal fields aligned in grid; proxy uses a toggle slider beside the "Proxy" label and centered vertically.
- MX Priority shows as a pill next to Content; when Priority is not applicable, field is disabled with "N/A".
- Single delete modal shows detailed info and uses a plain appearance (lighter shadow). Bulk delete modal unchanged.
- Read-only (Cloudflare managed) records detected via `meta.read_only` (plus other managed flags): checkbox shows 🔒; Edit/Delete disabled with tooltip.
- "Delete Selected" is disabled until at least one entry is selected.
- Layout adapts to viewport (max width uses up to ~94vw). Bouncy scroll disabled.

## Run
```bash
cp .env.example .env
# set APP_PASSWORD and CF_API_TOKEN
docker compose up --build -d
# open http://localhost:8080
```

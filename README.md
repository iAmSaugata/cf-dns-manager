# Cloudflare DNS Manager

- Modal fields aligned; proxy is a slider toggle (with spacing).
- Delete modal:
  - Single delete shows full details (type, name, content, TTL, proxy, priority, comment).
  - Bulk delete lists `type — name` for each item.
- Dark Mode across all pages, toggled from footer; persisted to next run.
- Read-only DNS entries (e.g., `meta.read_only: true`) show a lock in the Select column and have Edit/Delete disabled.

## Run
```bash
cp .env.example .env
# set APP_PASSWORD and CF_API_TOKEN
docker compose up --build -d
# open http://localhost:8080
```

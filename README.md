# CF DNS Manager (v15.1 full)

- Login centered. No version in tab title.
- Zone selection small & centered.
- Delete Selected disabled until selection.
- Desktop-only view (no separate mobile view); slightly scaled on small screens.
- Proxy toggle fix: edit form now syncs with latest record state.
- On zone select, browser tab title becomes the ZONE NAME (all caps).

## Run
```bash
docker compose up --build -d
# http://localhost:5000
```
Env: `APP_PASSWORD`, `CF_API_TOKEN` (Zone:Read, DNS:Edit).

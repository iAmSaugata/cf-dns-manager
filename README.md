# CF DNS Manager (v16 full)

- Centered login & centered zone selection (with zone type + hover).
- Desktop-only view, scaled on tiny screens.
- Toolbar: Search/Filter left + Clear; Delete Selected far right (disabled until selection).
- Confirmation modal lists all selected records.
- Add Record shows PROXY label above toggle.
- Proxy toggle bug fixed; edit view syncs with latest state.
- Zone name highlighted in header; tab title becomes ZONE.COM; resets when changing zone.
- Tooltip icon changed to 📜, legacy icons removed.

## Run
```bash
docker compose up --build -d
# http://localhost:5000
```
Env: `APP_PASSWORD`, `CF_API_TOKEN` (Zone:Read, DNS:Edit).

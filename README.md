# Cloudflare DNS Manager (UI fixes)

- Dark-mode friendly zone cards and badges.
- Bulk delete stays disabled until a user selects at least one *selectable* entry (read-only items are ignored and not preselected).
- Read-only entries (meta.read_only) show a lock in the checkbox cell; Edit/Delete are disabled with tooltip.
- Popups have consistent spacing, wider width, overflow handling, right-aligned buttons with space, and updated copy.
- Add/Edit modal now orders fields: Type | Name | TTL | Content | Proxy | Priority | Comment. Header is highlighted.

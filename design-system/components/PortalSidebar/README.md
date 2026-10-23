# PortalSidebar

The employee portal's side navigation, on the dark Portal theme.

- `groups` is a list of `{label, items}`; each item is `{icon, label, href, active, count}`. Counts (open tickets, showings today) come from the database.
- `user` is `{name, role}` for the signed-in agent.
- Collapses to icons with tooltips on narrow screens.

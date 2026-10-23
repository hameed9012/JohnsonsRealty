# NavBar

The public site header: logo, main links, a Portal link and one call to action.

- `links` is a list of `{label, href, active}`; the active one gets `aria-current`.
- `portalHref` shows the Portal link for signed-in clients and staff; `cta` is `{label, href}` and carries the brass key.
- Below tablet width the links collapse behind the menu button (`onMenu`).

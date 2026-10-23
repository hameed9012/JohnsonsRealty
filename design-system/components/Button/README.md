# Button

The action button; the label starts with a verb and says exactly what happens ("Book a showing", "Publish listing").

- `variant`: `primary` (one per view), `secondary`, `ghost`, `danger`.
- `size="sm"` for dense tables and the portal; the default meets the 44px touch target.
- `icon` puts an icon before the label, `iconRight` after it. `withKey` adds the brass key that turns on hover; reserve it for the main call to action.
- `loading` keeps the width and sets `aria-busy`. `href` renders a link styled as a button.

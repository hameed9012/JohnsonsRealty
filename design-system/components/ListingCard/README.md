# ListingCard

The listing card used in grids, rails, search results and saved homes.

- Provide `address`, `price` and `status`; `area`, `facts` ([{icon, text}]) and `photo` are optional. Without a photo it shows the mark and "Photos coming soon", never a broken image.
- `priceKind`: `sale`, `rent` (adds /mo), `sold` or `reduced` (with `previousPrice`).
- `href` links the photo and address. Passing `saved` or `onSave` shows the save heart.
- `layout="list"` puts the photo left for list views and saved homes.
- Photos crop to 4:3 and get the house grade; the status ribbon sits top-left.

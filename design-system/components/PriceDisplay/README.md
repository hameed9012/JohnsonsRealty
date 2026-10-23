# PriceDisplay

A price in mono with its label: asking, rent per month, sold for, or reduced with the old price struck through.

- `amount` is a number in dollars; it is formatted with commas and no cents.
- `kind`: `sale` (default), `rent`, `sold`, `reduced` (pass `previous`).
- `size="xl"` for the property hero. `label` overrides the default word; `label=""` hides it.

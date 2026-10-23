# ConfidentialPanel

The panel that holds internal-only fields: seller bottom lines, negotiation notes, commission splits.

- `rows` is a list of `{label, value, mono}`. `title` and `note` default to "Confidential" and "Agents only".
- When the viewer lacks access, pass `redacted`: values become redaction bars and are never sent to the page.
- Works on both themes; it always carries the hatched header and lock.

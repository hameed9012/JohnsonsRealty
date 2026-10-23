# TextField

A labelled text input or textarea with hint and error text.

- `label` is required and always visible; placeholders are examples, never labels.
- `hint` explains the format; `error` replaces it, says what went wrong and how to fix it, and sets `aria-invalid`.
- `mono` for prices, IDs, parcel and postal numbers. `multiline` renders a textarea.
- Any other prop (`name`, `value`, `onChange`, `type`, `required`) passes to the input.

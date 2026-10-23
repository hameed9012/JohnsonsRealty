# AgentCard

An agent's card: avatar or initials, name, title, Chirper handle, a few figures and a contact action.

- Provide `name`; `title`, `handle`, `photo` and `stats` ([{value, label}]) are optional.
- `onContact` or `href` drives the button; `actionLabel` overrides "Contact <first name>". `action={false}` hides it.
- Never invent figures: show only stats the database has.

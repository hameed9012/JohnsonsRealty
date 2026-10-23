# SearchBar

The segmented property search that sits in the home hero and at the top of Buy and Rent results.

- `fields` is a list of `{name, label, options, value}`; each becomes a labelled select. Feed options from the database (areas, types, price bands).
- `onSearch` receives the submit event; the form also works as a plain GET form.
- `submitLabel` defaults to "Search". On mobile the segments stack.

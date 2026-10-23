# SalesLedger

The sales ledger: a ruled table of numbered sales, the brokerage's track record.

- `rows` is a list of `{no, date, address, area, agent, status, price}`, newest first, straight from the sales table.
- `columns` picks and orders columns from `no`, `date`, `property`, `agent`, `status`, `price`.
- `caption` titles the table; `total` (and `totalLabel`) adds a footer sum.
- On narrow screens wrap it in a scroller or render rows as stacked cards.

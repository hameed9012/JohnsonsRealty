# StatusStamp

The angled ink stamp that announces a listing's status where the status is the news: property hero, brochure, sold ledger, document headers.

- `status` is a key of `JR.STATUS` (available, just-listed, coming-soon, price-reduced, under-offer, under-contract, sold, settled, for-lease, leased, draft, off-market, withdrawn, archived, pending-review, changes-requested, rejected, listed-by-owner, confidential). The colour and word come from it; `label` overrides the word.
- `variant="ribbon"` is the flat brass-edged flag used on listing photos.
- `size="lg"` for heroes; `press` plays the stamp-press animation once when a status is applied.

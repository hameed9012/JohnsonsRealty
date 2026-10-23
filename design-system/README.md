Johnson's Realty is an independent real estate brokerage in Dauphin County, Pennsylvania, registered as a PARP Civilian Operations business. This system dresses three surfaces with one identity: the **public site** (anyone browsing homes, rentals and businesses), the **client account** (signed-in buyers, sellers, renters and owners), and the **employee portal** (agents running the brokerage). It also covers printed **documents** and **social graphics** made from the same data.

The idea behind everything is **the deed and the key**. Real estate is paper and brass: deed books, parcel numbers, ledger entries, ink stamps, the brass key handed over at settlement. Build from that world, then make it modern and precise. It should read as a brokerage that has been around for decades and a product made by a careful team.

## Voice and content

- Write like a calm, experienced agent: plain, confident, specific. Never salesy, never hype. No "BUY NOW", no exclamation marks in UI, no emoji in the interface.
- Lead with facts people act on: price, beds, baths, area, status, date. "4 bed · 1 bath · heated pool", not "stunning dream home".
- Be honest about trade-offs. A listing with one bathroom says so in the facts, not in small print.
- Sentence case for headings, buttons and labels in running UI ("Book a showing", "Request a valuation"). UPPERCASE only for `label`, `doc-title`, `form-label` and the `wordmark`.
- Address the reader as "you"; the brokerage speaks as "we" in marketing and as the named agent in client messages ("Hameed will confirm your showing").
- Buttons start with a verb and say exactly what happens: "Book a showing", "Save home", "Publish listing". The confirmation echoes it: "Listing published".
- Errors say what went wrong and how to fix it: "Enter a price in dollars, like 365000."
- Numbers: dollars with commas and no cents on listings (`$365,000`), rent as `$1,900/mo`, square feet as `1,850 sq ft`, dates as `Oct 21, 2026` in UI and `October 21, 2026` in documents.
- Domain details are content, not ornament. Show parcel IDs, sale numbers ("Sale No. 001"), form numbers ("Form JR-PA-100"), reference numbers ("JR-2026-00041") and in-game postal codes ("Postal 809") in `id` style wherever they are real.
- All content is dynamic. Previews in this system use placeholder content to show layouts; never hard-code listings, people or figures into a template.

## Colour

- Public pages sit on `bg` (paper). Cards, sheets and panels use `surface` with a `line` border; wells, filter bars and table headers use `surface-sunken`.
- The portal uses the **Portal (dark)** theme: set `data-theme="dark"` on the portal root. Client account pages stay on Paper.
- Text is `ink`; secondary text is `ink-muted`. `ink-subtle` is for disabled states only and never carries information.
- `green-900` is the brand. Use it for the primary action on paper (`primary`), the document header band, the footer and the top rule of ledgers.
- Brass is hardware, not decoration. Use `accent` (brass-500) for frames, ribbons, rules and the logo. As text use `accent-text`, never `accent` (2.8:1 on paper). At most one brass element per view should draw the eye.
- In the portal, the primary action is light brass (`primary` resolves to brass-300) with `on-primary` text.
- Links in running copy use `link`. Focus is always `focus`: a 2px solid outline with a 2px offset, on every interactive element, in both themes.
- Never use gradients for UI chrome. Photos may carry the unifying grade described under Imagery.

## Status

Status is the heart of the product, so it is consistent everywhere and never relies on colour alone: it always carries a word, and a stamp, pill or ribbon shape.

| Status | Token pair | Where |
| --- | --- | --- |
| Available · Active | `status-available` / `status-available-soft` | Listings on sale or for rent |
| Just Listed · Coming Soon · Price Reduced | `status-new` / `status-new-soft` | First 14 days, pre-launch, reductions |
| Under Offer · Under Contract | `status-offer` / `status-offer-soft` | Accepted or pending offers |
| Sold · Settled | `status-sold` / `status-sold-soft` | Closed sales, the sales ledger |
| For Lease · Leased | `status-lease` / `status-lease-soft` | Rentals |
| Draft · Off Market · Withdrawn · Archived | `status-off` / `status-off-soft` | Internal or inactive records |
| Pending Review · Changes Requested | `status-offer` / `status-offer-soft` | Listing submissions waiting for the owner, or sent back to the submitter |
| Rejected | `status-confidential` / `status-confidential-soft` | Submissions the owner turned down (portal only) |
| Listed by Owner | `status-lease` / `status-lease-soft` | Source label on listings a client submitted themselves; shown beside the status, never instead of it |
| Confidential | `status-confidential` / `status-confidential-soft` | Internal-only fields and panels |

- Every new listing, from an agent or a client, enters review first: Draft → Pending Review → (Changes Requested ↺) → Active, or Rejected. Only the owner approves. The portal shows the review queue as a list of submissions with a notification count on the sidebar and a bell in the portal header.
- After approval the lifecycle is always Draft → Active → Under Offer → Under Contract → Sold or Leased → Archived. Show it as a timeline on client deal pages and as pipeline columns in the portal.
- Use **StatusStamp** (the angled ink stamp) where the status is the news: property hero, brochure, sold ledger, document headers. Use **StatusPill** in dense lists and tables. Use the stamp's `ribbon` variant on listing photos.

## Visibility layers

Three layers must be impossible to confuse:

1. **Public**: anything on the public site.
2. **Client**: visible only to the signed-in client it belongs to. Mark these panels with a small `label` reading "Only you can see this".
3. **Internal / Confidential**: seller bottom lines, negotiation notes, commission splits. Always inside **ConfidentialPanel**, which carries the hatched `status-confidential-soft` ground and a lock label. When a viewer lacks access, render redaction bars, never the value.

## Typography

- Three families plus a script: `display` (Manrope), `sans` (IBM Plex Sans), `mono` (IBM Plex Mono), and `script` (Mrs Saint Delafield) for typed signatures only. Load them from Google Fonts with real fallbacks.
- Headlines use `display-xl` to `heading-3`. Only the home hero uses `display-xl`. Give headings `text-wrap: balance`.
- Running text uses `body` or `body-l`, capped at `text-max` (680px).
- **Every number is mono**: prices (`price-xl`, `price`), stats and dates (`figure`), IDs and postal codes (`id`). Always `font-variant-numeric: tabular-nums` so columns line up.
- `label` is the house eyebrow: uppercase, tracked 0.14em, in `accent-text` or `ink-muted`. Use it above headings, as table headers and inside stamps.
- Documents use `doc-title`, `form-label` and `form-value`, matching the printed paperwork.

## Layout and spacing

- Public content sits in a 12-column grid up to `content-max` (1240px): 8 columns on tablet, 4 on mobile, with a minimum `space-4` side gutter.
- Space sections with `space-16` on desktop and `space-12` on mobile; related blocks with `space-8`; card grids with a `space-6` gap.
- Prefer hairlines (`line`) and ledger rules over boxes. A section is separated by space and a rule, not by a card.
- The portal is a sidebar (`sidebar-width`) plus a content area padded with `space-10`, dense tables and `control-height-sm` controls on desktop.
- Every interactive target is at least `control-height` (44px) on touch devices.
- Mobile is first-class: filters become a bottom drawer, galleries swipe, tables become stacked cards, and the primary action stays reachable.

## Shape, borders and depth

- The house radius is `radius-1` (2px): buttons, inputs, cards, pills. Photos, documents, ledgers and bands are square (`radius-0`). Nothing is rounder than `radius-2`, except toggles and avatar photos (`radius-round`).
- Paper sits flat: cards use a `line` border and `shadow-none`. Only overlays (menus, modals, toasts, map previews) use `shadow-overlay`. A document or brochure displayed on a page may use `shadow-sheet`.
- Never put a coloured accent bar down the left edge of a card.

## Imagery

- Every property photo is an in-game Roblox screenshot: bright, saturated, sometimes low-poly. Treat them the same way every time so they read as one portfolio:
  - fixed ratios: hero 21:9, card 4:3, gallery 3:2, brochure 1080×1350 (4:5);
  - a light unifying grade: `filter: saturate(0.92) contrast(1.03)`;
  - square corners, no borders, no drop shadows;
  - a mono `caption` under gallery images: "In-game photo · Postal 809".
- Missing photo: a `surface-sunken` block with the logo mark at 40% and the words "Photos coming soon". Never a broken image.
- Never present in-game images as real-world photography, and never use stock photos of real people or real homes.

## Motion

Motion is restrained and always means something.

- **Stamp press**: when a status is applied, the stamp scales from 1.15 to 1 and settles at -4°, over 220ms ease-out.
- **Ledger count**: headline figures (homes sold, total volume) count up once on first view, over 900ms. Never loop.
- **Key turn**: the key icon in primary CTAs rotates -30° on hover, over 160ms.
- **Photo hover**: listing card photos scale to 1.03 over 300ms.
- Durations: 120ms (hover), 220ms (state), 320ms (panels and drawers). Easing: `cubic-bezier(0.2, 0, 0, 1)`.
- Under `prefers-reduced-motion: reduce`, all of these become instant. Nothing essential may depend on animation.

## Iconography

- A custom line icon set, drawn on a 24px grid with a 1.6px stroke, square ends and mitred corners. It is available as the **Icon** component and as SVG files under Icons.
- Icons label facts (beds, baths, garage, area, lot, pool, office, laundry, gate) and actions (search, filter, save, share, calendar). Always pair an icon with a word or a value; icons never stand alone except in the portal sidebar when collapsed, where they get a tooltip.
- The standalone SVG files are single-ink `green-900` (#16302a) for paper; inside the product, use the Icon component, which inherits `currentColor`.
- No emoji in the interface. Emoji may appear in social posts only.

## Logo

- The mark: a square brass frame holding a roof chevron above a horizontal key. On paper the roof is `green-900`; on green the roof is `cream`. The frame and key are always brass.
- Lockups: mark alone (favicon, avatar, portal collapsed), and mark plus the `wordmark` "JOHNSON'S REALTY" with "Brokerage · Pennsylvania" beneath in `label`.
- Clear space around the mark equals the height of the roof. Minimum size: 24px for the mark, 160px wide for the lockup.
- Never recolour, outline, rotate, add effects to, or redraw the mark. Never place it on a photo without a solid `green-900` or `paper` ground behind it.
- Use the **Logo** component in product UI; use the files under Logos for social avatars and print.

## Components

Components live in `components/bundle.js` as `window.JR` and expect React 18. Each component's guidelines say what it needs. Build pages from them; when a pattern is missing, compose it from tokens, never from literal values.

- Public: NavBar, SearchBar, FilterChip, ListingCard, StatRow, PriceDisplay, StatusStamp, StatusPill, AreaChip, AgentCard, SalesLedger, ProcessSteps, ReferenceReceipt, EmptyState, Button, Icon, Logo.
- Forms and documents: TextField, SelectField, DocumentHeader, SignatureLine.
- Portal: PortalSidebar, StatTile, PipelineCard, ConfidentialPanel, Toast.

## Don't

- No generic real-estate styling: blue and white, pill buttons, rounded cards with stock smiles.
- No black-and-gold "luxury", glassmorphism, purple or blue gradients, or emoji as icons.
- No Inter, Roboto or other default faces.
- No invented statistics, fake reviews or fake testimonials. Testimonials come from real clients and may be anonymised ("Buyer, Whispering Pines").
- No resemblance to real companies (Zillow, Redfin, Compass, Sotheby's, RE/MAX, Realtor.com). Community rules forbid matching real company names or logos, and every asset must be original.

# Surfaces and templates

Every page is a template filled from the database. Listings, areas, agents, sales, clients and documents link to each other: a listing links to its area, its agent and similar listings; an area lists its listings and recent sales; an agent lists theirs. Design and build each template for real variability: long addresses, missing photos, zero, one or hundreds of results, sale and rent, active and sold.

## Public site (Paper theme)

| Template | Built from | Notes |
| --- | --- | --- |
| Home | NavBar, cinematic hero with SearchBar, StatTile-style ledger figures, ListingCard rail, AreaChip grid, SalesLedger (latest 5), ProcessSteps, AgentCard row, Button | Hero is a 21:9 in-game photo or slow muted video with a `green-900` scrim on the text side only. Ledger figures count up once. |
| Buy · search results | SearchBar, FilterChip, ListingCard (grid and list), map with status pins, EmptyState | Grid, list and split map views. Filters become a bottom drawer on mobile. Show result count and sort. |
| Rent · search results | Same as Buy | PriceDisplay in `rent` mode; lease length and availability date on cards. |
| Property detail | Gallery (3:2), StatusStamp, PriceDisplay (price-xl), StatRow, facts table, feature list, AreaChip, AgentCard, booking form, ListingCard rail (similar) | Address in `display-l`. Price history as a ledger. "Download brochure" exports the 1080×1350 card. |
| Sell | Hero, valuation form (TextField, SelectField), SalesLedger, ProcessSteps, ReferenceReceipt | The valuation request returns a reference number. |
| Business · index and detail | ListingCard (business mode), StatusStamp, ConfidentialPanel-style "Name withheld" treatment | A business can be listed without its name: "Established diner, Swatara Township". |
| Areas · index and detail | AreaChip, area hero, StatTile figures, ListingCard grid, SalesLedger, services list (police, fire, school district), postal code chips | Areas: Harrisburg (West Downtown, East Downtown, North Residential), Swatara Township (Springfield), Susquehanna Township (Fairview). Areas come from the database too. |
| Sold archive · market report | SalesLedger (full), FilterChip, charts | Each row: sale number, date, address, area, price, agent, brochure thumbnail. |
| Agents · index and profile | AgentCard, ListingCard grid, SalesLedger (agent's sales) | Profile shows Chirper handle as text. |
| About | Editorial layout, Logo, CivOps registration line | Brand story in `body-l`, capped at `text-max`. |
| Guides and news | Article layout, label eyebrows | Buyer, seller and renter guides; brokerage announcements. |
| Careers | Role list, application form, ReferenceReceipt | |
| Contact | Form, ReferenceReceipt, office details as selectable text | |
| Search results, 404, legal | EmptyState, body layout | |

## Client account (Paper theme)

| Template | Built from |
| --- | --- |
| Sign in / sign up | TextField, Button, Logo |
| Dashboard | Journey timeline (Draft → … → Settled), saved homes rail, upcoming showings, messages |
| Saved homes and searches | ListingCard (list), FilterChip, alert toggles |
| My showings | Showing cards with StatusPill, reschedule and cancel actions |
| My deal | Timeline, document list (DocumentHeader thumbnails), message thread, "Only you can see this" label |
| Profile and notifications | TextField, toggles |

## Employee portal (Portal theme: `data-theme="dark"`)

| Template | Built from |
| --- | --- |
| Sign in | Logo, TextField, Button |
| Dashboard | PortalSidebar, StatTile row, PipelineCard summary, activity log, upcoming showings |
| Listings manager | Data table with StatusPill, bulk actions, filters |
| Listing editor | TextField, SelectField, photo uploader with reordering, StatusStamp preview, publish controls |
| Clients index and client file | Data sheet in form-label/form-value pairs, ConfidentialPanel for bottom line and negotiation notes, linked listings and documents |
| Deal pipeline | PipelineCard in columns: Active, Under Offer, Under Contract, Settlement, Closed |
| Showings calendar | Calendar grid, showing cards |
| Documents workspace | DocumentHeader, TextField in paper style, SignatureLine, "Fill from client file" picker, "Save as image" |
| Marketing studio | Brochure editor beside a live 1080×1350 preview; Chirper post composer |
| Commission ledger | SalesLedger in portal theme, StatTile totals |
| Team, roles and permissions | AgentCard, role pills, permission matrix |
| Activity log | Dense ledger of who changed what and when |
| Support inbox | Ticket list, message thread, StatusPill |
| Settings | Forms |

## Outputs

| Output | Spec |
| --- | --- |
| Property brochure | 1080×1350. Green header band with lockup, 21:9-to-4:5 photo with brass ribbon stamp, address in `display-m`, StatRow, price in mono, agent footer on `surface-sunken` with a brass top rule. |
| Square post | 1080×1080, same parts, photo above, facts below. |
| Banner | 1500×500, green ground, lockup left, ledger figures right. |
| Business card | 1050×600 at 300dpi. Front: green ground, mark, wordmark, "Buy • Sell • Rent". Back: paper ground, name in `display`, title in `label` brass, Chirper handle in mono. |
| Printed documents | Letter width (860px on screen), DocumentHeader band, sections with dark `label` bars, paper-form fields, signatures in `signature`, footer with form number in `id`. |

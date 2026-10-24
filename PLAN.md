# Johnson's Realty — build plan

Status: **approved Oct 23, 2026.** All §9 questions answered with the defaults (see §9). The brief now lives at `docs/CLAUDE_CODE_PROMPT.md`.

**Additions from the go-ahead:**
- **Deploy to Vercel at the end of Phase 2** so the core flow can be tested live; the README's Neon, Discord and Cloudinary setup steps must be in place by then.
- **Per-event Discord webhooks** replace the single review webhook (see §2 Notifications). Each is optional and skipped when its env var is unset.
- The co-owner gets the **Admin** role, and **"Admins can approve" is on** (the settings seed defaults it to true). Phase 2 therefore includes a minimal Team page where the Owner can promote an existing user to Admin; invites and the full team screen stay in Phase 5.

Inputs read: `CLAUDE_CODE_PROMPT.md`, `design-system/README.md`, `surfaces.md`, `tokens.css` / `tokens.json`, `components/bundle.js`, `bundle.css`, `index.d.ts`, all 26 component READMEs, asset READMEs, `reference/seller-files.md`, and the structure, field keys, area picker and seller-fill logic of `reference/forms-pa.html` and `reference/brochure-maker.html`.

---

## 1. Repository layout

The starter currently sits at `johnsons-realty-starter/johnsons-realty-starter/`. **[Q1]** I propose moving `design-system/` and `reference/` to the repo root (paths then match the brief) and putting the Next.js app at the root:

```
/                         Next.js app (package.json, next.config.ts, drizzle.config.ts)
design-system/            untouched source of truth (read-only reference)
reference/                untouched legacy tools (read-only reference)
drizzle/                  generated SQL migrations (checked in)
src/
  app/
    (public)/             Paper theme: home, buy, rent, property/[slug], businesses, areas, sold, agents, sell, about, guides, careers, contact, legal
    account/              Paper theme, signed-in client area
    portal/               data-theme="dark", staff only
    styleguide/           all components in both themes (dev + staff only in prod)
    api/                  auth route, Cloudinary sign endpoint, OG images
  components/ui/          typed ports of the 26 DS components + new primitives
  components/<feature>/   composed feature components (listing-form, gallery, documents, studio…)
  db/                     schema/*.ts, client.ts, seed-areas.ts, seed-dev.ts
  lib/                    permissions, listing-status, refs, format, storage, notify, audit, search-params
  server/                 queries/*.ts (read, permission-aware) and actions/*.ts (mutations)
  forms/                  the 8 document schemas + layouts + fill mappers
  styles/                 tokens.css, bundle.css (faithful copies), app.css (new primitives, print)
tests/                    vitest unit tests; e2e/ Playwright
```

## 2. Stack details

| Concern | Choice | Notes |
| --- | --- | --- |
| Framework | Next.js, latest stable at setup, App Router, TypeScript strict | RSC + server actions by default; client components only for interactivity. npm. |
| DB | Neon Postgres, Drizzle ORM + drizzle-kit | `drizzle-orm/neon-serverless` (WebSocket Pool) so we get real transactions — needed for reference numbers, approvals and sale numbers. Migrations generated and committed. |
| Auth | Auth.js v5, Discord provider, Drizzle adapter, **database sessions** | Profile extends `users`. `signIn` event: if `discordId === OWNER_DISCORD_ID` and no Owner exists → role `owner`. |
| Images | Cloudinary signed uploads via `lib/storage` interface (`signUpload`, `url`, `delete`) | Client uploads directly with a server-issued signature; incoming transformation limits long edge to 2000px; delivery `f_auto,q_auto`; `next/image` custom loader. A `local` driver exists for tests/e2e. |
| Validation | Zod schemas in `src/lib/schemas/*`, shared by forms and actions | Error copy in house style. |
| Export | `html-to-image` (PNG at exact pixel size, fonts embedded) | Print stylesheet for documents → PDF. |
| Notifications | `notifications` table + bell (unread count, refreshed on navigation and every 60s) | Per-event Discord webhooks (below). |
| Discord webhooks | `lib/discord.ts`: one env var per event, each optional | Events → env vars: review pending `DISCORD_WEBHOOK_REVIEW_PENDING`, new sale listing `DISCORD_WEBHOOK_NEW_LISTING`, new rental `DISCORD_WEBHOOK_NEW_RENTAL`, new business listing `DISCORD_WEBHOOK_NEW_BUSINESS`, sale recorded `DISCORD_WEBHOOK_SALE_RECORDED`, deal stage change `DISCORD_WEBHOOK_DEAL_STAGE`, career application `DISCORD_WEBHOOK_CAREER_APPLICATION`. Posts are rich embeds (cover photo, address, area, price, key facts, agent, brand colour) plus a "View on website" link button (`?with_components=true`; if Discord refuses components, it retries with the embed title as the link). Sent after the transaction commits; failures are logged, never block the action. |
| Fonts | `next/font/google`: Manrope, IBM Plex Sans, IBM Plex Mono, Mrs Saint Delafield | Exposed as the `--font-*` variables that `tokens.css` already uses. |
| Tests | Vitest (unit), Playwright (e2e) | See §8. |

## 3. Design system port

- Copy `tokens.css` and `bundle.css` into `src/styles/` verbatim (fonts swapped to the `next/font` variables). Not loading `bundle.js`.
- Port each of the 26 components to `src/components/ui/<Name>.tsx` with the **same names and props as `index.d.ts`**, same class names, same markup/ARIA as `bundle.js`. `STATUS` map and `Icon.names` exported from `ui/status.ts` / `ui/Icon.tsx`.
- Small, compatible additions (props only added, never changed): `ListingCard` gets `ownerListed?: boolean` (renders the "Listed by Owner" pill beside the ribbon) and accepts a `photo` render slot so it can use `next/image` instead of a background image (no layout shift, lazy loading). `Button` renders `next/link` for internal `href`s.
- New primitives, composed from tokens only, in the same style: `DataTable` (collapses to stacked cards under 640px), `Modal`, `Drawer` (bottom sheet on mobile), `Tabs`, `Toggle`, `Checkbox/RadioGroup`, `FeatureChips`, `Calendar` (week grid), `Uploader` (drag/drop, progress, drag reorder, cover pick, alt/caption), `NotificationBell`, `Skeleton`, `Pagination`, `Breadcrumbs`, `Timeline` (journey/lifecycle), `ToastProvider`, `Gallery` + `Lightbox` (swipe, keyboard), `DiffView` (review rounds), `MapPin` (image + %-positioned pins), `Redacted`, `VisibilityLabel` ("Only you can see this"), `Chart` (simple SVG bar/line from data; no chart lib).
- `/styleguide` renders every component and primitive in Paper and Portal themes.
- Lint guard: a stylelint/ESLint rule (or a small test) that fails on raw hex colours, `px` font sizes and spacing literals outside `src/styles/tokens.css`.

## 4. Data model (Drizzle / Postgres)

Principles:
- **Confidential data lives in separate tables** (`*_confidential`). Queries for viewers without access simply never join them, so the value is never sent; the UI renders `ConfidentialPanel redacted`.
- **Statuses are Postgres enums**; display-only badges (Just Listed, Price Reduced) are **derived**, not stored.
- All tables have `id` (uuid), `created_at`, `updated_at`. Money is `integer` dollars (no cents on listings; documents may show cents from the same integer).

### Identity and staff
- `users` — Auth.js fields + `discord_id` (unique), `display_name`, `avatar_url`, `roblox_username`, `chirper_handle`, `role` enum (`owner`, `admin`, `agent`, `client`), `status` (`active`, `deactivated`), `onboarded_at`, notification prefs (jsonb).
- `accounts`, `sessions`, `verification_tokens` — Auth.js adapter tables.
- `agent_profiles` — `user_id`, `slug`, `title`, `bio`, `photo_id` → `media`, `contact_line`, `active`, `display_order`, `wide_confidential_access` (bool; default off).
- `staff_invites` — token hash, role, created_by, expires_at, used_by, used_at.

### Content and settings
- `site_settings` (single row) — name lines, office location text, Chirper handle, Discord invite, CivOps line, footer text, hero media (photo or video), map image + dimensions, `admins_can_approve`, `live_edits_need_review`.
- `areas` — `name`, `slug`, `parent_id` (self), `city` (e.g. "Harrisburg"), `postal_codes` text[], `description`, `hero_id`, `police`, `fire`, `school_district`, `display_order`. Migration-safe seed inserts only the five areas + parents (Harrisburg, Swatara Township, Susquehanna Township) with postal codes and services from the seller-files table, `ON CONFLICT DO NOTHING`, then the Owner edits them.
- `posts` (guides and news: kind, title, slug, excerpt, body (markdown), hero, author, published_at), `careers` (title, slug, summary, body, open flag, order).
- `media` — `storage_id`, `width`, `height`, `bytes`, `format`, `uploaded_by`. Referenced by listing photos, agent photos, area heroes, posts.

### Clients (from `seller-files.md`)
A client file is a **party** (person, couple, company, estate) with one or more **people**:
- `clients` — `kind` (`person`, `couple`, `company`, `estate`), `display_name` ("Priya and Daniel Raman"), `legal_name_on_forms` ("Hayes Property Holdings LLC", "Margaret Brennan-Cole, Executor of…"), `roles` set (`buyer`, `seller`, `landlord`, `tenant`, `business_owner`), `user_id` (nullable link to an account), `agent_id` (responsible agent), `source` (how they found us), `best_contact` (how/when), `occupying` text, `mailing_address_after`, `reason`, `timeline`, `notes`.
- `client_people` — `client_id`, `legal_name`, `goes_by`, `age_occupation`, `marital_status`, `signs` (bool), `role_label` ("Executor", "Managing member", "Advises, does not sign"), `discord`, `roblox_username`, `chirper`, `order`.
- `client_confidential` — `client_id`, `motivation`, `negotiation_notes`, `relay_lines`, `commission_terms`.

### Listings
- `listings` — `type` (`house`, `apartment`, `business`, `land`, `rental`), `purpose` (`sale`, `rent`), `source` (`agent`, `owner_submitted`), `status` (enum below), `ref_no` (JR-YYYY-NNNNN), `slug`, `address_line`, `unit`, `area_id`, `postal_code`, `parcel_id`, `county` (default Dauphin), `price`, `previous_price`, `beds`, `baths`, `sqft`, `lot` (text, e.g. "0.22 acres"), `year_built`, `garage`, `description`, `showing_instructions`, `listing_agent_id`, `seller_client_id`, `submitted_by_user_id`, `map_x`, `map_y` (nullable %, manual only), `published_at`, `withdrawn_at`, `round` (current review round).
- `features` (key, label, icon, order — data, Owner-editable) and `listing_features` (listing, feature).
- `listing_photos` — `listing_id`, `media_id`, `alt`, `caption`, `sort`, `is_cover`.
- `listing_property_details` (1:1, homes) — property style, other rooms, basement, heating, cooling, water heater, water/sewer, electrical, roof, windows, taxes, HOA, utilities, legal description, zoning, parking text, occupancy.
- `listing_ownership` (1:1) — vesting (how title is held), bought date + price, deed reference, mortgage holder, liens. **Ownership is per property**, since one client can own several.
- `listing_terms` (1:1) — agreement start/end, earnest money expected, target settlement, possession, included, excluded, leased items, transfer tax split, title company, attorney, home warranty, financing accepted, offer reply time, as-is flag, yard sign / photos / lockbox flags.
- `listing_lease_terms` (1:1, rentals) — rent due day, late fee, deposit, due at signing, lease length, available from, renewal, utilities split, yard/snow, max occupants, pets, smoking, subletting, insurance, applicant requirements (income multiple, checks, references, fee, decision time).
- `listing_business` (1:1, businesses) — business name, `name_withheld`, public teaser ("Established diner, Swatara Township"), entity, signer capacity, type, opened year, employees, hours, seats, what's sold (business only / with building), building size, premises rent/lease end/landlord, yearly sales, yearly profit, inventory, owner financing, price split (building/equipment/inventory/goodwill), licences, training, non-compete, staff terms, confidentiality flag. Financials marked public/confidential per field (sales and profit are confidential by default; "trading history" summary is the public field).
- `listing_disclosures` — `listing_id`, `item` (enum of the 20 SPDS items: roof … flooding), `answer` (`yes`, `no`, `unknown`, `na`), `detail`. Feeds Form JR-PA-060 directly.
- `listing_confidential` (1:1) — bottom line price, negotiation rules, relay lines, commission terms.
- `listing_reviews` — `listing_id`, `round`, `submitted_by`, `submitted_at`, `snapshot` (jsonb of the submission for diffing), `decision` (`approved`, `changes_requested`, `rejected`, null while pending), `reviewer_id`, `notes`, `decided_at`.
- `listing_revisions` **[Q2]** — pending edits to a *live* listing when "live edits need review" is on: the listing stays public unchanged while the revision is reviewed; approval applies it.
- `price_history` — listing, price, date, event (`listed`, `reduced`, `increased`, `sold`, `leased`).

**Listing status enum and state machine** (`lib/listing-status.ts`, unit-tested):
```
draft → pending_review
pending_review → active | for_lease | changes_requested | rejected      (Owner / approving Admin only)
changes_requested → pending_review (resubmit = new round) | withdrawn
active → under_offer | off_market | withdrawn | coming_soon?
for_lease → leased | off_market | withdrawn
under_offer → under_contract | active
under_contract → sold | active
sold | leased | withdrawn | rejected | off_market → archived
off_market → active (re-list, no re-review)
```
`coming_soon` is accepted as a status the Owner can set on approval (pre-launch). Derived badges: **Just Listed** = active and `published_at` within 14 days; **Price Reduced** = `previous_price > price` and the last price event was a reduction. Public queries only return `active, for_lease, coming_soon, under_offer, under_contract, sold, leased`.

### Deals, showings, sales
- `deals` — `listing_id`, `agent_id`, `stage` (`active`, `under_offer`, `under_contract`, `settlement`, `closed`, plus `fallen_through`), key dates (offer, acceptance, inspection, financing, settlement), `shared_with_client` flag.
- `deal_parties` — deal, client, side (`buyer`, `seller`, `tenant`, `landlord`).
- `deal_confidential` — offer amounts (jsonb list of offers/counters), notes.
- Stage changes drive listing status: under_offer → `under_offer`, under_contract/settlement → `under_contract`, closed → `sold`/`leased` (via recording a sale).
- `showings` — listing, client (nullable), requested_by_user, agent, `ref_no`, requested_at, confirmed_at, status (`requested`, `confirmed`, `completed`, `cancelled`, `no_show`), notes.
- `sales` — `sale_no` (global sequence, "Sale No. 001"), listing, deal, buyer client, seller client, price, sale date, settlement date. `sale_agents` (sale, agent, side). `sale_commissions` (confidential: sale, agent, rate, amount, split).
- `messages` — deal thread: deal, author, body, created_at, read state per participant.

### Documents
- `documents` — `form_type` (8 enum values), `form_no` (e.g. "JR-PA-100"), `doc_no` (per form type per year, e.g. Agreement No.), `data` jsonb (validated by that form's Zod schema), `listing_id`, `deal_id`, `status` (`draft`, `sent`, `signed`), `shared_with_client`, `created_by`.
- `document_clients` (document, client, role) and `document_signatures` (document, party role, typed name, signed_on).

Form numbers come from the current tool: JR-PA-050 Exclusive Right to Sell, JR-PA-060 Seller's Property Disclosure, JR-PA-100 Residential Agreement of Sale, JR-PA-110 Change to Agreement of Sale, JR-PA-200 Business Listing Contract, JR-PA-210 Earnest Money Receipt, JR-PA-220 Business Sale Agreement, JR-PA-400 Settlement & Key Handover.

### Engagement and ops
- `enquiries` — `type` (`showing_request`, `valuation_request`, `general_contact`, `career_application`, `listing_question`), `ref_no`, payload jsonb (per-type Zod), `listing_id`, `user_id`, `status` (`new`, `open`, `waiting`, `closed`), `assignee_id`. `enquiry_replies` for the support thread.
- `saved_homes` (user, listing), `saved_searches` (user, name, `params` jsonb — the same object the Buy/Rent URL parses to, `alerts` bool).
- `notifications` — user, kind, title, body, link, read_at.
- `activity_log` — actor, action, entity, entity_id, summary, diff jsonb, created_at.
- `ref_counters` — (`kind`, `year`) primary key, `last` integer. `nextRef(tx, kind)` does `INSERT … ON CONFLICT DO UPDATE SET last = last + 1 RETURNING last` inside the caller's transaction → gap-tolerant, race-free. Kinds: `ref` (JR-YYYY-NNNNN, shared by listings, showings, enquiries), `sale` (no year reset), one per form type.

## 5. Server architecture

- **Permissions** — `lib/permissions.ts`: pure `can(actor, action, subject?)` covering every action in the role table (incl. `listing.approve` honouring `admins_can_approve`, `client.viewConfidential` = Owner/Admin, own agent, or `wide_confidential_access`). Every server action and query starts with `requireUser()` / `assert(can(...))`. Unit tests enumerate the matrix.
- **Queries** (`server/queries`) take the actor and return DTOs shaped for the page; confidential joins are conditional on `can(...)` and redacted DTOs carry `{ redacted: true }` instead of values.
- **Actions** (`server/actions`) — Zod-parse → authorize → transaction → `audit()` (writes `activity_log`) → `notify()` → `revalidatePath`/`revalidateTag`. Return `{ ok, data } | { ok: false, fieldErrors }` for form wiring with `useActionState`.
- **Review flow** — `submitListing` (≥3 photos enforced server-side, validates completeness checklist, snapshots into `listing_reviews`, notifies Owner + approving Admins, webhook ping); `decideReview` (approve → status, `published_at`, price history "listed", notify submitter, evaluate saved-search alerts; changes/reject require notes). Resubmission increments `round`; the review page diffs `snapshot[round]` vs `snapshot[round-1]`.
- **Seller file** — a server-rendered portal page assembled from `clients`, `client_people`, `listing_*` tables and confidential tables (if allowed). Not stored. Print stylesheet.
- **Fill from client file** — each form module exports `fill(ctx: { client, people, listing, details, terms, disclosures, business, deal, agent, settings })` returning a partial of its schema; the UI merges it into the draft (only empty fields unless "Overwrite" is chosen), mirroring the seller picker in `forms-pa.html`. Quick area picker fills city + postal code from `areas`.
- **Caching** — public pages are server-rendered with tag-based revalidation (`listings`, `areas`, `sales`, `agents`, `settings`) triggered by actions; no stale data after approval.
- **Search** — Buy/Rent parse `searchParams` with one Zod schema (area, type, min/max price, beds, baths, features[], owner listings include/exclude/only, sort, view, page) → SQL. The same object is stored in saved searches.

## 6. Routes (summary)

**Public:** `/`, `/buy`, `/rent`, `/property/[slug]`, `/businesses`, `/businesses/[slug]`, `/sell`, `/areas`, `/areas/[slug]`, `/sold`, `/agents`, `/agents/[slug]`, `/about`, `/guides`, `/guides/[slug]`, `/careers`, `/careers/[slug]`, `/contact`, `/privacy`, `/terms`, `not-found`. Each with `loading.tsx` skeletons, `generateMetadata`, OG image (`opengraph-image.tsx` uses the cover photo), sitemap and robots.

**Account:** `/account` (dashboard + journey timeline), `/account/welcome` (first-run profile), `/account/saved`, `/account/searches`, `/account/showings`, `/account/deal/[id]`, `/account/listings`, `/account/listings/new`, `/account/listings/[id]`, `/account/profile`, `/signin`.

**Portal:** `/portal`, `/portal/review`, `/portal/review/[id]`, `/portal/listings`, `/portal/listings/new`, `/portal/listings/[id]`, `/portal/clients`, `/portal/clients/[id]`, `/portal/clients/[id]/seller-file`, `/portal/deals`, `/portal/showings`, `/portal/documents`, `/portal/documents/[id]`, `/portal/studio`, `/portal/sales`, `/portal/commission`, `/portal/team`, `/portal/areas`, `/portal/content/{guides,careers}`, `/portal/settings`, `/portal/activity`, `/portal/inbox`, `/invite/[token]`.

Middleware only does coarse routing (signed-in check for `/account` and `/portal`); real authorization stays in server code.

## 7. Feature notes and interpretations

- **Owner vs property owner** — role `owner`; listing source `owner_submitted`, UI label "Listed by Owner". Never mixed in code names.
- **Client submissions** create (or reuse) the user's own client file, with `roles` including `seller`/`landlord`, filled from the account and the contact fields they enter. **[Q5]** whether the Owner may assign an agent to an owner-submitted listing on approval.
- **"Listed by Owner" contact block** **[Q6]** — I propose the property owner chooses which of their handles (Discord / Roblox / Chirper) show publicly; "Book a showing" and questions still create enquiries routed to the property owner in-app (and to the Owner for oversight).
- **Map** — the surfaces table mentions a "split map view with status pins" on Buy. Under the brief's rule (no ER:LC map modelling), I'll build that view only on the Owner-uploaded map image, showing pins only for listings with a manually placed pin, and hide the view when no map image is set. **[Q4]**
- **Home ledger figures** hidden when zero; agent stats show only figures the database has.
- **Business "name withheld"** — public pages show the teaser line and a ConfidentialPanel-style "Name withheld" treatment; the name is not sent to the client.
- **Marketing studio** — brochure (1080×1350), square (1080×1080), banner (1500×500) as React templates fed from listing data with editable overrides like the current maker (status banner, date, area line, 4 stats, one-line description, price + "show price" toggle, "Represented": sellers/buyer/both/landlord/owner, up to 3 photos picked from the listing). Chirper composer: template strings from real fields, copy button. Business card (1050×600) is in `surfaces.md` but not in the brief — I'll add it to the studio as a low-cost extra unless you say otherwise. **[Q7]**
- **Documents** — each form = Zod schema + section layout (numbered dark label bars, paper fields, SignatureLine) + `fill()` mapper, rendered at 860px letter width; "Save as image" exports PNG, print stylesheet for PDF, shareable to the client's account.
- **Dev seed** — `npm run seed:dev` refuses to run when `NODE_ENV=production` or `VERCEL_ENV=production`; every record is named "Example …".

## 8. Testing

- **Unit (Vitest):** permissions matrix; listing status transitions (every allowed and a sample of forbidden); `nextRef` concurrency (against a Neon branch or local Postgres in CI); reference/sale/doc number formatting; every form schema (valid sample, error copy) and every `fill()` mapper; search-param schema round-trip.
- **E2E (Playwright):** agent submits a listing with 3 photos → Owner approves → listing visible on `/buy` and its property page → seller file renders → a JR-PA-100 document fills from the client file. **[Q3]** Discord OAuth can't run in CI, so I propose an auth bypass that exists only when `E2E_TEST_AUTH=1` and `NODE_ENV !== 'production'` (a Credentials provider that signs in as seeded test users), plus the `local` storage driver instead of Cloudinary.
- Lighthouse CI on home, buy and a property page (target 90+); axe checks in Playwright on key pages.

## 9. Open questions — answered: all defaults approved (Oct 23, 2026)

1. **Layout:** move `design-system/` and `reference/` to the repo root and build the app at the root? (Default: yes.)
2. **Live listing edits under review:** add `listing_revisions` so a live listing stays public unchanged while an edit is reviewed? (Default: yes; the alternative is pulling the listing back to Pending Review, which hides it.)
3. **E2E auth:** OK to add a test-only Credentials sign-in, gated by env and impossible in production? (Default: yes.)
4. **Map view on Buy:** only the manual-pin map image, hidden when unset? (Default: yes.)
5. **Owner-submitted listings:** may the Owner assign a brokerage agent on approval (agent card shown alongside "Listed by Owner")? (Default: optional, off.)
6. **Property owner contact:** they choose which handles show publicly; enquiries route to them in-app? (Default: yes.)
7. **Business card output** (in `surfaces.md`, not the brief): include in the studio? (Default: yes, small.)
8. Data-model additions beyond the brief's starting point, for your approval: `client_people`, the split `listing_*` detail tables, the `*_confidential` tables, `features` as data, `deal_parties`, `sale_agents`/`sale_commissions`, `enquiry_replies`, `ref_counters`, `staff_invites`, `media`, and `fallen_through` as an extra deal stage.

## 10. Progress

### Phase 1 — Foundation: done (Oct 23, 2026)

- Next.js 16.4 (App Router, Turbopack), React 19.3, TypeScript 5.9 strict, ESLint, Vitest 4. Vitest 5 needs Node 22, and this machine runs Node 20.
- Design system: `tokens.css` and `bundle.css` copied faithfully. `type-tokens.css` is generated from `tokens.json` (`scripts/build-type-tokens.mjs`) so app CSS uses `var(--type-*)` and never literal font sizes. All 26 components ported with the `index.d.ts` props, plus additions that keep compatibility: ListingCard `ownerListed`/`priority`/`saveSlot` and next/image, SalesLedger row `href`, NavBar `actions`/`menuOpen`, SearchBar `action`.
- Primitives added: DataTable (stacked cards on mobile), Modal, Drawer (bottom sheet on mobile), Tabs, Toggle, Checkbox, RadioGroup, FeatureChips, Skeleton/CardSkeletonGrid, Pagination, Breadcrumbs, Timeline, VisibilityLabel, ClientPanel, DataSheet, ToastProvider, NotificationBell, WeekCalendar. These land with their features: Uploader and Gallery/Lightbox/DiffView in Phase 2, Chart in Phase 3, MapPin in Phase 7.
- `/styleguide` shows every component in both themes; in production only staff can open it.
- A test fails the build on raw hex colours, literal font sizes or literal spacing in app code.
- Schema: all tables in §4 plus `message_reads`. First migration is `drizzle/0000_init.sql`. The base seed has area names and hierarchy only (no postal codes or services, per the brief), the 5 features, and the settings row with "Admins can approve" on.
- Database driver: Neon over WebSockets (transactions). `pglite:<dir>` runs an embedded Postgres for local development and tests.
- Auth: Auth.js v5, Discord, database sessions, Owner promoted from `OWNER_DISCORD_ID`, deactivated users blocked, first-run profile (Roblox username, Chirper handle).
- **Test sign-in (Q3), implementation note:** Auth.js Credentials only works with JWT sessions, and we use database sessions. So the test sign-in is a route (`/api/test-auth`) that creates a database session for a seeded user. It works only when `E2E_TEST_AUTH=1`, the app is not on Vercel, and the database is `pglite:`. It is unit-tested.
- `lib/permissions.ts` (`can`), `lib/listing-status.ts` (state machine and derived badges), `lib/refs.ts` (atomic counters), `lib/discord.ts` (per-event webhooks), `server/audit.ts`, `server/notify.ts`.
- Shells: public (header with mobile menu, footer from settings), account (side nav), portal (dark theme, sidebar with live counts, bell). `proxy.ts` redirects signed-out visitors away from `/account` and `/portal`.
- Tests: 60 unit tests passing (permissions matrix, status machine, counters on real Postgres, seeds, webhooks, test-auth gate, token guard).
- `bundle.css` fix: its rule that hides ghost buttons under 900px also hid the mobile menu button. It's overridden in `app.css`.

### Phase 2 — Listings core: built (Oct 23, 2026), deploy waiting on account setup

- **Service layer** (`server/listings/service.ts`) holds every listing mutation, with no Next.js imports. That makes the whole flow testable against real Postgres (`tests/unit/review-flow.test.ts`). Server actions in `server/actions/listings.ts` wrap it and add the webhooks and revalidation.
- **Wizard** (`components/listing-editor`): five steps for agents (Property, Price and terms, Photos, Seller, Review and submit) and five for property owners (Property, Price, Photos, Your details, Review). Each step autosaves 2.5s after the last change and saves again on Back, Next or a step link. Saves are validated by Zod with house-style error copy, and a step won't advance while its fields have errors. The review step shows the live listing card, the property page preview, and the checklist with a link to each missing item. Submitting is blocked below 3 photos ("Add at least 3 photos. You have 2.").
- **Wizard edit window:** the wizard edits only Draft, Changes Requested and Withdrawn listings (Pending Review for the Owner and Admins only). Live listings will be edited in the Phase 5 listings manager, where price history and the "live edits need review" revisions apply.
- **Uploader**: drag and drop or file picker, per-file progress, reorder by dragging (with Earlier/Later buttons for keyboard users), cover choice, a description per photo (required) and an optional caption. Cloudinary signed uploads, with an incoming transformation that caps the long edge at 2000px. Uploads are verified server-side from Cloudinary's response signature. The local driver serves files from `.e2e-data/uploads` in development and tests.
- **Seller step**: pick an existing client file or create one inline: people (co-owners, signers, advisers), contact and situation, ownership and money, the 20 disclosure items, and a confidential panel (bottom line, negotiation rules, relay lines, commission, motivation, business financials). Confidential fields are only written by someone who can see them, so a blank form never wipes them.
- **Review queue**: listed oldest first with the submission round, plus sidebar count and bell. The review page shows the submission (photos, full seller sheet with confidential panels) beside the public preview, the diff against the previous round, and the review history. Approve has an optional Coming Soon toggle and, for owner listings, an optional agent assignment. Request changes and Reject require a note. Approval sets the status (Active or For Lease), `published_at`, the slug, a "Listed" price history row and notifications, and posts to the matching Discord webhook (new listing, rental or business). Submission posts to the review-pending webhook.
- **Public property page** `/property/[slug]`: swipeable 3:2 gallery with thumbnails and a full-screen viewer, status stamp, Listed by Owner pill, address, price, StatRow, description, features, key facts, price history ledger, area facts, agent card or owner contact block (showing only the handles the owner chose), similar listings, save and share. It has Open Graph metadata from the cover photo. **Book a showing** works now (signed in; returns a JR reference and notifies the agent). The full showings tools come in Phase 4.
- **Client account**: List your property, My listings (status, reviewer notes, timeline), edit when changes are requested, withdraw.
- **Admin**: Areas (list and edit: postal codes, services, parent, order, selectable), Site settings (brokerage lines, home copy, review rules), and Team (staff list, search people who have signed in, change role with confirmation, deactivate and reactivate, agent profile editing). Only the Owner grants Admin. The Owner's agent profile is created on promotion.
- **Home page**: a real "Newest listings" rail, so approved listings can be found during live testing. The full home page comes in Phase 3.
- **Database client fix**: the raw connection is cached on `globalThis` and the drizzle wrapper is rebuilt per module load. Before this, hot reloads in dev kept stale schema objects and relational queries failed.
- `npm run seed:dev` now adds one live and one pending Example listing.
- Tests: 87 unit and database tests, plus Playwright end-to-end tests for both submission flows (`tests/e2e/listing-flow.spec.ts`).
- Agent photo uploads (agent profile), area hero images, and the site hero and map images are not built yet. They land with the public pages in Phase 3 and the map pin in Phase 7.

Phase 1 and Phase 2 are pushed to GitHub, and `main` is at Phase 2. The Vercel deploy is on hold until the Neon, Discord and Cloudinary accounts are set up (user's call, Oct 24).

### Phase 3 — Public site: built (Oct 24, 2026)

- **Search** (`lib/search.ts`, `server/queries/cards.ts`, `components/search`): Buy, Rent and Businesses share one filter schema that lives in the URL. Filters: area (a town includes its neighbourhoods), type, price range, beds, baths, features, and owner listings (include, leave out, only). Sort, grid/list view and pagination are in the URL too. Parsing is lenient: bad values are dropped. The filter form is a plain GET form, so it works without JavaScript, and below 900px it becomes a bottom sheet. Each page has an empty state and loading skeletons. A lightweight card query feeds every grid and never exposes a withheld business name.
- **Home**: 21:9 hero photo or muted looping video from site settings, with a green scrim on the text side. SearchBar. Ledger figures (homes sold, total volume, on the market) count up once and are hidden when zero. Newest listings (featured first), the areas grid with counts, the latest 5 sales, process steps, an agents row and the list-your-property CTA.
- **Areas** index and detail: hero photo, postal codes, figures (on the market, recent sales, average sale price), description, neighbourhoods, listings, recent sales and services.
- **Agents** index and profile: photo, title, Chirper handle, contact line, figures from the database, listings and sales.
- **Sold**: the full ledger with filters (area, agent, year, sales or leases), totals, and two charts (volume by month, sales by area). The charts are a new `BarChart` primitive: single brand hue, rounded data ends, hover and focus tooltip, peak label, and a table view.
- **Sell** (valuation request), **Contact** (general or about a listing; property pages link to it), **Careers** (index, detail, application) and **About** (Markdown from settings, the team). **Guides and news** (index and article), **Privacy** and **Terms** (roleplay boilerplate), and 404. Every enquiry returns a JR reference and notifies the Owner and Admins (and the listing agent for listing questions). Career applications also post to `DISCORD_WEBHOOK_CAREER_APPLICATION`. Forms need sign-in, as the brief says.
- **Content manager** (`/portal/content`): guides, news and careers, with Markdown bodies and header photos. This was listed under Phase 5; it moved here because the public pages need it.
- **Image uploads** (`ImageField`, `server/actions/images.ts`): home hero and map image (Site settings), area photos (Areas) and agent photos (Team profile). Replacing or removing an image cleans up the old file.
- `Markdown` is a small renderer that never injects HTML: headings, lists, bold, italic and safe links.
- SEO: metadata and canonical URLs on every page, Open Graph images on listings, `sitemap.xml` and `robots.txt` (portal, account and API disallowed).
- Fixes: the footer grid overflowed on phones, and the e2e command now clears its own data cache (stale area IDs had survived database wipes).
- Added later: the Buy map view (Phase 7) and brochure thumbnails in the sold ledger. Each Sold row has a miniature of the brochure (band, cover photo, Sold or Leased ribbon, price) linking to the listing, where the full PNG downloads. The listing question routes into the Phase 5 support inbox.
- Tests: 97 unit tests, plus end-to-end tests for every public page (200 status, heading, no sideways scroll at 375px), URL filters, a valuation request, and content publishing with a career application.

Phase 3 is pushed and merged into `main` (`7150ebd`).

### Phase 4 — Client accounts: built (Oct 24, 2026)

- **Saved homes**: a heart on every listing card that's on the market. It's optimistic, and signed-out visitors go to sign-in and come back. The Saved homes page keeps the order homes were saved in and notes any that are no longer listed.
- **Saved searches**: "Save this search" on Buy, Rent and Businesses stores the scope and the criteria (`lib/saved-search.ts`) under a plain-words name ("Homes for sale in Fairview · 4+ beds"). Each has an alerts toggle and delete, with up to 25 per account. When a listing is approved, `alertSavedSearches` notifies every matching search inside the same transaction. A town matches its neighbourhoods; the user's own listing, accounts with alerts off, and searches with alerts off are skipped; one alert per person.
- **My showings**: upcoming and past lists with status pills (Requested, Confirmed, Completed, Cancelled, No show) and times in the viewer's local time (`LocalTime`). Reschedule (back to Requested) and cancel work while the showing is in the future, and both notify the agent, or the property owner for owner listings.
- **My deal**: the deals a client is party to (with "shared with client" on). Each shows the stage timeline, key dates, the agent card, the documents shared with them, the property, and a message thread with the agent. The thread refreshes every 30 seconds and Ctrl+Enter sends. Messages notify the other side; clients can turn this off, staff always hear. Offer amounts and unshared documents are never loaded for clients. Opening a deal marks it read, and the dashboard shows unread counts.
- **Dashboard**: the journey timeline (the deal's stages, or save → showing → offer → contract → keys), saved homes, upcoming showings and the client's own listings.
- **Profile**: notification settings for saved-search matches, showing updates and agent messages.
- **Notification bell for clients**: the public and account header now has the bell for anyone signed in. Before this, clients had no way to see their alerts; the e2e test caught it.
- Deals are created by staff in Phase 5. The message thread and deal query are already shared, so the portal deal page will reuse them.
- Tests: 107 unit tests (saved-search matching, showing rules, deal timeline, and approval alerts against Postgres). New end-to-end tests: save a home and a search, then get alerted on approval; book, reschedule and cancel a showing; a buyer follows their deal, messages the agent and the agent is notified, while another client gets 404; notification settings persist. The e2e seed now has a live listing with a deal and shared documents, a bookable listing, and a pending listing.

Phase 4 is pushed and merged into `main` (`69b95d4`). On Oct 24 the user asked me to carry on through Phases 5–8 while they were away. Each phase is committed on its own local branch; nothing after Phase 4 is pushed.

### Phase 5 — Portal operations: built (Oct 24, 2026)

- **Ops service layer** (`server/ops/*`), with no Next.js imports and integration-tested on Postgres (`tests/unit/ops.test.ts`):
  - **Listings**: manual status changes go through the state machine. Sales and leases close only from a deal; review decisions only from the queue. Bulk changes report per-listing failures. Price changes are immediate, set `previous_price` and add a reduced or increased row to price history. Material live edits (description, showing instructions, beds, baths, sq ft) apply straight away for managers. When "live edits need review" is on, an agent's edit becomes a pending `listing_revision`, the public listing stays unchanged, reviewers are notified, and it's approved or declined (with a note) from the review queue.
  - **Deals**: opening a deal from a listing adds the buyer or tenant and the seller's client file as parties, and adds the buyer or tenant role to the client. Dates, notes and the "shared with client" switch can be edited. Offers are confidential and kept in `deal_confidential`. Stage changes drive the listing status: Under Offer → Under Offer; Under Contract or Settlement → Under Contract; Active or Fell through → back on the market, unless another deal still holds the listing. Parties are notified, and the `deal_stage` webhook posts.
  - **Record a sale or lease**: takes the next Sale No. and records the sale agents and commission splits (confidential). It marks the listing Sold or Leased, adds a price-history row, closes the deal, marks other open deals on the listing as fallen through, notifies parties, and posts the `sale_recorded` webhook.
  - **Showings** (staff): confirm (optionally at a new time), mark done, no-show, cancel. Clients with showing updates on are notified.
  - **Support inbox**: status, assignment (with a notification) and replies. A reply reaches the sender as a notification; internal notes stay with staff.
  - **Staff invites**: single-use links (only the SHA-256 hash is stored) that expire after 1, 7 or 30 days. Admins can invite agents only, and only the Owner invites Admins. Accepting gives the role and an agent profile and never changes an Owner. Invites can be revoked.
  - **Client files**: create, edit, archive and restore. Agents own the files they open; managers can reassign. Confidential notes are only written by people who can see them.
- **Pages**:
  - **Listings manager**: search, status, source and agent filters; select-all and bulk actions; days on market.
  - **Listing page**: status, price, live edit, open a deal, its deals and showings, and a link to the seller file.
  - **Review queue**: now also lists edits to live listings, each with a diff to approve or decline.
  - **Clients**: index with search and archived toggle. The client file shows the data sheet, people, confidential panel (redacted without access), listings, deals, showings, documents and activity.
  - **Seller file**: printable, generated from the database. An at-a-glance row (seller, property, asking, lowest they'll take, timeline), then the full sheet. A print stylesheet gives the letter-size version.
  - **Deal pipeline**: five columns. Cards can be dragged (with a confirmation) or moved with a keyboard-friendly Move menu; dropping on Closed opens the sale form. Fell-through deals are listed separately.
  - **Deal page**: timeline, dates and sharing, confidential offers, record sale or lease with commission splits, the message thread (the Phase 4 one, reused) and documents.
  - **Showings**: week calendar and list, with previous/next week.
  - **Sales** ledger; **Commission** ledger (all splits for managers, an agent's own otherwise; totals by agent and month).
  - **Team** now has invites (create, copy, revoke) and `/invite/[token]`.
  - **Activity log**: search, record type, person and date filters, paginated.
  - **Support inbox**: open, mine, closed and all views; each enquiry shows its payload, assignment, status and conversation.
  - **Dashboard**: stat tiles, the review queue preview, pipeline counts, upcoming showings and recent activity. Agents get a "My profile" link in the sidebar.
- Fixes found by the tests:
  - A deal falling through could put the listing back on the market while another deal still held it.
  - Optional checkboxes left out of a form (unchecked toggles) failed Zod validation in four schemas. They now use the shared `bool` parser.

### Phase 6 — Documents: built (Oct 24, 2026)

- **Forms as data** (`src/forms/`): the eight forms from `reference/forms-pa.html` are typed `FormDef`s (`defs.ts`) with the same sections, fields, options, tables, notices and standard terms. Everything else is derived from them (`model.ts`):
  - the Zod schema for `documents.data`: selects only accept their options, and number and date fields are checked;
  - the editor, the printed copy, the PNG and the client's copy, all from one `DocSheet` component;
  - computed values, which match the old generator: price and deposit in words, balance due, commission amounts, price-to-profit, and the price split total.
- **Shared field ids** play the role the old `data-key` did. `seller_name`, `prop_address`, `price` and the rest mean the same on every form, so `fillFrom()` (`fill.ts`, pure and unit-tested) builds one map from the client files, listing, deal, agent and settings, and each form keeps its own keys. Disclosure answers fill the JR-PA-060 table from `listing_disclosures`. A business's price split fills from `listing_business`. Sales, profit and inventory fill only for people who can see the listing's confidential figures. Values that are empty in the file never wipe what was typed. A later receipt, addendum or handover on the same deal picks up the Agreement of Sale number.
- **Interpretations:**
  - The old per-form status menus (Offer Submitted, Countered…) become the brief's Draft → Sent → Signed.
  - The hard-coded agent name on signature lines is now the deal's (or listing's) agent.
  - Brokerage name, office and Chirper come from settings.
  - The brokerage commission record on JR-PA-400 is marked internal and left off the client's copy.
- **Rules** (`server/ops/documents.ts`):
  - **Who sees what.** Agents see documents they prepared, or that are on their deals, listings or clients. Managers and wide-access agents see all. Clients see a document only once it's shared, on its own read-only page (`/account/documents/[id]`), and get a notification when it is.
  - **Signatures.** Each party's typed name and date go in `document_signatures`. "Mark as signed" needs every required party; "(if any)" lines and witnesses are optional.
  - **Locking.** Signed documents are locked, and only the Owner or an Admin can reopen one. Only drafts can be deleted.
- **Pages:**
  - `/portal/documents`: index with form and status filters.
  - `/portal/documents/new`: takes `?deal=`, `?client=` or `?listing=`. From a deal it offers only the forms that fit (home or business) and fills straight away.
  - `/portal/documents/[id]`: the paper editor. It has the quick area picker (it fills the municipality and ZIP), Fill from client file, typed signatures, Save draft, Mark as sent or signed, Share with the client, Save as image (html-to-image, an 860px sheet at 2×) and Print/PDF (print stylesheet, letter size).
  - The deal page and client file both have a "New document" button, and the client's deal page links each shared document.

### Phase 7 — Marketing studio and map pin: built (Oct 24, 2026)

- **Artboards** (`components/studio/Artboards.tsx`): the formats from `surfaces.md`.
  - **Brochure**: green band and lockup, photo with a status ribbon, address, StatRow, price in mono, agent footer on `surface-sunken` with a brass top rule.
  - Also a **square post**, a **banner** (lockup plus the ledger's sold, volume and active figures; zero figures are left out), and a **business card** front and back.
  - **How the sizes come out exact.** Each artboard is laid out at half size with the design tokens and exported with html-to-image at 2×, so the PNGs are exactly 1080×1350, 1080×1080, 1500×500 and 1050×600 (checked in the browser). This keeps raw font sizes and spacing out of app code. Artboards are pinned to the light theme so the portal's dark mode doesn't recolour them.
- **Studio** (`/portal/studio?listing=`):
  - Picking a listing fills the brochure from it (`server/listings/studio.ts`), using public fields only, since brochures are shared outside. That covers the ribbon (from status, including Price Reduced), date, address, area line, up to four figures, the description's first sentence, the price (the recorded sale price once sold), who was represented, up to three photos in the order picked, and the agent.
  - Owner-listed homes carry "Listed by Owner" with the brokerage name.
  - Everything can be changed before export. Business cards use the signed-in agent's profile.
  - The picker lists only listings the agent can see in the portal.
- **Chirper composer** (`lib/chirper.ts`): template drafts (Just listed, Price reduced, Open house with a typed time, Under contract, Sold, For lease, Leased) built from the listing's real fields. Empty lines drop out, handles aren't repeated, and the blurb is trimmed with an ellipsis to stay within 280 characters. The draft is editable and has Copy and Reset buttons. No AI.
- **Property page**: "Download brochure" makes the same 1080×1350 PNG in the visitor's browser. It also shows for sold listings, as a record.
- **Manual map pin**:
  - **Placing.** Staff who manage a listing click the uploaded map image (Site settings) to place its pin. It is stored as x/y percentages, can be nudged with the arrow keys, and can be removed. The change is audited.
  - **Showing.** The property page shows "On the map" only when there is both a map image and a pin.
  - **Map views.** Buy, Rent and Businesses get a **Map** view, only when a map image exists. It shows every matching listing that has a pin (not just the current page), each linking to its listing, with the list below. Nothing is ever placed automatically.
- **Accessibility fix found by the tests:** pipeline cards were links with no accessible name. They are now named by address and client.
- **Flaky build:** once, PGlite aborted while prerendering the sitemap during the e2e build. A rerun passed. (Fixed in Phase 8: the sitemap is now built per request.)

### Phase 8 — Polish: built (Oct 24, 2026); deploy waiting on account setup

- **Accessibility audit** (`tests/e2e/accessibility.spec.ts`, axe-core, WCAG 2.1 A/AA). Every public page, the client account pages, and every portal page (including a document, a listing with the map picker, and the studio with a listing loaded) must have no serious or critical violations. Fixed along the way:
  - **Contrast:** the sidebar's monogram avatar was grey on brass, because the design-system bundle's span rule won.
  - **Week calendar:** it claimed `role="grid"` without rows; it is now a list of days.
  - Pipeline cards were unnamed links (fixed in Phase 7).
- **Mobile pass:** portal and account pages must not scroll sideways at 375px. Fixed:
  - `.grid-12` children defaulted to `span 12`, which added implicit columns to the 8- and 4-column grids on tablets and phones (every grid form overflowed).
  - The signed-in header (bell plus menu button) was about 3px too wide on a 375px phone.
- **Performance:**
  - The property page no longer renders the off-screen brochure (and fetches three full-size photos) on every visit; it renders only when "Download brochure" is clicked.
  - html-to-image is loaded only when an export runs.
  - Images already go through `next/image` with the Cloudinary loader.
- **SEO:**
  - Property pages carry `RealEstateListing` JSON-LD from the listing's own fields, with `<` escaped.
  - The sitemap is built per request, so a Vercel build never needs the database.
  - Robots, canonical URLs and Open Graph images were already in place.
- **README:**
  - Re-saved as UTF-8. It had been UTF-16 since Phase 2, which GitHub may show as a binary file.
  - New "What's in the portal" section (documents, studio, map pins) and the full list of end-to-end journeys.
- **Not done:** the Vercel deploy, which is waiting on the Neon, Discord and Cloudinary setup in the README.

## 11. Build order

Each phase ends with tests passing, a short summary, and this file updated.

1. **Foundation** — Next.js + TS + lint/format; tokens/bundle CSS and fonts; all 26 components ported + new primitives; `/styleguide` in both themes; full Drizzle schema + first migration; areas/features seed; Auth.js with Discord, DB sessions, Owner bootstrap, first-run profile; permissions helper + status machine + `nextRef` with tests; layout shells (public NavBar/footer, account, portal sidebar + bell); `.env.example`.
2. **Listings core** — areas/agents/site-settings admin; minimal Team page (promote to Admin/Agent); storage module + Cloudinary signed uploads + Uploader; agent Add listing wizard (autosaved drafts, 5 steps, inline client file, live preview, checklist); review queue, review detail with diff, approve (with optional agent assignment for owner-submitted listings)/changes/reject, notifications + Discord webhooks; public ListingCard and property page. README setup for Neon, Discord, Cloudinary. **Deploy to Vercel.**
3. **Public site** — home, Buy, Rent (filters, drawer, views, URL state, pagination), businesses, areas, sold (ledger + charts), agents, sell (valuation), about, guides, careers (applications), contact, legal, 404, SEO/OG/sitemap.
4. **Client accounts** — dashboard + journey, saved homes, saved searches + alerts, showings (book, reschedule, cancel), "List your property" flow, my listings (status, notes, edit, withdraw), my deal + documents + messages, profile/notification settings.
5. **Portal operations** — dashboard tiles, listings manager (table, bulk actions, quick edit, price history), clients index + client file + seller file (print), deals pipeline (drag with confirm, status sync), showings calendar, sales + Sale No., commission ledger, team/invites/roles, guides/careers CMS, activity log, support inbox.
6. **Documents** — 8 typed forms, fill from client file, area picker, signatures, drafts/sent/signed, PNG + print/PDF, attach and share.
7. **Marketing studio** — brochure, square, banner (+ business card), PNG export, Chirper composer, "Download brochure" on property pages; manual map pin placement and display.
8. **Polish** — accessibility audit (axe, keyboard, focus, contrast, reduced motion), mobile pass, performance/Lighthouse, Playwright e2e, README (setup, env, Neon, Cloudinary, Discord redirect URLs, migrations, seeding, first Owner, deployment), Vercel deploy.

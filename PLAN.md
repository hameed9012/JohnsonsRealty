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

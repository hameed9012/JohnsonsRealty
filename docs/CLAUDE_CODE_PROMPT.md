# Build the Johnson's Realty website

You are building the full website for **Johnson's Realty**, a roleplay real estate brokerage on the PARP (Pennsylvania State Roleplay) server in the Roblox game ER:LC. It is registered as a Civilian Operations (CivOps) business. All properties are in Dauphin County: Harrisburg (West Downtown, East Downtown, North Residential), Swatara Township (Springfield) and Susquehanna Township (Fairview). The owner is Hameed Johnson (Chirper @KeysWithJohnson).

The site has three parts that share one database and one design:

1. **Public site** — a complete real estate website: listings for sale and rent, businesses, areas, the sold archive, agents, guides, careers and contact.
2. **Client account** — signed-in users save homes, book showings, follow their deal and **submit their own property for listing**.
3. **Employee portal** — agents add listings, manage clients and deals, fill in documents, and make marketing graphics. The owner reviews and approves every new listing.

Treat this like a real production product. It should feel as complete and polished as a real brokerage site, not a demo.

---

## 0. Read these first

This repo contains:

- `design-system/` — the **Johnson's Realty Design System**. This is the source of truth for every visual decision.
  - `README.md` — the brand book: voice, colour, status rules, visibility layers, type, layout, imagery, motion, icons, logo, don'ts. **Read it fully before writing UI.**
  - `surfaces.md` — every page template and which components it uses, plus output specs (brochure 1080×1350, square post, banner, business card, printed documents).
  - `tokens.json` / `tokens.css` — all colours (Paper theme for public and client pages, Portal dark theme via `data-theme="dark"`), type styles, spacing, radius, shadows, sizes, z-index.
  - `components/bundle.css` — the component styles (`jr-*` classes), built only from tokens.
  - `components/bundle.js` + `components/index.d.ts` — reference implementations and props of the 26 components (Logo, Icon, Button, FilterChip, StatusStamp, StatusPill, TextField, SelectField, SearchBar, ListingCard, PriceDisplay, StatRow, AreaChip, AgentCard, SalesLedger, ProcessSteps, ReferenceReceipt, EmptyState, NavBar, PortalSidebar, DocumentHeader, SignatureLine, ConfidentialPanel, StatTile, PipelineCard, Toast) and the 39-icon set. `components/<Name>/README.md` has usage rules for each.
  - `assets/` — logo files, single-ink icon SVGs, and two sample in-game screenshots (layout samples only, never content).
- `reference/` — the tools the brokerage already uses, to be rebuilt inside the portal:
  - `forms-pa.html` — the current document generator: 8 Pennsylvania forms with a seller picker that fills them from client data, a quick area picker, and "Save as image".
  - `brochure-maker.html` — the current 1080×1350 property brochure maker.
  - `seller-files.md` — the current seller files: the exact data sheet each seller has (people, property, money and ownership, listing terms, showings, disclosures, confidential bottom line). **Use it to design the client/seller data model.** It is not seed data for production.

**How to use the design system:** port the components into real typed React components under `src/components/ui/` with the same names and props as `index.d.ts`, styled by importing `tokens.css` and `bundle.css` (or a faithful port of them). Do not load `bundle.js` at runtime. Never write a raw hex value, font size or spacing value in app code; use tokens. When a pattern is missing (data tables, modals, drawers, tabs, calendar, uploader, notification bell), compose it from tokens in the same style and add it to `src/components/ui/`.

Before coding, read everything above, then write `PLAN.md` with your architecture, data model and build order, and wait for my go-ahead.

---

## 1. Hard rules

- **Naming:** "Owner" (capital O, a role) means the brokerage owner, Hameed. A client who lists their own property is a "property owner", and their listings carry the "Listed by Owner" label. Keep the two apart in code: the role is `owner`, the listing source is `owner_submitted`.

- **Nothing is hard-coded.** Every listing, area, agent, sale, client, document, figure, contact detail, office address, social handle, career role and guide comes from the database. Pages are templates. The only fixed copy is UI text (labels, buttons, empty states, legal boilerplate).
- **Everything links.** A listing links to its area, its agent and similar listings. An area lists its active listings and recent sales. An agent lists their listings and sales. A client file links to its listings, deals, showings and documents. A sale links to its listing.
- **No AI or automated property filling.** Do not generate addresses, descriptions, prices, map positions or facts. Everything is entered by people. Do not try to model the ER:LC map; the only map feature is the optional manual pin described in section 6.
- **No invented data in production.** No fake reviews, testimonials, statistics or agents. A dev-only seed script may create clearly fake records (named "Example …") behind `npm run seed:dev`; it never runs in production.
- **CivOps rules:** original assets only, no real company names or logos, no resemblance to real brokerages or listing sites.
- **Status never relies on colour alone** (always a word plus a stamp, pill or ribbon). Accessible: WCAG 2.1 AA contrast, visible focus, keyboard navigation, 44px touch targets, `prefers-reduced-motion` respected.
- **Mobile is first-class:** filters become a bottom drawer, galleries swipe, tables become stacked cards, primary actions stay reachable.
- **Three visibility layers** must be impossible to confuse (see the brand book): Public, Client ("Only you can see this"), and Internal/Confidential (always inside ConfidentialPanel; when a viewer lacks access, the server never sends the value, and the UI shows redaction bars).

---

## 2. Stack

- **Next.js** (App Router, latest stable) + **TypeScript**, server components and server actions by default. Deployed on **Vercel**.
- **Database: Neon** (serverless Postgres) via the Vercel integration, using **Drizzle ORM** with migrations checked into the repo. (Supabase is not an option: its free plan is used up.)
- **Auth: Auth.js (NextAuth v5)** with **Discord** sign-in as the main provider (the community lives on Discord). Store each user's Discord ID, display name and avatar, plus a profile field for their **Roblox / in-game username** and optional Chirper handle. Sessions in the database.
- **Images: Cloudinary** (free plan) with signed uploads, behind a small `storage` module so it can be swapped for Vercel Blob later. Resize and compress on upload (long edge 2000px, WebP/AVIF delivery, `next/image` with Cloudinary loader). Store the public ID, width, height and order.
- **Validation:** Zod schemas shared by forms and server actions.
- **Image export** for documents and graphics: `html-to-image` or `html2canvas` client-side, producing PNG at the exact sizes in `surfaces.md`. Documents also print to PDF via a print stylesheet.
- **Notifications:** in-app (database table + bell with unread count) and, optionally, a Discord webhook ping to the owner when something is waiting for review (`DISCORD_REVIEW_WEBHOOK_URL`; skip silently if unset).
- Fonts: Manrope, IBM Plex Sans, IBM Plex Mono, Mrs Saint Delafield via `next/font/google`.

Environment variables to document in `.env.example`: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_DISCORD_ID`, `AUTH_DISCORD_SECRET`, `OWNER_DISCORD_ID`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `DISCORD_REVIEW_WEBHOOK_URL` (optional), `NEXT_PUBLIC_SITE_URL`.

---

## 3. Roles and permissions

| Role | Can |
| --- | --- |
| **Owner** | Everything. Approves, rejects or requests changes on listing submissions. Manages staff, roles, areas, site settings. Sees all confidential fields. The first user whose Discord ID equals `OWNER_DISCORD_ID` becomes Owner automatically. |
| **Admin** (optional, granted by Owner) | Same as Owner except managing the Owner and site-wide settings. Can approve listings only if the Owner enables "Admins can approve". |
| **Agent** | Portal access. Creates listing submissions, manages own clients, showings, deals and documents, uses the marketing studio. Sees confidential fields only on their own clients unless granted wider access. |
| **Client** | Public site plus client account: saved homes and searches, showings, their deal, messages, **submitting their own property**. |
| Visitor | Public site, enquiry forms (signed in to submit). |

Staff are added by the Owner via invite links (single-use token, expires) or by promoting an existing user. Every permission check happens on the server. Write a permissions helper and test it.

---

## 4. Data model (starting point — refine it in PLAN.md)

- `users` — Discord identity, display name, avatar, Roblox username, Chirper handle, role, status.
- `agent_profiles` — user, title, bio, public photo, phone/contact line, active flag, display order.
- `areas` — name, slug, parent area (for neighbourhoods inside a township/city), postal codes, description, hero image, services (police, fire, school district) as editable text, display order. **Areas are data**, seeded only with the names above in a real migration-safe seed the Owner can edit.
- `clients` — the client file: one record per person or company (buyers, sellers, landlords, tenants, businesses). Fields come from `reference/seller-files.md`: legal/RP names, co-owners, contact (Discord, Roblox username, Chirper), how they found us, motivation, timeline, ownership and title details, mortgage/liens, and **confidential** fields (bottom line, negotiation notes, commission terms). A client may be linked to a site `user` (when they have an account).
- `listings` — type (`house`, `apartment`, `business`, `land`, `rental`), purpose (`sale`, `rent`), **source** (`agent` or `owner_submitted`), status (see lifecycle), address line, unit, area, postal code, parcel ID, price or monthly rent, previous price, beds, baths, sq ft, lot, year built, garage, features (pool, gate, office, laundry, etc. as a features table), description, lease terms (length, deposit, availability date), business fields (business name, whether the name is withheld, trading history, staff, what's included), listing agent, seller client, showing instructions, slug, reference number, timestamps, published_at.
- `listing_photos` — listing, storage ID, width, height, alt text, caption, sort order, is_cover. **Minimum 3 photos to submit.**
- `listing_reviews` — the review history for a listing: submitted_by, submitted_at, decision (`approved`, `changes_requested`, `rejected`), reviewer, notes, decided_at. A listing can go through several rounds.
- `price_history` — listing, price, date, event (listed, reduced, sold).
- `sales` — sale number (Sale No. 001, sequential), listing, buyer client, seller client, agent(s), price, date, commission (confidential), settlement date.
- `showings` — listing, client, agent, requested time, confirmed time, status, notes.
- `deals` — listing, client(s), agent, stage (Active, Under Offer, Under Contract, Settlement, Closed), key dates, offer amounts (confidential), linked documents.
- `documents` — form type, form number, data (JSON validated per form type by Zod), linked listing, clients, deal, status (draft, sent, signed), signatures (typed name + date per party), created_by, timestamps.
- `enquiries` — type (showing request, valuation request, general contact, career application, listing question), payload, linked listing/user, reference number, status, assignee.
- `saved_homes`, `saved_searches` (with alert toggle), `messages` (deal thread between client and agent).
- `notifications` — user, kind, title, body, link, read_at.
- `activity_log` — actor, action, entity, entity ID, diff summary, time. Everything that changes data writes a row.
- `site_settings` — brokerage name lines, office location text, Chirper handle, Discord invite, CivOps registration line, footer text, "Admins can approve" flag. Editable by the Owner.
- `guides` / `posts` (guides and brokerage news) and `careers` (open roles) — managed in the portal.

Reference numbers: `JR-YYYY-NNNNN`, generated in the database (sequence per year), shown in `id` mono style. Form numbers per form type (e.g. `Form JR-PA-100`).

---

## 5. The listing submission and review flow (core feature)

### 5a. Agent submissions (portal → "Add listing")

A multi-step form, saved as a draft automatically at each step:

1. **Property** — type, purpose (sale/rent), address line and unit, area (quick-select chips from the `areas` table, like the current forms tool), postal code, parcel ID, beds, baths, sq ft, lot, year, garage, features (checkbox chips with icons), description.
2. **Price and terms** — asking price or monthly rent, lease terms or business terms, availability date, showing instructions.
3. **Photos** — drag-and-drop uploader with progress, reorder by drag, choose the cover, alt text per photo, caption. **At least 3 photos required**; show the count and block submission below 3 with a clear message ("Add at least 3 photos. You have 2.").
4. **Seller** — pick an existing client file or create a new one inline, with the full seller data sheet (people, ownership, money, listing terms, disclosures, confidential bottom line and motivation in a ConfidentialPanel).
5. **Review and submit** — a live preview of the public property page and the listing card, a checklist of missing fields, then **Submit for review**.

On submit: status becomes **Pending Review**, a `listing_reviews` row is created, the Owner (and approving Admins) get an in-app notification and the optional Discord webhook ping, and the agent sees a ReferenceReceipt with the listing's reference number.

### 5b. Client submissions (client account → "List your property")

A simpler public-facing version of the same form, in the Paper theme: property, price, at least 3 photos, and the owner's own details (taken from their account plus contact fields). They choose sale or rent. On submit it goes to **Pending Review** exactly like an agent submission, with `source = owner_submitted`. When approved, the listing shows a **"Listed by Owner"** pill beside its status everywhere (card, property page, search filters let people include or exclude owner listings). The client can see their submission's status and any notes from the reviewer, edit it when changes are requested, and withdraw it.

### 5c. Owner review (portal → "Review queue")

- Sidebar item with a count badge, and a **bell** in the portal header showing unread notifications.
- The queue lists submissions oldest first: cover photo, address, area, price, submitter (agent or client), source label, submitted time, round number.
- Opening one shows the full submission side by side with the public preview, all photos, the seller data (including confidential fields), and a diff against the previous round if it was resubmitted.
- Three actions, each needing a note except Approve:
  - **Approve** → status **Active** (or For Lease for rentals), `published_at` set, listing appears on the public site, the submitter is notified, price history gets a "Listed" row, and the **seller file is generated** (see 5d).
  - **Request changes** → status **Changes Requested**, notes go to the submitter, who edits and resubmits (new round).
  - **Reject** → status **Rejected**, notes go to the submitter; the listing never goes public.
- Every decision writes to `listing_reviews` and `activity_log`.

### 5d. Seller file on approval

When a listing is approved, the client file for its seller becomes a complete, printable **Seller file** page in the portal, matching the depth of `reference/seller-files.md`: an at-a-glance row (seller, property, asking, lowest they'll take, timeline), then the full data sheet in sections (sellers, the property, money and ownership, listing terms, showings, disclosures), with confidential parts in ConfidentialPanels. It is generated from the database, not stored as text, so edits to the client or listing update it. Owner-submitted listings get the same file built from what the client entered.

Every portal document can then **"Fill from client file"**: pick the client (and listing) and the form's fields fill from the database, exactly like the seller picker in `reference/forms-pa.html` does today.

---

## 6. Public site (Paper theme)

Build every template in `surfaces.md` with real routes, real queries, loading states, empty states and SEO metadata (Open Graph image per listing using the cover photo):

- **Home** — cinematic hero (21:9 in-game photo or a muted looping video set in site settings, green scrim on the text side only), SearchBar, ledger figures that count up once (homes sold, total volume, active listings — computed from the database, hidden if zero), featured and newest listings rail, areas grid with counts, latest 5 sales, process steps, agents row, a CTA to list your property.
- **Buy** and **Rent** — search results with filters (area, type, price range, beds, baths, features, include owner listings), sort, result count, grid and list views, URL-driven filters so searches are shareable, pagination or infinite scroll, EmptyState.
- **Property page** — gallery (3:2, swipe on mobile, full-screen viewer), status stamp, address in `display-l`, price, StatRow, facts table, features, description, price history as a ledger, area chip and area facts, agent card (or "Listed by Owner" contact block), **Book a showing** form (signed in; returns a reference number), save and share, similar listings, **Download brochure** (generates the 1080×1350 PNG).
- **Businesses** — index and detail, with the "name withheld" treatment when the business name is hidden.
- **Sell** — valuation request form with reference number, recent sales, process steps, CTA to list your property.
- **Areas** — index and detail pages from the `areas` table.
- **Sold** — full sales ledger with filters and simple charts (volume by month, sales by area) computed from data.
- **Agents** — index and profile pages.
- **About**, **Guides and news**, **Careers** (with application form), **Contact**, **404**, **Privacy / Terms** (RP-appropriate boilerplate).
- **Optional manual map pin:** the Owner can upload a map image of the playable area in site settings; on a listing, staff click that image to place a pin (stored as x/y percentages). The property page shows the pin on that image. No coordinates are ever guessed.

## 7. Client account (Paper theme)

Sign in with Discord, first-run profile (Roblox username, Chirper handle). Dashboard with their journey timeline, saved homes, saved searches with alert toggles (in-app notifications when a matching listing is approved), my showings (reschedule, cancel), my deal (timeline, documents shared with them, message thread with the agent, "Only you can see this" label), **my listings** (submissions with status and reviewer notes, edit when changes are requested, withdraw), profile and notification settings.

## 8. Employee portal (Portal dark theme, `data-theme="dark"`)

- **Dashboard** — StatTiles (active listings, pending review, under offer, showings today, volume this month), pipeline summary, upcoming showings, recent activity, and for the Owner the review queue preview.
- **Review queue** (Owner/approving Admins) — section 5c.
- **Listings manager** — table with status pills, source, agent, area, price, days on market; filters, bulk actions (mark under offer, withdraw, archive), quick edit. Editing a live listing's price records price history; material edits by agents to a live listing go back through review only if the Owner turns that setting on.
- **Listing editor** — section 5a.
- **Clients** — index and client file (data sheet in `form-label`/`form-value` pairs, confidential panels, linked listings, deals, showings, documents, activity). Seller file view and print (5d).
- **Deals pipeline** — PipelineCards in columns Active, Under Offer, Under Contract, Settlement, Closed; drag to move with confirmation; stage changes update listing status.
- **Showings calendar** — week and list views, confirm and complete showings.
- **Documents** — rebuild all 8 forms from `reference/forms-pa.html` as typed form schemas: Exclusive Right to Sell Listing Contract, Seller's Property Disclosure Statement, Residential Agreement of Sale, Business Listing Contract, Business Sale Agreement, Earnest Money Receipt, Change to Agreement of Sale, Settlement & Key Handover. Same paper look (DocumentHeader band, dark label section bars, paper fields, SignatureLine), "Fill from client file", quick area picker, typed signatures with dates, save as draft, mark signed, **Save as image** (PNG) and **Print/PDF**. Documents attach to the deal and client, and can be shared to the client's account.
- **Marketing studio** — rebuild `reference/brochure-maker.html`: pick a listing and it fills the 1080×1350 brochure live (photo, status ribbon, address, facts, price, agent footer); also the 1080×1080 square post and 1500×500 banner; export PNG. A Chirper post composer that drafts text from the listing's real fields (template-based, not AI) with copy button.
- **Commission ledger** — sales with commission splits (confidential), totals by agent and month.
- **Sales** — record a sale from a deal (assigns the next Sale No.).
- **Team, roles and permissions** — invite links, roles, deactivate.
- **Areas, site settings, guides, careers** — content management for everything the public site shows.
- **Activity log** — filterable list of every change.
- **Support inbox** — enquiries with status, assignee and replies.

## 9. Quality bar

- Server-side authorization on every query and action; confidential fields excluded from queries for viewers who can't see them.
- Zod validation with the error copy style from the brand book ("Enter a price in dollars, like 365000.").
- Optimistic UI where it helps, toasts that echo the action ("Listing published").
- Loading skeletons in the house style, EmptyStates everywhere a list can be empty, error boundaries.
- Image handling: no layout shift, lazy loading, the "Photos coming soon" placeholder when a listing has no photos.
- Lighthouse 90+ on public pages (performance, accessibility, SEO).
- Tests: permissions helper, status transitions (a state machine for listing status with allowed transitions), reference/sale number generation, form schemas, and an end-to-end Playwright test of: agent submits a listing with 3 photos → owner approves → listing visible publicly → seller file renders → a document fills from the client file.
- A `README.md` for the repo: setup, environment variables, Neon and Cloudinary setup, Discord app setup (redirect URLs for local and Vercel), migrations, seeding areas, how to make the first Owner, deployment.

## 10. Build order

Work in phases. Finish, test and summarise each phase before moving on, and keep `PLAN.md` updated.

1. Project setup, design system port (tokens, fonts, all 26 components plus missing primitives, a `/styleguide` route showing them in both themes), database schema and migrations, auth with roles, layout shells for public, account and portal.
2. Areas, agents, site settings and the listing model; the agent Add listing flow with photo uploads; the review queue, notifications and approve/changes/reject; public listing card and property page.
3. Public site: home, Buy, Rent, Businesses, Areas, Sold, Agents, Sell, About, Contact, Careers, Guides, 404.
4. Client accounts: profile, saved homes and searches, showings, client listing submissions, my deal and messages.
5. Portal: clients and seller files, deals pipeline, showings calendar, sales and commission ledger, team and settings, activity log, support inbox.
6. Documents (all 8 forms) with fill-from-client-file, signatures, image and PDF export.
7. Marketing studio and brochure export, optional map pin.
8. Polish: accessibility audit, mobile pass, performance, SEO, tests, README, Vercel deployment.

Ask me before making any decision that changes the scope, the stack or the data model in a way this brief doesn't cover.

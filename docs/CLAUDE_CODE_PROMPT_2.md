# Johnson's Realty — phase 2 brief: Discord bot, data import, auto seller files, property map

The website is built. This brief adds four things to the same repo. Same rules as the first brief: design system tokens only, nothing hard-coded, server-side permissions, Zod validation, tests, and `PLAN.md` updated. **Read this whole file and the files it points to, then add a "Phase 2" section to `PLAN.md` and wait for my go-ahead before coding.**

New files in this kit (put them in the repo as shown):

- `discord/discord-blueprint.md` — every role, channel, permission and message the bot creates. Source of truth for Discord.
- `import/seller-files.md` — the **current** seller files (newer than `reference/seller-files.md`; replace that file with this one).
- `import/forms-pa-latest.html` — the current forms tool. Its `SELLERS` and `EXTRA` objects hold the extra form data per seller (disclosure answers, showing notes, dates, vesting).
- `map/liberty-county-map.png` — the in-game map (1026×971).
- `map/postal-zones.json` — 62 postal zones with their centre on that map as % coordinates.
- `photos/6012-estate-drive/` — 20 ordered, cleaned photos for 6012 Estate Drive (01 is the cover).

---

## 1. The Discord bot

### 1a. How it runs (no always-on server)

Vercel can't host a bot that stays connected, so build the bot **without the gateway**:

- **One Discord application** (reuse the one used for "Sign in with Discord"), with a bot user. Env: `DISCORD_BOT_TOKEN`, `DISCORD_APP_ID`, `DISCORD_PUBLIC_KEY`, `DISCORD_GUILD_ID`.
- **Everything the site does in Discord goes through Discord's REST API** with the bot token: creating channels and roles, posting and editing embeds, adding roles, creating ticket channels.
- **Buttons, modals and slash commands** go through an **interactions endpoint** on the site: `POST /api/discord/interactions`, verifying Discord's Ed25519 signature on every request (reject anything that fails). Register its URL in the Discord developer portal. Respond within 3 seconds; for slow work, reply with a deferred response and finish with a follow-up.
- Use `discord-api-types` for types and a small typed REST wrapper (or `@discordjs/rest`). Handle rate limits (respect `retry_after`, queue per route).
- A `discord_config` table stores every created ID (roles, categories, channels, panel messages, the property-map message) so nothing is ever looked up by name at runtime.
- Things that need a live connection (logging message edits/deletes, member joins) are **out of scope**. Say in the README that a free logging bot can be added for that if wanted.

### 1b. `npm run discord:setup` — builds the whole server

A script (runs locally or as an Owner-only button in the portal under Settings → Discord) that reads a typed blueprint (`src/discord/blueprint.ts`, written from `discord/discord-blueprint.md`) and makes the server match it:

- Creates roles in order with colours, hoist and permissions; creates categories and channels with permission overwrites; creates forum posts for the FAQ; posts every panel and message from the blueprint as embeds with their buttons; creates AutoMod rules; tries the server settings in the blueprint and prints what to do by hand for anything Discord refuses.
- **Idempotent:** running it again updates what exists (by stored ID) instead of making duplicates, re-orders roles, fixes overwrites, and edits panel messages in place. A `--dry-run` flag prints the diff without changing anything.
- Logs a summary embed to #bot-log.

Invite link for the bot: generate it in the README with exactly the permissions the bot needs (not Administrator).

### 1c. Embed style

Embeds should look like the brand, not like a default bot:

- **Author line:** "Johnson's Realty" with the mark icon (`jr-avatar-green.png`, served from the site).
- **Colour strip by meaning**, from the design tokens: new listing `#b4925a` (brass), rental `#1f5c78`, sold or leased `#16302a`, under offer `#8a5a12`, review pending `#7a5f32`, error or complaint `#a3322a`, everything else `#16302a`.
- **New listing embed:** title "Just Listed · {address}" linking to the property page; description = the listing's 2-sentence summary; the cover photo as the big image; inline fields Price (or Rent /mo), Beds, Baths, Area (with "Postal {n}"), Agent (or "Listed by Owner"); footer "Ref {JR-…} · Johnson's Realty"; timestamp. Buttons: **View listing**, **Book a showing** (both links to the site). Pings @Notifications: Listings.
- **Rental and business embeds:** same shape. Business with a withheld name uses the public teaser, never the name.
- **Sold embed:** title "Sold · {address}", the sale number in the description ("Sale No. 007"), sale price, area, agent, a smaller thumbnail of the cover photo. No buyer names.
- **Review pending (staff):** submitter, source (Agent / Listed by Owner), round number, cover thumbnail, "Open in portal" link button. Pings Management.
- **Deal board, applications, announcements, open houses:** the same author, colour and footer pattern.
- Numbers formatted like the site (`$760,000`, `$1,900/mo`). No emoji in titles except the welcome. Every image URL must be public (Cloudinary delivery URL).

All embed builders live in `src/discord/embeds.ts` with unit tests (snapshot of the JSON) and a `/portal/settings/discord` preview page that renders each embed type with sample data, styled like Discord, so I can see them before they post.

### 1d. Website events → Discord

Replace the per-event webhooks from phase 1 with the bot (keep the webhook code path only if a channel ID isn't configured):

| Event on the site | Channel | Embed |
| --- | --- | --- |
| Listing approved (sale) | #new-listings | New listing |
| Listing approved (rental) | #for-rent | Rental |
| Listing approved (business) | #businesses-for-sale | Business |
| Sale or lease recorded | #sold | Sold |
| Submission waiting for review | #listing-review | Review pending |
| Deal stage change | #deal-board | Deal |
| Career application | #applications | Application, with Accept / Decline buttons that update the application on the site |
| Announcement published in the portal | #announcements | Announcement (new portal page: write, preview, publish) |
| Open house created in the portal | #open-houses | Open house |
| Listing price reduced | #new-listings | "Price Reduced · {address}" with old price struck through |
| Listing withdrawn or deleted | — | Edit the original listing embed to show "No longer available" and remove the Book button |

Store the Discord message ID on the listing so later changes edit the same message instead of posting new ones. Posting runs after the database transaction commits, and a failure never blocks the website action (log it to #bot-log and to the activity log, with a "Retry" button in the portal).

### 1e. Interactions

- **Verify** button → adds Verified; ephemeral reply.
- **Get roles** toggles → add/remove Notifications roles; ephemeral reply.
- **Tickets:** each panel button opens a **modal** with that type's fields (blueprint). Submitting creates a private channel `ticket-{type}-{number}` under HELP DESK with overwrites (opener + Staff; Complaint: opener + Management+), posts the intake embed with **Claim** and **Close**. Claim (Staff only) renames the channel with the agent's name and posts who claimed it. Close (Staff or opener) asks for a one-line summary in a modal, writes a transcript (fetch the channel's messages via REST, render a simple HTML file in house style), posts it to #ticket-transcripts, records the ticket in the site's `enquiries` table (type, opener's Discord ID, linked user if they've signed in, summary), then deletes the channel. Ticket numbers come from the site's `ref_counters`.
- **Shifts:** Clock in / Clock out buttons in #shifts; store shifts in a `shifts` table; show hours this week per agent in the portal.
- **Slash commands** (registered by the setup script, guild-scoped):
  - `/listings` with optional area (autocomplete from the areas table), type, max price → up to 5 results as compact embeds with link buttons; ephemeral.
  - `/listing ref` → the full listing embed.
  - `/agent name` (autocomplete) → agent card embed.
  - `/map` → the current property map image.
  - `/link` → links the member's Discord account to their site account (they're already linked if they signed in with Discord; this just confirms and syncs roles).

### 1f. Role sync

When a site user's role changes (Owner, Admin → Co-Owner, Agent, client with a closed deal → Client), add or remove the matching Discord role via REST if they're in the server. Run a full sync from the portal with one button. Never remove Owner from the server owner.

---

## 2. Import the existing client files and properties

Write `npm run import:legacy` (also an Owner-only portal action with a preview step) that reads `import/seller-files.md` and `import/forms-pa-latest.html` and creates the real records. It is idempotent (matches on a stable key per seller, e.g. `legacy:kowalski`), so running it twice changes nothing.

- **Parse, don't retype:** parse the markdown tables and lists per seller section and the `SELLERS` / `EXTRA` objects from the HTML. Write the parsed result to `import/legacy.json` first and show it in the preview so I can check it before anything is saved.
- **What it creates for each seller with a real property** (Porter, Kowalski, Raman, Castellano, Hartmann, Hayes, Lindqvist's laundromat): the client file (people, contact handles, confidential motivation and negotiation rules into the `*_confidential` tables), the listing with every detail table filled (property, ownership, terms, lease terms, business, disclosures from the form's SPDS answers), price history, and a link between them.
- **Status:** Castellano (601 Cardinal Court, 6 bed) is **Sold** — create the sale record too, Sale No. 001, price and date left for me to fill if the files don't have them. Everything else imports as **Active** (Hayes as For Lease), with `published_at` = the "Listed" date in the file.
- **Spare sellers** (Brennan, Whitaker, and the business sellers Dee's Diner, Malhotra's, Boyd & Co., Delgado Auto Repair) import as **client files only**, tagged "Spare seller", with no listing. They show up in the seller picker when an agent adds a listing.
- **Addresses:** use what the files say. Where a file says "You choose", leave the field empty and flag it in the preview. Known: 8095 Lakeway Street (Postal 809, Fairview, no basement), 6012 Estate Drive (Postal 601, Whispering Pines), 7063 Franklin Court, 601 Cardinal Court (Whispering Pines, two homes share it in the files — flag it so I can confirm), laundromat 8061 Fairview.
- **Photos:** upload `photos/6012-estate-drive/*` in order to the 6012 listing (01 = cover). Every other imported listing has no photos yet: it imports as Active but **hidden from the public site** with a "Needs photos" badge in the listings manager, until I add at least 3 photos, then it goes live without another review (the Owner already approved these).
- **No review queue for imports** (they're the Owner's own records), but every created record gets an activity log entry "Imported from legacy seller files".
- **Discord:** don't post imported listings to Discord automatically. Give me a "Post to Discord" button per listing so I can announce them when the photos are in.

---

## 3. Automatic seller files for new listings

The houses on PARP are empty in game; there is no real seller. Until now I wrote a fictional seller for each one by hand. Make the site do it.

- **When:** in the Add listing wizard, the Seller step gets a third option beside "Pick a client" and "New client": **Generate a seller**. If the agent skips the step entirely, the seller is generated automatically **when the Owner approves the listing**. Owner-submitted listings ("Listed by Owner") never get a generated seller; the real person is the seller.
- **How (no AI, no paid API):** a deterministic generator in `src/lib/seller-generator/` seeded by the listing ID, so the same listing always generates the same seller unless "Regenerate" is pressed. It builds a full seller file at the depth of `import/seller-files.md`:
  - **People:** from name pools (first names, surnames, varied backgrounds), single owner, couple, estate (older homes) or LLC (businesses and rentals), ages and occupations that fit the price band (a $760,000 home isn't owned by a 23-year-old cashier), contact handles in the style of the existing files (`RayK_Steelton`, `LenaHartmannDesign`), best contact time, mailing address after the move (a real-looking US address outside PA).
  - **Story:** reason for selling and timeline from a pool (downsizing, job move, estate sale, upsizing, divorce, retiring), a 3–4 sentence character paragraph and personality notes for showings, like the existing files.
  - **Ownership and money:** bought year after `year_built`, purchase price derived from the asking price and years held, deed book/page, mortgage holder and payoff (or none for long ownership), taxes about 1.4–1.8% of value, utilities by size.
  - **Listing terms:** commission 5% split, earnest money about 3% rounded, settlement window from the timeline, included and excluded items from the listing's features, showing instructions.
  - **Disclosures:** derived from facts. Built before 1978 → lead paint disclosure required. Roof and systems ages from the year built. Pool → pool item. No basement → "No basement, slab foundation". Plus one or two small honest defects from a pool (sticky garage door, fading fence stain), never anything that contradicts the agent's data.
  - **Negotiation (confidential):** lowest price 92–97% of asking depending on motivation, a decline threshold, a counter price, a timeline preference, and furniture terms if the listing is sold furnished (like the Hartmanns: furniture price and the least they'll take for it). Plus 2–3 "Lines Hameed can relay", written in the same voice as the existing files.
- Everything generated is **editable** before approval and stored as normal data, so the seller file page, the confidential panels and "Fill from client file" on the forms all work exactly as for imported sellers. Mark generated sellers "Fictional RP seller" in the portal only (never on the public site).
- Tests: same seed gives the same seller; numbers stay consistent (lowest < asking, counter between lowest and asking, purchase year ≥ year built); a pre-1978 home always needs the lead paint disclosure.

---

## 4. The property map

### 4a. Placing listings (approximate, never exact)

- The map image and postal zones from `map/` are seeded into `site_settings` and a `postal_zones` table (code, label, x %, y %).
- A listing's **postal code is the house number without its last digit** (6012 → 601, 8095 → 809, 10031 → 1003). The listing form fills it automatically from the address and the agent can change it. If the postal code has no zone yet, the Owner gets a notification to place it.
- **Portal → Settings → Map:** the map with every zone as a draggable dot, add/rename/delete zones, upload a new map image. Replaces the per-listing manual pin from phase 1 (keep the manual override field, but default to the zone).
- A listing appears on the map as a **soft circle at its zone**, not a pin on an exact house: one circle per zone per status group, with the **count** inside when there's more than one.

### 4b. The map image

- `GET /api/map.png` renders the map server-side (use `sharp` to composite an SVG overlay onto the map image; fonts embedded) at 1500px wide:
  - Circles per zone and status group: **Available** (brass `#b4925a` fill, cream number), **For lease** (`#1f5c78`), **Under offer** (`#8a5a12`), **Sold** (`#16302a` with a thin brass ring; sold listings stay on the map for 30 days, configurable). Circle radius grows a little with the count.
  - A clean legend panel in a corner with counts per status, the title "Johnson's Realty · Property map" and "Updated {date, time}".
  - Never draws addresses or prices; it's a representation, not a locator.
- Cache the PNG by a hash of the inputs (zones + listing statuses) and regenerate only when the hash changes.

### 4c. Where it shows

- **Website:** the Buy and Rent pages get a "Map" view showing the same map interactively (HTML/SVG, not the PNG): circles with counts, clicking a circle lists those listings beside the map. The property page shows a small map with that listing's zone circled.
- **Discord #property-map:** one message, created by setup, that the bot **edits in place** with the new image whenever the map hash changes (listing approved, sold, leased, under offer, withdrawn, zone moved). The message embed shows the legend counts as fields and "View the map on the website" as a link button. Also post the image when `/map` is used.

---

## 5. Chirper posts (if not already done)

The marketing studio's Chirper composer makes two posts per listing: the regular "🏡 Just Listed: {address}, {area} (Postal {postal})" post with the price and "Message me to book a showing.", and the Marketplace version: "Address: {address}, {area}", description, "Private showings by appointment.", no price in the text (the price goes in Chirper's price box), and if the listing is sold furnished, the line "Available fully furnished for {furnished price}." Both end with "— {agent name}, Johnson's Realty" and hashtags. Copy buttons, editable before copying.

---

## 6. Order

1. Postal zones, map rendering, map views on the site (no Discord yet).
2. Legacy import with preview, including the 6012 photos.
3. Seller generator in the wizard and on approval, with tests.
4. Discord: REST wrapper, blueprint, `discord:setup` with dry run, embeds with the preview page.
5. Discord: interactions endpoint (verify, roles, tickets, shifts, slash commands), event posts, property-map message, role sync.
6. README: creating the bot, invite link, interactions URL, env vars, running setup, what to click by hand.

Ask me before anything that changes the data model beyond what this brief describes.

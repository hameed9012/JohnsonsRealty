# Johnson's Realty

The website, client accounts and employee portal for Johnson's Realty, a roleplay brokerage on the PARP server (ER:LC), registered as a Civilian Operations business. Built with Next.js, Neon Postgres (Drizzle), Auth.js with Discord, and Cloudinary.

- `PLAN.md` — architecture, data model, decisions and build progress.
- `design-system/` — the brand book, tokens and component reference. Source of truth for every visual decision.
- `reference/` — the brokerage's previous tools (forms, brochure maker, seller files), being rebuilt inside the portal.
- `docs/CLAUDE_CODE_PROMPT.md` — the product brief.

## Run it locally

Requires Node 20.9 or newer.

```bash
npm install
cp .env.example .env.local
```

For a quick start without Neon, set `DATABASE_URL=pglite:./.e2e-data/dev` in `.env.local`. That runs an embedded Postgres in a local folder (development and tests only; it refuses to run on Vercel). Then:

```bash
npm run db:migrate
npm run dev
```

If you ever delete the local database folder, delete `.next` too: Next.js caches some lookups (areas, settings) and would otherwise serve the old IDs.

`db:migrate` applies the migrations in `drizzle/` and the base data (the area names, the feature list and the settings row). It is safe to run repeatedly and never overwrites what the Owner has edited.

### Clearly fake data for development

```bash
npm run seed:dev
```

Creates "Example …" records only. It refuses to run in production or on Vercel. With `E2E_TEST_AUTH=1` and a `pglite:` database you can sign in as a seeded user without Discord, for local testing only: `http://localhost:3000/api/test-auth?user=example-owner&next=/portal`. This route answers 404 unless all three conditions hold.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server on http://localhost:3000 |
| `npm run build` / `npm start` | Production build and server |
| `npm test` | Unit tests (Vitest), including database tests on an in-memory Postgres |
| `npm run test:e2e` | End-to-end tests (Playwright) |
| `npm run lint` / `npm run typecheck` | ESLint and TypeScript |
| `npm run db:generate` | Generate a new SQL migration after changing `src/db/schema` |
| `npm run db:migrate` | Apply migrations and base data |
| `npm run seed` | Re-apply base data only |
| `npm run seed:dev` | Fake "Example …" records for development |
| `npm run discord:setup` / `discord:invite` | Build the Discord server from the blueprint / print the bot's invite link (see below) |
| `npm run import:legacy` | Preview the legacy seller files import and write `import/legacy.json`; add `-- --yes` to save it |

## Environment variables

All are listed in `.env.example`.

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Neon pooled connection string (or `pglite:<dir>` locally) |
| `AUTH_SECRET` | Yes | `npx auth secret` |
| `AUTH_DISCORD_ID`, `AUTH_DISCORD_SECRET` | Yes | From the Discord application |
| `OWNER_DISCORD_ID` | Yes | Discord user ID of the Owner |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Yes (photos) | Cloudinary dashboard |
| `NEXT_PUBLIC_SITE_URL` | Yes | e.g. `https://your-project.vercel.app`; used for links, Open Graph and Discord posts |
| `DISCORD_WEBHOOK_REVIEW_PENDING` | No | Listing waiting for review |
| `DISCORD_WEBHOOK_NEW_LISTING` | No | New listing for sale approved |
| `DISCORD_WEBHOOK_NEW_RENTAL` | No | New rental approved |
| `DISCORD_WEBHOOK_NEW_BUSINESS` | No | New business listing approved |
| `DISCORD_WEBHOOK_SALE_RECORDED` | No | Sale recorded |
| `DISCORD_WEBHOOK_DEAL_STAGE` | No | Deal moved to a new stage |
| `DISCORD_WEBHOOK_CAREER_APPLICATION` | No | Career application received |
| `DISCORD_BOT_TOKEN`, `DISCORD_PUBLIC_KEY`, `DISCORD_GUILD_ID` | For the bot | Developer Portal and your server's ID; see the Discord bot section |
| `DISCORD_APP_ID` | No | Defaults to `AUTH_DISCORD_ID` |

Each webhook is optional; an empty one is skipped. Posts are embeds with the cover photo, address, area, price, key facts, agent and a "View on website" button.

## What's in the portal

- **Listings, review queue, clients, deals, showings, sales, commission, inbox, team and activity log.** See `PLAN.md` § 10 for each.
- **Documents** (`/portal/documents`): the eight Pennsylvania forms (JR-PA-050 to JR-PA-400).
  - Start one from a deal or client file and it fills from the client files, listing and deal. Any open document can also be refilled with **Fill from client file**.
  - Signatures are typed names with dates. Mark a document as sent, then signed; signed documents are locked.
  - **Save as image** makes a PNG. **Print or save as PDF** uses the print layout.
  - **Share with the client** puts a read-only copy (without brokerage-only sections) on their account.
- **Marketing studio** (`/portal/studio`): pick a listing and the 1080×1350 brochure fills from it. Also a square post, a banner and your business card, each exported as a PNG at its exact size. Property pages have a public **Download brochure** button.
  - **Chirper:** a post draft by type (just listed, price reduced, open house…), plus the two listing posts: **Just Listed** ("🏡 Just Listed: address, area (Postal …)", the price, "Message me to book a showing.") and **Marketplace** (no price in the text, the description, "Private showings by appointment." and the furnished line if there's a furnished price). Each is editable and has its own copy button.
- **Property map** (**Site settings → Property map**, Owner): listings appear as circles at their in-game postal zone, one circle per zone and status, on the search pages' **Map** view, the property page and the `#property-map` Discord message (`/api/map.png`).
  - A listing's postal code is its house number without the last digit (6012 → 601). The listing form fills it in, and the agent can change it.
  - Zones are draggable dots, each belonging to an area. A postal code with no zone notifies the Owner once.
  - A hand-placed pin on a listing still overrides its zone.
- **Generated sellers:** houses on the server have no real seller, so the Seller step can **Generate a seller**. It builds a fictional seller from the listing's facts (people, story, ownership, terms, disclosures and confidential negotiation rules).
  - Generation is seeded by the listing, so it stays the same until **Regenerate**. Everything is editable.
  - If an agent skips the step, a seller is generated when the Owner approves.
  - Generated sellers are marked "Fictional RP seller" in the portal only. Owner-submitted listings never get one.
- **Legacy import** (**Site settings → Import seller files**, Owner, or `npm run import:legacy`): creates the client files and listings from `import/seller-files.md` and `import/forms-pa-latest.html`.
  - The preview flags anything to check. Running it again changes nothing.
  - Imported listings without 3 photos are Active but hidden from the public site with a **Needs photos** badge, and go live once 3 described photos are saved. Use **Post to Discord** on the listing to announce it.

## Set up the services

### 1. Neon (database)

1. In Vercel, open the project → **Storage** → **Create database** → **Neon**, and connect it to the project. This adds `DATABASE_URL` to the project's environment variables.
2. To run migrations from your machine against Neon, copy the pooled `DATABASE_URL` into `.env.local` and run `npm run db:migrate`.

### 2. Discord (sign-in)

1. Go to https://discord.com/developers/applications → **New Application**, name it (for example "Johnson's Realty").
2. **OAuth2** → copy the **Client ID** into `AUTH_DISCORD_ID` and reset/copy the **Client Secret** into `AUTH_DISCORD_SECRET`.
3. **OAuth2 → Redirects**, add both:
   - `http://localhost:3000/api/auth/callback/discord`
   - `https://<your-vercel-domain>/api/auth/callback/discord` (and any custom domain)
4. Find the Owner's Discord user ID: Discord → **Settings → Advanced → Developer Mode** on, then right-click your name → **Copy User ID**. Put it in `OWNER_DISCORD_ID`.

### 3. Cloudinary (photos)

1. Create a free account at https://cloudinary.com.
2. **Dashboard** → copy **Cloud name**, **API Key** and **API Secret** into the three `CLOUDINARY_*` variables.
3. Uploads are signed by the server, so no unsigned upload preset is needed.

### 4. Discord webhooks (optional)

For each channel that should get posts: **Edit channel → Integrations → Webhooks → New Webhook → Copy Webhook URL**, and paste it into the matching `DISCORD_WEBHOOK_*` variable. Once the bot is set up (next section), it takes over these posts.

### 5. The Discord bot (builds the server)

The bot uses the same Discord application as sign-in. It has no always-on process: it changes the server through Discord's REST API, and buttons reach the site through an interactions endpoint, so it runs on Vercel.

1. **Turn the app into a bot.** Developer Portal → your app → **Bot** → **Reset Token**, and copy it into `DISCORD_BOT_TOKEN`. Leave "Public Bot" off.
2. **Copy the IDs.**
   - **General Information → Public Key** goes into `DISCORD_PUBLIC_KEY`.
   - Your server's ID goes into `DISCORD_GUILD_ID`: with Developer Mode on, right-click the server icon → **Copy Server ID**.
   - `DISCORD_APP_ID` is optional; it defaults to `AUTH_DISCORD_ID`.
3. **Add the variables in Vercel** (Production), then redeploy.
4. **Invite the bot** with the link on **Portal → Site settings → Discord server**, or run `npm run discord:invite`. The link asks for exactly what setup needs (permissions integer `1634742038259`), never Administrator. It covers:
   - posting and managing messages and threads;
   - managing channels, roles and the server (AutoMod, Community, onboarding, icon);
   - the moderation permissions the Management role gets (timeout, kick, audit log, nicknames).
5. **Move the bot's role to the top.** In Discord, **Server Settings → Roles**, drag the bot's role to the very top. A bot can only manage roles below its own.
6. **Set the Interactions Endpoint URL.** Developer Portal → **General Information**, set it to `https://<your-domain>/api/discord/interactions` and save (Discord sends a test request, which the site answers). The Verify and Get-roles buttons need this.
7. **Build the server.** On **Portal → Site settings → Discord server**, click **Preview changes**, then **Run setup**. From a terminal with the production `DATABASE_URL`, `npm run discord:setup -- --dry-run`, then `npm run discord:setup`, does the same.

Setup creates the roles in order, with colours from the design tokens. It also creates the categories and channels with their permissions, every panel from `discord/discord-blueprint.md`, the FAQ forum posts and the AutoMod rules, and it applies the server settings. It finishes with a summary in #bot-log.

Running setup again updates by stored ID: it re-orders roles, fixes permissions and edits panels in place, and never creates duplicates.

**What setup can't do, so you do it by hand** (it prints this list):
- Turn on **Administrator** for the Owner and Co-Owner roles. Bots can't grant it.
- Require 2FA for moderation (server owner only).
- Finish **onboarding**. Discord wants more default channels than the blueprint lists, so setup prints the questions to add.
- Add the server banner. It needs a boost level.

**What the bot does day to day:**

| On the website or in Discord | What happens |
| --- | --- |
| A listing is approved | Posted to #new-listings, #for-rent or #businesses-for-sale, pinging Notifications: Listings |
| Its price is cut | "Price Reduced" in #new-listings, with the old price struck through |
| It's withdrawn, archived or taken off the market | The original post is edited to "No longer available" |
| A sale or lease is recorded | Posted in #sold (no buyer names); buyers on the deal get the Client role |
| A listing is submitted for review | Posted in #listing-review, pinging Management |
| A deal changes stage | Posted in #deal-board |
| Someone applies on Careers | Posted in #applications with **Accept** and **Decline**, which update the application on the site and notify the applicant |
| **Portal → Announcements** | Posts to #announcements |
| An open house is scheduled on a listing | Posts to #open-houses and shows on the property page |
| A ticket button in #open-a-ticket | Asks a few questions, then opens a private `ticket-…` channel for the person and staff (Complaints: Management and up). Staff **Claim** it; **Close** asks for a summary, saves an HTML transcript in #ticket-transcripts, records the ticket on the site, and deletes the channel. |
| **Clock in** / **Clock out** in #shifts | Hours this week show on the portal's Discord page |
| `/listings`, `/listing`, `/agent`, `/map`, `/link` | Search listings, show one, show an agent, link to the map, link a member to their site account and sync their roles |
| Someone's role changes on the site | Their Discord role follows: Owner, Admin → Co-Owner, Agent, and Client after a closed deal. Management, Senior Agent and Trainee are set by hand. |

If a post fails (for example, a missing permission), the website action still goes through. The post is saved under **Failed posts** on the Discord page with a **Retry** button, and noted in #bot-log. **See how every post looks** on that page previews them all with sample data. Imported listings are never posted automatically: use **Post to Discord** on the listing.

**Not included:** logging message edits, deletions and member joins needs a bot that stays connected, which Vercel can't run. If you want those logs, add a free logging bot alongside this one.

## The first Owner

Sign in with Discord using the account whose ID is in `OWNER_DISCORD_ID`. That user becomes Owner automatically; nobody else can become Owner. The Owner then promotes other users (for example the co-owner to Admin) in **Portal → Team**. "Admins can approve" is on by default and can be changed in **Portal → Site settings**.

## Deploy (Vercel)

1. Push the repository to GitHub and import it in Vercel (**Add New → Project**, framework Next.js, root directory `/`).
2. Before the first deploy, add the Neon integration (above). Then add the other variables under **Settings → Environment Variables** for Production (and Preview if you use it): `AUTH_SECRET`, `AUTH_DISCORD_ID`, `AUTH_DISCORD_SECRET`, `OWNER_DISCORD_ID`, the three `CLOUDINARY_*`, `NEXT_PUBLIC_SITE_URL` (your `https://….vercel.app` address), and any `DISCORD_WEBHOOK_*` you want.
3. Deploy. The `vercel-build` script runs `db:migrate` before `next build`, so the schema and base data are applied on every deploy.
4. Add `https://<your-domain>/api/auth/callback/discord` to the Discord app's redirects (step 2 of Discord setup), if you haven't yet.
5. Sign in as the Owner, open **Portal → Team**, find your co-owner (they must have signed in once) and make them Admin.

Never set `E2E_TEST_AUTH` on Vercel. The test sign-in also refuses to run there.

## Testing

```bash
npm test
```

Unit and database tests. The database tests run against an in-memory Postgres (pglite) with the real migrations.

```bash
npx playwright install chromium
```

```bash
npm run test:e2e
```

Builds the app into `.next-e2e`, starts it on port 3100 against a fresh embedded database seeded with "Example …" records, and runs the main journeys in a real browser:

- **Listings.** An agent submits a listing with 3 photos, the Owner approves it and it appears on the public site. A property owner lists a rental, the Owner requests changes, and they resubmit.
- **Clients and deals.** A client saves homes and searches and books showings. An agent runs a deal to a recorded sale. Staff confirm showings and answer the inbox, and the Owner invites an Admin.
- **Documents.** The seller file renders, a document fills from the client file and is signed, and a deal document is shared to the buyer.
- **Marketing.** The studio exports a brochure and drafts a Chirper post. A map pin is placed and shows on the property page and the Buy map.
- **Accessibility audit** (axe, WCAG 2.1 A/AA). Public, account and portal pages must have no serious or critical issues and must not scroll sideways on a 375px phone.

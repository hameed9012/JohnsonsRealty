# Discord server blueprint

The source of truth for `npm run discord:setup`. Everything here is created by the bot; nothing is set up by hand except inviting the bot and the few settings Discord's API can't change (listed at the end).

Server name: **Johnson's Realty | PARP**. Icon: `design-system/assets/Logos/jr-avatar-green.png`. Banner: render the 1500×500 banner from the design system (green ground, lockup left, ledger figures right).

## Roles (top to bottom)

| # | Role | Colour | Hoist | Permissions |
| --- | --- | --- | --- | --- |
| 1 | Johnson's Realty Bot | none | no | Managed by the bot's invite (Manage Roles, Manage Channels, Manage Messages, Embed Links, Attach Files, Read Message History, View Channels, Send Messages, Manage Threads, Create Private Threads) |
| 2 | Owner | #b4925a | yes | Administrator |
| 3 | Co-Owner | #d8c29a | yes | Administrator |
| 4 | Management | #9db8af | yes | Manage Messages, Manage Threads, Moderate Members, Kick Members, Manage Roles, View Audit Log, Manage Nicknames |
| 5 | Senior Agent | #2a5248 | yes | Default + Manage Messages (set per channel) |
| 6 | Agent | #1f4038 | yes | Default |
| 7 | Trainee Agent | #617d74 | yes | Default |
| 8 | Client | #f1ede4 | yes | Default |
| 9 | Verified | none | no | Default |
| 10 | Partner | #7a5f32 | no | Default |
| 11 | Notifications: Listings | none | no | none (ping role) |
| 12 | Notifications: Announcements | none | no | none (ping role) |

@everyone: View Channels off at server level, except the three Front desk channels below that explicitly allow it. "Staff" below = Trainee Agent, Agent, Senior Agent, Management, Co-Owner, Owner.

## Categories and channels

| Category | Channel | Type | Who can see | Who can post | Bot posts here |
| --- | --- | --- | --- | --- | --- |
| FRONT DESK | welcome | text | everyone | Owner | Welcome embed + link buttons |
| FRONT DESK | rules | text | everyone | Owner | Rules embed |
| FRONT DESK | verify | text | everyone | nobody (bot) | Verify panel with button |
| FRONT DESK | announcements | announcement | Verified | Management+ | Announcement embeds from the portal |
| FRONT DESK | about-us | text | Verified | Owner | About embed + "How it works" embed |
| FRONT DESK | get-roles | text | Verified | nobody (bot) | Ping-role toggle buttons |
| PROPERTIES | new-listings | announcement | Verified | bot | New listing embeds (sale) |
| PROPERTIES | for-rent | text | Verified | bot | New rental embeds |
| PROPERTIES | businesses-for-sale | text | Verified | bot | Business listing embeds |
| PROPERTIES | sold | text | Verified | bot | Sold / leased embeds |
| PROPERTIES | property-map | text | Verified | bot | ONE live map message, edited in place |
| PROPERTIES | open-houses | text | Verified | Agent+ | Open house embeds from the portal |
| HELP DESK | open-a-ticket | text | Verified | nobody (bot) | Ticket panel |
| HELP DESK | faq | forum | Verified | Staff (Verified can reply) | One post per FAQ, created by setup |
| HELP DESK | (ticket channels) | text, created per ticket | opener + Staff (Complaint: opener + Management+) | same | Ticket intake embed with Claim / Close |
| COMMUNITY | general | text | Verified | Verified | — |
| COMMUNITY | in-game-photos | text | Verified | Verified | — |
| COMMUNITY | reviews | text | Verified | Client | Pinned "how reviews work" embed |
| COMMUNITY | partners | text | Verified | Management+ | — |
| CLIENT LOUNGE | client-lounge | text | Client + Staff | Client + Staff | Early-look embeds (listing approved but not yet announced, optional) |
| STAFF | staff-announcements | text | Staff | Management+ | — |
| STAFF | staff-chat | text | Staff | Staff | Pinned staff guide embed |
| STAFF | listing-review | text | Management+ | bot + Management+ | Review-pending embeds with "Open in portal" button |
| STAFF | deal-board | text | Staff | bot | Deal stage change embeds |
| STAFF | shifts | text | Staff | Staff | Shift panel: "Clock in" / "Clock out" buttons |
| STAFF | training | forum | Staff | Senior Agent+ (Staff reply) | — |
| STAFF | Staff Meeting | voice | Staff | Staff | — |
| MANAGEMENT | management | text | Management+ | Management+ | — |
| MANAGEMENT | applications | text | Management+ | bot + Management+ | Career application embeds with Accept / Decline |
| MANAGEMENT | ticket-transcripts | text | Management+ | bot | Transcript file per closed ticket |
| MANAGEMENT | bot-log | text | Management+ | bot | Everything the bot does (role changes, setup runs, errors) |

## Message text (bot posts these as embeds; keep the words)

### welcome
Title: **Welcome to Johnson's Realty**
Independent real estate brokerage on PARP, serving all of Dauphin County: Harrisburg, Swatara Township and Susquehanna Township.
We help you **buy**, **sell**, **rent** and **list businesses**, from first viewing to keys in hand.
**Start here**
1. Read #rules
2. Verify in #verify
3. Browse #new-listings or the website
4. Ready to move? Open a ticket in #open-a-ticket
Footer: Chirper @KeysWithJohnson · Registered PARP Civilian Operations business
Buttons (link): Visit the website · Browse listings · List your property

### rules
Title: **Server rules**
1. **Respect everyone.** No harassment, hate speech, slurs or personal attacks.
2. **Follow Discord's Terms of Service and PARP's rules**, including CivOps rules.
3. **Keep it in the right channel.** Property questions go in a ticket, not #general.
4. **No advertising** other servers or businesses outside #partners without permission.
5. **No spam**, mass pings or begging for discounts.
6. **Deals happen through tickets and the website.** Staff will never ask for payment through DMs.
7. **RP stays RP.** Prices, contracts and properties are in-game only. Never share real personal information.
8. **Staff decisions are final.** Disagree respectfully through a Complaint ticket.
Footer: Breaking these may lead to a warning, a timeout or a ban.

### verify
Title: **Verify**
Press the button below to get access to the rest of the server.
Button: Verify (green-style primary) → gives Verified, replies ephemerally "You're in. Head to #new-listings or open a ticket when you're ready."

### about-us
Title: **About Johnson's Realty**
Founded by Hameed Johnson, Johnson's Realty is a full-service brokerage on PARP. Every listing is checked and approved before it goes live, every client gets a named agent, and every deal is backed by proper paperwork.
**What we do** · Homes for sale across Dauphin County · Rentals with clear lease terms · Business sales, with names kept private until you're serious · Free valuations if you want to sell
Second embed: **How it works** 1. Tell us what you want in a ticket or on the website 2. Book a showing with your agent 3. Make an offer, and we handle the documents 4. Sign, settle and take your keys
Buttons (link): Website · List your property

### open-a-ticket
Title: **Talk to an agent**
Pick what you need and an agent will be with you shortly. Have your Roblox username ready, plus your budget or asking price.
Buttons: Buy · Rent · Sell · Business · General · Complaint (Complaint is red-style danger)

Ticket intake (posted in the new ticket channel): "Thanks for reaching out to Johnson's Realty. An agent will reply here shortly." plus the answers from the modal as fields. Buttons: Claim · Close.

Ticket modal fields per type:
- Buy / Rent: Roblox username, area you want, budget (or rent per month), beds needed, anything else.
- Sell: Roblox username, property address and postal, what you hope to get, anything else.
- Business: Roblox username, buying or selling, business type and area, budget or asking price.
- General / Complaint: Roblox username, what it's about.

### reviews (pinned)
Bought, sold or rented with us? Leave one message here about how it went. Clients only, one review each, no edits after 24 hours. We never write or pay for reviews.

### staff-chat (pinned staff guide)
Title: **Agent basics**
· Claim a ticket before replying, and close it with a summary when done.
· Every listing goes through the website: Portal → Add listing, with at least 3 photos. It goes live only after the Owner approves it.
· Never share a seller's bottom line, motivation or commission with a client. That stays in the portal.
· Book showings through the website so they show up on the calendar.
· Use the portal documents for every deal, and attach them to the client file.
· Clock in and out in #shifts.
· Professional at all times: you represent the brokerage in game and on Discord.

### get-roles
Title: **Pick your pings**
Buttons (toggle): New listings · Announcements. Each toggles the matching Notifications role and replies ephemerally with what changed.

### faq (one forum post each, created by setup)
- How do I book a showing? → Open a ticket or press "Book a showing" on the listing's page on the website.
- Can I list my own property? → Yes. Sign in on the website with Discord and use "List your property". The Owner reviews it before it goes live.
- Are prices negotiable? → Make an offer through your agent. Every offer goes to the seller.
- What does "Listed by Owner" mean? → The property owner listed it themselves. You can still book a showing through the website.
- How do I become an agent? → Apply on the website's Careers page.

## Server settings

Setup tries each of these through the API and, where Discord refuses (permissions, boost level, owner-only), prints a short checklist of what to click by hand instead:

- Community features on (rules channel = #rules, updates channel = #staff-announcements), verification level Medium, explicit content filter on for all members, default notifications "Only @mentions".
- Onboarding: default channels #welcome, #announcements, #new-listings, #open-a-ticket, #general; question 1 "What brings you here?" (Buying, Selling, Renting, Business, Just looking); question 2 "Want pings?" (New listings → Notifications: Listings, Announcements → Notifications: Announcements).
- AutoMod: block mentions of more than 5 users or roles, Discord's preset slur list, invite links outside #partners; alerts to #bot-log.
- Server icon from the logo file; banner only if the server's boost level allows it.
- Owner-only, always by hand: 2FA requirement for moderation.

import 'server-only';
// One function per website event in the brief's table (1d). Each loads what it needs, builds the branded
// message and hands it to sendToDiscord. Callers run these after their transaction commits (via `after`).
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { announcements, enquiries, listings, openHouses, users } from '@/db/schema';
import { configId } from '@/discord/config';
import { announcementMessage, applicationMessage, dealMessage, listingMessage, noLongerAvailableMessage, openHouseMessage, priceReducedMessage, reviewPendingMessage, soldMessage } from '@/discord/embeds';
import { discordDeps, LISTING_CHANNEL, listingEmbedData, listingKind, sendToDiscord, type SendResult } from '@/discord/events';
import { siteUrl, type WebhookEvent } from '@/lib/discord';
import { money, saleNo as saleNoText } from '@/lib/format';
import { publicImageUrl } from '@/lib/storage';
import { loadBundle } from '@/server/listings/bundle';
import { agentName, coverOf, priceText, publicTitle, webhookMessageFor } from '@/server/listings/present';
import { mediaSrc } from '@/server/queries/media';

async function bundle(listingId: string) {
  return loadBundle(db, listingId, { confidential: false });
}

const APPROVED_WEBHOOK = (k: ReturnType<typeof listingKind>): WebhookEvent => (k === 'business' ? 'new_business' : k === 'rent' ? 'new_rental' : 'new_listing');

/** Listing approved (or "Post to Discord" from the portal): the announcement whose ID later edits reuse. */
export async function postListing(listingId: string): Promise<SendResult> {
  const b = await bundle(listingId);
  if (!b) return 'skipped';
  const deps = await discordDeps(db);
  const kind = listingKind(b);
  const title = kind === 'business' ? 'New business listing' : kind === 'rent' ? 'New rental' : 'New listing';
  return sendToDiscord(
    db,
    {
      event: 'listing_approved',
      channel: LISTING_CHANNEL[kind],
      message: listingMessage(deps?.brand ?? (await fallbackBrand()), listingEmbedData(b), await configId(db, 'role:pingListings')),
      remember: { listingId },
      fallback: { event: APPROVED_WEBHOOK(kind), message: webhookMessageFor(b, title, `/property/${b.slug}`) },
    },
    deps,
  );
}

export async function postReviewPending(listingId: string, round: number): Promise<SendResult> {
  const b = await bundle(listingId);
  if (!b) return 'skipped';
  const deps = await discordDeps(db);
  const cover = coverOf(b);
  const submitter = b.submitter?.displayName ?? b.submitter?.name ?? 'Someone';
  return sendToDiscord(
    db,
    {
      event: 'review_pending',
      channel: 'listing-review',
      message: reviewPendingMessage(
        deps?.brand ?? (await fallbackBrand()),
        { title: publicTitle(b), listingId, submitter, source: b.source, round, thumbUrl: cover ? publicImageUrl(cover.media.storageId, { width: 400 }) : null, price: priceText(b), refNo: b.refNo },
        await configId(db, 'role:management'),
      ),
      fallback: { event: 'review_pending', message: webhookMessageFor(b, round > 1 ? 'Listing resubmitted for review' : 'Listing waiting for review', `/portal/review/${listingId}`, { internal: true }) },
    },
    deps,
  );
}

export async function postPriceReduced(listingId: string, oldPrice: number): Promise<SendResult> {
  const b = await bundle(listingId);
  if (!b) return 'skipped';
  const deps = await discordDeps(db);
  if (!deps) return 'skipped';
  return sendToDiscord(db, { event: 'price_reduced', channel: 'new-listings', message: priceReducedMessage(deps.brand, listingEmbedData(b), oldPrice, await configId(db, 'role:pingListings')) }, deps);
}

/** Withdrawn, archived or taken off the market: edit the original announcement, if there is one. */
export async function markListingUnavailable(listingId: string): Promise<SendResult> {
  const b = await bundle(listingId);
  if (!b?.discordMessageId || !b.discordChannelId) return 'skipped';
  const deps = await discordDeps(db);
  if (!deps) return 'skipped';
  return sendToDiscord(db, { event: 'listing_unavailable', channel: LISTING_CHANNEL[listingKind(b)], message: noLongerAvailableMessage(deps.brand, listingEmbedData(b)), edit: { channelId: b.discordChannelId, messageId: b.discordMessageId } }, deps);
}

export async function postSale(listingId: string, saleNo: number, price: number): Promise<SendResult> {
  const b = await bundle(listingId);
  if (!b) return 'skipped';
  const deps = await discordDeps(db);
  const rent = b.purpose === 'rent';
  const cover = coverOf(b);
  const fallback = webhookMessageFor(b, rent ? 'Lease signed' : 'Sale recorded', '/sold');
  fallback.fields = [{ name: 'Sale', value: saleNoText(saleNo), inline: true }, { name: rent ? 'Rent' : 'Sold for', value: money(price) + (rent ? '/mo' : ''), inline: true }, ...(fallback.fields ?? []).filter((f) => f.name !== 'Price')];
  return sendToDiscord(
    db,
    {
      event: 'sale_recorded',
      channel: 'sold',
      message: soldMessage(deps?.brand ?? (await fallbackBrand()), {
        title: publicTitle(b),
        saleNo: saleNoText(saleNo),
        price,
        rent,
        areaName: b.area?.name ?? null,
        postal: listingEmbedData(b).postal,
        agentName: b.source === 'owner_submitted' ? null : agentName(b),
        thumbUrl: cover ? publicImageUrl(cover.media.storageId, { width: 400 }) : null,
        refNo: b.refNo,
      }),
      fallback: { event: 'sale_recorded', message: fallback },
    },
    deps,
  );
}

export async function postDealStage(dealId: string, listingId: string, from: string, to: string, toKey: string): Promise<SendResult> {
  const b = await bundle(listingId);
  if (!b) return 'skipped';
  const deps = await discordDeps(db);
  const fallback = webhookMessageFor(b, `Deal moved to ${to}`, `/portal/deals/${dealId}`, { internal: true });
  fallback.fields = [{ name: 'From', value: from, inline: true }, { name: 'To', value: to, inline: true }, ...(fallback.fields ?? [])];
  const tone = toKey === 'closed' ? 'sold' : ['under_offer', 'under_contract', 'settlement'].includes(toKey) ? 'offer' : 'default';
  return sendToDiscord(
    db,
    { event: 'deal_stage', channel: 'deal-board', message: dealMessage(deps?.brand ?? (await fallbackBrand()), { title: publicTitle(b), dealId, from, to, agentName: agentName(b), refNo: b.refNo, tone }), fallback: { event: 'deal_stage', message: fallback } },
    deps,
  );
}

export async function postApplication(enquiryId: string): Promise<SendResult> {
  const e = await db.query.enquiries.findFirst({ where: eq(enquiries.id, enquiryId) });
  if (!e) return 'skipped';
  const p = e.payload as { role?: string; why?: string };
  const u = e.userId ? await db.query.users.findFirst({ where: eq(users.id, e.userId), columns: { displayName: true, robloxUsername: true } }) : null;
  const deps = await discordDeps(db);
  const data = { enquiryId, refNo: e.refNo, role: p.role ?? 'Career application', applicant: u?.displayName ?? 'Applicant', roblox: u?.robloxUsername ?? null, why: p.why ?? null };
  return sendToDiscord(
    db,
    {
      event: 'career_application',
      channel: 'applications',
      message: applicationMessage(deps?.brand ?? (await fallbackBrand()), data),
      fallback: {
        event: 'career_application',
        message: { title: 'Career application', heading: data.role, description: data.why?.slice(0, 300) ?? undefined, url: siteUrl('/portal/inbox'), fields: [{ name: 'Applicant', value: data.applicant, inline: true }, { name: 'Reference', value: e.refNo, inline: true }] },
      },
    },
    deps,
  );
}

export async function postAnnouncement(id: string): Promise<SendResult> {
  const a = await db.query.announcements.findFirst({ where: eq(announcements.id, id) });
  if (!a) return 'skipped';
  const deps = await discordDeps(db);
  if (!deps) return 'skipped';
  const author = a.createdBy ? await db.query.users.findFirst({ where: eq(users.id, a.createdBy), columns: { displayName: true } }) : null;
  const img = await mediaSrc(a.imageMediaId);
  return sendToDiscord(
    db,
    {
      event: 'announcement',
      channel: 'announcements',
      message: announcementMessage(deps.brand, { title: a.title, body: a.body, imageUrl: img ? publicImageUrl(img, { width: 1200 }) : null, authorName: author?.displayName ?? null }, a.pingRole ? await configId(db, 'role:pingAnnouncements') : null),
      remember: { announcementId: id },
    },
    deps,
  );
}

export async function postOpenHouse(id: string): Promise<SendResult> {
  const oh = await db.query.openHouses.findFirst({ where: eq(openHouses.id, id) });
  if (!oh) return 'skipped';
  const b = await bundle(oh.listingId);
  const deps = await discordDeps(db);
  if (!b || !deps) return 'skipped';
  const cover = coverOf(b);
  const message = openHouseMessage(deps.brand, {
    title: publicTitle(b),
    slug: b.slug,
    startsAt: oh.startsAt,
    endsAt: oh.endsAt,
    notes: oh.notes,
    coverUrl: cover ? publicImageUrl(cover.media.storageId, { width: 1200 }) : null,
    agentName: agentName(b),
    refNo: b.refNo,
    cancelled: oh.cancelled,
  });
  const channelId = await configId(db, 'channel:open-houses');
  const edit = oh.discordMessageId && channelId ? { channelId, messageId: oh.discordMessageId } : null;
  return sendToDiscord(db, { event: 'open_house', channel: 'open-houses', message, edit, remember: { openHouseId: id } }, deps);
}

/** Brand for building webhook-path messages when the bot isn't configured (only the colours and site matter). */
async function fallbackBrand() {
  const { brandContext } = await import('@/discord/config');
  return brandContext(db);
}

export async function listingHasAnnouncement(listingId: string) {
  const l = await db.query.listings.findFirst({ where: eq(listings.id, listingId), columns: { discordMessageId: true } });
  return !!l?.discordMessageId;
}

/** Keep Discord roles in step with the site (role change, deactivation, joining the team, a closed deal). */
export async function syncDiscordRoles(userIds: string[]): Promise<void> {
  const deps = await discordDeps(db);
  if (!deps) return;
  const { discordEnv } = await import('@/discord/config');
  const env = discordEnv();
  if (!env.ok) return;
  const { syncUser } = await import('@/discord/roles');
  for (const id of new Set(userIds)) {
    await syncUser(db, { rest: deps.rest, guildId: env.value.guildId, id: deps.id }, id).catch((e) => console.error('[discord] role sync failed', e));
  }
}

/** Users behind the clients on a deal, for the Client role once it closes. */
export async function dealPartyUserIds(dealId: string): Promise<string[]> {
  const { clients, dealParties } = await import('@/db/schema');
  const rows = await db.select({ userId: clients.userId }).from(dealParties).innerJoin(clients, eq(clients.id, dealParties.clientId)).where(eq(dealParties.dealId, dealId));
  return rows.map((r) => r.userId).filter((x): x is string => !!x);
}

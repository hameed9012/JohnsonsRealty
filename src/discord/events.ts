import 'server-only';
// Website events → Discord. Called after the database work has committed. A failed post never blocks the
// website action: it is stored in discord_outbox (Retry in the portal), noted in #bot-log and the activity log.
// When the bot isn't configured, or the channel was never created, the phase 1 webhook path is used instead.
import { eq } from 'drizzle-orm';
import type { APIMessage } from 'discord-api-types/v10';
import type { Executor } from '@/db/client';
import { announcements, discordOutbox, listings, openHouses } from '@/db/schema';
import { postWebhook, type WebhookEvent, type WebhookMessage } from '@/lib/discord';
import { publicImageUrl } from '@/lib/storage';
import { audit } from '@/server/audit';
import type { ListingBundle } from '@/server/listings/bundle';
import { agentName, coverOf, publicTitle } from '@/server/listings/present';
import { author, EMBED_COLOR, type BrandContext } from './brand';
import { brandContext, configId, discordEnv } from './config';
import type { DiscordMessage, ListingEmbedData } from './embeds';
import { discordRest, type DiscordRest } from './rest';

/** Where the message lives after posting, so later changes edit it. */
export type Remember = { listingId: string } | { announcementId: string } | { openHouseId: string };

export interface DiscordJob {
  event: string;
  /** Blueprint channel key, e.g. "new-listings". */
  channel: string;
  message: DiscordMessage;
  /** Edit this message instead of posting a new one. */
  edit?: { channelId: string; messageId: string } | null;
  remember?: Remember;
  /** Phase 1 webhook used when the bot can't post. */
  fallback?: { event: WebhookEvent; message: WebhookMessage };
}

export interface DiscordDeps {
  rest: DiscordRest;
  brand: BrandContext;
  id: (key: string) => Promise<string | null>;
}

/** The bot's REST client and brand, or null when the bot isn't configured. */
export async function discordDeps(ex: Executor): Promise<DiscordDeps | null> {
  const env = discordEnv();
  if (!env.ok) return null;
  return { rest: discordRest(env.value.token), brand: await brandContext(ex), id: (k) => configId(ex, k) };
}

async function rememberMessage(ex: Executor, r: Remember, channelId: string, messageId: string) {
  if ('listingId' in r) await ex.update(listings).set({ discordMessageId: messageId, discordChannelId: channelId }).where(eq(listings.id, r.listingId));
  else if ('announcementId' in r) await ex.update(announcements).set({ discordMessageId: messageId }).where(eq(announcements.id, r.announcementId));
  else await ex.update(openHouses).set({ discordMessageId: messageId }).where(eq(openHouses.id, r.openHouseId));
}

export type SendResult = 'sent' | 'webhook' | 'skipped' | 'failed';

/** Posts (or edits) one message. Returns how it went; failures are recorded, never thrown. */
export async function sendToDiscord(ex: Executor, job: DiscordJob, deps?: DiscordDeps | null, opts: { fromOutbox?: string } = {}): Promise<SendResult> {
  const d = deps === undefined ? await discordDeps(ex) : deps;
  const channelId = d ? (job.edit?.channelId ?? (await d.id(`channel:${job.channel}`))) : null;
  if (!d || !channelId) {
    if (job.fallback && !job.edit) return (await postWebhook(job.fallback.event, job.fallback.message)) === 'sent' ? 'webhook' : 'skipped';
    return 'skipped';
  }
  try {
    const m = job.edit
      ? await d.rest.patch<APIMessage>(`/channels/${job.edit.channelId}/messages/${job.edit.messageId}`, job.message)
      : await d.rest.post<APIMessage>(`/channels/${channelId}/messages`, job.message);
    if (job.remember && !job.edit) await rememberMessage(ex, job.remember, channelId, m.id);
    if (opts.fromOutbox) await ex.delete(discordOutbox).where(eq(discordOutbox.id, opts.fromOutbox));
    return 'sent';
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error(`[discord] ${job.event} failed`, error);
    if (opts.fromOutbox) {
      const row = await ex.query.discordOutbox.findFirst({ where: eq(discordOutbox.id, opts.fromOutbox) });
      await ex.update(discordOutbox).set({ attempts: (row?.attempts ?? 1) + 1, error }).where(eq(discordOutbox.id, opts.fromOutbox));
    } else {
      await ex.insert(discordOutbox).values({ event: job.event, payload: job as unknown as Record<string, unknown>, error });
    }
    await audit(ex, { actorId: null, action: 'discord.failed', entity: 'discord', summary: `Discord post failed (${job.event}): ${error.slice(0, 200)}` });
    const log = await d.id('channel:bot-log');
    if (log) {
      await d.rest
        .post(`/channels/${log}/messages`, { embeds: [{ author: author(d.brand), color: EMBED_COLOR.danger(), title: `Post failed · ${job.event}`, description: error.slice(0, 1000), footer: { text: 'Retry it from Portal → Site settings → Discord server' } }] })
        .catch(() => undefined);
    }
    return 'failed';
  }
}

/** Retry a stored failure. */
export async function retryOutbox(ex: Executor, id: string): Promise<SendResult> {
  const row = await ex.query.discordOutbox.findFirst({ where: eq(discordOutbox.id, id) });
  if (!row) return 'skipped';
  return sendToDiscord(ex, row.payload as unknown as DiscordJob, undefined, { fromOutbox: id });
}

// ---- Building embed data from the database ----

export function listingKind(b: Pick<ListingBundle, 'type' | 'purpose'>): ListingEmbedData['kind'] {
  return b.type === 'business' ? 'business' : b.purpose === 'rent' ? 'rent' : 'sale';
}

export const LISTING_CHANNEL: Record<ListingEmbedData['kind'], string> = { sale: 'new-listings', rent: 'for-rent', business: 'businesses-for-sale' };

/** Public fields only: a withheld business name never leaves the server. */
export function listingEmbedData(b: ListingBundle): ListingEmbedData {
  const cover = coverOf(b);
  return {
    kind: listingKind(b),
    title: publicTitle(b),
    slug: b.slug,
    description: b.description,
    coverUrl: cover ? publicImageUrl(cover.media.storageId, { width: 1200 }) : null,
    price: b.price,
    beds: b.beds,
    baths: b.baths,
    areaName: b.area?.name ?? null,
    postal: (b as ListingBundle & { postal?: string | null }).postal ?? null,
    agentName: b.source === 'owner_submitted' ? null : agentName(b),
    refNo: b.refNo,
    businessType: b.business?.businessType ?? null,
  };
}

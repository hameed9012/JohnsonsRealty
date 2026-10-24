'use server';

import { readFile } from 'node:fs/promises';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/db/client';
import { announcements, listings, openHouses } from '@/db/schema';
import { SERVER } from '@/discord/blueprint';
import { brandContext, configId, dbConfigStore, discordEnv } from '@/discord/config';
import { retryOutbox } from '@/discord/events';
import { discordRest, DiscordApiError } from '@/discord/rest';
import { syncAll } from '@/discord/roles';
import { runSetup, type SetupReport } from '@/discord/setup';
import { fieldErrors } from '@/lib/action-result';
import { isPublic, type ListingStatus } from '@/lib/listing-status';
import { can } from '@/lib/permissions';
import { audit } from '@/server/audit';
import { postAnnouncement, postListing, postOpenHouse } from '@/server/discord-posts';
import { actorOrThrow } from '@/server/session';

export type SetupResult = { ok: true; report: SetupReport } | { ok: false; message: string };
export type SimpleResult = { ok: boolean; message: string; fieldErrors?: Record<string, string> };

const manager = (a: { role: string }) => a.role === 'owner' || a.role === 'admin';

/** The server icon: the logo file in the repo, or the copy the site serves when the file isn't bundled. */
async function icon(site: string): Promise<Uint8Array | null> {
  try {
    return await readFile(SERVER.iconFile);
  } catch {
    const r = await fetch(`${site}/brand/jr-avatar-green.png`).catch(() => null);
    return r?.ok ? new Uint8Array(await r.arrayBuffer()) : null;
  }
}

/** Owner only. Runs the blueprint setup against the server, or a dry run that only reports. */
export async function runDiscordSetupAction(dryRun: boolean): Promise<SetupResult> {
  const actor = await actorOrThrow();
  if (!can(actor, 'settings.manage')) return { ok: false, message: 'Only the Owner can set up the Discord server.' };
  const env = discordEnv();
  if (!env.ok) return { ok: false, message: `Add these environment variables first: ${env.missing.join(', ')}.` };
  try {
    const brand = await brandContext(db);
    const report = await runSetup({ rest: discordRest(env.value.token), store: dbConfigStore(db), guildId: env.value.guildId, brand, dryRun, icon: await icon(brand.site), appId: env.value.appId });
    if (!dryRun) await audit(db, { actorId: actor.id, action: 'discord.setup', entity: 'discord', summary: `Ran Discord server setup (${report.changes.length} changes)`, diff: { changes: report.changes, manual: report.manual } });
    return { ok: true, report };
  } catch (e) {
    console.error(e);
    if (e instanceof DiscordApiError && (e.status === 401 || e.status === 403)) {
      return { ok: false, message: e.status === 401 ? 'Discord rejected the bot token. Check DISCORD_BOT_TOKEN.' : 'The bot is missing a permission or isn’t in the server. Invite it with the link on this page.' };
    }
    if (e instanceof DiscordApiError && e.status === 404) return { ok: false, message: 'Discord couldn’t find that server. Check DISCORD_GUILD_ID and that the bot has joined it.' };
    return { ok: false, message: e instanceof Error ? e.message : 'Setup failed. Try again.' };
  }
}

export async function retryDiscordPostAction(outboxId: string): Promise<SimpleResult> {
  const actor = await actorOrThrow();
  if (!manager(actor)) return { ok: false, message: 'Only the Owner or an Admin can retry posts.' };
  const r = await retryOutbox(db, outboxId);
  revalidatePath('/portal/settings/discord');
  if (r === 'sent') return { ok: true, message: 'Posted to Discord' };
  return { ok: false, message: r === 'skipped' ? 'The bot isn’t set up, so nothing was sent.' : 'Discord refused it again. See #bot-log for why.' };
}

export async function syncRolesAction(): Promise<SimpleResult> {
  const actor = await actorOrThrow();
  if (!can(actor, 'settings.manage')) return { ok: false, message: 'Only the Owner can run a full role sync.' };
  const env = discordEnv();
  if (!env.ok) return { ok: false, message: `Add these environment variables first: ${env.missing.join(', ')}.` };
  try {
    const t = await syncAll(db, { rest: discordRest(env.value.token), guildId: env.value.guildId, id: (k) => configId(db, k) });
    if (t['not-set-up']) return { ok: false, message: 'Run the server setup first, so the roles exist.' };
    await audit(db, { actorId: actor.id, action: 'discord.sync', entity: 'discord', summary: `Synced Discord roles (${t.updated} updated)` });
    return { ok: true, message: `${t.updated} updated, ${t.unchanged} already right, ${t['not-in-server']} not in the server` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Role sync failed.' };
  }
}

/** "Post to Discord" on a listing: for imported listings, or to announce one again. */
export async function postListingToDiscordAction(listingId: string): Promise<SimpleResult> {
  const actor = await actorOrThrow();
  if (!manager(actor)) return { ok: false, message: 'Only the Owner or an Admin can announce listings.' };
  const l = await db.query.listings.findFirst({ where: eq(listings.id, listingId), columns: { status: true, addressLine: true } });
  if (!l || !isPublic(l.status as ListingStatus)) return { ok: false, message: 'Only listings on the public site can be announced.' };
  const r = await postListing(listingId);
  await audit(db, { actorId: actor.id, action: 'discord.post', entity: 'listing', entityId: listingId, summary: `Posted ${l.addressLine || 'a listing'} to Discord` });
  revalidatePath(`/portal/listings/${listingId}`);
  if (r === 'sent' || r === 'webhook') return { ok: true, message: 'Posted to Discord' };
  return { ok: false, message: r === 'skipped' ? 'The bot isn’t set up, so nothing was sent.' : 'Discord refused the post. It’s saved under Failed posts to retry.' };
}

const announcementSchema = z.object({
  title: z.string().trim().min(1, 'Add a title.').max(200),
  body: z.string().trim().min(1, 'Write the announcement.').max(3500),
  pingRole: z.boolean().default(true),
});

export async function publishAnnouncementAction(input: unknown): Promise<SimpleResult> {
  const actor = await actorOrThrow();
  if (!manager(actor)) return { ok: false, message: 'Only the Owner or an Admin can publish announcements.' };
  const p = announcementSchema.safeParse(input);
  if (!p.success) return { ok: false, message: 'Check the highlighted fields.', fieldErrors: fieldErrors(p.error) };
  const [a] = await db.insert(announcements).values({ ...p.data, publishedAt: new Date(), createdBy: actor.id }).returning({ id: announcements.id });
  await audit(db, { actorId: actor.id, action: 'announcement.publish', entity: 'announcement', entityId: a!.id, summary: `Published announcement "${p.data.title}"` });
  const r = await postAnnouncement(a!.id);
  revalidatePath('/portal/announcements');
  if (r === 'sent') return { ok: true, message: 'Published to #announcements' };
  return { ok: true, message: r === 'skipped' ? 'Saved. The bot isn’t set up, so it wasn’t posted.' : 'Saved, but Discord refused the post. Retry it from the Discord page.' };
}

const openHouseSchema = z
  .object({
    listingId: z.uuid(),
    startsAt: z.string().min(1, 'Choose when it starts.'),
    endsAt: z.string().min(1, 'Choose when it ends.'),
    notes: z.string().trim().max(500).optional(),
  })
  .refine((v) => new Date(v.endsAt) > new Date(v.startsAt), { path: ['endsAt'], message: 'It has to end after it starts.' });

async function listingYouManage(actor: Awaited<ReturnType<typeof actorOrThrow>>, listingId: string) {
  const l = await db.query.listings.findFirst({ where: eq(listings.id, listingId) });
  if (!l || !can(actor, 'listing.changeStatus', { source: l.source, status: l.status, listingAgentId: l.listingAgentId, submittedByUserId: l.submittedByUserId })) return null;
  return l;
}

export async function createOpenHouseAction(input: unknown): Promise<SimpleResult> {
  const actor = await actorOrThrow();
  const p = openHouseSchema.safeParse(input);
  if (!p.success) return { ok: false, message: 'Check the highlighted fields.', fieldErrors: fieldErrors(p.error) };
  const l = await listingYouManage(actor, p.data.listingId);
  if (!l) return { ok: false, message: 'You can’t schedule an open house on this listing.' };
  if (!isPublic(l.status as ListingStatus)) return { ok: false, message: 'Open houses are for listings on the public site.' };
  const [oh] = await db
    .insert(openHouses)
    .values({ listingId: l.id, startsAt: new Date(p.data.startsAt), endsAt: new Date(p.data.endsAt), notes: p.data.notes || null, createdBy: actor.id })
    .returning({ id: openHouses.id });
  await audit(db, { actorId: actor.id, action: 'openhouse.create', entity: 'listing', entityId: l.id, summary: `Scheduled an open house at ${l.addressLine || l.refNo}` });
  const r = await postOpenHouse(oh!.id);
  revalidatePath(`/portal/listings/${l.id}`);
  revalidatePath(`/property/${l.slug}`);
  return { ok: true, message: r === 'sent' ? 'Open house scheduled and posted to #open-houses' : 'Open house scheduled' };
}

export async function cancelOpenHouseAction(id: string): Promise<SimpleResult> {
  const actor = await actorOrThrow();
  const oh = await db.query.openHouses.findFirst({ where: eq(openHouses.id, id) });
  if (!oh) return { ok: false, message: 'That open house no longer exists.' };
  const l = await listingYouManage(actor, oh.listingId);
  if (!l) return { ok: false, message: 'You can’t change this open house.' };
  await db.update(openHouses).set({ cancelled: true }).where(eq(openHouses.id, id));
  await audit(db, { actorId: actor.id, action: 'openhouse.cancel', entity: 'listing', entityId: l.id, summary: `Cancelled the open house at ${l.addressLine || l.refNo}` });
  await postOpenHouse(id);
  revalidatePath(`/portal/listings/${l.id}`);
  revalidatePath(`/property/${l.slug}`);
  return { ok: true, message: 'Open house cancelled' };
}

'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath, revalidateTag } from 'next/cache';
import { after } from 'next/server';
import { db } from '@/db/client';
import { listings } from '@/db/schema';
import { formObject } from '@/lib/action-result';
import { siteUrl } from '@/lib/discord';
import { saleNo } from '@/lib/format';
import { isPublic, TransitionError, type ListingStatus } from '@/lib/listing-status';
import { ServiceError } from '@/server/listings/service';
import * as clientsOps from '@/server/ops/clients';
import * as dealOps from '@/server/ops/deals';
import * as inbox from '@/server/ops/inbox';
import * as invites from '@/server/ops/invites';
import * as listingOps from '@/server/ops/listings';
import * as showingOps from '@/server/ops/showings';
import { actorOrThrow, ForbiddenError } from '@/server/session';
import { getSettings } from '@/server/settings';
import { updatePropertyMapMessage } from '@/server/map/discord';
import { dealPartyUserIds, markListingUnavailable, postDealStage, postPriceReduced, postSale, syncDiscordRoles } from '@/server/discord-posts';

export type OpResult<T = undefined> = { ok: true; message?: string; data?: T } | { ok: false; message?: string; fieldErrors?: Record<string, string> };

function fail(e: unknown): { ok: false; message?: string; fieldErrors?: Record<string, string> } {
  if (e instanceof ServiceError) return { ok: false, message: e.message, fieldErrors: e.fieldErrors };
  if (e instanceof ForbiddenError || e instanceof TransitionError) return { ok: false, message: e.message };
  console.error(e);
  return { ok: false, message: 'Something went wrong. Try again.' };
}

async function run<T>(fn: () => Promise<T>, message?: string, paths: string[] = []): Promise<OpResult<T>> {
  try {
    const data = await fn();
    for (const p of paths) revalidatePath(p);
    revalidatePath('/portal', 'layout');
    return { ok: true, message, data };
  } catch (e) {
    return fail(e);
  }
}

// ---------- Listings ----------

const OFF_MARKET: ListingStatus[] = ['withdrawn', 'archived', 'off_market'];

export async function setListingStatus(id: string, to: ListingStatus) {
  const actor = await actorOrThrow();
  const r = await run(() => db.transaction((tx) => listingOps.changeListingStatus(tx, actor, id, to)), 'Status updated', ['/portal/listings']);
  revalidateTag('listings', 'max');
  if (r.ok && OFF_MARKET.includes(to)) after(() => markListingUnavailable(id));
  if (r.ok) after(() => updatePropertyMapMessage(db).then(() => undefined));
  return r;
}

export async function bulkListingStatus(ids: string[], to: ListingStatus) {
  const actor = await actorOrThrow();
  const r = await run(() => listingOps.bulkStatus(db, actor, ids, to));
  revalidateTag('listings', 'max');
  if (r.ok && r.data && OFF_MARKET.includes(to)) for (const done of r.data.done) after(() => markListingUnavailable(done));
  if (r.ok && r.data) return { ...r, message: r.data.failed.length ? `${r.data.done.length} updated, ${r.data.failed.length} couldn’t change` : `${r.data.done.length} updated` };
  return r;
}

export async function setListingPrice(id: string, price: string) {
  const actor = await actorOrThrow();
  const r = await run(() => db.transaction((tx) => listingOps.changePrice(tx, actor, id, { price })), 'Price updated', ['/portal/listings']);
  // A cut on a live listing is announced in #new-listings with the old price struck through.
  if (r.ok && r.data?.previousPrice && r.data.price && r.data.price < r.data.previousPrice && isPublic(r.data.status as ListingStatus)) {
    const old = r.data.previousPrice;
    after(() => postPriceReduced(id, old));
  }
  return { ...r, data: undefined };
}

export async function setListingPin(id: string, pin: { x: number; y: number } | null) {
  const actor = await actorOrThrow();
  const r = await run(() => db.transaction((tx) => listingOps.placePin(tx, actor, id, pin)), pin ? 'Pin placed' : 'Pin removed', [`/portal/listings/${id}`]);
  revalidateTag('listings', 'max');
  return r;
}

export async function saveLiveEdit(id: string, values: Record<string, string>) {
  const actor = await actorOrThrow();
  const settings = await getSettings();
  const r = await run(() => db.transaction((tx) => listingOps.liveEdit(tx, actor, settings, id, values)));
  if (r.ok && r.data) return { ...r, message: r.data.applied ? 'Listing updated' : 'Edit sent for review. The live listing stays as it is until it’s approved.' };
  return r;
}

export async function decideRevisionAction(revisionId: string, approve: boolean, notes: string) {
  const actor = await actorOrThrow();
  const settings = await getSettings();
  return run(() => db.transaction((tx) => listingOps.decideRevision(tx, actor, settings, revisionId, approve, notes.trim() || null)), approve ? 'Edit approved' : 'Edit declined', ['/portal/review']);
}

// ---------- Clients ----------

export async function saveClientAction(id: string | null, values: unknown) {
  const actor = await actorOrThrow();
  return run(() => db.transaction((tx) => clientsOps.saveClientFile(tx, actor, id, values)), 'Client file saved', ['/portal/clients']);
}

export async function archiveClientAction(id: string, archived: boolean) {
  const actor = await actorOrThrow();
  return run(() => db.transaction((tx) => clientsOps.archiveClient(tx, actor, id, archived)), archived ? 'Client file archived' : 'Client file restored', ['/portal/clients']);
}

// ---------- Deals ----------

export async function createDealAction(input: { listingId: string; clientId: string; side: string }) {
  const actor = await actorOrThrow();
  return run(async () => (await db.transaction((tx) => dealOps.createDeal(tx, actor, input))).id, 'Deal opened', ['/portal/deals']);
}

export async function updateDealAction(id: string, fd: FormData) {
  const actor = await actorOrThrow();
  return run(() => db.transaction((tx) => dealOps.updateDealDetails(tx, actor, id, formObject(fd))).then(() => undefined), 'Deal saved', [`/portal/deals/${id}`, `/account/deal/${id}`]);
}

export async function addOfferAction(id: string, fd: FormData) {
  const actor = await actorOrThrow();
  return run(() => db.transaction((tx) => dealOps.addOffer(tx, actor, id, formObject(fd))), 'Offer logged', [`/portal/deals/${id}`]);
}

export async function moveDealStage(id: string, to: (typeof dealOps.STAGE_WORDS extends Record<infer K, string> ? K : never) & string) {
  const actor = await actorOrThrow();
  const r = await run(() => db.transaction((tx) => dealOps.changeDealStage(tx, actor, id, to as never)), `Moved to ${dealOps.STAGE_WORDS[to as keyof typeof dealOps.STAGE_WORDS]}`, ['/portal/deals', `/portal/deals/${id}`, `/account/deal/${id}`]);
  if (r.ok && r.data) {
    revalidateTag('listings', 'max');
    const { listing, from, to: toKey } = r.data;
    after(() => postDealStage(id, listing.id, dealOps.STAGE_WORDS[from], dealOps.STAGE_WORDS[toKey], toKey));
    return { ok: true as const, message: r.message };
  }
  return r;
}

export async function recordSaleAction(id: string, input: unknown) {
  const actor = await actorOrThrow();
  const r = await run(() => dealOps.recordSale(db, actor, id, input), undefined, ['/portal/deals', '/portal/sales', '/portal/commission', '/sold', `/portal/deals/${id}`]);
  if (r.ok && r.data) {
    revalidateTag('listings', 'max');
    const { listing, saleNo: no, price } = r.data;
    after(() => postSale(listing.id, no, price));
    after(async () => syncDiscordRoles(await dealPartyUserIds(id)));
    return { ok: true as const, message: `${saleNo(r.data.saleNo)} recorded`, data: r.data.saleNo };
  }
  return r;
}

// ---------- Showings ----------

export async function staffShowingAction(id: string, action: showingOps.StaffShowingAction, atIso?: string) {
  const actor = await actorOrThrow();
  const words = { confirm: 'Showing confirmed', complete: 'Marked as done', no_show: 'Marked as a no-show', cancel: 'Showing cancelled' };
  return run(() => db.transaction((tx) => showingOps.updateShowing(tx, actor, id, action, atIso ? new Date(atIso) : null)).then(() => undefined), words[action], ['/portal/showings']);
}

// ---------- Inbox ----------

export async function setEnquiryStatusAction(id: string, status: inbox.EnquiryStatus) {
  const actor = await actorOrThrow();
  return run(() => db.transaction((tx) => inbox.setEnquiryStatus(tx, actor, id, status)), 'Status updated', ['/portal/inbox', `/portal/inbox/${id}`]);
}

export async function assignEnquiryAction(id: string, assigneeId: string) {
  const actor = await actorOrThrow();
  return run(() => db.transaction((tx) => inbox.assignEnquiry(tx, actor, id, assigneeId || null)), assigneeId ? 'Assigned' : 'Unassigned', ['/portal/inbox', `/portal/inbox/${id}`]);
}

export async function replyEnquiryAction(id: string, fd: FormData) {
  const actor = await actorOrThrow();
  const internal = fd.get('internal') === 'on';
  return run(() => db.transaction((tx) => inbox.replyToEnquiry(tx, actor, id, formObject(fd))), internal ? 'Note added' : 'Reply sent', [`/portal/inbox/${id}`]);
}

// ---------- Invites ----------

export async function createInviteAction(input: { role: 'admin' | 'agent'; note?: string; days?: number }): Promise<OpResult<{ url: string; expiresAt: string }>> {
  try {
    const actor = await actorOrThrow();
    const r = await db.transaction((tx) => invites.createInvite(tx, actor, input));
    revalidatePath('/portal/team');
    return { ok: true, message: 'Invite link created', data: { url: siteUrl(`/invite/${r.token}`), expiresAt: r.expiresAt.toISOString() } };
  } catch (e) {
    return fail(e);
  }
}

export async function revokeInviteAction(id: string) {
  const actor = await actorOrThrow();
  return run(() => db.transaction((tx) => invites.revokeInvite(tx, actor, id)), 'Invite revoked', ['/portal/team']);
}

export async function acceptInviteAction(token: string) {
  const actor = await actorOrThrow();
  const r = await run(() => db.transaction((tx) => invites.acceptInvite(tx, actor.id, token)), 'Welcome to the team');
  if (r.ok) after(() => syncDiscordRoles([actor.id]));
  return r;
}

export async function listingSlug(id: string) {
  return (await db.query.listings.findFirst({ where: eq(listings.id, id), columns: { slug: true } }))?.slug ?? null;
}

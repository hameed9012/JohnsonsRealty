import 'server-only';
import { and, eq, inArray } from 'drizzle-orm';
import type { DB, Executor } from '@/db/client';
import { listingRevisions, listings, priceHistory } from '@/db/schema';
import { fieldErrors } from '@/lib/action-result';
import { assertTransition, label, type ListingStatus } from '@/lib/listing-status';
import { can, type Actor, type PermissionSettings } from '@/lib/permissions';
import { liveEditSchema, priceChangeSchema } from '@/lib/schemas/ops';
import { audit, diffOf } from '@/server/audit';
import { notifyUsers, reviewerIds } from '@/server/notify';
import { ServiceError } from '@/server/listings/service';

type Listing = typeof listings.$inferSelect;

const subject = (l: Listing) => ({ source: l.source, status: l.status, listingAgentId: l.listingAgentId, submittedByUserId: l.submittedByUserId });
const isManager = (a: Actor) => a.role === 'owner' || a.role === 'admin';

/** Statuses staff can set by hand. Review decisions, sales and leases have their own flows. */
export const MANUAL_STATUSES: ListingStatus[] = ['active', 'for_lease', 'coming_soon', 'under_offer', 'under_contract', 'off_market', 'withdrawn', 'archived'];

async function get(ex: Executor, id: string) {
  const l = await ex.query.listings.findFirst({ where: eq(listings.id, id) });
  if (!l) throw new ServiceError('That listing doesn’t exist.');
  return l;
}

export async function changeListingStatus(ex: Executor, actor: Actor, id: string, to: ListingStatus) {
  const l = await get(ex, id);
  if (!can(actor, 'listing.changeStatus', subject(l))) throw new ServiceError('You can’t change this listing.');
  if (!MANUAL_STATUSES.includes(to)) throw new ServiceError(`Use the ${to === 'sold' || to === 'leased' ? 'record a sale' : 'review'} flow for that.`);
  if (l.status === to) return l;
  assertTransition(l.status as ListingStatus, to, l.purpose);
  const patch: Partial<Listing> = { status: to };
  if (to === 'withdrawn') patch.withdrawnAt = new Date();
  await ex.update(listings).set(patch).where(eq(listings.id, id));
  await audit(ex, { actorId: actor.id, action: 'listing.status', entity: 'listing', entityId: id, summary: `Moved ${l.refNo} from ${label(l.status as ListingStatus)} to ${label(to)}`, diff: { status: { from: l.status, to } } });
  return { ...l, ...patch };
}

/** Bulk status change: each listing is checked on its own; failures are reported, not fatal. */
export async function bulkStatus(db: DB, actor: Actor, ids: string[], to: ListingStatus) {
  const done: string[] = [];
  const failed: { id: string; reason: string }[] = [];
  for (const id of ids.slice(0, 200)) {
    try {
      await db.transaction((tx) => changeListingStatus(tx, actor, id, to));
      done.push(id);
    } catch (e) {
      failed.push({ id, reason: e instanceof Error ? e.message : 'Failed' });
    }
  }
  return { done, failed };
}

/** Price changes on a live listing are always immediate and always land in price history. */
export async function changePrice(ex: Executor, actor: Actor, id: string, input: unknown) {
  const l = await get(ex, id);
  if (!can(actor, 'listing.changeStatus', subject(l))) throw new ServiceError('You can’t change this listing.');
  const p = priceChangeSchema.safeParse(input);
  if (!p.success) throw new ServiceError('Check the price.', fieldErrors(p.error));
  const price = p.data.price!;
  if (l.price === price) return l;
  const event = l.price && price < l.price ? 'reduced' : 'increased';
  await ex.update(listings).set({ price, previousPrice: l.price }).where(eq(listings.id, id));
  await ex.insert(priceHistory).values({ listingId: id, price, event });
  await audit(ex, { actorId: actor.id, action: 'listing.price', entity: 'listing', entityId: id, summary: `${event === 'reduced' ? 'Reduced' : 'Raised'} ${l.refNo} to $${price.toLocaleString('en-US')}`, diff: { price: { from: l.price, to: price } } });
  return { ...l, price, previousPrice: l.price };
}

export type LiveEditResult = { applied: true } | { applied: false; revisionId: string };

/**
 * Material edits to a live listing. Managers apply them straight away. When "live edits need review" is on,
 * an agent's edit becomes a pending revision and the public listing stays unchanged until it's approved.
 */
export async function liveEdit(ex: Executor, actor: Actor, settings: PermissionSettings & { liveEditsNeedReview: boolean }, id: string, input: unknown): Promise<LiveEditResult> {
  const l = await get(ex, id);
  if (!can(actor, 'listing.changeStatus', subject(l))) throw new ServiceError('You can’t edit this listing.');
  const p = liveEditSchema.safeParse(input);
  if (!p.success) throw new ServiceError('Check the highlighted fields.', fieldErrors(p.error));
  const changes = diffOf(l as unknown as Record<string, unknown>, p.data as Record<string, unknown>);
  if (!Object.keys(changes).length) return { applied: true };
  if (settings.liveEditsNeedReview && !isManager(actor)) {
    const open = await ex.query.listingRevisions.findFirst({ where: and(eq(listingRevisions.listingId, id), eq(listingRevisions.status, 'pending')) });
    if (open) throw new ServiceError('There’s already an edit waiting for review on this listing.');
    const [r] = await ex.insert(listingRevisions).values({ listingId: id, changes: p.data, submittedBy: actor.id }).returning({ id: listingRevisions.id });
    await audit(ex, { actorId: actor.id, action: 'listing.revision', entity: 'listing', entityId: id, summary: `Submitted an edit to ${l.refNo} for review`, diff: changes });
    await notifyUsers(ex, (await reviewerIds(ex, settings.adminsCanApprove)).filter((u) => u !== actor.id), {
      kind: 'revision.pending',
      title: 'Edit waiting for review',
      body: `${l.addressLine || l.refNo}: ${Object.keys(changes).join(', ')}`,
      link: `/portal/review/revisions/${r!.id}`,
    });
    return { applied: false, revisionId: r!.id };
  }
  await ex.update(listings).set(p.data).where(eq(listings.id, id));
  await audit(ex, { actorId: actor.id, action: 'listing.update', entity: 'listing', entityId: id, summary: `Edited live listing ${l.refNo}`, diff: changes });
  return { applied: true };
}

export async function decideRevision(ex: Executor, actor: Actor, settings: PermissionSettings, revisionId: string, approve: boolean, notes: string | null) {
  if (!can(actor, 'listing.approve', undefined, settings)) throw new ServiceError('Only the Owner can review edits.');
  const r = await ex.query.listingRevisions.findFirst({ where: and(eq(listingRevisions.id, revisionId), eq(listingRevisions.status, 'pending')) });
  if (!r) throw new ServiceError('That edit isn’t waiting for review any more.');
  if (!approve && !notes?.trim()) throw new ServiceError('Check the notes.', { notes: 'Add a note so the agent knows why.' });
  const l = await get(ex, r.listingId);
  if (approve) {
    const p = liveEditSchema.parse(r.changes);
    await ex.update(listings).set(p).where(eq(listings.id, r.listingId));
  }
  await ex.update(listingRevisions).set({ status: approve ? 'approved' : 'rejected', reviewerId: actor.id, notes, decidedAt: new Date() }).where(eq(listingRevisions.id, revisionId));
  await audit(ex, { actorId: actor.id, action: approve ? 'listing.revision.approved' : 'listing.revision.rejected', entity: 'listing', entityId: r.listingId, summary: `${approve ? 'Approved' : 'Declined'} an edit to ${l.refNo}` });
  if (r.submittedBy && r.submittedBy !== actor.id) {
    await notifyUsers(ex, [r.submittedBy], {
      kind: 'revision.decided',
      title: approve ? 'Edit approved' : 'Edit not approved',
      body: `${l.addressLine || l.refNo}${notes ? ': ' + notes : ''}`,
      link: `/portal/listings/${l.id}`,
    });
  }
  return { listing: l, approved: approve };
}

export async function pendingRevisions(ex: Executor) {
  return ex.query.listingRevisions.findMany({ where: inArray(listingRevisions.status, ['pending']), with: { listing: true } });
}

/** Places (or clears) the hand-placed pin on the brokerage map. x and y are percentages of the map image. */
export async function placePin(ex: Executor, actor: Actor, id: string, pin: { x: number; y: number } | null) {
  const l = await get(ex, id);
  if (!can(actor, 'listing.placePin') || !can(actor, 'listing.changeStatus', subject(l))) throw new ServiceError('You can’t place the pin on this listing.');
  if (pin && ![pin.x, pin.y].every((v) => Number.isFinite(v) && v >= 0 && v <= 100)) throw new ServiceError('Click inside the map to place the pin.');
  const values = pin ? { mapX: Math.round(pin.x * 100) / 100, mapY: Math.round(pin.y * 100) / 100 } : { mapX: null, mapY: null };
  await ex.update(listings).set(values).where(eq(listings.id, id));
  await audit(ex, { actorId: actor.id, action: pin ? 'listing.pin' : 'listing.unpin', entity: 'listing', entityId: id, summary: `${pin ? 'Placed' : 'Removed'} the map pin on ${l.addressLine || l.refNo}` });
}

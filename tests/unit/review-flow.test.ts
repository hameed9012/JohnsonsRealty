import { eq } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '@/db/client';
import { seedBase } from '@/db/seed-base';
import { activityLog, areas, clients, listingReviews, listings, notifications, priceHistory, users } from '@/db/schema';
import { checklist } from '@/lib/listing-checklist';
import type { Actor } from '@/lib/permissions';
import { checklistInput, diffSnapshots, loadBundle } from '@/server/listings/bundle';
import {
  addPhoto,
  createDraft,
  decideReview,
  saveOwnerDetails,
  saveProperty,
  saveSeller,
  saveTerms,
  ServiceError,
  submitForReview,
  updatePhotos,
  withdrawListing,
} from '@/server/listings/service';
import { resetDb, testDb } from './helpers/db';

const owner: Actor = { id: 'u-owner', role: 'owner', status: 'active' };
const admin: Actor = { id: 'u-admin', role: 'admin', status: 'active' };
const agent: Actor = { id: 'u-agent', role: 'agent', status: 'active' };
const client: Actor = { id: 'u-client', role: 'client', status: 'active' };
const settings = { adminsCanApprove: true };

let db: DB;
let fairview: string;

async function photo(id: string, actor: Actor, n: number) {
  return addPhoto(db, actor, id, { storageId: `/api/uploads/local/listings/${String(n).padStart(32, '0')}.jpg`, width: 2000, height: 1333 });
}

async function readyAgentListing() {
  const l = await createDraft(db, agent, 'agent');
  await saveProperty(db, agent, l.id, {
    type: 'house',
    purpose: 'sale',
    addressLine: 'Example Lane',
    areaId: fairview,
    beds: '3',
    baths: '2',
    sqft: '1,850',
    description: 'Example description that is long enough to pass the checklist rules.',
  });
  await saveTerms(db, agent, l.id, { price: '$365,000' });
  const photos = [await photo(l.id, agent, 1), await photo(l.id, agent, 2), await photo(l.id, agent, 3)];
  await updatePhotos(db, agent, l.id, {
    order: { order: photos.map((p) => p.id), coverId: photos[1]!.id },
    meta: photos.map((p, i) => ({ id: p.id, alt: `Example photo ${i + 1}`, caption: null })),
  });
  await saveSeller(db, agent, l.id, {
    clientId: null,
    client: { kind: 'person', displayName: 'Example Seller', people: [{ legalName: 'Example Seller', signs: true }] },
    clientConfidential: { motivation: 'Example motivation' },
    bottomLine: '350000',
    vesting: 'Sole owner',
  });
  return l;
}

beforeAll(async () => {
  db = await testDb();
});

beforeEach(async () => {
  await resetDb(db);
  await seedBase(db);
  await db.insert(users).values([
    { id: owner.id, role: 'owner', displayName: 'Example Owner' },
    { id: admin.id, role: 'admin', displayName: 'Example Admin' },
    { id: agent.id, role: 'agent', displayName: 'Example Agent' },
    { id: client.id, role: 'client', displayName: 'Example Client', robloxUsername: 'ExampleClient' },
  ]);
  fairview = (await db.query.areas.findFirst({ where: eq(areas.slug, 'fairview') }))!.id;
});

describe('agent submission', () => {
  it('blocks submission below 3 photos with the exact message', async () => {
    const l = await createDraft(db, agent, 'agent');
    await photo(l.id, agent, 1);
    await photo(l.id, agent, 2);
    const err = await submitForReview(db, agent, settings, l.id).catch((e) => e);
    expect(err).toBeInstanceOf(ServiceError);
    expect((err as ServiceError).checklist!.map((c) => c.message)).toContain('Add at least 3 photos. You have 2.');
  });

  it('rejects malformed numbers with house-style copy', async () => {
    const l = await createDraft(db, agent, 'agent');
    const err = (await saveTerms(db, agent, l.id, { price: 'three hundred' }).catch((e) => e)) as ServiceError;
    expect(err.fieldErrors).toEqual({ price: 'Enter a price in dollars, like 365000.' });
  });

  it('submits, notifies reviewers, then the Owner approves and it goes live', async () => {
    const l = await readyAgentListing();
    const b = (await loadBundle(db, l.id, { confidential: true }))!;
    expect(checklist(checklistInput(b))).toEqual([]);
    expect(b.photos.find((p) => p.isCover)!.alt).toBe('Example photo 2');
    expect(b.confidential?.bottomLine).toBe(350000);

    const res = await submitForReview(db, agent, settings, l.id);
    expect(res.refNo).toMatch(/^JR-\d{4}-\d{5}$/);
    expect(res.round).toBe(1);
    const pending = await db.query.listings.findFirst({ where: eq(listings.id, l.id) });
    expect(pending!.status).toBe('pending_review');
    const notes = await db.select().from(notifications);
    expect(new Set(notes.map((n) => n.userId))).toEqual(new Set([owner.id, admin.id]));

    await expect(decideReview(db, agent, settings, l.id, { decision: 'approved' })).rejects.toThrow('Only the Owner can review listings.');

    const done = await decideReview(db, owner, settings, l.id, { decision: 'approved' });
    expect(done.status).toBe('active');
    const live = await db.query.listings.findFirst({ where: eq(listings.id, l.id) });
    expect(live!.publishedAt).not.toBeNull();
    expect(live!.slug).toBe(`example-lane-fairview-${l.refNo.split('-')[2]}`);
    const ph = await db.select().from(priceHistory).where(eq(priceHistory.listingId, l.id));
    expect(ph.map((p) => [p.event, p.price])).toEqual([['listed', 365000]]);
    const review = await db.query.listingReviews.findFirst({ where: eq(listingReviews.listingId, l.id) });
    expect(review!.decision).toBe('approved');
    expect(review!.reviewerId).toBe(owner.id);
    const agentNote = await db.select().from(notifications).where(eq(notifications.userId, agent.id));
    expect(agentNote.map((n) => n.title)).toContain('Listing approved');
    const log = await db.select().from(activityLog).where(eq(activityLog.entityId, l.id));
    expect(log.map((x) => x.action)).toEqual(expect.arrayContaining(['listing.create', 'listing.submit', 'listing.review.approved']));
  });

  it('needs a note to request changes, then diffs the resubmission', async () => {
    const l = await readyAgentListing();
    await submitForReview(db, agent, settings, l.id);
    const err = (await decideReview(db, owner, settings, l.id, { decision: 'changes_requested', notes: '' }).catch((e) => e)) as ServiceError;
    expect(err.fieldErrors?.notes).toBe('Add a note so the submitter knows what to change.');

    await decideReview(db, owner, settings, l.id, { decision: 'changes_requested', notes: 'Add the lot size.' });
    expect((await db.query.listings.findFirst({ where: eq(listings.id, l.id) }))!.status).toBe('changes_requested');

    await saveProperty(db, agent, l.id, {
      type: 'house',
      purpose: 'sale',
      addressLine: 'Example Lane',
      areaId: fairview,
      beds: '3',
      baths: '2',
      sqft: '1850',
      lot: '0.22 acres',
      description: 'Example description that is long enough to pass the checklist rules.',
    });
    const r2 = await submitForReview(db, agent, settings, l.id);
    expect(r2.round).toBe(2);
    const rounds = await db.select().from(listingReviews).where(eq(listingReviews.listingId, l.id));
    const [a, b] = [rounds.find((r) => r.round === 1)!, rounds.find((r) => r.round === 2)!];
    expect(diffSnapshots(a.snapshot as Record<string, string>, b.snapshot as Record<string, string>)).toEqual([{ key: 'listing.lot', before: null, after: '0.22 acres' }]);
  });

  it('keeps confidential fields out of review snapshots', async () => {
    const l = await readyAgentListing();
    await submitForReview(db, agent, settings, l.id);
    const r = await db.query.listingReviews.findFirst({ where: eq(listingReviews.listingId, l.id) });
    expect(JSON.stringify(r!.snapshot)).not.toContain('350000');
    expect(JSON.stringify(r!.snapshot)).not.toContain('Example motivation');
  });

  it('rejects for good: the listing can’t be resubmitted', async () => {
    const l = await readyAgentListing();
    await submitForReview(db, agent, settings, l.id);
    await decideReview(db, owner, settings, l.id, { decision: 'rejected', notes: 'Not a fit.' });
    await expect(submitForReview(db, agent, settings, l.id)).rejects.toThrow();
  });

  it('Admins approve only when allowed', async () => {
    const l = await readyAgentListing();
    await submitForReview(db, agent, settings, l.id);
    await expect(decideReview(db, admin, { adminsCanApprove: false }, l.id, { decision: 'approved' })).rejects.toThrow();
    expect((await decideReview(db, admin, settings, l.id, { decision: 'approved' })).status).toBe('active');
  });

  it('other agents cannot edit someone else’s listing', async () => {
    const l = await createDraft(db, agent, 'agent');
    await expect(saveProperty(db, { id: 'x', role: 'agent', status: 'active' }, l.id, { type: 'house' })).rejects.toThrow('You can’t edit this listing.');
  });
});

describe('owner-submitted listing', () => {
  async function ownerListing(purpose: 'sale' | 'rent' = 'rent') {
    await db.insert(users).values({ id: 'u-agent2', role: 'agent', displayName: 'Example Agent Two' });
    const l = await createDraft(db, client, 'owner_submitted');
    await saveProperty(db, client, l.id, {
      type: purpose === 'rent' ? 'rental' : 'house',
      purpose,
      addressLine: 'Example Court',
      areaId: fairview,
      beds: '2',
      baths: '1',
      description: 'Example rental description that is long enough for the checklist.',
    });
    await saveTerms(db, client, l.id, { price: '1900', availableFrom: '2026-11-01', leaseLengthMonths: '12', deposit: '1900' });
    const ps = [await photo(l.id, client, 4), await photo(l.id, client, 5), await photo(l.id, client, 6)];
    await updatePhotos(db, client, l.id, { order: { order: ps.map((p) => p.id), coverId: null }, meta: ps.map((p) => ({ id: p.id, alt: 'Example room', caption: null })) });
    await saveOwnerDetails(db, client, l.id, { legalName: 'Example Client', ownerContact: { discord: true, roblox: true, chirper: false } });
    return l;
  }

  it('builds the client file from the account and goes to review like any other', async () => {
    const l = await ownerListing();
    const c = await db.query.clients.findFirst({ where: eq(clients.userId, client.id), with: { people: true } });
    expect(c!.roles).toEqual(['landlord']);
    expect(c!.people[0]!.robloxUsername).toBe('ExampleClient');
    await submitForReview(db, client, settings, l.id);
    await expect(saveProperty(db, client, l.id, { type: 'rental' })).rejects.toThrow('waiting for review');
    const res = await decideReview(db, owner, settings, l.id, { decision: 'approved', agentId: 'u-agent2' });
    expect(res.status).toBe('for_lease');
    const live = await db.query.listings.findFirst({ where: eq(listings.id, l.id) });
    expect(live!.source).toBe('owner_submitted');
    expect(live!.listingAgentId).toBe('u-agent2');
    const note = await db.select().from(notifications).where(eq(notifications.userId, client.id));
    expect(note[0]!.link).toBe(`/account/listings/${l.id}`);
  });

  it('lets the property owner edit after changes are requested, and withdraw', async () => {
    const l = await ownerListing();
    await submitForReview(db, client, settings, l.id);
    await decideReview(db, owner, settings, l.id, { decision: 'changes_requested', notes: 'Add a photo of the kitchen.' });
    await saveTerms(db, client, l.id, { price: '1850', availableFrom: '2026-11-01', leaseLengthMonths: '12', deposit: '1900' });
    await withdrawListing(db, client, l.id);
    expect((await db.query.listings.findFirst({ where: eq(listings.id, l.id) }))!.status).toBe('withdrawn');
  });

  it('never lets a property owner touch the agent-only seller step', async () => {
    const l = await createDraft(db, client, 'owner_submitted');
    await expect(saveSeller(db, client, l.id, { bottomLine: '1' })).rejects.toThrow('You can’t edit this part of the listing.');
  });
});

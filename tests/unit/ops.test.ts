import { eq } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '@/db/client';
import { seedBase } from '@/db/seed-base';
import { areas, clients, dealConfidential, deals, enquiries, enquiryReplies, listingRevisions, listings, notifications, priceHistory, saleCommissions, sales, showings, staffInvites, users } from '@/db/schema';
import type { Actor } from '@/lib/permissions';
import { addOffer, changeDealStage, createDeal, listingStatusFor, recordSale } from '@/server/ops/deals';
import { acceptInvite, createInvite } from '@/server/ops/invites';
import { assignEnquiry, replyToEnquiry } from '@/server/ops/inbox';
import { bulkStatus, changeListingStatus, changePrice, decideRevision, liveEdit, placePin } from '@/server/ops/listings';
import { saveClientFile } from '@/server/ops/clients';
import { updateShowing } from '@/server/ops/showings';
import { resetDb, testDb } from './helpers/db';

const owner: Actor = { id: 'o', role: 'owner', status: 'active' };
const admin: Actor = { id: 'ad', role: 'admin', status: 'active' };
const agent: Actor = { id: 'ag', role: 'agent', status: 'active' };
const agent2: Actor = { id: 'ag2', role: 'agent', status: 'active' };
const client: Actor = { id: 'c', role: 'client', status: 'active' };
const settings = { adminsCanApprove: true, liveEditsNeedReview: false };

let db: DB;
let listingId: string;
let buyerId: string;

beforeAll(async () => {
  db = await testDb();
});

beforeEach(async () => {
  await resetDb(db);
  await seedBase(db);
  await db.insert(users).values([
    { id: 'o', role: 'owner', displayName: 'Example Owner' },
    { id: 'ad', role: 'admin', displayName: 'Example Admin' },
    { id: 'ag', role: 'agent', displayName: 'Example Agent' },
    { id: 'ag2', role: 'agent', displayName: 'Example Agent Two' },
    { id: 'c', role: 'client', displayName: 'Example Buyer' },
  ]);
  const area = await db.query.areas.findFirst({ where: eq(areas.slug, 'fairview') });
  const [seller] = await db.insert(clients).values({ displayName: 'Example Seller', roles: ['seller'], agentId: 'ag' }).returning();
  const [l] = await db
    .insert(listings)
    .values({ refNo: 'JR-2026-00001', slug: 'example-lane', type: 'house', purpose: 'sale', source: 'agent', status: 'active', addressLine: 'Example Lane', areaId: area!.id, price: 365000, listingAgentId: 'ag', sellerClientId: seller!.id, publishedAt: new Date() })
    .returning();
  listingId = l!.id;
  const [b] = await db.insert(clients).values({ displayName: 'Example Buyer', roles: [], userId: 'c', agentId: 'ag' }).returning();
  buyerId = b!.id;
});

describe('listing operations', () => {
  it('changes status through the state machine only', async () => {
    await changeListingStatus(db, agent, listingId, 'under_offer');
    expect((await db.query.listings.findFirst({ where: eq(listings.id, listingId) }))!.status).toBe('under_offer');
    await expect(changeListingStatus(db, agent, listingId, 'sold')).rejects.toThrow('record a sale');
    await expect(changeListingStatus(db, agent2, listingId, 'active')).rejects.toThrow('You can’t change this listing.');
    await expect(changeListingStatus(db, agent, listingId, 'for_lease')).rejects.toThrow();
  });

  it('places and clears a hand-placed map pin, only for staff who manage the listing', async () => {
    await placePin(db, agent, listingId, { x: 12.345, y: 67.891 });
    let l = await db.query.listings.findFirst({ where: eq(listings.id, listingId) });
    expect([l!.mapX, l!.mapY]).toEqual([12.35, 67.89]);
    await expect(placePin(db, agent, listingId, { x: 120, y: 5 })).rejects.toThrow('Click inside the map');
    await expect(placePin(db, agent2, listingId, { x: 1, y: 1 })).rejects.toThrow('You can’t place the pin');
    await expect(placePin(db, client, listingId, { x: 1, y: 1 })).rejects.toThrow('You can’t place the pin');
    await placePin(db, owner, listingId, null);
    l = await db.query.listings.findFirst({ where: eq(listings.id, listingId) });
    expect([l!.mapX, l!.mapY]).toEqual([null, null]);
  });

  it('bulk changes report failures without stopping', async () => {
    const r = await bulkStatus(db, owner, [listingId, '00000000-0000-0000-0000-000000000000'], 'off_market');
    expect(r.done).toEqual([listingId]);
    expect(r.failed).toHaveLength(1);
  });

  it('records reductions in price history and keeps the previous price', async () => {
    await changePrice(db, agent, listingId, { price: '350,000' });
    const l = await db.query.listings.findFirst({ where: eq(listings.id, listingId) });
    expect([l!.price, l!.previousPrice]).toEqual([350000, 365000]);
    const ph = await db.select().from(priceHistory).where(eq(priceHistory.listingId, listingId));
    expect(ph.map((p) => [p.event, p.price])).toEqual([['reduced', 350000]]);
    await expect(changePrice(db, agent, listingId, { price: 'lots' })).rejects.toThrow('Check the price.');
  });

  it('applies live edits directly unless the review setting is on for agents', async () => {
    expect(await liveEdit(db, agent, settings, listingId, { description: 'Example new description.' })).toEqual({ applied: true });
    const on = { ...settings, liveEditsNeedReview: true };
    const r = await liveEdit(db, agent, on, listingId, { description: 'Example edit that needs review.' });
    expect(r.applied).toBe(false);
    expect((await db.query.listings.findFirst({ where: eq(listings.id, listingId) }))!.description).toBe('Example new description.');
    await expect(liveEdit(db, agent, on, listingId, { description: 'Another' })).rejects.toThrow('already an edit waiting');
    const notes = await db.select().from(notifications).where(eq(notifications.kind, 'revision.pending'));
    expect(new Set(notes.map((n) => n.userId))).toEqual(new Set(['o', 'ad']));

    if (r.applied) throw new Error('unreachable');
    await expect(decideRevision(db, agent, on, r.revisionId, true, null)).rejects.toThrow();
    await expect(decideRevision(db, owner, on, r.revisionId, false, '')).rejects.toThrow('Check the notes.');
    await decideRevision(db, owner, on, r.revisionId, true, null);
    expect((await db.query.listings.findFirst({ where: eq(listings.id, listingId) }))!.description).toBe('Example edit that needs review.');
    expect((await db.query.listingRevisions.findFirst({ where: eq(listingRevisions.id, r.revisionId) }))!.status).toBe('approved');
    // Managers skip review even when the setting is on.
    expect(await liveEdit(db, admin, on, listingId, { description: 'Example admin edit.' })).toEqual({ applied: true });
  });
});

describe('deals and sales', () => {
  it('maps deal stages to listing statuses', () => {
    expect(listingStatusFor('under_offer', 'sale')).toBe('under_offer');
    expect(listingStatusFor('settlement', 'rent')).toBe('under_contract');
    expect(listingStatusFor('fallen_through', 'rent')).toBe('for_lease');
    expect(listingStatusFor('closed', 'sale')).toBeNull();
  });

  it('runs a deal from offer to sale', async () => {
    const d = await createDeal(db, agent, { listingId, clientId: buyerId, side: 'buyer' });
    const buyer = await db.query.clients.findFirst({ where: eq(clients.id, buyerId) });
    expect(buyer!.roles).toContain('buyer');

    await addOffer(db, agent, d.id, { amount: '355000', by: 'buyer', on: '2026-10-20' });
    const conf = await db.query.dealConfidential.findFirst({ where: eq(dealConfidential.dealId, d.id) });
    expect(conf!.offers).toEqual([{ on: '2026-10-20', amount: 355000, by: 'buyer' }]);

    const s1 = await changeDealStage(db, agent, d.id, 'under_offer');
    expect(s1.listingStatus).toBe('under_offer');
    await changeDealStage(db, agent, d.id, 'under_contract');
    await expect(changeDealStage(db, agent, d.id, 'closed')).rejects.toThrow('Record the sale');
    await expect(changeDealStage(db, agent2, d.id, 'settlement')).rejects.toThrow('You can’t change this deal.');
    const clientNotes = await db.select().from(notifications).where(eq(notifications.userId, 'c'));
    expect(clientNotes.map((n) => n.title)).toContain('Your deal is now Under Contract');

    const sale = await recordSale(db, agent, d.id, { price: '360000', soldOn: '2026-10-24', buyerAgentId: 'ag2', commissions: [{ agentId: 'ag', ratePercent: '2.5', amount: '9000' }, { agentId: 'ag2', ratePercent: '2.5', amount: '9000' }] });
    expect(sale.saleNo).toBe(1);
    const l = await db.query.listings.findFirst({ where: eq(listings.id, listingId) });
    expect(l!.status).toBe('sold');
    expect((await db.query.deals.findFirst({ where: eq(deals.id, d.id) }))!.stage).toBe('closed');
    expect((await db.select().from(saleCommissions)).map((c) => c.amount)).toEqual([9000, 9000]);
    const ph = await db.select().from(priceHistory).where(eq(priceHistory.listingId, listingId));
    expect(ph.map((p) => p.event)).toContain('sold');
    await expect(recordSale(db, agent, d.id, { price: '1', soldOn: '2026-10-24' })).rejects.toThrow('already closed');
    expect(await db.select().from(sales)).toHaveLength(1);
  });

  it('a fallen-through deal puts the listing back on the market unless another deal holds it', async () => {
    const d1 = await createDeal(db, agent, { listingId, clientId: buyerId, side: 'buyer' });
    const [other] = await db.insert(clients).values({ displayName: 'Example Other Buyer', agentId: 'ag' }).returning();
    const d2 = await createDeal(db, agent, { listingId, clientId: other!.id, side: 'buyer' });
    await changeDealStage(db, agent, d1.id, 'under_offer');
    await changeDealStage(db, agent, d2.id, 'under_offer');
    await changeDealStage(db, agent, d1.id, 'fallen_through');
    expect((await db.query.listings.findFirst({ where: eq(listings.id, listingId) }))!.status).toBe('under_offer');
    await changeDealStage(db, agent, d2.id, 'fallen_through');
    expect((await db.query.listings.findFirst({ where: eq(listings.id, listingId) }))!.status).toBe('active');
  });
});

describe('showings', () => {
  it('lets the listing agent confirm and complete, and tells the client', async () => {
    const [s] = await db.insert(showings).values({ refNo: 'JR-2026-00009', listingId, requestedBy: 'c', agentId: 'ag', requestedFor: new Date(Date.now() + 86400000) }).returning();
    await expect(updateShowing(db, agent2, s!.id, 'confirm')).rejects.toThrow('You can’t change this showing.');
    const later = new Date(Date.now() + 2 * 86400000);
    const r = await updateShowing(db, agent, s!.id, 'confirm', later);
    expect(r.confirmedFor!.getTime()).toBe(later.getTime());
    expect((await db.select().from(notifications).where(eq(notifications.userId, 'c'))).map((n) => n.title)).toEqual(['Showing confirmed']);
    await updateShowing(db, agent, s!.id, 'complete');
    await expect(updateShowing(db, agent, s!.id, 'cancel')).rejects.toThrow('already completed');
  });
});

describe('support inbox', () => {
  it('assigns, replies to the sender and keeps internal notes internal', async () => {
    const [e] = await db.insert(enquiries).values({ refNo: 'JR-2026-00010', type: 'general_contact', payload: { message: 'Hi' }, userId: 'c' }).returning();
    await expect(assignEnquiry(db, client, e!.id, 'ag')).rejects.toThrow();
    await assignEnquiry(db, owner, e!.id, 'ag');
    await replyToEnquiry(db, agent, e!.id, { body: 'Example internal note.', internal: 'on' });
    expect(await db.select().from(notifications).where(eq(notifications.userId, 'c'))).toHaveLength(0);
    await replyToEnquiry(db, agent, e!.id, { body: 'Example reply.' });
    const n = await db.select().from(notifications).where(eq(notifications.userId, 'c'));
    expect(n.map((x) => x.body)).toEqual(['Example reply.']);
    expect((await db.query.enquiries.findFirst({ where: eq(enquiries.id, e!.id) }))!.status).toBe('waiting');
    expect(await db.select().from(enquiryReplies)).toHaveLength(2);
    await expect(replyToEnquiry(db, agent, e!.id, { body: '' })).rejects.toThrow('Check the reply.');
  });
});

describe('staff invites', () => {
  it('are single-use, role-limited and never touch the Owner', async () => {
    await expect(createInvite(db, admin, { role: 'admin' })).rejects.toThrow('Only the Owner can invite Admins.');
    const { token } = await createInvite(db, owner, { role: 'admin', note: 'Co-owner' });
    const stored = await db.select().from(staffInvites);
    expect(stored[0]!.tokenHash).not.toBe(token);
    expect(await acceptInvite(db, 'c', token)).toBe('admin');
    expect((await db.query.users.findFirst({ where: eq(users.id, 'c') }))!.role).toBe('admin');
    await expect(acceptInvite(db, 'ag', token)).rejects.toThrow('expired or has already been used');
    const second = await createInvite(db, owner, { role: 'agent' });
    await expect(acceptInvite(db, 'o', second.token)).rejects.toThrow('You’re the Owner already.');
  });
});

describe('client files', () => {
  it('opens a file owned by the agent and protects confidential notes', async () => {
    const id = await saveClientFile(db, agent, null, { client: { kind: 'couple', displayName: 'Example Couple', people: [{ legalName: 'Example One', signs: true }, { legalName: 'Example Two', signs: true }] }, roles: ['seller'], confidential: { motivation: 'Example motive' } });
    const c = await db.query.clients.findFirst({ where: eq(clients.id, id), with: { people: true, confidential: true } });
    expect(c!.agentId).toBe('ag');
    expect(c!.people).toHaveLength(2);
    expect(c!.confidential!.motivation).toBe('Example motive');
    await expect(saveClientFile(db, agent2, id, { client: { displayName: 'Hijack', people: [] } })).rejects.toThrow('You can’t edit this client file.');
    await expect(saveClientFile(db, agent, null, { client: { displayName: '', people: [] } })).rejects.toThrow('Check the highlighted fields.');
  });
});

describe('sending limits', () => {
  it('stops one person sending more than 5 messages or showing requests in 10 minutes', async () => {
    const { sentTooMany } = await import('@/server/rate-limit');
    const { enquiries, users: u } = await import('@/db/schema');
    const fresh = await (await import('./helpers/db')).testDb();
    await fresh.insert(u).values({ id: 'u-spam', role: 'client', displayName: 'Example Spammer' });
    expect(await sentTooMany(fresh, 'u-spam')).toBe(false);
    await fresh.insert(enquiries).values(Array.from({ length: 5 }, (_, i) => ({ refNo: `JR-2026-9${String(i).padStart(4, '0')}`, type: 'general_contact' as const, payload: {}, userId: 'u-spam' })));
    expect(await sentTooMany(fresh, 'u-spam')).toBe(true);
    expect(await sentTooMany(fresh, 'u-spam', new Date(Date.now() + 11 * 60_000))).toBe(false);
  });
});

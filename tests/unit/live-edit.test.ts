import { and, eq } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '@/db/client';
import { seedBase } from '@/db/seed-base';
import { areas, clients, listings, priceHistory, siteSettings, users } from '@/db/schema';
import type { Actor } from '@/lib/permissions';
import { addPhoto, createDraft, decideReview, saveProperty, saveSeller, saveTerms, submitForReview, updatePhotos } from '@/server/listings/service';
import { resetDb, testDb } from './helpers/db';

const owner: Actor = { id: 'u-owner', role: 'owner', status: 'active' };
const agent: Actor = { id: 'u-agent', role: 'agent', status: 'active' };
const settings = { adminsCanApprove: true };
let db: DB;
let fairview: string;

const property = (o: Record<string, unknown> = {}) => ({ type: 'house', purpose: 'sale', addressLine: '7063 Example Court', areaId: fairview, beds: '3', baths: '2', sqft: '1850', description: 'Example description that is long enough to pass the checklist rules.', ...o });

async function liveListing() {
  const l = await createDraft(db, agent, 'agent');
  await saveProperty(db, agent, l.id, property());
  await saveTerms(db, agent, l.id, { price: '$365,000' });
  const photos = [];
  for (let i = 1; i <= 3; i++) photos.push(await addPhoto(db, agent, l.id, { storageId: `/api/uploads/local/listings/${l.id.replace(/-/g, '').slice(0, 31)}${i}.jpg`, width: 2000, height: 1333 }));
  await updatePhotos(db, agent, l.id, { order: { order: photos.map((p) => p.id), coverId: photos[0]!.id }, meta: photos.map((p, i) => ({ id: p.id, alt: `Example ${i}`, caption: null })) });
  await saveSeller(db, agent, l.id, { clientId: null, client: { kind: 'person', displayName: 'Example Seller', people: [{ legalName: 'Example Seller', signs: true }] }, bottomLine: '350000' });
  await submitForReview(db, agent, settings, l.id);
  await decideReview(db, owner, settings, l.id, { decision: 'approved' });
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
    { id: agent.id, role: 'agent', displayName: 'Example Agent' },
  ]);
  fairview = (await db.query.areas.findFirst({ where: eq(areas.slug, 'fairview') }))!.id;
});

describe('editing live listings in full', () => {
  it('the Owner edits every step of an active listing, and the seller file follows', async () => {
    const l = await liveListing();
    expect((await db.query.listings.findFirst({ where: eq(listings.id, l.id) }))!.status).toBe('active');
    await saveProperty(db, owner, l.id, property({ beds: '4', addressLine: '7065 Example Court' }));
    const row = (await db.query.listings.findFirst({ where: eq(listings.id, l.id) }))!;
    expect(row).toMatchObject({ beds: 4, addressLine: '7065 Example Court', status: 'active' });
    await saveSeller(db, owner, l.id, { clientId: row.sellerClientId, client: { kind: 'person', displayName: 'Example Seller Renamed', people: [{ legalName: 'Example Seller Renamed', signs: true }] }, bottomLine: '340000' });
    expect((await db.query.clients.findFirst({ where: eq(clients.id, row.sellerClientId!) }))!.displayName).toBe('Example Seller Renamed');
  });

  it('a new price on a live listing goes into the price history', async () => {
    const l = await liveListing();
    const r = await saveTerms(db, owner, l.id, { price: '$355,000' });
    expect(r.priceChange).toEqual({ from: 365000, to: 355000 });
    expect((await db.query.listings.findFirst({ where: eq(listings.id, l.id) }))!).toMatchObject({ price: 355000, previousPrice: 365000 });
    expect(await db.$count(priceHistory, and(eq(priceHistory.listingId, l.id), eq(priceHistory.event, 'reduced')))).toBe(1);
    expect((await saveTerms(db, owner, l.id, { price: '$355,000' })).priceChange).toBeUndefined();
  });

  it('a live listing keeps its purpose', async () => {
    const l = await liveListing();
    await expect(saveProperty(db, owner, l.id, property({ purpose: 'rent' }))).rejects.toMatchObject({ fieldErrors: { purpose: expect.stringMatching(/sale and rent/) } });
  });

  it('agents edit their live listings unless live edits need review', async () => {
    const l = await liveListing();
    await saveProperty(db, agent, l.id, property({ beds: '5' }));
    await db.update(siteSettings).set({ liveEditsNeedReview: true }).where(eq(siteSettings.id, 1));
    await expect(saveProperty(db, agent, l.id, property({ beds: '6' }))).rejects.toThrow(/need the Owner’s review/);
    await saveProperty(db, owner, l.id, property({ beds: '6' }));
    expect((await db.query.listings.findFirst({ where: eq(listings.id, l.id) }))!.beds).toBe(6);
  });
});

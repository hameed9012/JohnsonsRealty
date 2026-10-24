import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import type { DB } from '@/db/client';
import { seedBase } from '@/db/seed-base';
import { areas, clientPeople, clients, listingConfidential, listingDisclosures, listingOwnership, listings, users } from '@/db/schema';
import type { Actor } from '@/lib/permissions';
import { generateSeller, type GeneratorListing } from '@/lib/seller-generator';
import { addPhoto, createDraft, decideReview, generatedSellerValues, saveProperty, saveTerms, submitForReview, updatePhotos } from '@/server/listings/service';
import { testDb } from './helpers/db';

const house = (o: Partial<GeneratorListing> = {}): GeneratorListing => ({ type: 'house', purpose: 'sale', price: 365000, beds: 3, sqft: 1850, yearBuilt: 1994, garage: 'Single-car garage', basement: 'Full', features: [], furnishedPrice: null, ...o });
const today = new Date('2026-10-24T12:00:00Z');
const SEEDS = Array.from({ length: 300 }, (_, i) => `example-seed-${i}`);

describe('the seller generator', () => {
  it('gives the same seller for the same seed, and a different one for another', () => {
    expect(generateSeller('abc', house(), { today })).toEqual(generateSeller('abc', house(), { today }));
    expect(generateSeller('abc', house(), { today }).client.displayName).not.toBe(generateSeller('xyz', house(), { today }).client.displayName);
  });

  it('keeps the numbers consistent across many seeds and listings', () => {
    for (const seed of SEEDS) {
      for (const l of [house(), house({ price: 760000, yearBuilt: 2018, furnishedPrice: 795000, features: ['Pool'] }), house({ price: 149000, type: 'business' }), house({ price: 1900, purpose: 'rent', type: 'rental' })]) {
        const g = generateSeller(seed, l, { today });
        const n = g.numbers;
        expect(n.decline!).toBeLessThan(n.lowest!);
        expect(n.lowest!).toBeLessThan(n.counter!);
        expect(n.counter!).toBeLessThan(n.asking!);
        expect(n.yearBought).toBeGreaterThanOrEqual(l.yearBuilt!);
        expect(n.yearBought).toBeLessThan(today.getUTCFullYear());
        if (l.purpose === 'sale' && l.type !== 'business') expect(n.lowest! / n.asking!).toBeGreaterThanOrEqual(0.91);
        if (l.furnishedPrice) {
          expect(g.listingConfidential.furnitureLowest!).toBeLessThan(l.furnishedPrice - l.price!);
          expect(g.listingConfidential.negotiationRules).toMatch(/Furniture/);
        }
        expect(g.disclosures).toHaveLength(20);
        expect(g.people.length).toBeGreaterThan(0);
        expect(g.client.mailingAddressAfter).not.toMatch(/, PA \d/);
      }
    }
  });

  it('a pre-1978 home always needs the lead paint disclosure', () => {
    for (const seed of SEEDS) {
      const g = generateSeller(seed, house({ yearBuilt: 1956 }), { today });
      expect(g.numbers.leadPaint).toBe(true);
      expect(g.disclosures.find((d) => d.item === 'lead_paint')!.detail).toMatch(/lead-based paint disclosure/);
      expect(generateSeller(seed, house({ yearBuilt: 1994 }), { today }).disclosures.find((d) => d.item === 'lead_paint')!.answer).toBe('na');
    }
  });

  it('follows the facts: no basement, pool, and defects that fit', () => {
    for (const seed of SEEDS.slice(0, 80)) {
      const g = generateSeller(seed, house({ basement: 'None, slab foundation', garage: null, features: [] }), { today });
      expect(g.disclosures.find((d) => d.item === 'basement_water')).toMatchObject({ answer: 'na', detail: 'No basement, slab foundation' });
      expect(g.disclosures.find((d) => d.item === 'pool_spa')!.answer).toBe('na');
      expect(JSON.stringify(g.disclosures)).not.toMatch(/garage door|pool cover|fence/i);
      expect(generateSeller(seed, house({ features: ['Pool'] }), { today }).disclosures.find((d) => d.item === 'pool_spa')!.answer).not.toBe('na');
    }
  });

  it('fits ages and jobs to the price band', () => {
    for (const seed of SEEDS.slice(0, 100)) {
      const g = generateSeller(seed, house({ price: 760000, yearBuilt: 2018 }), { today });
      for (const p of g.people) expect(Number(p.ageOccupation.split(',')[0])).toBeGreaterThanOrEqual(25);
      expect(JSON.stringify(g.people)).not.toMatch(/cashier|line cook|nurse aide/);
    }
  });
});

describe('generated sellers on listings', () => {
  let db: DB;
  const owner: Actor = { id: 'u-owner', role: 'owner', status: 'active' };
  const agent: Actor = { id: 'u-agent', role: 'agent', status: 'active' };

  beforeAll(async () => {
    db = await testDb();
    await seedBase(db);
    await db.insert(users).values([
      { id: owner.id, role: 'owner', displayName: 'Example Owner' },
      { id: agent.id, role: 'agent', displayName: 'Example Agent' },
      { id: 'u-client', role: 'client', displayName: 'Example Client' },
    ]);
  });

  let uploads = 0;
  async function ready(actor: Actor, source: 'agent' | 'owner_submitted') {
    const fairview = (await db.query.areas.findFirst({ where: eq(areas.slug, 'fairview') }))!.id;
    const l = await createDraft(db, actor, source);
    await saveProperty(db, actor, l.id, { type: 'house', purpose: 'sale', addressLine: '7063 Example Court', areaId: fairview, beds: '3', baths: '2', sqft: '1850', yearBuilt: '1962', description: 'Example description that is long enough to pass the checklist rules.' });
    await saveTerms(db, actor, l.id, { price: '$365,000' });
    const photos = [];
    for (let i = 0; i < 3; i++) photos.push(await addPhoto(db, actor, l.id, { storageId: `/api/uploads/local/listings/${String(++uploads).padStart(32, '0')}.jpg`, width: 2000, height: 1333 }));
    await updatePhotos(db, actor, l.id, { order: { order: photos.map((p) => p.id), coverId: photos[0]!.id }, meta: photos.map((p, i) => ({ id: p.id, alt: `Example ${i}`, caption: null })) });
    return l;
  }

  it('the Seller step offers the same generated seller until Regenerate', async () => {
    const l = await ready(agent, 'agent');
    const a = await generatedSellerValues(db, agent, l.id, false);
    const b = await generatedSellerValues(db, agent, l.id, false);
    expect(a).toEqual(b);
    expect(a.client.generatedSeed).toBe(l.id);
    const c = await generatedSellerValues(db, agent, l.id, true);
    expect(c.client.generatedSeed).not.toBe(l.id);
  });

  it('an agent listing approved with the Seller step skipped gets a fictional seller', async () => {
    const l = await ready(agent, 'agent');
    await submitForReview(db, agent, { adminsCanApprove: true }, l.id);
    await decideReview(db, owner, { adminsCanApprove: true }, l.id, { decision: 'approved' });
    const row = (await db.query.listings.findFirst({ where: eq(listings.id, l.id) }))!;
    expect(row.sellerClientId).not.toBeNull();
    const c = (await db.query.clients.findFirst({ where: eq(clients.id, row.sellerClientId!) }))!;
    expect(c.generatedSeed).toBe(l.id);
    expect(c.agentId).toBe(agent.id);
    expect(await db.$count(clientPeople, eq(clientPeople.clientId, c.id))).toBeGreaterThan(0);
    expect((await db.query.listingConfidential.findFirst({ where: eq(listingConfidential.listingId, l.id) }))!.bottomLine).toBeLessThan(365000);
    expect((await db.query.listingOwnership.findFirst({ where: eq(listingOwnership.listingId, l.id) }))!.deedReference).toMatch(/^Deed Book \d+, Page \d+$/);
    const lead = await db.query.listingDisclosures.findFirst({ where: (d, { and, eq: e }) => and(e(d.listingId, l.id), e(d.item, 'lead_paint')) });
    expect(lead!.detail).toMatch(/lead-based paint/);
    expect(await db.$count(listingDisclosures, eq(listingDisclosures.listingId, l.id))).toBe(20);
  });

  it('owner-submitted listings never get a generated seller', async () => {
    const client: Actor = { id: 'u-client', role: 'client', status: 'active' };
    const l = await ready(client, 'owner_submitted');
    await expect(generatedSellerValues(db, owner, l.id, false)).rejects.toThrow(/real seller/);
  });
});

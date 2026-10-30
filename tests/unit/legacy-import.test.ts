import { and, eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import type { DB } from '@/db/client';
import { seedBase } from '@/db/seed-base';
import { activityLog, clientPeople, clients, listingDisclosures, listingPhotos, listings, listingTerms, listingConfidential, sales, users, listingBusiness, listingLeaseTerms } from '@/db/schema';
import { addKitPhoto, altFromFilename, applyPlan, IMPORT_SUMMARY, photoJobs } from '@/import/legacy/apply';
import { buildPlan, isoDate, money } from '@/import/legacy/map';
import { extractConst, parseJsLiteral, parseSellerFiles } from '@/import/legacy/parse';
import { loadPlan } from '@/import/legacy/source';
import { releasePhotoHold, saveProperty } from '@/server/listings/service';
import { testDb } from './helpers/db';

describe('parsing the legacy files', () => {
  it('reads JavaScript object literals without eval', () => {
    expect(parseJsLiteral(`{ a: 'it\\'s', "b": [1, true, null], c: { d: -2.5 }, }`)).toEqual({ a: "it's", b: [1, true, null], c: { d: -2.5 } });
    expect(extractConst(`<script>const X = { k: '}' };\nconst Y = 1;</script>`, 'X')).toEqual({ k: '}' });
  });

  it('splits seller sections into tables and lists', () => {
    const [s] = parseSellerFiles(`## Example Seller: 1 Example Road\n\nIntro line.\n\n**Seller**\n\n| Field | Value |\n|---|---|\n| Full legal name | Example A. Seller |\n\n**Disclosures**\n\n- First\n- Second\n`);
    expect(s).toMatchObject({ key: 'seller', name: 'Example Seller', intro: 'Intro line.', blocks: { Seller: { 'Full legal name': 'Example A. Seller' }, Disclosures: ['First', 'Second'] } });
  });

  it('reads money and dates', () => {
    expect(money('$760,000 unfurnished')).toBe(760000);
    expect(money('none')).toBeNull();
    expect(isoDate('Oct 14, 2026')).toBe('2026-10-14');
    expect(isoDate('2027-01-15')).toBe('2027-01-15');
    expect(altFromFilename('11-bedroom-3-twin.jpg')).toBe('Bedroom 3 twin');
  });

  it('builds the plan from the real kit files', async () => {
    const plan = await loadPlan();
    expect(plan.listings.map((l) => l.key)).toEqual(['porter', 'kowalski', 'raman', 'castellano', 'hartmann', 'hayes', 'novak', 'lindqvist']);
    expect(plan.clients.filter((c) => c.tags.includes('Spare seller')).map((c) => c.key).sort()).toEqual(['boyd', 'brennan', 'delgado', 'malhotra', 'marchetti', 'whitaker']);
    const by = Object.fromEntries(plan.listings.map((l) => [l.key, l]));
    expect(by.castellano).toMatchObject({ status: 'sold', postal: '601', price: 795000, sale: { price: 795000, soldOn: '2027-01-15' } });
    expect(by.hartmann).toMatchObject({ postal: '601', price: 760000, baths: 1.5, photosDir: 'photos/6012-estate-drive', terms: { furnishedPrice: 795000 }, confidential: { bottomLine: 730000, furnitureLowest: 25000 } });
    expect(by.kowalski).toMatchObject({ addressLine: '8095 Lakeway Street', postal: '809', terms: { asIs: true, lockbox: false } });
    expect(by.raman!.postal).toBe('601');
    expect(by.hayes).toMatchObject({ type: 'rental', purpose: 'rent', status: 'for_lease', price: 1900, addressLine: '', lease: { deposit: 1900, leaseLengthMonths: 12, maxOccupants: 4 } });
    expect(by.lindqvist).toMatchObject({ type: 'business', postal: '806', postalCode: '17109', business: { priceEquipment: 70000, priceGoodwill: 77000, nameWithheld: false }, confidential: { yearlySales: 168000, yearlyProfit: 61000 } });
    expect(by.porter!.disclosures).toHaveLength(20);
    // A file without the forms tool's answers gets its condition table from the property facts.
    expect(by.novak).toMatchObject({ addressLine: '', postal: null, price: 335000, beds: 2, baths: 1, yearBuilt: 2004, photosDir: 'photos/novak-two-storey-house', confidential: { bottomLine: 318000 } });
    expect(by.novak!.disclosures.find((d) => d.item === 'windows_doors')).toMatchObject({ answer: 'yes' });
    expect(by.novak!.description).toMatch(/^Single-family detached with 2 bedrooms and 1 bathroom, about 1,900 sq ft, built 2004\./);
    expect(by.lindqvist!.photosDir).toBe('photos/common-cents-laundromat');
    expect(by.porter!.disclosures[1]).toMatchObject({ item: 'basement_water', answer: 'yes' });
    // "You choose" never becomes a listing value; it becomes a flag. (Spare files keep it in their notes.)
    expect(JSON.stringify(plan.listings)).not.toMatch(/you choose/i);
    expect(plan.flags.some((f) => f.key === 'hayes' && f.field === 'addressLine')).toBe(true);
    expect(plan.flags.filter((f) => f.field === 'addressLine' && /Cardinal/.test(f.message)).map((f) => f.key)).toEqual(['raman', 'castellano']);
    const raman = plan.clients.find((c) => c.key === 'raman')!;
    expect(raman.kind).toBe('couple');
    expect(raman.people.map((p) => [p.goesBy, p.discord])).toEqual([['Priya', 'PRaman_MD'], ['Daniel', 'DanRaman']]);
  });
});

describe('applying the import', () => {
  let db: DB;
  const uploads: string[] = [];
  const upload = async (_b: Buffer, type: string) => {
    uploads.push(type);
    return { storageId: `/api/uploads/local/listings/${String(uploads.length).padStart(32, '0')}.jpg`, width: 1600, height: 1067 };
  };

  beforeAll(async () => {
    db = await testDb();
    await seedBase(db);
    await db.insert(users).values({ id: 'u-owner', role: 'owner', displayName: 'Example Owner' });
  });

  it('creates every record once, and running it again changes nothing', async () => {
    const plan = await loadPlan();
    const opts = { actorId: 'u-owner', sale: { price: 795000, soldOn: '2027-01-15' }, upload };
    const first = await applyPlan(db, plan, opts);
    expect(first.created).toHaveLength(14);
    expect(first.created.find((c) => c.key === 'castellano')!.saleNo).toBe(1);
    expect(first.created.find((c) => c.key === 'hartmann')!.photos).toBe(20);

    const second = await applyPlan(db, plan, opts);
    expect(second.created).toHaveLength(0);
    expect(second.skipped).toHaveLength(14);
    expect(await db.$count(clients)).toBe(14);
    expect(await db.$count(listings)).toBe(8);
    expect(await db.$count(sales)).toBe(1);
    expect(uploads).toHaveLength(35); // 6012 Estate Drive 20, the Novak house 10, the laundromat 5
  });

  it('fills the details and holds listings without photos off the public site', async () => {
    const rows = await db.select().from(listings);
    const by = Object.fromEntries(rows.map((l) => [l.addressLine || l.type, l]));
    expect(by['6012 Estate Drive']).toMatchObject({ status: 'active', photosHold: false, postal: '601' });
    expect(by['7063 Franklin Court']).toMatchObject({ status: 'active', photosHold: true, publishedAt: new Date('2026-10-14T12:00:00Z') });
    expect(by.rental).toMatchObject({ status: 'for_lease', photosHold: true, purpose: 'rent' });
    const castellano = rows.find((l) => l.status === 'sold')!;
    expect(castellano.photosHold).toBe(false);
    expect(await db.$count(sales, eq(sales.listingId, castellano.id))).toBe(1);

    const hartmann = by['6012 Estate Drive']!;
    const photos = await db.select().from(listingPhotos).where(eq(listingPhotos.listingId, hartmann.id)).orderBy(listingPhotos.sortOrder);
    expect(photos[0]).toMatchObject({ isCover: true, alt: 'Exterior front' });
    expect(photos.filter((p) => p.isCover)).toHaveLength(1);
    expect((await db.query.listingTerms.findFirst({ where: eq(listingTerms.listingId, hartmann.id) }))!.furnishedPrice).toBe(795000);
    expect((await db.query.listingConfidential.findFirst({ where: eq(listingConfidential.listingId, hartmann.id) }))!.furnitureLowest).toBe(25000);
    expect(await db.$count(listingDisclosures, eq(listingDisclosures.listingId, by['7063 Franklin Court']!.id))).toBe(20);
    expect(await db.$count(listingLeaseTerms, eq(listingLeaseTerms.listingId, by.rental!.id))).toBe(1);
    expect(await db.$count(listingBusiness)).toBe(1);

    const raman = await db.query.clients.findFirst({ where: eq(clients.legacyKey, 'legacy:raman') });
    expect(await db.$count(clientPeople, eq(clientPeople.clientId, raman!.id))).toBe(2);
    expect((await db.query.clients.findFirst({ where: eq(clients.legacyKey, 'legacy:brennan') }))!.tags).toEqual(['Spare seller']);
    // Every created record has its activity entry.
    expect(await db.$count(activityLog, and(eq(activityLog.action, 'client.create')))).toBe(14);
    expect(await db.$count(activityLog, eq(activityLog.action, 'listing.create'))).toBe(8);
    const logged = await db.select({ s: activityLog.summary }).from(activityLog);
    expect(logged.every((r) => r.s.startsWith(IMPORT_SUMMARY))).toBe(true);
  });

  it('a held listing goes live once it has 3 described photos', async () => {
    const porter = (await db.query.listings.findFirst({ where: eq(listings.addressLine, '7063 Franklin Court') }))!;
    const [m1, m2, m3] = (await db.select().from(listingPhotos).limit(3)).map((p) => p.mediaId);
    await db.insert(listingPhotos).values([m1!, m2!].map((mediaId, i) => ({ listingId: porter.id, mediaId, alt: `Example ${i}`, sortOrder: i })));
    expect(await releasePhotoHold(db, porter.id)).toBe(false);
    await db.insert(listingPhotos).values({ listingId: porter.id, mediaId: m3!, alt: '', sortOrder: 2 });
    expect(await releasePhotoHold(db, porter.id)).toBe(false);
    await db.update(listingPhotos).set({ alt: 'Example 2' }).where(and(eq(listingPhotos.listingId, porter.id), eq(listingPhotos.sortOrder, 2)));
    expect(await releasePhotoHold(db, porter.id)).toBe(true);
    expect((await db.query.listings.findFirst({ where: eq(listings.id, porter.id) }))!.photosHold).toBe(false);
  });

  it('a failed photo upload never stops the import, and importing again adds the photos', async () => {
    const fresh = await testDb();
    await seedBase(fresh);
    await fresh.insert(users).values({ id: 'u-owner', role: 'owner', displayName: 'Example Owner' });
    const plan = await loadPlan();
    const broken = async () => {
      throw new Error('Invalid cloud_name Root');
    };
    const first = await applyPlan(fresh, plan, { actorId: 'u-owner', sale: { price: 795000, soldOn: '2027-01-15' }, upload: broken });
    expect(first.failed).toEqual([]);
    expect(first.created).toHaveLength(14);
    const h = first.created.find((c) => c.key === 'hartmann')!;
    expect(h).toMatchObject({ photos: 0, photoError: expect.stringMatching(/Invalid cloud_name Root/) });
    expect((await fresh.query.listings.findFirst({ where: eq(listings.id, h.listing!) }))!.photosHold).toBe(true);

    const second = await applyPlan(fresh, plan, { actorId: 'u-owner', upload });
    expect(second.created).toHaveLength(0);
    expect(second.photosAdded).toEqual([
      { key: 'hartmann', photos: 20 },
      { key: 'novak', photos: 10 },
      { key: 'lindqvist', photos: 5 },
    ]);
    expect((await fresh.query.listings.findFirst({ where: eq(listings.id, h.listing!) }))!.photosHold).toBe(false);
    expect((await applyPlan(fresh, plan, { actorId: 'u-owner', upload })).photosAdded).toEqual([]);
  });

  it('imports one seller at a time, leaves photos for later, and uploads them one by one', async () => {
    const fresh = await testDb();
    await seedBase(fresh);
    await fresh.insert(users).values({ id: 'u-owner', role: 'owner', displayName: 'Example Owner' });
    const plan = await loadPlan();
    const one = await applyPlan(fresh, plan, { actorId: 'u-owner', only: 'hartmann', skipPhotos: true });
    expect(one.created.map((c) => c.key)).toEqual(['hartmann']);
    expect(await fresh.$count(clients)).toBe(1);
    const row = (await fresh.query.listings.findFirst())!;
    expect(row).toMatchObject({ status: 'active', photosHold: true });
    expect(await photoJobs(fresh, plan)).toEqual([{ key: 'hartmann', listingId: row.id, total: 20, have: 0 }]);
    for (let i = 0; i < 3; i++) await addKitPhoto(fresh, plan, 'hartmann', i, { actorId: 'u-owner', upload });
    expect((await addKitPhoto(fresh, plan, 'hartmann', 2, { actorId: 'u-owner', upload })).added).toBe(false); // safe to repeat
    expect((await fresh.query.listings.findFirst({ where: eq(listings.id, row.id) }))!.photosHold).toBe(false);
    expect((await photoJobs(fresh, plan))[0]).toMatchObject({ have: 3, total: 20 });
  });

  it('an agent starting from a seller file gets a draft, and the same seller can’t be listed twice', async () => {
    const fresh = await testDb();
    await seedBase(fresh);
    await fresh.insert(users).values({ id: 'u-agent', role: 'agent', displayName: 'Example Agent' });
    const plan = await loadPlan();
    const r = await applyPlan(fresh, plan, { actorId: 'u-agent', only: 'kowalski', skipPhotos: true, asDraft: true });
    const row = (await fresh.query.listings.findFirst({ where: eq(listings.id, r.created[0]!.listing!) }))!;
    expect(row).toMatchObject({ status: 'draft', publishedAt: null, listingAgentId: 'u-agent', photosHold: false, addressLine: '8095 Lakeway Street' });
    expect((await applyPlan(fresh, plan, { actorId: 'u-agent', only: 'kowalski', skipPhotos: true, asDraft: true })).skipped).toEqual(['kowalski']);
    expect(await fresh.$count(listings)).toBe(1);
  });

  it('a listing with photos but no address stays off the site until the address is saved', async () => {
    const fresh = await testDb();
    await seedBase(fresh);
    await fresh.insert(users).values({ id: 'u-owner', role: 'owner', displayName: 'Example Owner' });
    const plan = await loadPlan();
    await applyPlan(fresh, plan, { actorId: 'u-owner', only: 'novak', skipPhotos: true });
    for (let i = 0; i < 10; i++) await addKitPhoto(fresh, plan, 'novak', i, { actorId: 'u-owner', upload });
    const row = (await fresh.query.listings.findFirst())!;
    expect(row).toMatchObject({ addressLine: '', photosHold: true });
    const owner = { id: 'u-owner', role: 'owner' as const, status: 'active' as const };
    await saveProperty(fresh, owner, row.id, { type: 'house', purpose: 'sale', addressLine: '4101 Example Lane', beds: '2', baths: '1' });
    expect((await fresh.query.listings.findFirst({ where: eq(listings.id, row.id) }))!.photosHold).toBe(false);
  });

  it('refuses a sold listing without a price and date', async () => {
    const fresh = await testDb();
    await seedBase(fresh);
    const plan = buildPlan(parseSellerFiles(`## Anthony and Renée Castellano: the six-bedroom mansion\n\n**Sellers**\n\n| Field | Value |\n|---|---|\n| Full legal names | Example One and Example Two |\n`), { sellers: {}, extra: {} });
    const r = await applyPlan(fresh, plan, { actorId: null });
    expect(r.failed).toEqual([{ key: 'castellano', client: 'Anthony and Renée Castellano', message: expect.stringMatching(/sale price and date/) }]);
    expect(await fresh.$count(clients)).toBe(0);
  });
});

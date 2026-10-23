import { eq } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '@/db/client';
import { seedBase } from '@/db/seed-base';
import { areas, clientPeople, clients, dealParties, deals, documentClients, documents, listingDisclosures, listingOwnership, notifications, users } from '@/db/schema';
import { FORM_TYPES } from '@/db/schema/enums';
import { FORM_DEFS } from '@/forms/defs';
import { fillFrom, partyName } from '@/forms/fill';
import { applyFill, clientCopy, computeValue, docSchema, emptyData, flatFields, moneyWords } from '@/forms/model';
import type { Actor } from '@/lib/permissions';
import { canSeeDocument, createDocument, fillDocument, saveDocument, setDocumentStatus, shareDocument } from '@/server/ops/documents';
import { resetDb, testDb } from './helpers/db';

describe('form definitions', () => {
  it.each(FORM_TYPES)('%s has unique field ids, valid spans and parties, and parses an empty document', (type) => {
    const def = FORM_DEFS[type];
    const ids = flatFields(def).map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    const parties = new Set(def.signatures.map((s) => s.party));
    for (const s of def.sections) for (const g of s.signatures ?? []) for (const p of g.parties) expect(parties.has(p)).toBe(true);
    expect(def.signatures.some((s) => s.agent)).toBe(true);
    expect(docSchema(type).safeParse(emptyData(type)).success).toBe(true);
  });

  it('rejects values a select does not offer and strips unknown keys', () => {
    const s = docSchema('agreement_of_sale');
    expect(s.safeParse({ financing: 'Barter' }).success).toBe(false);
    expect(s.safeParse({ price: 'lots' }).success).toBe(false);
    const ok = s.safeParse({ financing: 'Cash (no financing)', 'cont.mortgage.on': true, extra: 'x' });
    expect(ok.success && ok.data).toEqual({ financing: 'Cash (no financing)', 'cont.mortgage.on': true });
  });

  it('writes amounts in words and works out balances and commission', () => {
    expect(moneyWords(275000)).toBe('Two Hundred Seventy-Five Thousand and 00/100 Dollars');
    expect(moneyWords(1234.5)).toBe('One Thousand Two Hundred Thirty-Four and 50/100 Dollars');
    const d = { price: '300000', deposit: '15000', comm_total: '5', comm_side: '2.5', biz_profit: '60000', sf_amount: '30000' };
    expect(computeValue('balance', d)).toBe('$285,000.00');
    expect(computeValue('comm_total_amt', d)).toBe('$15,000.00');
    expect(computeValue('comm_side_amt', d)).toBe('$7,500.00');
    expect(computeValue('biz_multiple', d)).toBe('5.0 × yearly profit');
    expect(computeValue('biz_balance', d)).toBe('$255,000.00');
    expect(computeValue('alloc_total', { ...d, 'alloc.building.amt': '200000', 'alloc.goodwill.amt': '100000' })).toBe('$300,000.00 · matches the price');
  });

  it('keeps only the fields a form has when filling, and never blanks typed values', () => {
    const fill = { seller_name: 'Example Seller', biz_name: 'Example Diner', price: '' };
    const out = applyFill('listing_contract', { price: '1' }, fill);
    expect(out).toEqual({ price: '1', seller_name: 'Example Seller' });
  });

  it('leaves the brokerage record off the client copy', () => {
    const data = { buyer_name: 'Example Buyer', comm_total: '5', representing: 'Buyer' };
    expect(clientCopy('settlement_handover', data)).toEqual({ buyer_name: 'Example Buyer' });
  });

  it('names parties as they go on forms', () => {
    const base = { displayName: 'Example Family', legalNameOnForms: null, bestContact: null, mailingAddressAfter: null, businessAddress: null };
    expect(partyName({ ...base, people: [{ legalName: 'Example One', signs: true, robloxUsername: null }, { legalName: 'Example Adviser', signs: false, robloxUsername: null }, { legalName: 'Example Two', signs: true, robloxUsername: null }] })).toBe('Example One & Example Two');
    expect(partyName({ ...base, legalNameOnForms: 'Example Holdings LLC', people: [] })).toBe('Example Holdings LLC');
    expect(fillFrom({ seller: { ...base, people: [{ legalName: 'Example One', signs: true, robloxUsername: 'ExampleRbx' }] } }).seller_contact).toBe('ExampleRbx');
  });
});

const owner: Actor = { id: 'o', role: 'owner', status: 'active' };
const agent: Actor = { id: 'ag', role: 'agent', status: 'active' };
const agent2: Actor = { id: 'ag2', role: 'agent', status: 'active' };
const client: Actor = { id: 'c', role: 'client', status: 'active' };

let db: DB;
let listingId: string;
let sellerId: string;
let buyerId: string;
let dealId: string;

beforeAll(async () => {
  db = await testDb();
});

beforeEach(async () => {
  await resetDb(db);
  await seedBase(db);
  await db.insert(users).values([
    { id: 'o', role: 'owner', displayName: 'Example Owner' },
    { id: 'ag', role: 'agent', displayName: 'Example Agent' },
    { id: 'ag2', role: 'agent', displayName: 'Example Agent Two' },
    { id: 'c', role: 'client', displayName: 'Example Buyer' },
  ]);
  const area = await db.query.areas.findFirst({ where: eq(areas.slug, 'fairview') });
  const [s] = await db.insert(clients).values({ displayName: 'Example Seller', roles: ['seller'], agentId: 'ag', mailingAddressAfter: 'Example forwarding address' }).returning();
  sellerId = s!.id;
  await db.insert(clientPeople).values({ clientId: sellerId, legalName: 'Example Seller Legal', signs: true, robloxUsername: 'ExampleSellerRbx' });
  const [b] = await db.insert(clients).values({ displayName: 'Example Buyer', roles: ['buyer'], userId: 'c', agentId: 'ag' }).returning();
  buyerId = b!.id;
  const { listings } = await import('@/db/schema');
  const [l] = await db
    .insert(listings)
    .values({ refNo: 'JR-2026-00001', slug: 'example-lane', type: 'house', purpose: 'sale', source: 'agent', status: 'under_offer', addressLine: 'Example Lane', areaId: area!.id, postalCode: '17110', price: 365000, beds: 3, baths: 2, listingAgentId: 'ag', sellerClientId: sellerId })
    .returning();
  listingId = l!.id;
  await db.insert(listingOwnership).values({ listingId, vesting: 'Sole owner' });
  await db.insert(listingDisclosures).values([
    { listingId, item: 'roof', answer: 'no', detail: 'Example roof note' },
    { listingId, item: 'radon', answer: 'unknown' },
  ]);
  const [d] = await db.insert(deals).values({ listingId, agentId: 'ag', stage: 'under_contract', settlementDate: '2026-11-30' }).returning();
  dealId = d!.id;
  await db.insert(dealParties).values([
    { dealId, clientId: buyerId, side: 'buyer' },
    { dealId, clientId: sellerId, side: 'seller' },
  ]);
});

async function data(id: string) {
  return (await db.query.documents.findFirst({ where: eq(documents.id, id) }))!;
}

describe('documents', () => {
  it('fills a new agreement from the deal: parties, property, deal dates and agent', async () => {
    const { id, docNo } = await createDocument(db, agent, { formType: 'agreement_of_sale', dealId });
    expect(docNo).toMatch(/^AOS-\d{4}-0001$/);
    const d = await data(id);
    expect(d.formNo).toBe('JR-PA-100');
    expect(d.data).toMatchObject({ seller_name: 'Example Seller Legal', seller_contact: 'ExampleSellerRbx', seller_addr: 'Example forwarding address', buyer_name: 'Example Buyer', prop_address: 'Example Lane', prop_zip: '17110', price: '365000', prop_beds: '3', settle_date: '2026-11-30', agent_name: 'Example Agent', prop_state: 'PA' });
    expect(d.dealId).toBe(dealId);

    // A later receipt on the same deal picks up the agreement number.
    const em = await createDocument(db, agent, { formType: 'earnest_money', dealId });
    expect((await data(em.id)).data.agreement_no).toBe(docNo);
  });

  it('maps the seller’s disclosures onto the disclosure statement', async () => {
    const { id } = await createDocument(db, agent, { formType: 'disclosure_statement', listingId });
    const d = await data(id);
    expect(d.data).toMatchObject({ 'cond.roof.a': 'No', 'cond.roof.d': 'Example roof note', 'cond.radon.a': 'Unknown', seller_name: 'Example Seller Legal' });
    const links = await db.select().from(documentClients).where(eq(documentClients.documentId, id));
    expect(links.map((l) => [l.clientId, l.role])).toEqual([[sellerId, 'seller']]);
  });

  it('fills an open document without wiping what was typed', async () => {
    const { id } = await createDocument(db, agent, { formType: 'listing_contract' });
    const out = await fillDocument(db, agent, id, { seller_name: '', taxes: 'Example typed taxes' }, { listingId });
    expect(out).toMatchObject({ seller_name: 'Example Seller Legal', taxes: 'Example typed taxes', seller_vesting: 'Sole owner' });
  });

  it('saves signatures, and only marks signed when every required party has signed', async () => {
    const { id } = await createDocument(db, agent, { formType: 'agreement_change', dealId });
    await saveDocument(db, agent, id, { data: { change_type: 'Price change', 'chg.price.to': '355000' }, signatures: [{ party: 'buyer', typedName: 'Example Buyer', signedOn: '2026-10-20' }] });
    await expect(setDocumentStatus(db, agent, id, 'signed')).rejects.toThrow('Still needs signing by: Seller, the agent.');
    await expect(saveDocument(db, agent, id, { data: {}, signatures: [{ party: 'seller', typedName: 'Example Seller', signedOn: '' }] })).rejects.toThrow('Check the signatures.');
    await saveDocument(db, agent, id, {
      data: { change_type: 'Price change' },
      signatures: [
        { party: 'buyer', typedName: 'Example Buyer', signedOn: '2026-10-20' },
        { party: 'seller', typedName: 'Example Seller', signedOn: '2026-10-21' },
        { party: 'agent', typedName: 'Example Agent', signedOn: '2026-10-21' },
      ],
    });
    await setDocumentStatus(db, agent, id, 'signed');
    expect((await data(id)).signedAt).not.toBeNull();
    await expect(saveDocument(db, agent, id, { data: {} })).rejects.toThrow('This document is signed');
    await expect(setDocumentStatus(db, agent, id, 'draft')).rejects.toThrow('Only the Owner or an Admin');
    await setDocumentStatus(db, owner, id, 'draft');
  });

  it('keeps documents to the agents and clients involved, and tells the client when shared', async () => {
    const { id } = await createDocument(db, agent, { formType: 'agreement_of_sale', dealId });
    const d = await data(id);
    expect(await canSeeDocument(db, agent, d)).toBe(true);
    expect(await canSeeDocument(db, agent2, d)).toBe(false);
    expect(await canSeeDocument(db, client, d)).toBe(false);
    await expect(saveDocument(db, agent2, id, { data: {} })).rejects.toThrow('doesn’t exist');
    await shareDocument(db, agent, id, true);
    expect(await canSeeDocument(db, client, await data(id))).toBe(true);
    const n = await db.select().from(notifications).where(eq(notifications.userId, 'c'));
    expect(n.map((x) => x.link)).toEqual([`/account/documents/${id}`]);
  });
});

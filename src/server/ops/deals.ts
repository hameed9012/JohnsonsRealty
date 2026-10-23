import 'server-only';
import { and, eq, inArray, ne, notInArray } from 'drizzle-orm';
import type { DB, Executor } from '@/db/client';
import { clients, dealConfidential, dealParties, deals, listings, priceHistory, saleAgents, saleCommissions, sales, users } from '@/db/schema';
import { fieldErrors } from '@/lib/action-result';
import { saleNo } from '@/lib/format';
import { canTransition, type ListingStatus } from '@/lib/listing-status';
import { can, type Actor } from '@/lib/permissions';
import { nextSaleNo } from '@/lib/refs';
import { dealCreateSchema, dealDatesSchema, offerSchema, saleSchema } from '@/lib/schemas/ops';
import { audit } from '@/server/audit';
import { notifyUsers } from '@/server/notify';
import { ServiceError } from '@/server/listings/service';

type Deal = typeof deals.$inferSelect;
type Stage = Deal['stage'];

export const STAGE_WORDS: Record<Stage, string> = {
  active: 'Active',
  under_offer: 'Under Offer',
  under_contract: 'Under Contract',
  settlement: 'Settlement',
  closed: 'Closed',
  fallen_through: 'Fallen through',
};

const OPEN_STAGES: Stage[] = ['active', 'under_offer', 'under_contract', 'settlement'];

/** The listing status a deal stage implies. Closing happens only by recording a sale. */
export function listingStatusFor(stage: Stage, purpose: 'sale' | 'rent'): ListingStatus | null {
  if (stage === 'active' || stage === 'fallen_through') return purpose === 'rent' ? 'for_lease' : 'active';
  if (stage === 'under_offer') return 'under_offer';
  if (stage === 'under_contract' || stage === 'settlement') return 'under_contract';
  return null;
}

async function partyUsers(ex: Executor, dealId: string) {
  const rows = await ex.select({ userId: clients.userId }).from(dealParties).innerJoin(clients, eq(clients.id, dealParties.clientId)).where(eq(dealParties.dealId, dealId));
  return rows.map((r) => r.userId).filter((u): u is string => !!u);
}

async function getDeal(ex: Executor, actor: Actor, id: string) {
  const d = await ex.query.deals.findFirst({ where: eq(deals.id, id) });
  if (!d) throw new ServiceError('That deal doesn’t exist.');
  if (!can(actor, 'deal.manage', { agentId: d.agentId })) throw new ServiceError('You can’t change this deal.');
  return d;
}

/** Opens a deal on a listing for a buyer or tenant. The seller's client file joins as the other side. */
export async function createDeal(ex: Executor, actor: Actor, input: unknown): Promise<Deal> {
  if (!can(actor, 'portal.access')) throw new ServiceError('You can’t open deals.');
  const p = dealCreateSchema.safeParse(input);
  if (!p.success) throw new ServiceError('Check the highlighted fields.', fieldErrors(p.error));
  const l = await ex.query.listings.findFirst({ where: eq(listings.id, p.data.listingId!) });
  if (!l || !['active', 'for_lease', 'coming_soon', 'under_offer', 'under_contract'].includes(l.status)) {
    throw new ServiceError('Check the highlighted fields.', { listingId: 'Choose a listing that’s on the market.' });
  }
  const c = await ex.query.clients.findFirst({ where: eq(clients.id, p.data.clientId!) });
  if (!c) throw new ServiceError('Check the highlighted fields.', { clientId: 'Choose a client file.' });
  const agentId = l.listingAgentId ?? actor.id;
  if (!can(actor, 'deal.manage', { agentId })) throw new ServiceError('Only the listing agent or the Owner can open a deal on this listing.');
  const side = p.data.side ?? (l.purpose === 'rent' ? 'tenant' : 'buyer');
  const [d] = await ex.insert(deals).values({ listingId: l.id, agentId, stage: 'active' }).returning();
  await ex.insert(dealParties).values({ dealId: d!.id, clientId: c.id, side });
  if (l.sellerClientId && l.sellerClientId !== c.id) {
    await ex.insert(dealParties).values({ dealId: d!.id, clientId: l.sellerClientId, side: l.purpose === 'rent' ? 'landlord' : 'seller' }).onConflictDoNothing();
  }
  await ex.insert(dealConfidential).values({ dealId: d!.id }).onConflictDoNothing();
  const role = side === 'tenant' ? 'tenant' : 'buyer';
  if (!c.roles.includes(role)) await ex.update(clients).set({ roles: [...c.roles, role] }).where(eq(clients.id, c.id));
  await audit(ex, { actorId: actor.id, action: 'deal.create', entity: 'deal', entityId: d!.id, summary: `Opened a deal on ${l.addressLine || l.refNo} for ${c.displayName}` });
  return d!;
}

export async function updateDealDetails(ex: Executor, actor: Actor, id: string, input: unknown) {
  const d = await getDeal(ex, actor, id);
  const p = dealDatesSchema.safeParse(input);
  if (!p.success) throw new ServiceError('Check the highlighted fields.', fieldErrors(p.error));
  await ex.update(deals).set(p.data).where(eq(deals.id, id));
  await audit(ex, { actorId: actor.id, action: 'deal.update', entity: 'deal', entityId: id, summary: 'Updated deal dates and notes' });
  return d;
}

export async function addOffer(ex: Executor, actor: Actor, id: string, input: unknown) {
  await getDeal(ex, actor, id);
  if (!can(actor, 'deal.viewConfidential', { agentId: (await ex.query.deals.findFirst({ where: eq(deals.id, id) }))!.agentId })) throw new ServiceError('You can’t see offers on this deal.');
  const p = offerSchema.safeParse(input);
  if (!p.success) throw new ServiceError('Check the highlighted fields.', fieldErrors(p.error));
  const conf = await ex.query.dealConfidential.findFirst({ where: eq(dealConfidential.dealId, id) });
  const offers = [...(conf?.offers ?? []), { on: p.data.on!, amount: p.data.amount!, by: p.data.by!, note: p.data.note ?? undefined }];
  await ex.insert(dealConfidential).values({ dealId: id, offers }).onConflictDoUpdate({ target: dealConfidential.dealId, set: { offers } });
  await audit(ex, { actorId: actor.id, action: 'deal.offer', entity: 'deal', entityId: id, summary: `Logged an offer from the ${p.data.by}` });
}

export interface StageChange {
  deal: Deal;
  from: Stage;
  to: Stage;
  listing: typeof listings.$inferSelect;
  listingStatus: ListingStatus | null;
}

/** Moves a deal through the pipeline and keeps the listing's status in step. */
export async function changeDealStage(ex: Executor, actor: Actor, id: string, to: Stage): Promise<StageChange> {
  const d = await getDeal(ex, actor, id);
  if (to === 'closed') throw new ServiceError('Record the sale to close a deal.');
  if (d.stage === 'closed') throw new ServiceError('This deal is closed.');
  if (d.stage === to) throw new ServiceError(`This deal is already ${STAGE_WORDS[to]}.`);
  const l = (await ex.query.listings.findFirst({ where: eq(listings.id, d.listingId) }))!;
  let status = listingStatusFor(to, l.purpose);
  // If another deal still holds the listing under offer or contract, leave the listing where it is.
  if (status === 'active' || status === 'for_lease') {
    const others = await ex.query.deals.findFirst({ where: and(eq(deals.listingId, l.id), ne(deals.id, d.id), inArray(deals.stage, ['under_offer', 'under_contract', 'settlement'])) });
    if (others) status = null;
  }
  if (status && status !== l.status) {
    if (!canTransition(l.status as ListingStatus, status, l.purpose)) throw new ServiceError(`The listing is ${l.status.replace('_', ' ')}, so the deal can’t move to ${STAGE_WORDS[to]}.`);
    await ex.update(listings).set({ status }).where(eq(listings.id, l.id));
  } else status = null;
  const patch: Partial<Deal> = { stage: to };
  if (to === 'under_offer' && !d.offerDate) patch.offerDate = new Date().toISOString().slice(0, 10);
  if (to === 'under_contract' && !d.acceptedDate) patch.acceptedDate = new Date().toISOString().slice(0, 10);
  await ex.update(deals).set(patch).where(eq(deals.id, id));
  await audit(ex, { actorId: actor.id, action: 'deal.stage', entity: 'deal', entityId: id, summary: `Moved the deal on ${l.addressLine || l.refNo} from ${STAGE_WORDS[d.stage]} to ${STAGE_WORDS[to]}`, diff: { stage: { from: d.stage, to } } });
  if (d.sharedWithClient) {
    await notifyUsers(ex, await partyUsers(ex, id), { kind: 'deal.stage', title: `Your deal is now ${STAGE_WORDS[to]}`, body: l.addressLine || l.refNo, link: `/account/deal/${id}` });
  }
  return { deal: { ...d, ...patch }, from: d.stage, to, listing: l, listingStatus: status };
}

export interface SaleResult {
  saleNo: number;
  saleId: string;
  listing: typeof listings.$inferSelect;
  price: number;
}

/** Records a sale (or lease) from a deal: next Sale No., commissions, listing sold/leased, deal closed. */
export async function recordSale(db: DB, actor: Actor, dealId: string, input: unknown): Promise<SaleResult> {
  const p = saleSchema.safeParse(input);
  if (!p.success) throw new ServiceError('Check the highlighted fields.', fieldErrors(p.error));
  return db.transaction(async (tx) => {
    const d = await getDeal(tx, actor, dealId);
    if (!can(actor, 'sale.record', { agentId: d.agentId })) throw new ServiceError('You can’t record this sale.');
    if (d.stage === 'closed' || d.stage === 'fallen_through') throw new ServiceError('This deal is already closed.');
    const l = (await tx.query.listings.findFirst({ where: eq(listings.id, d.listingId) }))!;
    const final: ListingStatus = l.purpose === 'rent' ? 'leased' : 'sold';
    if (!canTransition(l.status as ListingStatus, final, l.purpose)) throw new ServiceError(`The listing is ${l.status.replace('_', ' ')}, so it can’t be marked ${final}.`);
    const parties = await tx.select({ clientId: dealParties.clientId, side: dealParties.side }).from(dealParties).where(eq(dealParties.dealId, dealId));
    const buyer = parties.find((x) => x.side === 'buyer' || x.side === 'tenant');
    const seller = parties.find((x) => x.side === 'seller' || x.side === 'landlord');
    const n = await nextSaleNo(tx);
    const [s] = await tx
      .insert(sales)
      .values({ saleNo: n, listingId: l.id, dealId, buyerClientId: buyer?.clientId ?? null, sellerClientId: seller?.clientId ?? l.sellerClientId, price: p.data.price!, soldOn: p.data.soldOn!, settledOn: p.data.settledOn, createdBy: actor.id })
      .returning();
    const agents: { agentId: string; side: 'seller' | 'buyer' | 'landlord' | 'tenant' }[] = [];
    if (d.agentId) agents.push({ agentId: d.agentId, side: l.purpose === 'rent' ? 'landlord' : 'seller' });
    if (p.data.buyerAgentId && p.data.buyerAgentId !== d.agentId) {
      const ok = await tx.query.users.findFirst({ where: and(eq(users.id, p.data.buyerAgentId), inArray(users.role, ['owner', 'admin', 'agent'])) });
      if (!ok) throw new ServiceError('Check the highlighted fields.', { buyerAgentId: 'Choose an agent from the team.' });
      agents.push({ agentId: p.data.buyerAgentId, side: l.purpose === 'rent' ? 'tenant' : 'buyer' });
    }
    if (agents.length) await tx.insert(saleAgents).values(agents.map((a) => ({ saleId: s!.id, ...a })));
    if (p.data.commissions.length) {
      await tx.insert(saleCommissions).values(p.data.commissions.map((c) => ({ saleId: s!.id, agentId: c.agentId, ratePercent: c.ratePercent, amount: c.amount!, note: c.note })));
    }
    await tx.update(listings).set({ status: final }).where(eq(listings.id, l.id));
    await tx.insert(priceHistory).values({ listingId: l.id, price: p.data.price!, event: final, on: new Date(p.data.soldOn! + 'T12:00:00Z') });
    await tx.update(deals).set({ stage: 'closed', closedAt: new Date(), settlementDate: p.data.settledOn ?? d.settlementDate }).where(eq(deals.id, dealId));
    // Other open deals on the same listing fall through.
    await tx.update(deals).set({ stage: 'fallen_through' }).where(and(eq(deals.listingId, l.id), notInArray(deals.id, [dealId]), inArray(deals.stage, OPEN_STAGES)));
    await audit(tx, { actorId: actor.id, action: 'sale.record', entity: 'sale', entityId: s!.id, summary: `Recorded ${saleNo(n)}: ${l.addressLine || l.refNo} for $${p.data.price!.toLocaleString('en-US')}` });
    if (d.sharedWithClient) {
      await notifyUsers(tx, await partyUsers(tx, dealId), { kind: 'deal.closed', title: final === 'sold' ? 'Your deal has closed' : 'Your lease is signed', body: l.addressLine || l.refNo, link: `/account/deal/${dealId}` });
    }
    return { saleNo: n, saleId: s!.id, listing: { ...l, status: final }, price: p.data.price! };
  });
}

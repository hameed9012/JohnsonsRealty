import 'server-only';
import { asc, desc, eq, inArray, or } from 'drizzle-orm';
import type { AreaPick, Signature } from '@/components/documents/DocSheet';
import { db } from '@/db/client';
import { clients, deals, documentClients, documentSignatures, documents, listings, users } from '@/db/schema';
import type { DocData } from '@/forms/types';
import type { Actor } from '@/lib/permissions';
import { canSeeDocument } from '@/server/ops/documents';
import { areaOptions, getAreas } from '@/server/queries/areas';
import { getSettings } from '@/server/settings';

/** Brokerage lines for the document band, from settings. */
export async function brokerageLines() {
  const s = await getSettings();
  return {
    name: s.brokerageName,
    subline: s.brokerageSubline,
    contact: [...(s.officeLocation ? [{ label: 'Office', value: s.officeLocation }] : []), ...(s.chirperHandle ? [{ label: 'Chirper', value: '@' + s.chirperHandle }] : [])],
  };
}

/** One document with its signatures and the agent whose name goes on the agent line. Null when the actor can't see it. */
export async function documentView(actor: Actor, id: string) {
  const d = await db.query.documents.findFirst({ where: eq(documents.id, id) });
  if (!d || !(await canSeeDocument(db, actor, d))) return null;
  const [sigs, links, deal, listing] = await Promise.all([
    db.select().from(documentSignatures).where(eq(documentSignatures.documentId, id)),
    db.select().from(documentClients).where(eq(documentClients.documentId, id)),
    d.dealId ? db.query.deals.findFirst({ where: eq(deals.id, d.dealId), columns: { id: true, agentId: true, stage: true } }) : null,
    d.listingId ? db.query.listings.findFirst({ where: eq(listings.id, d.listingId), columns: { id: true, addressLine: true, refNo: true, listingAgentId: true, purpose: true } }) : null,
  ]);
  const agentId = deal?.agentId ?? listing?.listingAgentId ?? d.createdBy;
  const agent = agentId ? await db.query.users.findFirst({ where: eq(users.id, agentId), columns: { displayName: true } }) : null;
  const signatures: Record<string, Signature> = Object.fromEntries(sigs.map((s) => [s.party, { typedName: s.typedName, signedOn: s.signedOn }]));
  return { doc: { ...d, data: d.data as DocData }, signatures, links, deal, listing, agentName: agent?.displayName ?? null };
}

export async function areaPicks(): Promise<AreaPick[]> {
  return areaOptions(await getAreas()).map((o) => ({ label: o.label, city: o.area.city ?? o.label.split(' · ').pop() ?? '', zip: o.area.postalCodes[0] ?? '' }));
}

/** Listings an agent can fill a document from: their own (managers: all). */
export async function listingOptions(actor: Actor) {
  const wide = actor.role === 'owner' || actor.role === 'admin' || !!actor.wideConfidentialAccess;
  const rows = await db
    .select({ id: listings.id, addressLine: listings.addressLine, refNo: listings.refNo, sellerId: listings.sellerClientId, seller: clients.displayName })
    .from(listings)
    .leftJoin(clients, eq(clients.id, listings.sellerClientId))
    .where(wide ? undefined : or(eq(listings.listingAgentId, actor.id), eq(listings.submittedByUserId, actor.id)))
    .orderBy(desc(listings.updatedAt))
    .limit(300);
  return rows.map((r) => ({ value: r.id, label: [r.addressLine || 'Address not set', r.seller, r.refNo].filter(Boolean).join(' · '), sellerId: r.sellerId }));
}

/** Documents shared with a client, for their account. */
export async function sharedDocumentsFor(userId: string) {
  const { dealParties } = await import('@/db/schema');
  const mine = db.select({ id: clients.id }).from(clients).where(eq(clients.userId, userId));
  return db
    .select({ id: documents.id, formType: documents.formType, docNo: documents.docNo, status: documents.status, updatedAt: documents.updatedAt })
    .from(documents)
    .where(
      or(
        inArray(documents.id, db.select({ id: documentClients.documentId }).from(documentClients).where(inArray(documentClients.clientId, mine))),
        inArray(documents.dealId, db.select({ id: dealParties.dealId }).from(dealParties).where(inArray(dealParties.clientId, mine))),
      ),
    )
    .orderBy(asc(documents.createdAt));
}

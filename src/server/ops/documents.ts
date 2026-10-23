import 'server-only';
import { and, desc, eq, inArray, or } from 'drizzle-orm';
import { z } from 'zod';
import type { Executor } from '@/db/client';
import { clients, dealParties, deals, documentClients, documentSignatures, documents, listings, siteSettings, users } from '@/db/schema';
import { FORM_TYPES } from '@/db/schema/enums';
import { FORM_DEFS } from '@/forms/defs';
import { fillFrom, type FillContext } from '@/forms/fill';
import { applyFill, docSchema, emptyData } from '@/forms/model';
import type { DocData } from '@/forms/types';
import { fieldErrors } from '@/lib/action-result';
import { can, type Actor } from '@/lib/permissions';
import { FORMS, nextDocNo, type FormType } from '@/lib/refs';
import { audit } from '@/server/audit';
import { loadBundle } from '@/server/listings/bundle';
import { ServiceError } from '@/server/listings/service';
import { notifyUsers } from '@/server/notify';

type DocRow = typeof documents.$inferSelect;
export type DocSide = 'seller' | 'buyer' | 'landlord' | 'tenant';

const manager = (a: Actor) => a.role === 'owner' || a.role === 'admin';

/** Clients on a document: linked directly, or party to its deal. */
async function docClients(ex: Executor, d: Pick<DocRow, 'id' | 'dealId'>) {
  const direct = await ex
    .select({ id: clients.id, userId: clients.userId, agentId: clients.agentId, role: documentClients.role })
    .from(documentClients)
    .innerJoin(clients, eq(clients.id, documentClients.clientId))
    .where(eq(documentClients.documentId, d.id));
  const viaDeal = d.dealId
    ? await ex.select({ id: clients.id, userId: clients.userId, agentId: clients.agentId, role: dealParties.side }).from(dealParties).innerJoin(clients, eq(clients.id, dealParties.clientId)).where(eq(dealParties.dealId, d.dealId))
    : [];
  const seen = new Set<string>();
  return [...direct, ...viaDeal].filter((c) => !seen.has(c.id) && seen.add(c.id));
}

/**
 * Staff see documents for their own deals, listings and clients (managers and wide-access agents see all).
 * Clients see a document only once it is shared with them.
 */
export async function canSeeDocument(ex: Executor, actor: Actor, d: DocRow): Promise<boolean> {
  if (actor.status !== 'active') return false;
  if (manager(actor) || (actor.role === 'agent' && actor.wideConfidentialAccess)) return true;
  const cs = await docClients(ex, d);
  if (actor.role === 'client') return d.sharedWithClient && cs.some((c) => c.userId === actor.id);
  if (d.createdBy === actor.id || cs.some((c) => c.agentId === actor.id)) return true;
  if (d.dealId) {
    const deal = await ex.query.deals.findFirst({ where: eq(deals.id, d.dealId), columns: { agentId: true } });
    if (deal?.agentId === actor.id) return true;
  }
  if (d.listingId) {
    const l = await ex.query.listings.findFirst({ where: eq(listings.id, d.listingId), columns: { listingAgentId: true } });
    if (l?.listingAgentId === actor.id) return true;
  }
  return false;
}

async function loadEditable(ex: Executor, actor: Actor, id: string): Promise<DocRow> {
  const d = await ex.query.documents.findFirst({ where: eq(documents.id, id) });
  if (!d || !can(actor, 'document.manage') || !(await canSeeDocument(ex, actor, d))) throw new ServiceError('That document doesn’t exist.');
  return d;
}

export interface FillPicks {
  dealId?: string | null;
  sellerClientId?: string | null;
  buyerClientId?: string | null;
  listingId?: string | null;
}

/** Gathers the client files, listing and deal for "Fill from client file". Confidential figures only for those allowed. */
export async function fillContext(ex: Executor, actor: Actor, picks: FillPicks): Promise<{ ctx: FillContext; links: { clientId: string; role: DocSide }[]; listingId: string | null; dealId: string | null }> {
  let { sellerClientId, buyerClientId, listingId } = picks;
  let deal: typeof deals.$inferSelect | undefined;
  if (picks.dealId) {
    deal = await ex.query.deals.findFirst({ where: eq(deals.id, picks.dealId) });
    if (!deal) throw new ServiceError('That deal doesn’t exist.');
    const parties = await ex.select().from(dealParties).where(eq(dealParties.dealId, deal.id));
    if (!can(actor, 'deal.view', { agentId: deal.agentId })) throw new ServiceError('You can’t use this deal.');
    listingId ??= deal.listingId;
    buyerClientId ??= parties.find((p) => p.side === 'buyer' || p.side === 'tenant')?.clientId;
    sellerClientId ??= parties.find((p) => p.side === 'seller' || p.side === 'landlord')?.clientId;
  }
  const bundle = listingId ? await loadBundle(ex, listingId, { confidential: false }) : null;
  if (listingId && !bundle) throw new ServiceError('That listing doesn’t exist.');
  sellerClientId ??= bundle?.sellerClientId ?? null;
  const seeListingConf = bundle ? can(actor, 'listing.viewConfidential', { source: bundle.source, status: bundle.status, listingAgentId: bundle.listingAgentId, submittedByUserId: bundle.submittedByUserId }) : false;
  const conf = bundle && seeListingConf ? await ex.query.listingConfidential.findFirst({ where: (t, { eq }) => eq(t.listingId, bundle.id) }) : null;

  const loadParty = async (id: string | null | undefined) => {
    if (!id) return null;
    const c = await ex.query.clients.findFirst({ where: eq(clients.id, id), with: { people: { orderBy: (p, { asc }) => [asc(p.sortOrder)] } } });
    if (!c) throw new ServiceError('That client file doesn’t exist.');
    if (!can(actor, 'client.view', { agentId: c.agentId, userId: c.userId })) throw new ServiceError('You can’t use this client file.');
    return c;
  };
  const [seller, buyer] = await Promise.all([loadParty(sellerClientId), loadParty(buyerClientId)]);
  const agentId = deal?.agentId ?? bundle?.listingAgentId ?? actor.id;
  const [agent, settings, agreement] = await Promise.all([
    ex.query.users.findFirst({ where: eq(users.id, agentId), columns: { displayName: true, name: true } }),
    ex.query.siteSettings.findFirst({ where: eq(siteSettings.id, 1) }),
    deal
      ? ex.query.documents.findFirst({ where: and(eq(documents.dealId, deal.id), inArray(documents.formType, ['agreement_of_sale', 'business_sale'])), orderBy: [desc(documents.createdAt)], columns: { docNo: true } })
      : Promise.resolve(undefined),
  ]);
  const rent = bundle?.purpose === 'rent';
  return {
    ctx: {
      seller,
      buyer,
      listing: bundle,
      confidential: conf ?? null,
      deal: deal ? { settlementDate: deal.settlementDate } : null,
      agentName: agent?.displayName ?? agent?.name ?? null,
      brokerageName: settings?.brokerageName ?? null,
      agreementNo: agreement?.docNo ?? null,
    },
    links: [...(seller ? [{ clientId: seller.id, role: (rent ? 'landlord' : 'seller') as DocSide }] : []), ...(buyer ? [{ clientId: buyer.id, role: (rent ? 'tenant' : 'buyer') as DocSide }] : [])],
    listingId: bundle?.id ?? null,
    dealId: deal?.id ?? null,
  };
}

async function link(ex: Executor, documentId: string, links: { clientId: string; role: string }[]) {
  if (links.length) await ex.insert(documentClients).values(links.map((l) => ({ documentId, ...l }))).onConflictDoNothing();
}

const createSchema = z.object({
  formType: z.enum(FORM_TYPES),
  dealId: z.uuid().optional().nullable(),
  sellerClientId: z.uuid().optional().nullable(),
  buyerClientId: z.uuid().optional().nullable(),
  listingId: z.uuid().optional().nullable(),
});

/** Starts a draft. With a deal, client or listing it is filled from the client file straight away. */
export async function createDocument(ex: Executor, actor: Actor, input: unknown): Promise<{ id: string; docNo: string }> {
  if (!can(actor, 'document.manage')) throw new ServiceError('Only staff prepare documents.');
  const p = createSchema.safeParse(input);
  if (!p.success) throw new ServiceError('Choose a form.', fieldErrors(p.error));
  const { formType, ...picks } = p.data;
  const any = picks.dealId || picks.sellerClientId || picks.buyerClientId || picks.listingId;
  const f = any ? await fillContext(ex, actor, picks) : null;
  const data = applyFill(formType, emptyData(formType), f ? fillFrom(f.ctx) : {});
  const docNo = await nextDocNo(ex, formType);
  const [d] = await ex
    .insert(documents)
    .values({ formType, formNo: FORMS[formType].formNo, docNo, data, dealId: f?.dealId ?? null, listingId: f?.listingId ?? null, createdBy: actor.id })
    .returning({ id: documents.id });
  if (f) await link(ex, d!.id, f.links);
  await audit(ex, { actorId: actor.id, action: 'document.create', entity: 'document', entityId: d!.id, summary: `Started ${FORMS[formType].title} ${docNo}` });
  return { id: d!.id, docNo };
}

/** Fills an open document from the chosen client files and listing, keeping what was typed where the file is empty. */
export async function fillDocument(ex: Executor, actor: Actor, id: string, current: unknown, picks: FillPicks): Promise<DocData> {
  const d = await loadEditable(ex, actor, id);
  if (d.status === 'signed') throw new ServiceError('This document is signed. Reopen it to make changes.');
  const base = docSchema(d.formType).safeParse(current ?? d.data);
  if (!base.success) throw new ServiceError('Check the highlighted fields.', fieldErrors(base.error));
  const f = await fillContext(ex, actor, picks);
  await link(ex, d.id, f.links);
  if (!d.listingId && f.listingId) await ex.update(documents).set({ listingId: f.listingId }).where(eq(documents.id, d.id));
  return applyFill(d.formType, base.data, fillFrom(f.ctx));
}

const sigSchema = z.array(z.object({ party: z.string().max(40), typedName: z.string().trim().max(120), signedOn: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Enter a date.') })).max(10);

/** Saves the fields and typed signatures. Signed documents are locked. */
export async function saveDocument(ex: Executor, actor: Actor, id: string, input: { data: unknown; signatures?: unknown }) {
  const d = await loadEditable(ex, actor, id);
  if (d.status === 'signed') throw new ServiceError('This document is signed. Reopen it to make changes.');
  const p = docSchema(d.formType).safeParse(input.data);
  if (!p.success) throw new ServiceError('Check the highlighted fields.', fieldErrors(p.error));
  const s = sigSchema.safeParse(input.signatures ?? []);
  if (!s.success) throw new ServiceError('Check the signatures.', fieldErrors(s.error));
  const parties = new Set(FORM_DEFS[d.formType].signatures.map((x) => x.party));
  for (const sig of s.data) {
    if (!parties.has(sig.party)) throw new ServiceError('That signature line isn’t on this form.');
    if (!!sig.typedName !== !!sig.signedOn) throw new ServiceError('Check the signatures.', { [`sig.${sig.party}`]: sig.typedName ? 'Add the date it was signed.' : 'Type the name of the person signing.' });
  }
  await ex.update(documents).set({ data: p.data }).where(eq(documents.id, d.id));
  await ex.delete(documentSignatures).where(eq(documentSignatures.documentId, d.id));
  const filled = s.data.filter((x) => x.typedName);
  if (filled.length) await ex.insert(documentSignatures).values(filled.map((x) => ({ documentId: d.id, party: x.party, typedName: x.typedName, signedOn: x.signedOn, recordedBy: actor.id })));
  await audit(ex, { actorId: actor.id, action: 'document.save', entity: 'document', entityId: d.id, summary: `Saved ${FORMS[d.formType].title} ${d.docNo}` });
}

const STATUS_WORDS = { draft: 'Draft', sent: 'Sent', signed: 'Signed' } as const;

/** Draft → Sent → Signed. Marking signed needs every required party's signature; only managers reopen a signed document. */
export async function setDocumentStatus(ex: Executor, actor: Actor, id: string, status: 'draft' | 'sent' | 'signed') {
  const d = await loadEditable(ex, actor, id);
  if (d.status === status) return;
  if (d.status === 'signed' && !manager(actor)) throw new ServiceError('Only the Owner or an Admin can reopen a signed document.');
  if (status === 'signed') {
    const sigs = await ex.select({ party: documentSignatures.party }).from(documentSignatures).where(eq(documentSignatures.documentId, d.id));
    const have = new Set(sigs.map((x) => x.party));
    const missing = FORM_DEFS[d.formType].signatures.filter((x) => !x.optional && !have.has(x.party));
    if (missing.length) throw new ServiceError(`Still needs signing by: ${missing.map((m) => (m.agent ? 'the agent' : m.label)).join(', ')}.`);
  }
  await ex
    .update(documents)
    .set({ status, signedAt: status === 'signed' ? new Date() : null })
    .where(eq(documents.id, d.id));
  await audit(ex, { actorId: actor.id, action: 'document.status', entity: 'document', entityId: d.id, summary: `${FORMS[d.formType].title} ${d.docNo} marked ${STATUS_WORDS[status]}` });
}

/** Shares the client copy to the account of every client on the document, and tells them. */
export async function shareDocument(ex: Executor, actor: Actor, id: string, shared: boolean) {
  const d = await loadEditable(ex, actor, id);
  if (d.sharedWithClient === shared) return;
  const cs = await docClients(ex, d);
  if (shared && !cs.some((c) => c.userId)) throw new ServiceError('No client on this document has an account yet. Link the client file to their account first.');
  await ex.update(documents).set({ sharedWithClient: shared }).where(eq(documents.id, d.id));
  if (shared) {
    await notifyUsers(
      ex,
      cs.map((c) => c.userId!).filter(Boolean),
      { kind: 'document_shared', title: `${FORMS[d.formType].title} shared with you`, body: d.docNo, link: `/account/documents/${d.id}` },
    );
  }
  await audit(ex, { actorId: actor.id, action: shared ? 'document.share' : 'document.unshare', entity: 'document', entityId: d.id, summary: `${shared ? 'Shared' : 'Stopped sharing'} ${FORMS[d.formType].title} ${d.docNo}` });
}

export async function deleteDraft(ex: Executor, actor: Actor, id: string) {
  const d = await loadEditable(ex, actor, id);
  if (d.status !== 'draft') throw new ServiceError('Only drafts can be deleted.');
  await ex.delete(documents).where(eq(documents.id, d.id));
  await audit(ex, { actorId: actor.id, action: 'document.delete', entity: 'document', entityId: d.id, summary: `Deleted draft ${FORMS[d.formType].title} ${d.docNo}` });
}

/** Documents the actor may see, newest first, for the portal index. */
export async function documentList(ex: Executor, actor: Actor, opts: { type?: FormType; status?: string } = {}) {
  const wide = manager(actor) || !!actor.wideConfidentialAccess;
  const conds = [];
  if (opts.type) conds.push(eq(documents.formType, opts.type));
  if (opts.status === 'draft' || opts.status === 'sent' || opts.status === 'signed') conds.push(eq(documents.status, opts.status));
  if (!wide) {
    conds.push(
      or(
        eq(documents.createdBy, actor.id),
        inArray(documents.dealId, ex.select({ id: deals.id }).from(deals).where(eq(deals.agentId, actor.id))),
        inArray(documents.listingId, ex.select({ id: listings.id }).from(listings).where(eq(listings.listingAgentId, actor.id))),
        inArray(documents.id, ex.select({ id: documentClients.documentId }).from(documentClients).innerJoin(clients, eq(clients.id, documentClients.clientId)).where(eq(clients.agentId, actor.id))),
      )!,
    );
  }
  return ex
    .select({ id: documents.id, formType: documents.formType, docNo: documents.docNo, status: documents.status, shared: documents.sharedWithClient, updatedAt: documents.updatedAt, dealId: documents.dealId, address: listings.addressLine, author: users.displayName })
    .from(documents)
    .leftJoin(listings, eq(listings.id, documents.listingId))
    .leftJoin(users, eq(users.id, documents.createdBy))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(documents.updatedAt))
    .limit(300);
}

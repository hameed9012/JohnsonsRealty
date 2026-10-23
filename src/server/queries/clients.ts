import 'server-only';
import { and, asc, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { activityLog, clients, dealParties, deals, documentClients, documents, listings, showings, users } from '@/db/schema';
import { can, type Actor } from '@/lib/permissions';

/** Client files the actor may see: managers and wide-access agents see all, other agents their own. */
export async function clientList(actor: Actor, opts: { q?: string; archived?: boolean } = {}) {
  const wide = actor.role === 'owner' || actor.role === 'admin' || !!actor.wideConfidentialAccess;
  const conds = [eq(clients.archived, !!opts.archived)];
  if (!wide) conds.push(eq(clients.agentId, actor.id));
  if (opts.q) conds.push(or(ilike(clients.displayName, `%${opts.q}%`), ilike(clients.legalNameOnForms, `%${opts.q}%`))!);
  return db
    .select({
      id: clients.id,
      displayName: clients.displayName,
      kind: clients.kind,
      roles: clients.roles,
      agentId: clients.agentId,
      agent: users.displayName,
      bestContact: clients.bestContact,
      updatedAt: clients.updatedAt,
      hasAccount: sql<boolean>`${clients.userId} is not null`,
      listings: sql<number>`(select count(*)::int from ${listings} l where l.seller_client_id = ${clients.id})`,
      deals: sql<number>`(select count(*)::int from ${dealParties} dp where dp.client_id = ${clients.id})`,
    })
    .from(clients)
    .leftJoin(users, eq(users.id, clients.agentId))
    .where(and(...conds))
    .orderBy(asc(clients.displayName))
    .limit(500);
}

/** Everything on one client file. Confidential notes only when the actor may see them. */
export async function clientFile(actor: Actor, id: string) {
  const c = await db.query.clients.findFirst({ where: eq(clients.id, id), with: { people: { orderBy: (p, { asc }) => [asc(p.sortOrder)] }, confidential: true, user: { columns: { displayName: true, robloxUsername: true, chirperHandle: true } }, agent: { columns: { displayName: true } } } });
  if (!c || !can(actor, 'client.view', { agentId: c.agentId, userId: c.userId })) return null;
  const seeConf = can(actor, 'client.viewConfidential', { agentId: c.agentId, userId: c.userId });
  const canEdit = can(actor, 'client.edit', { agentId: c.agentId, userId: c.userId });
  const [ls, ds, ss, docs, log] = await Promise.all([
    db.select({ id: listings.id, refNo: listings.refNo, addressLine: listings.addressLine, status: listings.status, purpose: listings.purpose, price: listings.price }).from(listings).where(eq(listings.sellerClientId, id)).orderBy(desc(listings.updatedAt)),
    db
      .select({ id: deals.id, stage: deals.stage, side: dealParties.side, address: listings.addressLine, updatedAt: deals.updatedAt })
      .from(dealParties)
      .innerJoin(deals, eq(deals.id, dealParties.dealId))
      .innerJoin(listings, eq(listings.id, deals.listingId))
      .where(eq(dealParties.clientId, id))
      .orderBy(desc(deals.updatedAt)),
    db
      .select({ id: showings.id, refNo: showings.refNo, status: showings.status, at: showings.requestedFor, confirmedFor: showings.confirmedFor, address: listings.addressLine })
      .from(showings)
      .innerJoin(listings, eq(listings.id, showings.listingId))
      .where(or(eq(showings.clientId, id), c.userId ? eq(showings.requestedBy, c.userId) : sql`false`))
      .orderBy(desc(showings.requestedFor))
      .limit(30),
    db
      .select({ id: documents.id, formType: documents.formType, docNo: documents.docNo, status: documents.status, updatedAt: documents.updatedAt })
      .from(documents)
      .where(
        or(
          sql`${documents.id} in (select document_id from ${documentClients} where client_id = ${id})`,
          inArray(documents.dealId, db.select({ id: dealParties.dealId }).from(dealParties).where(eq(dealParties.clientId, id))),
        ),
      )
      .orderBy(desc(documents.updatedAt)),
    db.select({ id: activityLog.id, summary: activityLog.summary, createdAt: activityLog.createdAt, actor: users.displayName }).from(activityLog).leftJoin(users, eq(users.id, activityLog.actorId)).where(and(eq(activityLog.entity, 'client'), eq(activityLog.entityId, id))).orderBy(desc(activityLog.createdAt)).limit(20),
  ]);
  return { client: { ...c, confidential: seeConf ? c.confidential : undefined }, seeConf, canEdit, listings: ls, deals: ds, showings: ss, documents: docs, activity: log };
}

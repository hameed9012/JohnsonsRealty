import 'server-only';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { agentProfiles, clients, dealParties, deals, documents, listings, messageReads, messages, users } from '@/db/schema';
import { can, type Actor } from '@/lib/permissions';
import { FORMS, type FormType } from '@/lib/refs';
import { cardsWhere } from './cards';

export const DEAL_STAGES = ['active', 'under_offer', 'under_contract', 'settlement', 'closed'] as const;
export const STAGE_LABEL: Record<string, string> = {
  active: 'Active',
  under_offer: 'Under Offer',
  under_contract: 'Under Contract',
  settlement: 'Settlement',
  closed: 'Closed',
  fallen_through: 'Fallen through',
};

/** User IDs of the client accounts party to a deal. */
export async function partyUserIds(dealId: string): Promise<string[]> {
  const rows = await db
    .select({ userId: clients.userId })
    .from(dealParties)
    .innerJoin(clients, eq(clients.id, dealParties.clientId))
    .where(eq(dealParties.dealId, dealId));
  return rows.map((r) => r.userId).filter((u): u is string => !!u);
}

/** Deals the signed-in client is party to, newest first. */
export async function myDeals(userId: string) {
  return db
    .select({ id: deals.id, stage: deals.stage, updatedAt: deals.updatedAt, side: dealParties.side, address: listings.addressLine, slug: listings.slug, purpose: listings.purpose })
    .from(dealParties)
    .innerJoin(clients, eq(clients.id, dealParties.clientId))
    .innerJoin(deals, eq(deals.id, dealParties.dealId))
    .innerJoin(listings, eq(listings.id, deals.listingId))
    .where(and(eq(clients.userId, userId), eq(deals.sharedWithClient, true)))
    .orderBy(desc(deals.updatedAt));
}

/** One deal as its client sees it. Null when the actor isn't a party (or staff). Never includes confidential offers. */
export async function dealForViewer(actor: Actor, id: string) {
  const deal = await db.query.deals.findFirst({ where: eq(deals.id, id) });
  if (!deal) return null;
  const parties = await partyUserIds(id);
  if (!can(actor, 'deal.view', { agentId: deal.agentId, partyUserIds: parties })) return null;
  const staff = actor.role !== 'client';
  if (!staff && !deal.sharedWithClient) return null;

  const [listingCards, agent, docs, thread, side] = await Promise.all([
    cardsWhere(eq(listings.id, deal.listingId), 1),
    deal.agentId
      ? db
          .select({ name: agentProfiles.publicName, title: agentProfiles.title, slug: agentProfiles.slug, chirper: users.chirperHandle, photo: sql<string | null>`(select storage_id from media m where m.id = ${agentProfiles.photoId})` })
          .from(agentProfiles)
          .innerJoin(users, eq(users.id, agentProfiles.userId))
          .where(eq(agentProfiles.userId, deal.agentId))
          .then((r) => r[0] ?? null)
      : Promise.resolve(null),
    db
      .select({ id: documents.id, formType: documents.formType, docNo: documents.docNo, status: documents.status, updatedAt: documents.updatedAt })
      .from(documents)
      .where(and(eq(documents.dealId, id), staff ? undefined : eq(documents.sharedWithClient, true)))
      .orderBy(desc(documents.updatedAt)),
    db
      .select({ id: messages.id, body: messages.body, createdAt: messages.createdAt, authorId: messages.authorId, author: users.displayName, role: users.role })
      .from(messages)
      .leftJoin(users, eq(users.id, messages.authorId))
      .where(eq(messages.dealId, id))
      .orderBy(asc(messages.createdAt)),
    staff
      ? Promise.resolve(null)
      : db
          .select({ side: dealParties.side })
          .from(dealParties)
          .innerJoin(clients, eq(clients.id, dealParties.clientId))
          .where(and(eq(dealParties.dealId, id), eq(clients.userId, actor.id)))
          .then((r) => r[0]?.side ?? null),
  ]);
  return {
    deal,
    listing: listingCards[0] ?? null,
    agent,
    side,
    documents: docs.map((d) => ({ ...d, title: FORMS[d.formType as FormType].title, formNo: FORMS[d.formType as FormType].formNo })),
    messages: thread,
  };
}

export async function markThreadRead(dealId: string, userId: string) {
  await db
    .insert(messageReads)
    .values({ dealId, userId, lastReadAt: new Date() })
    .onConflictDoUpdate({ target: [messageReads.dealId, messageReads.userId], set: { lastReadAt: new Date() } });
}

/** Unread messages across the client's deals, for the dashboard. */
export async function unreadForUser(userId: string): Promise<number> {
  const mine = await myDeals(userId);
  if (!mine.length) return 0;
  const [{ n } = { n: 0 }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(messages)
    .where(
      and(
        inArray(
          messages.dealId,
          mine.map((d) => d.id),
        ),
        sql`${messages.authorId} is distinct from ${userId}`,
        sql`${messages.createdAt} > coalesce((select last_read_at from ${messageReads} r where r.deal_id = ${messages.dealId} and r.user_id = ${userId}), 'epoch'::timestamptz)`,
      ),
    );
  return n;
}

import 'server-only';
import { and, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { enquiries, listings, sales, showings } from '@/db/schema';

function todayRange(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return { start, end: new Date(start.getTime() + 86400000) };
}

const count = sql<number>`count(*)::int`;

/** Sidebar badges. Counts only; no record data. */
export async function portalCounts() {
  const { start, end } = todayRange();
  const [[pending], [today], [open]] = await Promise.all([
    db.select({ n: sql<number>`(select count(*)::int from listings where status = 'pending_review') + (select count(*)::int from listing_revisions where status = 'pending')` }).from(sql`(select 1) as one`),
    db
      .select({ n: count })
      .from(showings)
      .where(and(inArray(showings.status, ['requested', 'confirmed']), gte(showings.requestedFor, start), lt(showings.requestedFor, end))),
    db.select({ n: count }).from(enquiries).where(inArray(enquiries.status, ['new', 'open'])),
  ]);
  return { pendingReview: pending?.n ?? 0, showingsToday: today?.n ?? 0, openEnquiries: open?.n ?? 0 };
}

export async function dashboardTiles() {
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const [[active], [underOffer], [volume]] = await Promise.all([
    db.select({ n: count }).from(listings).where(inArray(listings.status, ['active', 'for_lease', 'coming_soon'])),
    db.select({ n: count }).from(listings).where(inArray(listings.status, ['under_offer', 'under_contract'])),
    db
      .select({ total: sql<number>`coalesce(sum(${sales.price}), 0)::int` })
      .from(sales)
      .where(gte(sales.soldOn, monthStart.toISOString().slice(0, 10))),
  ]);
  const counts = await portalCounts();
  return {
    active: active?.n ?? 0,
    pendingReview: counts.pendingReview,
    underOffer: underOffer?.n ?? 0,
    showingsToday: counts.showingsToday,
    volumeThisMonth: Number(volume?.total ?? 0),
  };
}

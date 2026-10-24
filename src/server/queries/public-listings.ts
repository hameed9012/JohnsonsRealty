import 'server-only';
import { and, desc, eq, inArray, ne, or, sql } from 'drizzle-orm';
import { cache } from 'react';
import { db } from '@/db/client';
import { listings, savedHomes } from '@/db/schema';
import { MARKET_STATUSES, PUBLIC_STATUSES } from '@/lib/listing-status';
import { loadBundle } from '@/server/listings/bundle';
import { toPropertyView } from '@/server/listings/view';

type Status = (typeof listings.status.enumValues)[number];

/** A public listing by slug, or null. Never loads confidential tables. */
export const publicListingBySlug = cache(async (slug: string) => {
  const row = await db.query.listings.findFirst({
    where: and(eq(listings.slug, slug), inArray(listings.status, PUBLIC_STATUSES as Status[]), eq(listings.photosHold, false)),
    columns: { id: true },
  });
  if (!row) return null;
  const b = await loadBundle(db, row.id, { confidential: false });
  return b ? { bundle: b, view: toPropertyView(b) } : null;
});

/** Up to `limit` similar listings on the market: same area first, then same purpose and type. */
export async function similarListings(b: { id: string; areaId: string | null; purpose: 'sale' | 'rent'; type: string }, limit = 3) {
  const rows = await db
    .select({ id: listings.id })
    .from(listings)
    .where(
      and(
        ne(listings.id, b.id),
        eq(listings.purpose, b.purpose),
        inArray(listings.status, MARKET_STATUSES as Status[]),
        eq(listings.photosHold, false),
        b.areaId ? or(eq(listings.areaId, b.areaId), eq(listings.type, b.type as (typeof listings.type.enumValues)[number])) : undefined,
      ),
    )
    .orderBy(sql`case when ${listings.areaId} = ${b.areaId} then 0 else 1 end`, desc(listings.publishedAt))
    .limit(limit);
  const bundles = await Promise.all(rows.map((r) => loadBundle(db, r.id, { confidential: false })));
  return bundles.filter((x) => !!x).map((x) => toPropertyView(x!));
}

export async function isSaved(userId: string | undefined, listingId: string) {
  if (!userId) return false;
  const r = await db.query.savedHomes.findFirst({ where: and(eq(savedHomes.userId, userId), eq(savedHomes.listingId, listingId)) });
  return !!r;
}

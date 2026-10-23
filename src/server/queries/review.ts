import 'server-only';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { areas, listingPhotos, listingReviews, listings, media, users } from '@/db/schema';

/** Submissions waiting for a decision, oldest first. */
export async function reviewQueue() {
  return db
    .select({
      id: listings.id,
      refNo: listings.refNo,
      addressLine: listings.addressLine,
      unit: listings.unit,
      type: listings.type,
      purpose: listings.purpose,
      price: listings.price,
      source: listings.source,
      round: listingReviews.round,
      submittedAt: listingReviews.submittedAt,
      submitter: users.displayName,
      submitterRole: users.role,
      areaName: areas.name,
      cover: sql<string | null>`(select ${media.storageId} from ${listingPhotos} join ${media} on ${media.id} = ${listingPhotos.mediaId} where ${listingPhotos.listingId} = ${listings.id} order by ${listingPhotos.isCover} desc, ${listingPhotos.sortOrder} asc limit 1)`,
    })
    .from(listingReviews)
    .innerJoin(listings, and(eq(listings.id, listingReviews.listingId), eq(listings.round, listingReviews.round)))
    .leftJoin(users, eq(users.id, listingReviews.submittedBy))
    .leftJoin(areas, eq(areas.id, listings.areaId))
    .where(and(isNull(listingReviews.decision), eq(listings.status, 'pending_review')))
    .orderBy(asc(listingReviews.submittedAt));
}

export async function staffOptions() {
  return db
    .select({ id: users.id, name: users.displayName })
    .from(users)
    .where(and(sql`${users.role} in ('owner','admin','agent')`, eq(users.status, 'active')))
    .orderBy(asc(users.displayName));
}

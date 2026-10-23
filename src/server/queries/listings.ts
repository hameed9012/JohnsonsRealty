import 'server-only';
import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { areas, listingPhotos, listings, media, users } from '@/db/schema';
import type { Actor } from '@/lib/permissions';

/** Listings the actor works with in the portal: all for managers, their own for agents. */
export async function portalListings(actor: Actor, opts: { statuses?: string[] } = {}) {
  const manager = actor.role === 'owner' || actor.role === 'admin';
  const conds = [];
  if (!manager) conds.push(or(eq(listings.listingAgentId, actor.id), eq(listings.submittedByUserId, actor.id)));
  if (opts.statuses?.length) conds.push(inArray(listings.status, opts.statuses as (typeof listings.status.enumValues)[number][]));
  return db
    .select({
      id: listings.id,
      refNo: listings.refNo,
      slug: listings.slug,
      addressLine: listings.addressLine,
      unit: listings.unit,
      status: listings.status,
      source: listings.source,
      purpose: listings.purpose,
      type: listings.type,
      price: listings.price,
      previousPrice: listings.previousPrice,
      publishedAt: listings.publishedAt,
      updatedAt: listings.updatedAt,
      areaId: listings.areaId,
      agentId: listings.listingAgentId,
      areaName: areas.name,
      agentName: users.displayName,
      cover: sql<string | null>`(select ${media.storageId} from ${listingPhotos} join ${media} on ${media.id} = ${listingPhotos.mediaId} where ${listingPhotos.listingId} = ${listings.id} order by ${listingPhotos.isCover} desc, ${listingPhotos.sortOrder} asc limit 1)`,
    })
    .from(listings)
    .leftJoin(areas, eq(areas.id, listings.areaId))
    .leftJoin(users, eq(users.id, listings.listingAgentId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(listings.updatedAt))
    .limit(500);
}

/** A property owner's own submissions. */
export async function ownerListings(userId: string) {
  return db
    .select({
      id: listings.id,
      refNo: listings.refNo,
      slug: listings.slug,
      addressLine: listings.addressLine,
      status: listings.status,
      purpose: listings.purpose,
      price: listings.price,
      round: listings.round,
      updatedAt: listings.updatedAt,
      areaName: areas.name,
      cover: sql<string | null>`(select ${media.storageId} from ${listingPhotos} join ${media} on ${media.id} = ${listingPhotos.mediaId} where ${listingPhotos.listingId} = ${listings.id} order by ${listingPhotos.isCover} desc, ${listingPhotos.sortOrder} asc limit 1)`,
      lastNotes: sql<string | null>`(select notes from listing_reviews r where r.listing_id = ${listings.id} and r.decision is not null order by r.round desc limit 1)`,
    })
    .from(listings)
    .leftJoin(areas, eq(areas.id, listings.areaId))
    .where(and(eq(listings.submittedByUserId, userId), eq(listings.source, 'owner_submitted')))
    .orderBy(desc(listings.updatedAt));
}

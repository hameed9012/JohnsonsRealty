import 'server-only';
import { and, asc, desc, eq, gte, inArray, lte, sql, type SQL } from 'drizzle-orm';
import type { IconName } from '@/components/ui/Icon';
import type { StatusKey } from '@/components/ui/status';
import { db } from '@/db/client';
import { areas, features, listingBusiness, listingFeatures, listingLeaseTerms, listingPhotos, listings, media } from '@/db/schema';
import { sqft } from '@/lib/format';
import { displayStatus, MARKET_STATUSES, type ListingStatus } from '@/lib/listing-status';
import type { SearchQuery } from '@/lib/search';

type Status = (typeof listings.status.enumValues)[number];
type LType = (typeof listings.type.enumValues)[number];

/** What a ListingCard needs. Public columns only; a withheld business name never leaves the server. */
export interface CardData {
  id: string;
  slug: string;
  title: string;
  areaName: string | null;
  areaSlug: string | null;
  price: number;
  previousPrice: number | null;
  purpose: 'sale' | 'rent';
  type: string;
  status: StatusKey;
  ownerListed: boolean;
  cover: { src: string; alt: string } | null;
  facts: { icon?: IconName; text: string }[];
  publishedAt: Date | null;
}

const cardColumns = {
  id: listings.id,
  slug: listings.slug,
  addressLine: listings.addressLine,
  unit: listings.unit,
  status: listings.status,
  source: listings.source,
  purpose: listings.purpose,
  type: listings.type,
  price: listings.price,
  previousPrice: listings.previousPrice,
  beds: listings.beds,
  baths: listings.baths,
  sqft: listings.sqft,
  publishedAt: listings.publishedAt,
  mapX: listings.mapX,
  mapY: listings.mapY,
  areaName: areas.name,
  areaSlug: areas.slug,
  nameWithheld: listingBusiness.nameWithheld,
  teaser: listingBusiness.teaser,
  businessName: listingBusiness.businessName,
  businessType: listingBusiness.businessType,
  leaseMonths: listingLeaseTerms.leaseLengthMonths,
  coverSrc: sql<string | null>`(select ${media.storageId} from ${listingPhotos} join ${media} on ${media.id} = ${listingPhotos.mediaId} where ${listingPhotos.listingId} = ${listings.id} order by ${listingPhotos.isCover} desc, ${listingPhotos.sortOrder} asc limit 1)`,
  coverAlt: sql<string | null>`(select ${listingPhotos.alt} from ${listingPhotos} where ${listingPhotos.listingId} = ${listings.id} order by ${listingPhotos.isCover} desc, ${listingPhotos.sortOrder} asc limit 1)`,
};

type Row = {
  [K in keyof typeof cardColumns]: unknown;
} & Record<string, unknown>;

function toCard(r: Row, now = new Date()): CardData {
  const type = r.type as string;
  const biz = type === 'business';
  let title = [r.addressLine, r.unit ? `Unit ${r.unit}` : null].filter(Boolean).join(', ') || 'Address to be confirmed';
  if (biz && r.nameWithheld) title = (r.teaser as string) || `Business, ${(r.areaName as string) ?? 'Dauphin County'}`;
  else if (biz && r.businessName) title = (r.businessName as string).replace(/\s*\(.*\)\s*$/, '');
  const facts: CardData['facts'] = [];
  if (!biz && r.beds !== null) facts.push({ icon: 'bed', text: `${r.beds} bed` });
  if (!biz && r.baths !== null) facts.push({ icon: 'bath', text: `${r.baths} bath` });
  if (r.sqft) facts.push({ icon: 'area', text: sqft(r.sqft as number) });
  if (biz && r.businessType) facts.push({ icon: 'office', text: r.businessType as string });
  if (r.purpose === 'rent' && r.leaseMonths) facts.push({ icon: 'calendar', text: `${r.leaseMonths}-month lease` });
  const price = (r.price as number) ?? 0;
  const prev = r.previousPrice as number | null;
  const publishedAt = r.publishedAt ? new Date(r.publishedAt as string) : null;
  return {
    id: r.id as string,
    slug: r.slug as string,
    title,
    areaName: (r.areaName as string) ?? null,
    areaSlug: (r.areaSlug as string) ?? null,
    price,
    previousPrice: prev && prev > price ? prev : null,
    purpose: r.purpose as 'sale' | 'rent',
    type,
    status: displayStatus({ status: r.status as ListingStatus, publishedAt, price, previousPrice: prev }, now),
    ownerListed: r.source === 'owner_submitted',
    cover: r.coverSrc ? { src: r.coverSrc as string, alt: (r.coverAlt as string) || `Photo of ${title}` } : null,
    facts,
    publishedAt,
  };
}

function base() {
  return db
    .select(cardColumns)
    .from(listings)
    .leftJoin(areas, eq(areas.id, listings.areaId))
    .leftJoin(listingBusiness, eq(listingBusiness.listingId, listings.id))
    .leftJoin(listingLeaseTerms, eq(listingLeaseTerms.listingId, listings.id));
}

const onMarket = () => and(inArray(listings.status, MARKET_STATUSES as Status[]), eq(listings.photosHold, false))!;

/** Newest listings on the market, optionally filtered. */
export async function newestCards(opts: { limit?: number; where?: SQL; featuredFirst?: boolean } = {}): Promise<CardData[]> {
  const rows = await base()
    .where(and(onMarket(), opts.where))
    .orderBy(...(opts.featuredFirst ? [desc(listings.featured)] : []), desc(listings.publishedAt))
    .limit(opts.limit ?? 6);
  return rows.map((r) => toCard(r as Row));
}

export async function cardsWhere(where: SQL | undefined, limit = 60): Promise<CardData[]> {
  const rows = await base().where(where).orderBy(desc(listings.publishedAt)).limit(limit);
  return rows.map((r) => toCard(r as Row));
}

export interface SearchScope {
  purpose?: 'sale' | 'rent';
  types?: LType[];
  excludeTypes?: LType[];
}

export const PAGE_SIZE = 12;

/** Buy, Rent and Businesses search. */
export async function searchCards(scope: SearchScope, q: SearchQuery, opts: { pins?: boolean } = {}) {
  const conds: (SQL | undefined)[] = [onMarket()];
  if (scope.purpose) conds.push(eq(listings.purpose, scope.purpose));
  if (scope.types?.length) conds.push(inArray(listings.type, scope.types));
  if (scope.excludeTypes?.length) conds.push(sql`${listings.type} not in (${sql.join(scope.excludeTypes.map((t) => sql`${t}`), sql`, `)})`);
  if (q.type) conds.push(eq(listings.type, q.type as LType));
  if (q.area) {
    // An area slug matches the area itself and any neighbourhood inside it.
    conds.push(sql`${listings.areaId} in (select id from ${areas} a where a.slug = ${q.area} or a.parent_id = (select id from ${areas} p where p.slug = ${q.area}))`);
  }
  if (q.min !== null) conds.push(gte(listings.price, q.min));
  if (q.max !== null) conds.push(lte(listings.price, q.max));
  if (q.beds !== null) conds.push(gte(listings.beds, q.beds));
  if (q.baths !== null) conds.push(gte(listings.baths, q.baths));
  if (q.owner === 'exclude') conds.push(eq(listings.source, 'agent'));
  if (q.owner === 'only') conds.push(eq(listings.source, 'owner_submitted'));
  for (const key of q.features) {
    conds.push(
      sql`exists (select 1 from ${listingFeatures} lf join ${features} f on f.id = lf.feature_id where lf.listing_id = ${listings.id} and f.key = ${key})`,
    );
  }
  const where = and(...conds);
  const order =
    q.sort === 'price-asc'
      ? [asc(listings.price), desc(listings.publishedAt)]
      : q.sort === 'price-desc'
        ? [desc(listings.price), desc(listings.publishedAt)]
        : q.sort === 'beds'
          ? [sql`${listings.beds} desc nulls last`, desc(listings.publishedAt)]
          : [desc(listings.publishedAt)];

  const [[{ total } = { total: 0 }], rows, pinned] = await Promise.all([
    db.select({ total: sql<number>`count(*)::int` }).from(listings).where(where),
    base()
      .where(where)
      .orderBy(...order)
      .limit(PAGE_SIZE)
      .offset((q.page - 1) * PAGE_SIZE),
    // The map view shows every matching listing that has a hand-placed pin, not just this page.
    opts.pins ? base().where(and(where, sql`${listings.mapX} is not null and ${listings.mapY} is not null`)).orderBy(...order).limit(300) : Promise.resolve([]),
  ]);
  const pins = pinned.map((r) => {
    const c = toCard(r as Row);
    return { x: Number(r.mapX), y: Number(r.mapY), label: c.title, href: `/property/${c.slug}` };
  });
  return { total, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), cards: rows.map((r) => toCard(r as Row)), pins };
}


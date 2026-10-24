import 'server-only';
import { and, asc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import type { Executor } from '@/db/client';
import { listingBusiness, listings, media, postalZones, sales, siteSettings } from '@/db/schema';
import { layoutMap, mapHash, type MapLayout, type MapListing, type MapZone } from '@/lib/map';

export interface MapImage {
  storageId: string;
  width: number;
  height: number;
}

export interface MapData {
  image: MapImage | null;
  zones: (MapZone & { areaId: string | null })[];
  layout: MapLayout;
  hash: string;
  soldDays: number;
}

const ON_MAP = ['coming_soon', 'active', 'for_lease', 'under_offer', 'under_contract', 'sold', 'leased'] as const;

/** Everything the map shows. Optional scope narrows it to one search page (Buy, Rent, Businesses). */
export async function mapData(ex: Executor, scope: { purpose?: 'sale' | 'rent'; business?: boolean } = {}): Promise<MapData> {
  const s = await ex.query.siteSettings.findFirst({ where: eq(siteSettings.id, 1) });
  const img = s?.mapMediaId ? await ex.query.media.findFirst({ where: eq(media.id, s.mapMediaId), columns: { storageId: true, width: true, height: true } }) : null;
  const zones = await ex.select({ code: postalZones.code, label: postalZones.label, x: postalZones.x, y: postalZones.y, areaId: postalZones.areaId }).from(postalZones).orderBy(asc(postalZones.code));
  const conds: SQL[] = [inArray(listings.status, [...ON_MAP])];
  if (scope.purpose) conds.push(eq(listings.purpose, scope.purpose));
  if (scope.business === true) conds.push(eq(listings.type, 'business'));
  if (scope.business === false) conds.push(sql`${listings.type} <> 'business'`);
  const rows = await ex
    .select({
      id: listings.id,
      slug: listings.slug,
      addressLine: listings.addressLine,
      unit: listings.unit,
      type: listings.type,
      nameWithheld: listingBusiness.nameWithheld,
      teaser: listingBusiness.teaser,
      status: listings.status,
      price: listings.price,
      purpose: listings.purpose,
      postal: listings.postal,
      mapX: listings.mapX,
      mapY: listings.mapY,
      closedOn: sql<string | null>`(select max(${sales.soldOn}) from ${sales} where ${sales.listingId} = ${listings.id})`,
    })
    .from(listings)
    .leftJoin(listingBusiness, eq(listingBusiness.listingId, listings.id))
    .where(and(...conds));
  const mapListings: MapListing[] = rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    // A withheld business name never reaches the map.
    title: r.type === 'business' && r.nameWithheld ? r.teaser || 'Business for sale' : [r.addressLine, r.unit ? `Unit ${r.unit}` : null].filter(Boolean).join(', ') || 'Address to be confirmed',
    status: r.status,
    price: r.price,
    purpose: r.purpose,
    postal: r.postal,
    mapX: r.mapX,
    mapY: r.mapY,
    closedAt: r.closedOn ? new Date(r.closedOn + 'T00:00:00Z') : null,
  }));
  const soldDays = s?.soldOnMapDays ?? 30;
  const layout = layoutMap(mapListings, zones, { soldDays });
  return { image: img ?? null, zones, layout, hash: mapHash(layout, zones, s?.mapMediaId ?? null), soldDays };
}

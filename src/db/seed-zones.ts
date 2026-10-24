// Postal zones from map/postal-zones.json, each assigned to an area by the PARP jurisdiction map: the generic
// ER:LC map is split into Fairview (northwest), Springfield (northeast) and Harrisburg (south: North
// Residential above West Downtown, with East Downtown across the river). State parks (High Rock Park, the beach
// and the bay) belong to no area: nothing there is for sale. Migration-safe: inserts only missing zones, so a
// zone the Owner moved or re-assigned is never reset.
import { eq, inArray, sql } from 'drizzle-orm';
import zonesFile from '../../map/postal-zones.json';
import type { Executor } from './client';
import { areas, media, postalZones, siteSettings } from './schema';

const AREA_OF: Record<string, string[]> = {
  fairview: ['800', '801', '803', '809', '600', '601', '602', '603', '604', '605', '607', '900', '901', '902', '905', '908'],
  springfield: ['1000', '1001', '1002', '1003', '1010', '1011', '1100', '1101', '1102', '1105', '700', '704', '501', '503', '504'],
  'north-residential': ['400', '401', '409', '410', '411'],
  'west-downtown': ['204', '206', '209', '212', '215', '218', '223', '224', '226'],
  'east-downtown': ['300', '302', '303', '306', '310', '315', '320', '321', '322'],
};

export const ZONE_AREA: Record<string, string> = Object.fromEntries(Object.entries(AREA_OF).flatMap(([slug, codes]) => codes.map((c) => [c, slug])));

/** The map image bundled with the site (public/map), used until the Owner uploads another. */
export const BUNDLED_MAP = { storageId: '/map/liberty-county-map.png', width: zonesFile.width, height: zonesFile.height };

export async function seedZones(db: Executor) {
  const [{ n } = { n: 0 }] = await db.select({ n: sql<number>`count(*)::int` }).from(postalZones);
  const zones = Object.entries(zonesFile.zones as Record<string, { x: number; y: number; label: string }>);
  const slugs = [...new Set(Object.values(ZONE_AREA))];
  const areaRows = slugs.length ? await db.select({ id: areas.id, slug: areas.slug }).from(areas).where(inArray(areas.slug, slugs)) : [];
  const areaId = new Map(areaRows.map((a) => [a.slug, a.id]));
  await db
    .insert(postalZones)
    .values(zones.map(([code, z]) => ({ code, label: z.label, x: z.x, y: z.y, areaId: areaId.get(ZONE_AREA[code] ?? '') ?? null })))
    .onConflictDoNothing();

  // First run only: point the site at the bundled map image if no map is set.
  if (n === 0) {
    const s = await db.query.siteSettings.findFirst({ where: eq(siteSettings.id, 1) });
    if (s && !s.mapMediaId) {
      const existing = await db.query.media.findFirst({ where: eq(media.storageId, BUNDLED_MAP.storageId) });
      const m = existing ?? (await db.insert(media).values({ storageId: BUNDLED_MAP.storageId, width: BUNDLED_MAP.width, height: BUNDLED_MAP.height, format: 'png' }).returning())[0]!;
      await db.update(siteSettings).set({ mapMediaId: m.id }).where(eq(siteSettings.id, 1));
    }
  }
}

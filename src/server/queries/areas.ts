import 'server-only';
import { asc, sql } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';
import { db } from '@/db/client';
import { areas, listings } from '@/db/schema';
import { MARKET_STATUSES } from '@/lib/listing-status';

export type AreaRow = typeof areas.$inferSelect;

export const getAreas = unstable_cache(
  async (): Promise<AreaRow[]> => db.select().from(areas).orderBy(asc(areas.displayOrder), asc(areas.name)),
  ['areas'],
  { tags: ['areas'] },
);

/** Options for area pickers: selectable areas, labelled with their parent ("Fairview · Susquehanna Township"). */
export function areaOptions(all: AreaRow[]) {
  const byId = new Map(all.map((a) => [a.id, a]));
  return all
    .filter((a) => a.selectable)
    .map((a) => {
      const parent = a.parentId ? byId.get(a.parentId) : null;
      return { value: a.id, label: parent ? `${a.name} · ${parent.name}` : a.name, area: a };
    });
}

export async function areaListingCounts(): Promise<Record<string, number>> {
  const rows = await db
    .select({ areaId: listings.areaId, n: sql<number>`count(*)::int` })
    .from(listings)
    .where(sql`${listings.status} in (${sql.join(MARKET_STATUSES.map((s) => sql`${s}`), sql`, `)})`)
    .groupBy(listings.areaId);
  return Object.fromEntries(rows.filter((r) => r.areaId).map((r) => [r.areaId!, r.n]));
}

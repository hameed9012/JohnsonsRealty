// Migration-safe base data. Safe to run on every deploy: it only inserts rows that are missing and never
// overwrites what the Owner has edited. Areas are seeded by name and hierarchy only; postal codes,
// descriptions and services are entered by the Owner in the portal.
import { sql } from 'drizzle-orm';
import type { Executor } from './client';
import { areas, features, siteSettings } from './schema';

type AreaSeed = { name: string; slug: string; city: string; parent?: string; selectable: boolean; order: number };

export const BASE_AREAS: AreaSeed[] = [
  { name: 'Harrisburg', slug: 'harrisburg', city: 'Harrisburg', selectable: false, order: 10 },
  { name: 'West Downtown', slug: 'west-downtown', city: 'Harrisburg', parent: 'harrisburg', selectable: true, order: 11 },
  { name: 'East Downtown', slug: 'east-downtown', city: 'Harrisburg', parent: 'harrisburg', selectable: true, order: 12 },
  { name: 'North Residential', slug: 'north-residential', city: 'Harrisburg', parent: 'harrisburg', selectable: true, order: 13 },
  { name: 'Swatara Township', slug: 'swatara-township', city: 'Swatara Township', selectable: false, order: 20 },
  { name: 'Springfield', slug: 'springfield', city: 'Swatara Township', parent: 'swatara-township', selectable: true, order: 21 },
  { name: 'Susquehanna Township', slug: 'susquehanna-township', city: 'Susquehanna Township', selectable: false, order: 30 },
  { name: 'Fairview', slug: 'fairview', city: 'Susquehanna Township', parent: 'susquehanna-township', selectable: true, order: 31 },
];

/** Feature taxonomy (labels and icons), not property facts. The Owner can add more. */
export const BASE_FEATURES = [
  { key: 'pool', label: 'Pool', icon: 'pool', displayOrder: 10 },
  { key: 'gate', label: 'Gated', icon: 'gate', displayOrder: 20 },
  { key: 'office', label: 'Home office', icon: 'office', displayOrder: 30 },
  { key: 'laundry', label: 'Laundry room', icon: 'laundry', displayOrder: 40 },
  { key: 'garage', label: 'Garage', icon: 'garage', displayOrder: 50 },
];

export async function seedBase(db: Executor) {
  await db.insert(siteSettings).values({ id: 1 }).onConflictDoNothing();

  for (const a of BASE_AREAS.filter((x) => !x.parent)) {
    await db
      .insert(areas)
      .values({ name: a.name, slug: a.slug, city: a.city, selectable: a.selectable, displayOrder: a.order })
      .onConflictDoNothing({ target: areas.slug });
  }
  for (const a of BASE_AREAS.filter((x) => x.parent)) {
    await db
      .insert(areas)
      .values({
        name: a.name,
        slug: a.slug,
        city: a.city,
        selectable: a.selectable,
        displayOrder: a.order,
        parentId: sql`(select id from ${areas} where slug = ${a.parent})`,
      })
      .onConflictDoNothing({ target: areas.slug });
  }

  await db.insert(features).values(BASE_FEATURES).onConflictDoNothing({ target: features.key });
}

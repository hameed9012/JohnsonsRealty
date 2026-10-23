import 'server-only';
import { eq } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';
import { db } from '@/db/client';
import { siteSettings } from '@/db/schema';

export type SiteSettings = typeof siteSettings.$inferSelect;

/** Site settings, cached across requests and revalidated by tag when the Owner saves them. */
export const getSettings = unstable_cache(
  async (): Promise<SiteSettings> => {
    const row = await db.query.siteSettings.findFirst({ where: eq(siteSettings.id, 1) });
    if (row) return row;
    const [created] = await db.insert(siteSettings).values({ id: 1 }).onConflictDoNothing().returning();
    return created ?? (await db.query.siteSettings.findFirst({ where: eq(siteSettings.id, 1) }))!;
  },
  ['site-settings'],
  { tags: ['settings'] },
);

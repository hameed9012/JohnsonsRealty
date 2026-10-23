import 'server-only';
import { and, eq } from 'drizzle-orm';
import type { Executor } from '@/db/client';
import { areas, features, listingFeatures, listings, savedSearches, users } from '@/db/schema';
import { matchesSaved, readSaved } from '@/lib/saved-search';
import { notifyUsers } from '@/server/notify';

/** After a listing is approved: notify everyone whose saved search (with alerts on) matches it. */
export async function alertSavedSearches(ex: Executor, listingId: string): Promise<string[]> {
  const l = await ex.query.listings.findFirst({ where: eq(listings.id, listingId) });
  if (!l) return [];
  const area = l.areaId ? await ex.query.areas.findFirst({ where: eq(areas.id, l.areaId) }) : null;
  const parent = area?.parentId ? await ex.query.areas.findFirst({ where: eq(areas.id, area.parentId) }) : null;
  const feats = await ex.select({ key: features.key }).from(listingFeatures).innerJoin(features, eq(features.id, listingFeatures.featureId)).where(eq(listingFeatures.listingId, listingId));
  const facts = {
    purpose: l.purpose,
    type: l.type,
    areaSlug: area?.slug ?? null,
    areaParentSlug: parent?.slug ?? null,
    price: l.price,
    beds: l.beds,
    baths: l.baths,
    ownerListed: l.source === 'owner_submitted',
    featureKeys: feats.map((f) => f.key),
  };
  const rows = await ex
    .select({ userId: savedSearches.userId, name: savedSearches.name, params: savedSearches.params, prefs: users.notificationPrefs })
    .from(savedSearches)
    .innerJoin(users, eq(users.id, savedSearches.userId))
    .where(and(eq(savedSearches.alerts, true), eq(users.status, 'active')));
  const matched = rows.filter((r) => r.prefs.savedSearchAlerts && r.userId !== l.submittedByUserId && matchesSaved(readSaved(r.params), facts));
  const byUser = new Map<string, string>();
  for (const r of matched) if (!byUser.has(r.userId)) byUser.set(r.userId, r.name);
  for (const [userId, name] of byUser) {
    await notifyUsers(ex, [userId], {
      kind: 'saved-search.match',
      title: 'New listing for your saved search',
      body: `${l.addressLine || 'A new listing'}${area ? ', ' + area.name : ''} matches “${name}”.`,
      link: `/property/${l.slug}`,
    });
  }
  return [...byUser.keys()];
}

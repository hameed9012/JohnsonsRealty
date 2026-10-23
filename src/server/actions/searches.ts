'use server';

import { and, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/client';
import { savedSearches } from '@/db/schema';
import { describeSaved, SAVED_SCOPES, toSaved, type SavedScope } from '@/lib/saved-search';
import { parseSearch } from '@/lib/search';
import { audit } from '@/server/audit';
import { getAreas } from '@/server/queries/areas';
import { getActor } from '@/server/session';

const MAX_SAVED = 25;

export async function saveSearch(scope: SavedScope, query: string): Promise<{ ok: boolean; message: string }> {
  const actor = await getActor();
  if (!actor) return { ok: false, message: 'Sign in to save searches.' };
  if (!SAVED_SCOPES.includes(scope)) return { ok: false, message: 'That search can’t be saved.' };
  const q = parseSearch(Object.fromEntries(new URLSearchParams(query.replace(/^\?/, ''))));
  const criteria = toSaved(scope, q);
  const areas = await getAreas();
  const name = describeSaved(criteria, (slug) => areas.find((a) => a.slug === slug)?.name).slice(0, 200);
  const [{ n } = { n: 0 }] = await db.select({ n: sql<number>`count(*)::int` }).from(savedSearches).where(eq(savedSearches.userId, actor.id));
  if (n >= MAX_SAVED) return { ok: false, message: `You can keep up to ${MAX_SAVED} saved searches. Delete one to add another.` };
  const existing = await db.query.savedSearches.findFirst({ where: and(eq(savedSearches.userId, actor.id), eq(savedSearches.name, name)) });
  if (existing) return { ok: true, message: 'You’ve already saved this search' };
  await db.insert(savedSearches).values({ userId: actor.id, name, params: criteria, alerts: true });
  await audit(db, { actorId: actor.id, action: 'search.save', entity: 'saved_search', entityId: null, summary: `Saved search “${name}”` });
  revalidatePath('/account/searches');
  return { ok: true, message: 'Search saved. We’ll let you know about new matches.' };
}

export async function setSearchAlerts(id: string, alerts: boolean): Promise<{ ok: boolean; message: string }> {
  const actor = await getActor();
  if (!actor) return { ok: false, message: 'Sign in to continue.' };
  const r = await db.update(savedSearches).set({ alerts }).where(and(eq(savedSearches.id, id), eq(savedSearches.userId, actor.id))).returning({ id: savedSearches.id });
  if (!r.length) return { ok: false, message: 'That search no longer exists.' };
  revalidatePath('/account/searches');
  return { ok: true, message: alerts ? 'Alerts on' : 'Alerts off' };
}

export async function deleteSearch(id: string): Promise<{ ok: boolean; message: string }> {
  const actor = await getActor();
  if (!actor) return { ok: false, message: 'Sign in to continue.' };
  const r = await db.delete(savedSearches).where(and(eq(savedSearches.id, id), eq(savedSearches.userId, actor.id))).returning({ name: savedSearches.name });
  if (!r.length) return { ok: false, message: 'That search no longer exists.' };
  await audit(db, { actorId: actor.id, action: 'search.delete', entity: 'saved_search', entityId: id, summary: `Deleted saved search “${r[0]!.name}”` });
  revalidatePath('/account/searches');
  return { ok: true, message: 'Search deleted' };
}

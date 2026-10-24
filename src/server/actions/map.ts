'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath, revalidateTag } from 'next/cache';
import { after } from 'next/server';
import { z } from 'zod';
import { db } from '@/db/client';
import { postalZones, siteSettings } from '@/db/schema';
import { fieldErrors } from '@/lib/action-result';
import { can } from '@/lib/permissions';
import { audit } from '@/server/audit';
import { updatePropertyMapMessage } from '@/server/map/discord';
import { actorOrThrow } from '@/server/session';

export type MapActionResult = { ok: boolean; message: string; fieldErrors?: Record<string, string> };

const pct = z.coerce.number().min(0, 'Inside the map, please.').max(100, 'Inside the map, please.');
const zoneSchema = z.object({
  code: z.string().trim().regex(/^\d{1,6}$/, 'A postal code is numbers only, like 601.'),
  label: z.string().trim().min(1, 'Name the zone.').max(60),
  x: pct,
  y: pct,
  areaId: z.uuid().nullable().optional(),
});

async function owner() {
  const actor = await actorOrThrow();
  if (!can(actor, 'settings.manage')) throw new Error('Only the Owner can edit the map.');
  return actor;
}

function done(message: string): MapActionResult {
  revalidatePath('/portal/settings/map');
  revalidatePath('/buy');
  revalidatePath('/rent');
  revalidatePath('/businesses');
  revalidateTag('listings', 'max');
  after(() => updatePropertyMapMessage(db).then(() => undefined));
  return { ok: true, message };
}

export async function saveZoneAction(input: unknown): Promise<MapActionResult> {
  const actor = await owner();
  const p = zoneSchema.safeParse(input);
  if (!p.success) return { ok: false, message: 'Check the zone.', fieldErrors: fieldErrors(p.error) };
  const { code, ...rest } = p.data;
  const values = { label: rest.label, x: Math.round(rest.x * 100) / 100, y: Math.round(rest.y * 100) / 100, areaId: rest.areaId ?? null };
  const updated = await db.update(postalZones).set(values).where(eq(postalZones.code, code)).returning({ code: postalZones.code });
  if (!updated.length) return { ok: false, message: `Postal ${code} isn’t on the map.` };
  await audit(db, { actorId: actor.id, action: 'map.zone', entity: 'postal_zone', entityId: code, summary: `Updated postal zone ${code} (${values.label})` });
  return done(`Postal ${code} saved`);
}

export async function addZoneAction(input: unknown): Promise<MapActionResult> {
  const actor = await owner();
  const p = zoneSchema.safeParse({ x: 50, y: 50, ...(input as object) });
  if (!p.success) return { ok: false, message: 'Check the zone.', fieldErrors: fieldErrors(p.error) };
  const exists = await db.query.postalZones.findFirst({ where: eq(postalZones.code, p.data.code) });
  if (exists) return { ok: false, message: `Postal ${p.data.code} is already on the map.`, fieldErrors: { code: 'Already on the map.' } };
  await db.insert(postalZones).values({ code: p.data.code, label: p.data.label, x: p.data.x, y: p.data.y, areaId: p.data.areaId ?? null });
  await audit(db, { actorId: actor.id, action: 'map.zone.add', entity: 'postal_zone', entityId: p.data.code, summary: `Added postal zone ${p.data.code} (${p.data.label})` });
  return done(`Postal ${p.data.code} added. Drag it into place.`);
}

export async function deleteZoneAction(code: string): Promise<MapActionResult> {
  const actor = await owner();
  const gone = await db.delete(postalZones).where(eq(postalZones.code, code)).returning({ code: postalZones.code });
  if (!gone.length) return { ok: false, message: 'That zone is already gone.' };
  await audit(db, { actorId: actor.id, action: 'map.zone.delete', entity: 'postal_zone', entityId: code, summary: `Removed postal zone ${code}` });
  return done(`Postal ${code} removed`);
}

export async function setSoldDaysAction(days: number): Promise<MapActionResult> {
  const actor = await owner();
  const p = z.coerce.number().int().min(0).max(365).safeParse(days);
  if (!p.success) return { ok: false, message: 'Use a number of days from 0 to 365.' };
  await db.update(siteSettings).set({ soldOnMapDays: p.data }).where(eq(siteSettings.id, 1));
  await audit(db, { actorId: actor.id, action: 'settings.update', entity: 'site_settings', entityId: '1', summary: `Sold listings stay on the map for ${p.data} days` });
  revalidateTag('settings', 'max');
  return done('Saved');
}

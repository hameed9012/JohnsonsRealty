'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath, revalidateTag } from 'next/cache';
import { db } from '@/db/client';
import { agentProfiles, areas, media, posts, siteSettings } from '@/db/schema';
import { can } from '@/lib/permissions';
import { uploadedSchema } from '@/lib/schemas/listing';
import { createUploadTarget, destroyUpload, verifyUpload, type UploadTarget } from '@/lib/storage';
import { audit } from '@/server/audit';
import { actorOrThrow, type SessionActor } from '@/server/session';

export type ImageSlot = { kind: 'site-hero' } | { kind: 'site-map' } | { kind: 'area'; id: string } | { kind: 'agent'; userId: string } | { kind: 'post'; id: string };

const FOLDER = { 'site-hero': 'site', 'site-map': 'site', area: 'areas', agent: 'agents', post: 'posts' } as const;

function allowed(actor: SessionActor, slot: ImageSlot) {
  if (slot.kind === 'site-hero' || slot.kind === 'site-map') return can(actor, 'settings.manage');
  if (slot.kind === 'area') return can(actor, 'areas.manage');
  if (slot.kind === 'post') return can(actor, 'content.manage');
  return actor.id === slot.userId || can(actor, 'staff.view');
}

async function current(slot: ImageSlot): Promise<string | null> {
  if (slot.kind === 'site-hero' || slot.kind === 'site-map') {
    const s = await db.query.siteSettings.findFirst({ where: eq(siteSettings.id, 1) });
    return (slot.kind === 'site-hero' ? s?.heroMediaId : s?.mapMediaId) ?? null;
  }
  if (slot.kind === 'area') return (await db.query.areas.findFirst({ where: eq(areas.id, slot.id) }))?.heroMediaId ?? null;
  if (slot.kind === 'post') return (await db.query.posts.findFirst({ where: eq(posts.id, slot.id) }))?.heroMediaId ?? null;
  return (await db.query.agentProfiles.findFirst({ where: eq(agentProfiles.userId, slot.userId) }))?.photoId ?? null;
}

async function assign(slot: ImageSlot, mediaId: string | null) {
  if (slot.kind === 'site-hero') await db.update(siteSettings).set({ heroMediaId: mediaId }).where(eq(siteSettings.id, 1));
  else if (slot.kind === 'site-map') await db.update(siteSettings).set({ mapMediaId: mediaId }).where(eq(siteSettings.id, 1));
  else if (slot.kind === 'area') await db.update(areas).set({ heroMediaId: mediaId }).where(eq(areas.id, slot.id));
  else if (slot.kind === 'post') await db.update(posts).set({ heroMediaId: mediaId }).where(eq(posts.id, slot.id));
  else await db.update(agentProfiles).set({ photoId: mediaId }).where(eq(agentProfiles.userId, slot.userId));
}

function revalidate(slot: ImageSlot) {
  if (slot.kind.startsWith('site')) revalidateTag('settings', 'max');
  if (slot.kind === 'area') revalidateTag('areas', 'max');
  if (slot.kind === 'agent') revalidateTag('agents', 'max');
  revalidatePath('/', 'layout');
}

export async function getImageTarget(slot: ImageSlot): Promise<{ ok: true; target: UploadTarget } | { ok: false; message: string }> {
  try {
    const actor = await actorOrThrow();
    if (!allowed(actor, slot)) return { ok: false, message: 'You don’t have access to that.' };
    return { ok: true, target: createUploadTarget(FOLDER[slot.kind]) };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Uploads aren’t available.' };
  }
}

export async function setImage(slot: ImageSlot, uploaded: unknown): Promise<{ ok: boolean; message: string; storageId?: string }> {
  const actor = await actorOrThrow();
  if (!allowed(actor, slot)) return { ok: false, message: 'You don’t have access to that.' };
  const f = uploadedSchema.safeParse(uploaded);
  if (!f.success || !verifyUpload(f.data)) return { ok: false, message: 'That upload couldn’t be verified. Try again.' };
  const before = await current(slot);
  const [m] = await db.insert(media).values({ storageId: f.data.storageId, width: f.data.width, height: f.data.height, bytes: f.data.bytes, format: f.data.format, uploadedBy: actor.id }).returning();
  await assign(slot, m!.id);
  if (before) await removeMedia(before);
  await audit(db, { actorId: actor.id, action: 'image.set', entity: slot.kind, entityId: 'id' in slot ? slot.id : 'userId' in slot ? slot.userId : '1', summary: `Updated the ${slot.kind.replace('-', ' ')} image` });
  revalidate(slot);
  return { ok: true, message: 'Image saved', storageId: m!.storageId };
}

export async function clearImage(slot: ImageSlot): Promise<{ ok: boolean; message: string }> {
  const actor = await actorOrThrow();
  if (!allowed(actor, slot)) return { ok: false, message: 'You don’t have access to that.' };
  const before = await current(slot);
  await assign(slot, null);
  if (before) await removeMedia(before);
  await audit(db, { actorId: actor.id, action: 'image.clear', entity: slot.kind, entityId: 'id' in slot ? slot.id : 'userId' in slot ? slot.userId : '1', summary: `Removed the ${slot.kind.replace('-', ' ')} image` });
  revalidate(slot);
  return { ok: true, message: 'Image removed' };
}

async function removeMedia(id: string) {
  const m = await db.query.media.findFirst({ where: eq(media.id, id) });
  if (!m) return;
  try {
    await db.delete(media).where(eq(media.id, id));
    await destroyUpload(m.storageId);
  } catch {
    // Still referenced elsewhere; keep it.
  }
}

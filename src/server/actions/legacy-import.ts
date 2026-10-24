'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { z } from 'zod';
import { db } from '@/db/client';
import { clients, listings } from '@/db/schema';
import { addKitPhoto, applyPlan, legacyKey } from '@/import/legacy/apply';
import { loadPlan } from '@/import/legacy/source';
import { can } from '@/lib/permissions';
import { uploadFromServer } from '@/lib/storage';
import { updatePropertyMapMessage } from '@/server/map/discord';
import { actorOrThrow } from '@/server/session';

export type ImportStepResult = { ok: boolean; message: string; fieldErrors?: Record<string, string> };

const saleSchema = z.object({
  price: z.coerce.number({ error: 'Enter the sale price.' }).int().min(1, 'Enter the sale price.'),
  soldOn: z.iso.date({ error: 'Enter the sale date.' }),
});

function refresh() {
  revalidatePath('/portal/listings');
  revalidatePath('/portal/clients');
  revalidatePath('/portal/settings/import');
  revalidatePath('/portal/listings/new');
  revalidateTag('listings', 'max');
}

/**
 * Settings → Import: one seller per request, so one problem (or a slow one) never stops the others.
 * Photos are a separate step. A seller already imported is skipped.
 */
export async function importLegacySellerAction(key: string, sale?: unknown): Promise<ImportStepResult> {
  const actor = await actorOrThrow();
  if (!can(actor, 'settings.manage')) return { ok: false, message: 'Only the Owner can import the seller files.' };
  try {
    const plan = await loadPlan();
    const c = plan.clients.find((x) => x.key === key);
    if (!c) return { ok: false, message: 'That seller isn’t in the seller files.' };
    const sold = plan.listings.find((l) => l.key === key && l.sale);
    let saleValues: { price: number; soldOn: string } | undefined;
    if (sold) {
      const p = saleSchema.safeParse(sale);
      if (!p.success) return { ok: false, message: 'Check the sale price and date.', fieldErrors: Object.fromEntries(p.error.issues.map((i) => [String(i.path[0]), i.message])) };
      saleValues = p.data;
    }
    const report = await applyPlan(db, plan, { actorId: actor.id, only: key, skipPhotos: true, sale: saleValues });
    refresh();
    if (report.failed.length) return { ok: false, message: `${c.displayName}: ${report.failed[0]!.message}` };
    if (report.skipped.length) return { ok: true, message: `${c.displayName} was already imported.` };
    after(() => updatePropertyMapMessage(db).then(() => undefined));
    return { ok: true, message: `Imported ${c.displayName}.` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'The import failed.' };
  }
}

/** Uploads one kit photo to an imported listing (the import page sends them one at a time). */
export async function importKitPhotoAction(key: string, index: number): Promise<ImportStepResult & { released?: boolean }> {
  const actor = await actorOrThrow();
  if (!can(actor, 'settings.manage')) return { ok: false, message: 'Only the Owner can import the seller files.' };
  try {
    const plan = await loadPlan();
    const r = await addKitPhoto(db, plan, key, index, { actorId: actor.id, upload: (buf, type) => uploadFromServer(buf, type, 'listings') });
    if (r.released) {
      refresh();
      after(() => updatePropertyMapMessage(db).then(() => undefined));
    }
    return { ok: true, message: r.added ? 'Photo added' : 'Already there', released: r.released };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'The photo upload failed.' };
  }
}

/**
 * Add listing → Start from a seller file: brings one property from the seller files in with every detail
 * filled. Each seller file becomes one listing, once (legacy_key is unique), so nothing is listed twice.
 * The Owner and Admins get it as the Owner's own record (live, held until photos); agents get a draft to
 * finish and submit for review.
 */
export async function startFromSellerFileAction(key: string): Promise<ImportStepResult> {
  const actor = await actorOrThrow();
  if (!can(actor, 'listing.create')) return { ok: false, message: 'You can’t create listings.' };
  const manager = actor.role === 'owner' || actor.role === 'admin';
  let listingId: string | undefined;
  try {
    const plan = await loadPlan();
    const l = plan.listings.find((x) => x.key === key);
    const c = plan.clients.find((x) => x.key === key);
    if (!l || !c) return { ok: false, message: 'That property isn’t in the seller files.' };
    if (l.sale && !manager) return { ok: false, message: 'That property has already sold.' };
    const existing = await db.query.clients.findFirst({ where: eq(clients.legacyKey, legacyKey(key)), columns: { id: true } });
    if (existing) return { ok: false, message: `${c.displayName}’s property is already on the site.` };
    const report = await applyPlan(db, plan, {
      actorId: actor.id,
      only: key,
      skipPhotos: true,
      asDraft: !manager,
      sale: l.sale?.price && l.sale.soldOn ? { price: l.sale.price, soldOn: l.sale.soldOn } : undefined,
    });
    if (report.failed.length) return { ok: false, message: report.failed[0]!.message };
    if (!report.created.length) return { ok: false, message: `${c.displayName}’s property is already on the site.` };
    listingId = report.created[0]!.listing;
    refresh();
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Couldn’t start the listing.' };
  }
  if (!listingId) return { ok: false, message: 'Couldn’t start the listing.' };
  const row = await db.query.listings.findFirst({ where: eq(listings.id, listingId), columns: { status: true } });
  redirect(row?.status === 'draft' ? `/portal/listings/${listingId}/edit` : `/portal/listings/${listingId}`);
}

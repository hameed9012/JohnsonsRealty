'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { after } from 'next/server';
import { z } from 'zod';
import { db } from '@/db/client';
import { applyPlan } from '@/import/legacy/apply';
import { loadPlan } from '@/import/legacy/source';
import { can } from '@/lib/permissions';
import { uploadFromServer } from '@/lib/storage';
import { updatePropertyMapMessage } from '@/server/map/discord';
import { actorOrThrow } from '@/server/session';

export type ImportResult = { ok: boolean; message: string; fieldErrors?: Record<string, string>; created?: string[]; problems?: string[] };

const saleSchema = z.object({
  price: z.coerce.number({ error: 'Enter the sale price.' }).int().min(1, 'Enter the sale price.'),
  soldOn: z.iso.date({ error: 'Enter the sale date.' }),
});

/** Settings → Import: saves the legacy seller files. Sellers already imported are skipped. */
export async function runLegacyImportAction(input: unknown): Promise<ImportResult> {
  const actor = await actorOrThrow();
  if (!can(actor, 'settings.manage')) return { ok: false, message: 'Only the Owner can import the seller files.' };
  const plan = await loadPlan();
  const needsSale = plan.listings.some((l) => l.sale);
  const sale = needsSale ? saleSchema.safeParse(input) : null;
  if (sale && !sale.success) {
    const errors = Object.fromEntries(sale.error.issues.map((i) => [String(i.path[0]), i.message]));
    return { ok: false, message: 'Check the highlighted fields.', fieldErrors: errors };
  }
  try {
    const report = await applyPlan(db, plan, {
      actorId: actor.id,
      sale: sale?.data,
      upload: (buf, type) => uploadFromServer(buf, type, 'listings'),
    });
    revalidatePath('/portal/listings');
    revalidatePath('/portal/clients');
    revalidatePath('/portal/settings/import');
    revalidateTag('listings', 'max');
    after(() => updatePropertyMapMessage(db).then(() => undefined));
    const name = (key: string) => plan.clients.find((c) => c.key === key)?.displayName ?? key;
    const problems = [
      ...report.failed.map((f) => `${f.client} wasn’t imported: ${f.message}`),
      ...report.created.filter((c) => c.photoError).map((c) => `${c.client} was imported with ${c.photos ?? 0} photos. ${c.photoError} Fix it, then import again to add the rest.`),
      ...report.photosAdded.filter((p) => p.photoError).map((p) => `${name(p.key)}: ${p.photoError}`),
    ];
    const added = report.photosAdded.filter((p) => p.photos).map((p) => `${p.photos} photos added to ${name(p.key)}.`);
    const done = report.created.length ? `Imported ${report.created.length} seller files.` : added.length ? '' : 'Everything was already imported. Nothing changed.';
    return { ok: !report.failed.length, message: [done, ...added, problems.length ? 'Some things need attention: see below.' : ''].filter(Boolean).join(' '), created: report.created.map((c) => c.client), problems };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'The import failed. Nothing was saved for that seller.' };
  }
}

'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/db/client';
import type { DocData } from '@/forms/types';
import { ServiceError } from '@/server/listings/service';
import * as docs from '@/server/ops/documents';
import { actorOrThrow, ForbiddenError } from '@/server/session';
import type { OpResult } from './ops';

async function run<T>(fn: () => Promise<T>, message?: string, id?: string): Promise<OpResult<T>> {
  try {
    const data = await fn();
    revalidatePath('/portal/documents');
    if (id) revalidatePath(`/portal/documents/${id}`);
    return { ok: true, message, data };
  } catch (e) {
    if (e instanceof ServiceError) return { ok: false, message: e.message, fieldErrors: e.fieldErrors };
    if (e instanceof ForbiddenError) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: 'Something went wrong. Try again.' };
  }
}

export async function createDocumentAction(input: { formType: string; dealId?: string; sellerClientId?: string; buyerClientId?: string; listingId?: string }) {
  const actor = await actorOrThrow();
  const clean = Object.fromEntries(Object.entries(input).filter(([, v]) => v));
  const r = await run(() => db.transaction((tx) => docs.createDocument(tx, actor, clean)));
  if (r.ok) redirect(`/portal/documents/${r.data!.id}`);
  return r;
}

export async function saveDocumentAction(id: string, data: DocData, signatures: { party: string; typedName: string; signedOn: string }[]) {
  const actor = await actorOrThrow();
  return run(() => db.transaction((tx) => docs.saveDocument(tx, actor, id, { data, signatures })), 'Draft saved', id);
}

export async function fillDocumentAction(id: string, current: DocData, picks: docs.FillPicks) {
  const actor = await actorOrThrow();
  const clean = Object.fromEntries(Object.entries(picks).filter(([, v]) => v));
  return run(() => db.transaction((tx) => docs.fillDocument(tx, actor, id, current, clean)), 'Filled from the client file. Check it, then save.', id);
}

const STATUS_MESSAGE = { draft: 'Back to draft', sent: 'Marked as sent', signed: 'Marked as signed' } as const;

export async function setDocumentStatusAction(id: string, status: 'draft' | 'sent' | 'signed') {
  const actor = await actorOrThrow();
  return run(() => db.transaction((tx) => docs.setDocumentStatus(tx, actor, id, status)), STATUS_MESSAGE[status], id);
}

export async function shareDocumentAction(id: string, shared: boolean) {
  const actor = await actorOrThrow();
  return run(() => db.transaction((tx) => docs.shareDocument(tx, actor, id, shared)), shared ? 'Shared to the client’s account' : 'No longer shared', id);
}

export async function deleteDraftAction(id: string) {
  const actor = await actorOrThrow();
  const r = await run(() => db.transaction((tx) => docs.deleteDraft(tx, actor, id)));
  if (r.ok) redirect('/portal/documents');
  return r;
}

'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/db/client';
import { listings } from '@/db/schema';
import type { ActionState } from '@/lib/action-result';
import { postWebhook, type WebhookEvent } from '@/lib/discord';
import { checklist, type ChecklistItem } from '@/lib/listing-checklist';
import { can } from '@/lib/permissions';
import { createUploadTarget, destroyUpload, verifyUpload, type UploadTarget } from '@/lib/storage';
import { TransitionError } from '@/lib/listing-status';
import { checklistInput, loadBundle } from '@/server/listings/bundle';
import { webhookMessageFor } from '@/server/listings/present';
import * as svc from '@/server/listings/service';
import { actorOrThrow, ForbiddenError } from '@/server/session';
import { getSettings } from '@/server/settings';

type Result<T = undefined> = NonNullable<ActionState<T>>;

function fail(e: unknown): { ok: false; message?: string; fieldErrors?: Record<string, string>; checklist?: ChecklistItem[] } {
  if (e instanceof svc.ServiceError) return { ok: false, message: e.message, fieldErrors: e.fieldErrors, checklist: e.checklist };
  if (e instanceof ForbiddenError || e instanceof TransitionError) return { ok: false, message: e.message };
  console.error(e);
  return { ok: false, message: 'Something went wrong saving that. Try again.' };
}

function editorPath(id: string, source: 'agent' | 'owner_submitted') {
  return source === 'agent' ? `/portal/listings/${id}/edit` : `/account/listings/${id}/edit`;
}

function revalidateListing(slug?: string) {
  revalidateTag('listings', 'max');
  if (slug) revalidatePath(`/property/${slug}`);
}

export async function startListing(source: 'agent' | 'owner_submitted') {
  const actor = await actorOrThrow();
  const l = await db.transaction((tx) => svc.createDraft(tx, actor, source));
  redirect(editorPath(l.id, source));
}

export type StepName = 'property' | 'terms' | 'seller' | 'owner';

export async function saveListingStep(id: string, step: StepName, values: unknown): Promise<Result & { checklist?: ChecklistItem[] }> {
  try {
    const actor = await actorOrThrow();
    await db.transaction(async (tx) => {
      if (step === 'property') await svc.saveProperty(tx, actor, id, values);
      else if (step === 'terms') await svc.saveTerms(tx, actor, id, values);
      else if (step === 'seller') await svc.saveSeller(tx, actor, id, values);
      else await svc.saveOwnerDetails(tx, actor, id, values);
    });
    return { ok: true, message: 'Draft saved' };
  } catch (e) {
    return fail(e);
  }
}

export async function getUploadTarget(): Promise<{ ok: true; target: UploadTarget } | { ok: false; message: string }> {
  try {
    await actorOrThrow();
    return { ok: true, target: createUploadTarget('listings') };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Uploads aren’t available.' };
  }
}

export async function registerPhoto(id: string, uploaded: { storageId: string; width: number; height: number; bytes?: number; format?: string; version?: number; signature?: string }) {
  try {
    const actor = await actorOrThrow();
    if (!verifyUpload(uploaded)) return { ok: false as const, message: 'That upload couldn’t be verified. Try again.' };
    const photo = await db.transaction((tx) => svc.addPhoto(tx, actor, id, uploaded));
    return { ok: true as const, photo };
  } catch (e) {
    return fail(e);
  }
}

export async function savePhotos(id: string, order: { order: string[]; coverId: string | null }, meta: { id: string; alt: string; caption: string | null }[]): Promise<Result> {
  try {
    const actor = await actorOrThrow();
    await db.transaction((tx) => svc.updatePhotos(tx, actor, id, { order, meta }));
    return { ok: true, message: 'Photos saved' };
  } catch (e) {
    return fail(e);
  }
}

export async function deletePhoto(id: string, photoId: string): Promise<Result> {
  try {
    const actor = await actorOrThrow();
    const storageId = await db.transaction((tx) => svc.removePhoto(tx, actor, id, photoId));
    if (storageId) await destroyUpload(storageId);
    return { ok: true, message: 'Photo removed' };
  } catch (e) {
    return fail(e);
  }
}

export async function submitListing(id: string): Promise<Result<{ refNo: string; round: number }> & { checklist?: ChecklistItem[] }> {
  try {
    const actor = await actorOrThrow();
    const settings = await getSettings();
    const res = await svc.submitForReview(db, actor, settings, id);
    await postWebhook(
      'review_pending',
      webhookMessageFor(res.bundle, res.round > 1 ? 'Listing resubmitted for review' : 'Listing waiting for review', `/portal/review/${id}`, { internal: true }),
    );
    revalidatePath('/portal', 'layout');
    return { ok: true, message: 'Submitted for review', data: { refNo: res.refNo, round: res.round } };
  } catch (e) {
    return fail(e);
  }
}

const APPROVED_EVENT = (b: { type: string; purpose: string }): WebhookEvent =>
  b.type === 'business' ? 'new_business' : b.purpose === 'rent' ? 'new_rental' : 'new_listing';

export async function decideListing(id: string, input: { decision: 'approved' | 'changes_requested' | 'rejected'; notes?: string; comingSoon?: boolean; agentId?: string | null }): Promise<Result> {
  try {
    const actor = await actorOrThrow();
    const settings = await getSettings();
    const res = await svc.decideReview(db, actor, settings, id, input);
    if (res.decision === 'approved') {
      const b = res.bundle;
      const title = b.type === 'business' ? 'New business listing' : b.purpose === 'rent' ? 'New rental' : 'New listing';
      await postWebhook(APPROVED_EVENT(b), webhookMessageFor(b, title, `/property/${b.slug}`));
      revalidateListing(b.slug);
    }
    revalidatePath('/portal', 'layout');
    const words = { approved: 'Listing published', changes_requested: 'Changes requested', rejected: 'Listing rejected' };
    return { ok: true, message: words[res.decision] };
  } catch (e) {
    return fail(e);
  }
}

export async function withdrawListingAction(id: string): Promise<Result> {
  try {
    const actor = await actorOrThrow();
    await svc.withdrawListing(db, actor, id);
    const l = await db.query.listings.findFirst({ where: eq(listings.id, id), columns: { slug: true } });
    revalidateListing(l?.slug);
    revalidatePath('/portal', 'layout');
    return { ok: true, message: 'Listing withdrawn' };
  } catch (e) {
    return fail(e);
  }
}

/** Used by the wizard's review step to refresh the checklist after edits. */
export async function listingChecklist(id: string) {
  const actor = await actorOrThrow();
  const b = await loadBundle(db, id, { confidential: false });
  if (!b) return null;
  if (!can(actor, 'listing.view', { source: b.source, status: b.status, listingAgentId: b.listingAgentId, submittedByUserId: b.submittedByUserId })) return null;
  return checklist(checklistInput(b));
}

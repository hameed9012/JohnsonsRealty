'use server';

import { and, eq, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/db/client';
import { clients, listings, savedHomes, showings } from '@/db/schema';
import { fieldErrors, type ActionState } from '@/lib/action-result';
import { MARKET_STATUSES } from '@/lib/listing-status';
import { nextRef } from '@/lib/refs';
import { text } from '@/lib/schemas/fields';
import { audit } from '@/server/audit';
import { notifyUsers } from '@/server/notify';
import { getActor } from '@/server/session';

type Status = (typeof listings.status.enumValues)[number];

export async function toggleSavedHome(listingId: string): Promise<{ ok: boolean; saved?: boolean; message?: string }> {
  const actor = await getActor();
  if (!actor) return { ok: false, message: 'Sign in to save homes.' };
  const existing = await db.query.savedHomes.findFirst({ where: and(eq(savedHomes.userId, actor.id), eq(savedHomes.listingId, listingId)) });
  if (existing) {
    await db.delete(savedHomes).where(and(eq(savedHomes.userId, actor.id), eq(savedHomes.listingId, listingId)));
    revalidatePath('/account/saved');
    return { ok: true, saved: false, message: 'Removed from saved homes' };
  }
  const l = await db.query.listings.findFirst({ where: and(eq(listings.id, listingId), inArray(listings.status, MARKET_STATUSES as Status[])), columns: { id: true } });
  if (!l) return { ok: false, message: 'This home is no longer on the market.' };
  await db.insert(savedHomes).values({ userId: actor.id, listingId }).onConflictDoNothing();
  revalidatePath('/account/saved');
  return { ok: true, saved: true, message: 'Home saved' };
}

const showingSchema = z.object({
  when: z
    .string()
    .trim()
    // The browser converts the local time it shows into an ISO timestamp.
    .refine((v) => /^\d{4}-\d{2}-\d{2}T/.test(v) && !Number.isNaN(Date.parse(v)), 'Choose a date and time for the showing.')
    .refine((v) => Date.parse(v) > Date.now() - 3600_000, 'Choose a time that hasn’t passed yet.'),
  note: text(500, 'Your note'),
});

/** Book a showing from the property page. Returns the reference number. */
export async function requestShowing(listingId: string, _prev: ActionState<{ refNo: string }>, fd: FormData): Promise<ActionState<{ refNo: string }>> {
  const actor = await getActor();
  if (!actor) return { ok: false, message: 'Sign in to book a showing.' };
  const parsed = showingSchema.safeParse({ when: fd.get('when'), note: fd.get('note') });
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };
  const l = await db.query.listings.findFirst({ where: and(eq(listings.id, listingId), inArray(listings.status, MARKET_STATUSES as Status[])) });
  if (!l) return { ok: false, message: 'This listing isn’t taking showings right now.' };

  const refNo = await db.transaction(async (tx) => {
    const ref = await nextRef(tx);
    const client = await tx.query.clients.findFirst({ where: and(eq(clients.userId, actor.id), eq(clients.archived, false)), columns: { id: true } });
    await tx.insert(showings).values({
      refNo: ref,
      listingId,
      clientId: client?.id ?? null,
      requestedBy: actor.id,
      agentId: l.listingAgentId,
      requestedFor: new Date(parsed.data.when),
      notes: parsed.data.note,
    });
    await audit(tx, { actorId: actor.id, action: 'showing.request', entity: 'listing', entityId: listingId, summary: `Showing requested (${ref}) for ${l.addressLine || l.refNo}` });
    const who = l.listingAgentId ?? (l.source === 'owner_submitted' ? l.submittedByUserId : null);
    if (who) {
      await notifyUsers(tx, [who], {
        kind: 'showing.requested',
        title: 'Showing requested',
        body: `${actor.displayName} for ${l.addressLine || l.refNo}`,
        link: l.listingAgentId ? '/portal/showings' : '/account/showings',
      });
    }
    return ref;
  });
  return { ok: true, message: 'Showing requested', data: { refNo } };
}

'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/client';
import { listings, showings } from '@/db/schema';
import { clientCanChange, type ShowingStatus } from '@/lib/showings';
import { audit } from '@/server/audit';
import { notifyUsers } from '@/server/notify';
import { getActor } from '@/server/session';

type R = { ok: boolean; message: string; fieldError?: string };

async function own(id: string) {
  const actor = await getActor();
  if (!actor) return { error: 'Sign in to continue.' as const };
  const [s] = await db
    .select({ showing: showings, listing: { addressLine: listings.addressLine, refNo: listings.refNo, agentId: listings.listingAgentId, submittedBy: listings.submittedByUserId, source: listings.source } })
    .from(showings)
    .innerJoin(listings, eq(listings.id, showings.listingId))
    .where(and(eq(showings.id, id), eq(showings.requestedBy, actor.id)));
  if (!s) return { error: 'That showing no longer exists.' as const };
  return { actor, ...s };
}

function contactFor(l: { agentId: string | null; submittedBy: string | null; source: string }) {
  return l.agentId ?? (l.source === 'owner_submitted' ? l.submittedBy : null);
}

export async function rescheduleShowing(id: string, whenIso: string): Promise<R> {
  const o = await own(id);
  if ('error' in o) return { ok: false, message: o.error! };
  const when = new Date(whenIso);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(whenIso) || Number.isNaN(when.getTime())) return { ok: false, message: 'Check the time.', fieldError: 'Choose a date and time for the showing.' };
  if (when.getTime() < Date.now()) return { ok: false, message: 'Check the time.', fieldError: 'Choose a time that hasn’t passed yet.' };
  const at = o.showing.confirmedFor ?? o.showing.requestedFor;
  if (!clientCanChange(o.showing.status as ShowingStatus, at)) return { ok: false, message: 'This showing can’t be changed any more.' };
  await db.transaction(async (tx) => {
    await tx.update(showings).set({ requestedFor: when, confirmedFor: null, status: 'requested' }).where(eq(showings.id, id));
    await audit(tx, { actorId: o.actor.id, action: 'showing.reschedule', entity: 'showing', entityId: id, summary: `Asked to move showing ${o.showing.refNo}`, diff: { requestedFor: { from: at.toISOString(), to: when.toISOString() } } });
    const who = contactFor(o.listing);
    if (who) await notifyUsers(tx, [who], { kind: 'showing.rescheduled', title: 'Showing moved', body: `${o.actor.displayName} asked to move ${o.showing.refNo} (${o.listing.addressLine || o.listing.refNo})`, link: o.listing.agentId ? '/portal/showings' : '/account/showings' });
  });
  revalidatePath('/account/showings');
  return { ok: true, message: 'New time requested' };
}

export async function cancelShowing(id: string): Promise<R> {
  const o = await own(id);
  if ('error' in o) return { ok: false, message: o.error! };
  const at = o.showing.confirmedFor ?? o.showing.requestedFor;
  if (!clientCanChange(o.showing.status as ShowingStatus, at)) return { ok: false, message: 'This showing can’t be cancelled any more.' };
  await db.transaction(async (tx) => {
    await tx.update(showings).set({ status: 'cancelled' }).where(eq(showings.id, id));
    await audit(tx, { actorId: o.actor.id, action: 'showing.cancel', entity: 'showing', entityId: id, summary: `Cancelled showing ${o.showing.refNo}` });
    const who = contactFor(o.listing);
    if (who) await notifyUsers(tx, [who], { kind: 'showing.cancelled', title: 'Showing cancelled', body: `${o.actor.displayName} cancelled ${o.showing.refNo} (${o.listing.addressLine || o.listing.refNo})`, link: o.listing.agentId ? '/portal/showings' : '/account/showings' });
  });
  revalidatePath('/account/showings');
  return { ok: true, message: 'Showing cancelled' };
}

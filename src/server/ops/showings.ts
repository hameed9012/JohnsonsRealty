import 'server-only';
import { eq } from 'drizzle-orm';
import type { Executor } from '@/db/client';
import { listings, showings, users } from '@/db/schema';
import { can, type Actor } from '@/lib/permissions';
import { audit } from '@/server/audit';
import { notifyUsers } from '@/server/notify';
import { ServiceError } from '@/server/listings/service';

export type StaffShowingAction = 'confirm' | 'complete' | 'no_show' | 'cancel';

const NEXT: Record<StaffShowingAction, { from: string[]; to: 'confirmed' | 'completed' | 'no_show' | 'cancelled'; word: string }> = {
  confirm: { from: ['requested', 'confirmed'], to: 'confirmed', word: 'confirmed' },
  complete: { from: ['confirmed', 'requested'], to: 'completed', word: 'marked as done' },
  no_show: { from: ['confirmed', 'requested'], to: 'no_show', word: 'marked as a no-show' },
  cancel: { from: ['requested', 'confirmed'], to: 'cancelled', word: 'cancelled' },
};

/** Staff confirm (optionally at a different time), complete, no-show or cancel a showing. */
export async function updateShowing(ex: Executor, actor: Actor, id: string, action: StaffShowingAction, at?: Date | null) {
  const s = await ex.query.showings.findFirst({ where: eq(showings.id, id) });
  if (!s) throw new ServiceError('That showing doesn’t exist.');
  const manager = actor.role === 'owner' || actor.role === 'admin';
  if (!can(actor, 'showing.manage') || (!manager && s.agentId && s.agentId !== actor.id)) throw new ServiceError('You can’t change this showing.');
  const step = NEXT[action];
  if (!step.from.includes(s.status)) throw new ServiceError(`This showing is already ${s.status.replace('_', ' ')}.`);
  if (at && Number.isNaN(at.getTime())) throw new ServiceError('Check the time.', { at: 'Choose a date and time.' });
  const patch: Partial<typeof showings.$inferSelect> = { status: step.to };
  if (action === 'confirm') patch.confirmedFor = at ?? s.confirmedFor ?? s.requestedFor;
  if (!s.agentId) patch.agentId = actor.id;
  await ex.update(showings).set(patch).where(eq(showings.id, id));
  const l = await ex.query.listings.findFirst({ where: eq(listings.id, s.listingId), columns: { addressLine: true, refNo: true } });
  await audit(ex, { actorId: actor.id, action: `showing.${action}`, entity: 'showing', entityId: id, summary: `Showing ${s.refNo} ${step.word}` });
  if (s.requestedBy && (action === 'confirm' || action === 'cancel')) {
    const u = await ex.query.users.findFirst({ where: eq(users.id, s.requestedBy), columns: { notificationPrefs: true } });
    if (u?.notificationPrefs.showingUpdates) {
      await notifyUsers(ex, [s.requestedBy], {
        kind: `showing.${action}`,
        title: action === 'confirm' ? 'Showing confirmed' : 'Showing cancelled',
        body: `${l?.addressLine || l?.refNo} · ${s.refNo}`,
        link: '/account/showings',
      });
    }
  }
  return { ...s, ...patch };
}

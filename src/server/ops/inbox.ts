import 'server-only';
import { and, eq, inArray } from 'drizzle-orm';
import type { Executor } from '@/db/client';
import { enquiries, enquiryReplies, users } from '@/db/schema';
import { fieldErrors } from '@/lib/action-result';
import { can, type Actor } from '@/lib/permissions';
import { replySchema } from '@/lib/schemas/ops';
import { audit } from '@/server/audit';
import { notifyUsers } from '@/server/notify';
import { ServiceError } from '@/server/listings/service';

export const ENQUIRY_STATUSES = ['new', 'open', 'waiting', 'closed'] as const;
export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];

async function get(ex: Executor, actor: Actor, id: string) {
  if (!can(actor, 'enquiry.manage')) throw new ServiceError('You can’t see the inbox.');
  const e = await ex.query.enquiries.findFirst({ where: eq(enquiries.id, id) });
  if (!e) throw new ServiceError('That enquiry doesn’t exist.');
  return e;
}

export async function setEnquiryStatus(ex: Executor, actor: Actor, id: string, status: EnquiryStatus) {
  const e = await get(ex, actor, id);
  if (!ENQUIRY_STATUSES.includes(status)) throw new ServiceError('Choose a status.');
  await ex.update(enquiries).set({ status }).where(eq(enquiries.id, id));
  await audit(ex, { actorId: actor.id, action: 'enquiry.status', entity: 'enquiry', entityId: id, summary: `Marked ${e.refNo} ${status}` });
}

export async function assignEnquiry(ex: Executor, actor: Actor, id: string, assigneeId: string | null) {
  const e = await get(ex, actor, id);
  if (assigneeId) {
    const u = await ex.query.users.findFirst({ where: and(eq(users.id, assigneeId), inArray(users.role, ['owner', 'admin', 'agent']), eq(users.status, 'active')) });
    if (!u) throw new ServiceError('Choose someone on the team.');
    if (assigneeId !== actor.id) await notifyUsers(ex, [assigneeId], { kind: 'enquiry.assigned', title: 'Enquiry assigned to you', body: e.refNo, link: `/portal/inbox/${id}` });
  }
  await ex.update(enquiries).set({ assigneeId, status: e.status === 'new' ? 'open' : e.status }).where(eq(enquiries.id, id));
  await audit(ex, { actorId: actor.id, action: 'enquiry.assign', entity: 'enquiry', entityId: id, summary: assigneeId ? `Assigned ${e.refNo}` : `Unassigned ${e.refNo}` });
}

/** A reply goes to the person who sent the enquiry (as a notification); an internal note stays with staff. */
export async function replyToEnquiry(ex: Executor, actor: Actor, id: string, input: unknown) {
  const e = await get(ex, actor, id);
  const p = replySchema.safeParse(input);
  if (!p.success) throw new ServiceError('Check the reply.', fieldErrors(p.error));
  await ex.insert(enquiryReplies).values({ enquiryId: id, authorId: actor.id, body: p.data.body!, internal: p.data.internal });
  if (!p.data.internal) {
    await ex.update(enquiries).set({ status: 'waiting', assigneeId: e.assigneeId ?? actor.id }).where(eq(enquiries.id, id));
    if (e.userId) await notifyUsers(ex, [e.userId], { kind: 'enquiry.reply', title: `Reply about ${e.refNo}`, body: p.data.body!.slice(0, 1000), link: '/account' });
  }
  await audit(ex, { actorId: actor.id, action: p.data.internal ? 'enquiry.note' : 'enquiry.reply', entity: 'enquiry', entityId: id, summary: `${p.data.internal ? 'Added a note to' : 'Replied to'} ${e.refNo}` });
}

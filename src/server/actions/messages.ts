'use server';

import { eq, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/db/client';
import { deals, messages, users } from '@/db/schema';
import { can } from '@/lib/permissions';
import { audit } from '@/server/audit';
import { notifyUsers } from '@/server/notify';
import { markThreadRead, partyUserIds } from '@/server/queries/deals';
import { getActor } from '@/server/session';

const bodySchema = z.string().trim().min(1, 'Write a message first.').max(4000, 'Keep messages under 4,000 characters.');

export async function sendDealMessage(dealId: string, body: string): Promise<{ ok: boolean; message?: string; error?: string }> {
  const actor = await getActor();
  if (!actor) return { ok: false, message: 'Sign in to continue.' };
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const deal = await db.query.deals.findFirst({ where: eq(deals.id, dealId) });
  if (!deal) return { ok: false, message: 'That deal no longer exists.' };
  const parties = await partyUserIds(dealId);
  if (!can(actor, 'deal.view', { agentId: deal.agentId, partyUserIds: parties })) return { ok: false, message: 'You don’t have access to that.' };
  if (actor.role === 'client' && !deal.sharedWithClient) return { ok: false, message: 'You don’t have access to that.' };

  const recipients = [...parties, ...(deal.agentId ? [deal.agentId] : [])].filter((u) => u !== actor.id);
  const prefs = recipients.length
    ? await db.select({ id: users.id, prefs: users.notificationPrefs, role: users.role }).from(users).where(inArray(users.id, recipients))
    : [];
  // Staff always hear about client messages; clients can turn deal-message notifications off.
  const notify = prefs.filter((p) => p.role !== 'client' || p.prefs.dealMessages).map((p) => p.id);

  await db.transaction(async (tx) => {
    await tx.insert(messages).values({ dealId, authorId: actor.id, body: parsed.data });
    await audit(tx, { actorId: actor.id, action: 'message.send', entity: 'deal', entityId: dealId, summary: 'Sent a deal message' });
    for (const uid of notify) {
      const p = prefs.find((x) => x.id === uid)!;
      await notifyUsers(tx, [uid], {
        kind: 'deal.message',
        title: `New message from ${actor.displayName}`,
        body: parsed.data.slice(0, 140),
        link: p.role === 'client' ? `/account/deal/${dealId}` : `/portal/deals/${dealId}`,
      });
    }
  });
  await markThreadRead(dealId, actor.id);
  revalidatePath(`/account/deal/${dealId}`);
  return { ok: true };
}

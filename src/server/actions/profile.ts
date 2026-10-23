'use server';

import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { fieldErrors, formObject, type ActionState } from '@/lib/action-result';
import { profileSchema } from '@/lib/schemas/profile';
import { audit } from '@/server/audit';
import { getActor } from '@/server/session';

function safeCallback(v: FormDataEntryValue | null) {
  const s = typeof v === 'string' ? v : '';
  return s.startsWith('/') && !s.startsWith('//') ? s : '/account';
}

export async function saveProfile(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await getActor();
  if (!actor) return { ok: false, message: 'Sign in to continue.' };
  const parsed = profileSchema.safeParse(formObject(fd));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };

  const firstRun = !actor.onboarded;
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        robloxUsername: parsed.data.robloxUsername,
        chirperHandle: parsed.data.chirperHandle,
        ...(parsed.data.displayName ? { displayName: parsed.data.displayName } : {}),
        ...(firstRun ? { onboardedAt: new Date() } : {}),
      })
      .where(eq(users.id, actor.id));
    await audit(tx, { actorId: actor.id, action: firstRun ? 'profile.create' : 'profile.update', entity: 'user', entityId: actor.id, summary: 'Updated profile' });
  });

  if (firstRun) redirect(safeCallback(fd.get('callbackUrl')));
  return { ok: true, message: 'Profile saved' };
}

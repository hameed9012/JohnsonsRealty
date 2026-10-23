import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import type { Executor } from '@/db/client';
import { agentProfiles, staffInvites, users } from '@/db/schema';
import { fieldErrors } from '@/lib/action-result';
import { can, type Actor } from '@/lib/permissions';
import { inviteSchema } from '@/lib/schemas/ops';
import { slugify } from '@/lib/slug';
import { audit } from '@/server/audit';
import { ServiceError } from '@/server/listings/service';

export const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');

/** Creates a single-use invite. The raw token is returned once and only its hash is stored. */
export async function createInvite(ex: Executor, actor: Actor, input: unknown): Promise<{ token: string; expiresAt: Date }> {
  const p = inviteSchema.safeParse(input);
  if (!p.success) throw new ServiceError('Check the highlighted fields.', fieldErrors(p.error));
  if (!can(actor, 'staff.invite', { role: p.data.role })) throw new ServiceError(p.data.role === 'admin' ? 'Only the Owner can invite Admins.' : 'You can’t invite staff.');
  const token = randomBytes(24).toString('base64url');
  const expiresAt = new Date(Date.now() + p.data.days * 86400000);
  await ex.insert(staffInvites).values({ tokenHash: hashToken(token), role: p.data.role, note: p.data.note, createdBy: actor.id, expiresAt });
  await audit(ex, { actorId: actor.id, action: 'invite.create', entity: 'invite', entityId: null, summary: `Created an ${p.data.role} invite${p.data.note ? ` (${p.data.note})` : ''}` });
  return { token, expiresAt };
}

export async function findInvite(ex: Executor, token: string) {
  return (
    (await ex.query.staffInvites.findFirst({
      where: and(eq(staffInvites.tokenHash, hashToken(token)), isNull(staffInvites.usedAt), isNull(staffInvites.revokedAt), gt(staffInvites.expiresAt, new Date())),
    })) ?? null
  );
}

/** The signed-in user accepts an invite: they get the role and an agent profile. Owners are never changed. */
export async function acceptInvite(ex: Executor, userId: string, token: string) {
  const inv = await findInvite(ex, token);
  if (!inv) throw new ServiceError('This invite has expired or has already been used. Ask for a new one.');
  const u = await ex.query.users.findFirst({ where: eq(users.id, userId) });
  if (!u || u.status !== 'active') throw new ServiceError('Sign in with an active account to accept.');
  if (u.role === 'owner') throw new ServiceError('You’re the Owner already.');
  if (u.role === 'admin' && inv.role === 'agent') throw new ServiceError('You already have Admin access.');
  await ex.update(users).set({ role: inv.role }).where(eq(users.id, userId));
  const name = u.displayName || u.name || 'Agent';
  const base = slugify(name) || 'agent';
  const taken = await ex.query.agentProfiles.findFirst({ where: eq(agentProfiles.slug, base) });
  await ex
    .insert(agentProfiles)
    .values({ userId, publicName: name, slug: taken && taken.userId !== userId ? `${base}-${userId.slice(0, 6)}` : base, active: true })
    .onConflictDoUpdate({ target: agentProfiles.userId, set: { active: true } });
  await ex.update(staffInvites).set({ usedBy: userId, usedAt: new Date() }).where(eq(staffInvites.id, inv.id));
  await audit(ex, { actorId: userId, action: 'invite.accept', entity: 'user', entityId: userId, summary: `${name} joined as ${inv.role}` });
  return inv.role;
}

export async function revokeInvite(ex: Executor, actor: Actor, id: string) {
  const inv = await ex.query.staffInvites.findFirst({ where: eq(staffInvites.id, id) });
  if (!inv) throw new ServiceError('That invite doesn’t exist.');
  if (!can(actor, 'staff.invite', { role: inv.role })) throw new ServiceError('You can’t revoke this invite.');
  await ex.update(staffInvites).set({ revokedAt: new Date() }).where(eq(staffInvites.id, id));
  await audit(ex, { actorId: actor.id, action: 'invite.revoke', entity: 'invite', entityId: id, summary: `Revoked an ${inv.role} invite` });
}

'use server';

import { and, eq, ne } from 'drizzle-orm';
import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/db/client';
import { agentProfiles, areas, sessions, siteSettings, users } from '@/db/schema';
import { fieldErrors, formObject, type ActionState } from '@/lib/action-result';
import { can } from '@/lib/permissions';
import { agentProfileSchema, areaSchema, roleChangeSchema, settingsSchema } from '@/lib/schemas/admin';
import { slugify } from '@/lib/slug';
import { audit, diffOf } from '@/server/audit';
import { actorOrThrow } from '@/server/session';

const DENIED = { ok: false as const, message: 'You don’t have access to that.' };

// ---------- Areas ----------

export async function saveArea(id: string | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await actorOrThrow();
  if (!can(actor, 'areas.manage')) return DENIED;
  const raw = formObject(fd);
  const parsed = areaSchema.safeParse({ ...raw, selectable: raw.selectable === 'on' });
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };
  const d = parsed.data;
  const values = { ...d, name: d.name!, slug: d.slug || slugify(d.name!), displayOrder: d.displayOrder ?? 0 };
  if (id && values.parentId === id) return { ok: false, fieldErrors: { parentId: 'An area can’t be inside itself.' } };

  const clash = await db.query.areas.findFirst({ where: id ? and(eq(areas.slug, values.slug), ne(areas.id, id)) : eq(areas.slug, values.slug) });
  if (clash) return { ok: false, fieldErrors: { slug: 'Another area already uses this slug. Choose a different one.' } };

  const saved = await db.transaction(async (tx) => {
    if (id) {
      const before = await tx.query.areas.findFirst({ where: eq(areas.id, id) });
      if (!before) return null;
      await tx.update(areas).set(values).where(eq(areas.id, id));
      await audit(tx, { actorId: actor.id, action: 'area.update', entity: 'area', entityId: id, summary: `Updated area ${values.name}`, diff: diffOf(before as Record<string, unknown>, values) });
      return id;
    }
    const [a] = await tx.insert(areas).values(values).returning({ id: areas.id });
    await audit(tx, { actorId: actor.id, action: 'area.create', entity: 'area', entityId: a!.id, summary: `Added area ${values.name}` });
    return a!.id;
  });
  if (!saved) return { ok: false, message: 'That area no longer exists.' };
  revalidateTag('areas', 'max');
  revalidatePath('/portal/areas');
  if (!id) redirect(`/portal/areas/${saved}`);
  return { ok: true, message: 'Area saved' };
}

// ---------- Site settings ----------

export async function saveSettings(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await actorOrThrow();
  if (!can(actor, 'settings.manage')) return DENIED;
  const raw = formObject(fd);
  const parsed = settingsSchema.safeParse({ ...raw, adminsCanApprove: raw.adminsCanApprove === 'on', liveEditsNeedReview: raw.liveEditsNeedReview === 'on' });
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };
  const d = parsed.data;
  await db.transaction(async (tx) => {
    const before = await tx.query.siteSettings.findFirst({ where: eq(siteSettings.id, 1) });
    const values = { ...d, brokerageName: d.brokerageName!, brokerageSubline: d.brokerageSubline! };
    await tx.insert(siteSettings).values({ id: 1, ...values }).onConflictDoUpdate({ target: siteSettings.id, set: values });
    await audit(tx, { actorId: actor.id, action: 'settings.update', entity: 'site_settings', entityId: '1', summary: 'Updated site settings', diff: before ? diffOf(before as Record<string, unknown>, values) : undefined });
  });
  revalidateTag('settings', 'max');
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Settings saved' };
}

// ---------- Team ----------

export async function changeRole(input: { userId: string; role: 'admin' | 'agent' | 'client' }): Promise<ActionState> {
  const actor = await actorOrThrow();
  const parsed = roleChangeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: 'Choose a role.' };
  const target = await db.query.users.findFirst({ where: eq(users.id, parsed.data.userId) });
  if (!target) return { ok: false, message: 'That person no longer has an account.' };
  if (!can(actor, 'role.assign', { targetId: target.id, targetRole: target.role, newRole: parsed.data.role })) return DENIED;
  if (target.role === parsed.data.role) return { ok: true };

  await db.transaction(async (tx) => {
    await tx.update(users).set({ role: parsed.data.role }).where(eq(users.id, target.id));
    if (parsed.data.role !== 'client') {
      const name = target.displayName || target.name || 'Agent';
      const base = slugify(name) || 'agent';
      const taken = await tx.query.agentProfiles.findFirst({ where: eq(agentProfiles.slug, base) });
      await tx
        .insert(agentProfiles)
        .values({ userId: target.id, publicName: name, slug: taken ? `${base}-${target.id.slice(0, 6)}` : base, active: true })
        .onConflictDoNothing({ target: agentProfiles.userId });
    } else {
      await tx.update(agentProfiles).set({ active: false }).where(eq(agentProfiles.userId, target.id));
    }
    await audit(tx, {
      actorId: actor.id,
      action: 'user.role',
      entity: 'user',
      entityId: target.id,
      summary: `Changed ${target.displayName ?? target.name ?? 'a user'} from ${target.role} to ${parsed.data.role}`,
      diff: { role: { from: target.role, to: parsed.data.role } },
    });
  });
  revalidatePath('/portal/team');
  return { ok: true, message: 'Role updated' };
}

export async function setUserActive(userId: string, active: boolean): Promise<ActionState> {
  const actor = await actorOrThrow();
  const target = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!target) return { ok: false, message: 'That person no longer has an account.' };
  if (!can(actor, 'staff.deactivate', { targetId: target.id, targetRole: target.role })) return DENIED;
  await db.transaction(async (tx) => {
    await tx.update(users).set({ status: active ? 'active' : 'deactivated' }).where(eq(users.id, userId));
    if (!active) await tx.delete(sessions).where(eq(sessions.userId, userId));
    await audit(tx, { actorId: actor.id, action: active ? 'user.reactivate' : 'user.deactivate', entity: 'user', entityId: userId, summary: `${active ? 'Reactivated' : 'Deactivated'} ${target.displayName ?? target.name ?? 'a user'}` });
  });
  revalidatePath('/portal/team');
  return { ok: true, message: active ? 'Account reactivated' : 'Account deactivated' };
}

export async function saveAgentProfile(userId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await actorOrThrow();
  const self = actor.id === userId;
  if (!self && !can(actor, 'staff.view')) return DENIED;
  const raw = formObject(fd);
  const parsed = agentProfileSchema.safeParse({ ...raw, active: raw.active === 'on', wideConfidentialAccess: raw.wideConfidentialAccess === 'on' });
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };
  const d = parsed.data;
  const existing = await db.query.agentProfiles.findFirst({ where: eq(agentProfiles.userId, userId) });
  if (!existing) return { ok: false, message: 'This person isn’t on the team.' };
  const slug = d.slug || slugify(d.publicName!);
  const clash = await db.query.agentProfiles.findFirst({ where: and(eq(agentProfiles.slug, slug), ne(agentProfiles.userId, userId)) });
  if (clash) return { ok: false, fieldErrors: { slug: 'Another agent already uses this slug.' } };
  const values = {
    publicName: d.publicName!,
    slug,
    title: d.title,
    bio: d.bio,
    contactLine: d.contactLine,
    // Only managers change visibility, order and access grants.
    ...(can(actor, 'staff.view') ? { active: d.active, displayOrder: d.displayOrder ?? 0 } : {}),
    ...(actor.role === 'owner' ? { wideConfidentialAccess: d.wideConfidentialAccess } : {}),
  };
  await db.transaction(async (tx) => {
    await tx.update(agentProfiles).set(values).where(eq(agentProfiles.userId, userId));
    await audit(tx, { actorId: actor.id, action: 'agent.update', entity: 'agent_profile', entityId: existing.id, summary: `Updated agent profile for ${values.publicName}`, diff: diffOf(existing as Record<string, unknown>, values) });
  });
  revalidateTag('agents', 'max');
  revalidatePath('/portal/team');
  return { ok: true, message: 'Profile saved' };
}

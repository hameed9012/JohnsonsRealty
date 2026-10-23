import 'server-only';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { auth } from '@/auth';
import { db } from '@/db/client';
import { agentProfiles } from '@/db/schema';
import { can, isStaff, type Action, type Actor } from '@/lib/permissions';
import { getSettings } from './settings';

export type SessionActor = Actor & {
  displayName: string;
  robloxUsername: string | null;
  image: string | null;
  onboarded: boolean;
};

/** The signed-in user as an Actor, once per request. Role and status come fresh from the database. */
export const getActor = cache(async (): Promise<SessionActor | null> => {
  const session = await auth();
  const u = session?.user;
  if (!u?.id || u.status !== 'active') return null;
  let wide = false;
  if (u.role === 'agent') {
    const p = await db.query.agentProfiles.findFirst({ where: eq(agentProfiles.userId, u.id), columns: { wideConfidentialAccess: true } });
    wide = !!p?.wideConfidentialAccess;
  }
  return {
    id: u.id,
    role: u.role,
    status: u.status,
    wideConfidentialAccess: wide,
    displayName: u.displayName || u.name || 'Member',
    robloxUsername: u.robloxUsername,
    image: u.image ?? null,
    onboarded: u.onboarded,
  };
});

export class ForbiddenError extends Error {
  constructor(message = 'You don’t have access to that.') {
    super(message);
  }
}

/** For pages: signed-in user or a redirect to sign in (and to first-run profile when needed). */
export async function requireActor(callbackUrl: string, opts: { allowUnonboarded?: boolean } = {}): Promise<SessionActor> {
  const a = await getActor();
  if (!a) redirect(`/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  if (!a.onboarded && !opts.allowUnonboarded) redirect(`/account/welcome?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  return a;
}

/** For portal pages. Non-staff see the not-found page rather than learning the portal exists. */
export async function requireStaff(callbackUrl: string): Promise<SessionActor> {
  const a = await requireActor(callbackUrl);
  if (!isStaff(a)) redirect('/account');
  return a;
}

/** For server actions: throws instead of redirecting. */
export async function actorOrThrow(): Promise<SessionActor> {
  const a = await getActor();
  if (!a) throw new ForbiddenError('Sign in to continue.');
  return a;
}

/** Throws ForbiddenError unless the actor may perform the action. Loads settings for approval checks. */
export async function authorize<A extends Action>(actor: Actor | null, action: A, subject?: Parameters<typeof can<A>>[2]): Promise<void> {
  const settings = await getSettings();
  const ok = (can as (a: Actor | null, x: Action, s?: unknown, st?: unknown) => boolean)(actor, action, subject, settings);
  if (!ok) throw new ForbiddenError();
}

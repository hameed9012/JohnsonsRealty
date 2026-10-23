import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { and, eq } from 'drizzle-orm';
import NextAuth, { type DefaultSession } from 'next-auth';
import Discord from 'next-auth/providers/discord';
import { getDb } from '@/db/client';
import { accounts, sessions, users, verificationTokens } from '@/db/schema';
import type { Role } from '@/lib/permissions';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: Role;
      status: 'active' | 'deactivated';
      displayName: string | null;
      robloxUsername: string | null;
      onboarded: boolean;
    } & DefaultSession['user'];
  }
}

type UserRow = typeof users.$inferSelect;

function discordAvatar(p: { id: string; avatar?: string | null }) {
  return p.avatar ? `https://cdn.discordapp.com/avatars/${p.id}/${p.avatar}.png?size=128` : null;
}

export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const db = getDb();
  return {
    adapter: DrizzleAdapter(db, {
      usersTable: users,
      accountsTable: accounts,
      sessionsTable: sessions,
      verificationTokensTable: verificationTokens,
    }),
    session: { strategy: 'database', maxAge: 30 * 24 * 60 * 60 },
    providers: [Discord({ authorization: { params: { scope: 'identify' } } })],
    pages: { signIn: '/signin', error: '/signin' },
    trustHost: true,
    callbacks: {
      async signIn({ user }) {
        if (!user?.id) return true;
        const row = await db.query.users.findFirst({ where: eq(users.id, user.id), columns: { status: true } });
        return row?.status !== 'deactivated';
      },
      session({ session, user }) {
        const u = user as unknown as UserRow;
        session.user.id = u.id;
        session.user.role = u.role;
        session.user.status = u.status;
        session.user.displayName = u.displayName ?? u.name ?? null;
        session.user.robloxUsername = u.robloxUsername ?? null;
        session.user.onboarded = !!u.onboardedAt;
        session.user.image = u.avatarUrl ?? u.image ?? null;
        return session;
      },
    },
    events: {
      // Keep the Discord identity fresh and make the configured Discord account the Owner.
      async signIn({ user, account, profile }) {
        if (!user.id || account?.provider !== 'discord') return;
        const discordId = account.providerAccountId;
        const p = (profile ?? {}) as { id?: string; username?: string; global_name?: string | null; avatar?: string | null };
        await db
          .update(users)
          .set({
            discordId,
            displayName: p.global_name || p.username || user.name || null,
            avatarUrl: discordAvatar({ id: discordId, avatar: p.avatar }),
          })
          .where(eq(users.id, user.id));
        await promoteOwnerIfConfigured(user.id, discordId);
      },
    },
  };
});

/** The first user whose Discord ID equals OWNER_DISCORD_ID becomes Owner, once. */
export async function promoteOwnerIfConfigured(userId: string, discordId: string) {
  const ownerId = process.env.OWNER_DISCORD_ID;
  if (!ownerId || discordId !== ownerId) return false;
  const db = getDb();
  const existing = await db.query.users.findFirst({ where: and(eq(users.role, 'owner')), columns: { id: true } });
  if (existing && existing.id !== userId) return false;
  await db.update(users).set({ role: 'owner', status: 'active' }).where(eq(users.id, userId));
  return true;
}

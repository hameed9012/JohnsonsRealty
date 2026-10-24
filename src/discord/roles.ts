// Site role → Discord role. Owner → Owner, Admin → Co-Owner, Agent → Agent, a client with a closed deal →
// Client. Management, Senior Agent and Trainee are Discord-only and set by hand, so sync never touches them.
import { and, eq, isNotNull, sql } from 'drizzle-orm';
import type { APIGuild, APIGuildMember } from 'discord-api-types/v10';
import type { Executor } from '@/db/client';
import { clients, dealParties, deals, users } from '@/db/schema';
import type { RoleKey } from './blueprint';
import { DiscordApiError, type DiscordRest } from './rest';

export const MANAGED: RoleKey[] = ['owner', 'coOwner', 'agent', 'client'];

export function desiredRoles(u: { role: string; status?: string; closedDeal: boolean }): RoleKey[] {
  if (u.status === 'deactivated') return [];
  const out: RoleKey[] = [];
  if (u.role === 'owner') out.push('owner');
  if (u.role === 'admin') out.push('coOwner');
  if (u.role === 'agent') out.push('agent');
  if (u.closedDeal) out.push('client');
  return out;
}

export interface SyncDeps {
  rest: DiscordRest;
  guildId: string;
  id: (key: string) => Promise<string | null>;
}

export type SyncResult = 'updated' | 'unchanged' | 'not-in-server' | 'not-set-up';

/** Adds and removes only the managed roles. Never takes Owner away from the server's owner. */
export async function syncMember(d: SyncDeps, discordUserId: string, want: RoleKey[], guildOwnerId?: string): Promise<SyncResult> {
  const ids = Object.fromEntries(await Promise.all(MANAGED.map(async (k) => [k, await d.id(`role:${k}`)] as const)));
  if (MANAGED.some((k) => !ids[k])) return 'not-set-up';
  let member: APIGuildMember;
  try {
    member = await d.rest.get<APIGuildMember>(`/guilds/${d.guildId}/members/${discordUserId}`);
  } catch (e) {
    if (e instanceof DiscordApiError && e.status === 404) return 'not-in-server';
    throw e;
  }
  let changed = false;
  for (const k of MANAGED) {
    const roleId = ids[k]!;
    const has = member.roles.includes(roleId);
    const should = want.includes(k) || (k === 'owner' && discordUserId === guildOwnerId && has);
    if (should && !has) {
      await d.rest.put(`/guilds/${d.guildId}/members/${discordUserId}/roles/${roleId}`, undefined, { reason: 'Role sync from the website' });
      changed = true;
    } else if (!should && has) {
      await d.rest.delete(`/guilds/${d.guildId}/members/${discordUserId}/roles/${roleId}`, { reason: 'Role sync from the website' });
      changed = true;
    }
  }
  return changed ? 'updated' : 'unchanged';
}

/** Has this user been a party to a closed deal (through any client file linked to them)? */
export async function hasClosedDeal(ex: Executor, userId: string): Promise<boolean> {
  const [r] = await ex
    .select({ n: sql<number>`count(*)::int` })
    .from(dealParties)
    .innerJoin(deals, eq(deals.id, dealParties.dealId))
    .innerJoin(clients, eq(clients.id, dealParties.clientId))
    .where(and(eq(clients.userId, userId), eq(deals.stage, 'closed')));
  return (r?.n ?? 0) > 0;
}

export async function syncUser(ex: Executor, d: SyncDeps, userId: string): Promise<SyncResult> {
  const u = await ex.query.users.findFirst({ where: eq(users.id, userId) });
  if (!u?.discordId) return 'not-in-server';
  const guild = await d.rest.get<APIGuild>(`/guilds/${d.guildId}`);
  return syncMember(d, u.discordId, desiredRoles({ role: u.role, status: u.status, closedDeal: await hasClosedDeal(ex, u.id) }), guild.owner_id);
}

/** The portal's "Sync roles" button: every site user with a Discord account. */
export async function syncAll(ex: Executor, d: SyncDeps) {
  const guild = await d.rest.get<APIGuild>(`/guilds/${d.guildId}`);
  const rows = await ex.select().from(users).where(isNotNull(users.discordId));
  const tally: Record<SyncResult, number> = { updated: 0, unchanged: 0, 'not-in-server': 0, 'not-set-up': 0 };
  for (const u of rows) {
    const r = await syncMember(d, u.discordId!, desiredRoles({ role: u.role, status: u.status, closedDeal: await hasClosedDeal(ex, u.id) }), guild.owner_id);
    tally[r]++;
    if (r === 'not-set-up') break;
  }
  return tally;
}

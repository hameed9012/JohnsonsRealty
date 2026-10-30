import 'server-only';
import { and, eq, gte, sql } from 'drizzle-orm';
import type { Executor } from '@/db/client';
import { enquiries, showings } from '@/db/schema';

/** Messages and showing requests one person can send in the window, so nobody can flood the inbox. */
export const SEND_LIMIT = Number(process.env.SEND_LIMIT) || 5;
export const SEND_WINDOW_MINUTES = 10;

export const TOO_MANY = { ok: false as const, message: `You’ve sent a lot in the last few minutes. Please wait ${SEND_WINDOW_MINUTES} minutes and try again.` };

async function recent(ex: Executor, table: typeof enquiries | typeof showings, column: typeof enquiries.userId | typeof showings.requestedBy, userId: string, now: Date) {
  const since = new Date(now.getTime() - SEND_WINDOW_MINUTES * 60_000);
  const [r] = await ex.select({ n: sql<number>`count(*)::int` }).from(table).where(and(eq(column, userId), gte(table.createdAt, since)));
  return r?.n ?? 0;
}

/** True when this person has already sent the most allowed (enquiries and showing requests counted together). */
export async function sentTooMany(ex: Executor, userId: string, now = new Date()): Promise<boolean> {
  const [a, b] = await Promise.all([recent(ex, enquiries, enquiries.userId, userId, now), recent(ex, showings, showings.requestedBy, userId, now)]);
  return a + b >= SEND_LIMIT;
}

import 'server-only';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { Executor } from '@/db/client';
import { db } from '@/db/client';
import { notifications, users } from '@/db/schema';
import type { BellData } from '@/components/ui/NotificationBell';

export interface NotificationInput {
  kind: string;
  title: string;
  body?: string;
  link?: string;
}

export async function notifyUsers(ex: Executor, userIds: string[], n: NotificationInput) {
  const ids = [...new Set(userIds)].filter(Boolean);
  if (!ids.length) return;
  await ex.insert(notifications).values(ids.map((userId) => ({ userId, ...n })));
}

/** The Owner plus Admins when "Admins can approve" is on. */
export async function reviewerIds(ex: Executor, adminsCanApprove: boolean): Promise<string[]> {
  const roles = adminsCanApprove ? (['owner', 'admin'] as const) : (['owner'] as const);
  const rows = await ex
    .select({ id: users.id })
    .from(users)
    .where(and(inArray(users.role, [...roles]), eq(users.status, 'active')));
  return rows.map((r) => r.id);
}

export async function bellData(userId: string): Promise<BellData> {
  const [items, [{ unread } = { unread: 0 }]] = await Promise.all([
    db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(15),
    db
      .select({ unread: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt))),
  ]);
  return {
    unread,
    items: items.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      link: n.link,
      createdAt: n.createdAt.toISOString(),
      unread: !n.readAt,
    })),
  };
}

export async function markAllRead(userId: string) {
  await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
}

'use server';

import { getActor } from '@/server/session';
import { bellData, markAllRead } from '@/server/notify';
import type { BellData } from '@/components/ui/NotificationBell';

export async function loadBell(): Promise<BellData> {
  const a = await getActor();
  if (!a) return { unread: 0, items: [] };
  return bellData(a.id);
}

export async function markBellRead(): Promise<void> {
  const a = await getActor();
  if (!a) return;
  await markAllRead(a.id);
}

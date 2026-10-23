import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { media } from '@/db/schema';

/** The storage ID (image src) for a media row, or null. */
export async function mediaSrc(id: string | null | undefined): Promise<string | null> {
  if (!id) return null;
  const m = await db.query.media.findFirst({ where: eq(media.id, id), columns: { storageId: true } });
  return m?.storageId ?? null;
}

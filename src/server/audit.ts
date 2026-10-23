import 'server-only';
import type { Executor } from '@/db/client';
import { activityLog } from '@/db/schema';

export interface AuditEntry {
  actorId: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  summary: string;
  diff?: Record<string, unknown>;
}

/** Every data change writes one row. Call inside the same transaction as the change. */
export async function audit(ex: Executor, e: AuditEntry) {
  await ex.insert(activityLog).values({
    actorId: e.actorId,
    action: e.action,
    entity: e.entity,
    entityId: e.entityId ?? null,
    summary: e.summary,
    diff: e.diff,
  });
}

/** Shallow diff of changed keys, for activity log entries. */
export function diffOf<T extends Record<string, unknown>>(before: T, after: Partial<T>): Record<string, { from: unknown; to: unknown }> {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const k of Object.keys(after)) {
    const a = before[k];
    const b = after[k];
    if (JSON.stringify(a) !== JSON.stringify(b)) out[k] = { from: a ?? null, to: b ?? null };
  }
  return out;
}

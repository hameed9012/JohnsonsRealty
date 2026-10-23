import { and, desc, eq, gte, ilike, lt, sql } from 'drizzle-orm';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EmptyState } from '@/components/ui/blocks';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/fields';
import { DataTable, Pagination } from '@/components/ui/layout';
import { LocalTime } from '@/components/ui/LocalTime';
import { db } from '@/db/client';
import { activityLog, users } from '@/db/schema';
import { can } from '@/lib/permissions';
import { requireStaff } from '@/server/session';
import { staffOptions } from '@/server/queries/review';

export const metadata: Metadata = { title: 'Activity log' };

const PAGE = 50;
type SP = Record<string, string | undefined>;

export default async function ActivityPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requireStaff('/portal/activity');
  if (!can(actor, 'activity.view')) notFound();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const conds = [
    sp.entity ? eq(activityLog.entity, sp.entity) : undefined,
    sp.actor ? eq(activityLog.actorId, sp.actor) : undefined,
    sp.q ? ilike(activityLog.summary, `%${sp.q}%`) : undefined,
    sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? gte(activityLog.createdAt, new Date(sp.from + 'T00:00:00Z')) : undefined,
    sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) ? lt(activityLog.createdAt, new Date(new Date(sp.to + 'T00:00:00Z').getTime() + 86400000)) : undefined,
  ].filter(Boolean);
  const where = conds.length ? and(...conds) : undefined;
  const [rows, [{ n } = { n: 0 }], entities, staff] = await Promise.all([
    db
      .select({ id: activityLog.id, summary: activityLog.summary, action: activityLog.action, entity: activityLog.entity, createdAt: activityLog.createdAt, actor: users.displayName })
      .from(activityLog)
      .leftJoin(users, eq(users.id, activityLog.actorId))
      .where(where)
      .orderBy(desc(activityLog.createdAt))
      .limit(PAGE)
      .offset((page - 1) * PAGE),
    db.select({ n: sql<number>`count(*)::int` }).from(activityLog).where(where),
    db.selectDistinct({ e: activityLog.entity }).from(activityLog),
    staffOptions(),
  ]);
  const qs = (p: number) => '?' + new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter(([k, v]) => v && k !== 'page')), page: String(p) } as Record<string, string>).toString();
  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <span className="label label--brass">Brokerage</span>
          <h1 className="heading-1">Activity log</h1>
          <p className="body muted">Every change, who made it and when.</p>
        </div>
      </div>
      <form method="get" className="sold-filters" aria-label="Filter activity">
        <label className="jr-field">
          <span className="jr-field-label">Search</span>
          <input className="jr-field-input" name="q" defaultValue={sp.q} />
        </label>
        <SelectField label="Record" name="entity" placeholder="Everything" options={entities.map((e) => e.e).sort()} defaultValue={sp.entity ?? ''} />
        <SelectField label="Person" name="actor" placeholder="Anyone" options={staff.map((s) => ({ value: s.id, label: s.name ?? 'Staff' }))} defaultValue={sp.actor ?? ''} />
        <label className="jr-field">
          <span className="jr-field-label">From</span>
          <input className="jr-field-input jr-mono" type="date" name="from" defaultValue={sp.from} />
        </label>
        <div className="row">
          <Button type="submit" size="sm" icon="filter">
            Filter
          </Button>
          <Button variant="ghost" size="sm" href="/portal/activity">
            Clear
          </Button>
        </div>
      </form>
      <p className="body-s muted">
        <span className="figure">{n}</span> entries
      </p>
      <DataTable
        caption="Activity"
        rows={rows}
        rowKey={(r) => r.id}
        empty={<EmptyState icon="activity" title="Nothing matches" />}
        columns={[
          { key: 'when', header: 'When', cell: (r) => <LocalTime iso={r.createdAt.toISOString()} /> },
          { key: 'who', header: 'Who', cell: (r) => r.actor ?? 'System' },
          { key: 'what', header: 'What', cell: (r) => r.summary },
          { key: 'rec', header: 'Record', num: true, cell: (r) => r.entity },
        ]}
      />
      <Pagination page={page} pages={Math.max(1, Math.ceil(n / PAGE))} href={qs} />
    </div>
  );
}

import { and, desc, eq, inArray } from 'drizzle-orm';
import Link from 'next/link';
import type { Metadata } from 'next';
import { EmptyState } from '@/components/ui/blocks';
import { DataTable } from '@/components/ui/layout';
import { LocalTime } from '@/components/ui/LocalTime';
import { StatusPill } from '@/components/ui/StatusStamp';
import { db } from '@/db/client';
import { enquiries, users } from '@/db/schema';
import { ENQUIRY_PILL, ENQUIRY_TYPE } from '@/lib/enquiries';
import { requireStaff } from '@/server/session';

export const metadata: Metadata = { title: 'Support inbox' };

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ show?: string; mine?: string }> }) {
  const actor = await requireStaff('/portal/inbox');
  const { show, mine } = await searchParams;
  const statuses = show === 'closed' ? (['closed'] as const) : show === 'all' ? (['new', 'open', 'waiting', 'closed'] as const) : (['new', 'open', 'waiting'] as const);
  const rows = await db
    .select({ e: enquiries, from: users.displayName })
    .from(enquiries)
    .leftJoin(users, eq(users.id, enquiries.userId))
    .where(and(inArray(enquiries.status, [...statuses]), mine === '1' ? eq(enquiries.assigneeId, actor.id) : undefined))
    .orderBy(desc(enquiries.createdAt))
    .limit(300);
  const assignees = new Map((await db.select({ id: users.id, name: users.displayName }).from(users).where(inArray(users.role, ['owner', 'admin', 'agent']))).map((u) => [u.id, u.name]));
  const tab = (label: string, q: string, active: boolean) => (
    <Link href={`/portal/inbox${q}`} aria-current={active ? 'true' : undefined}>
      {label}
    </Link>
  );
  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <span className="label label--brass">Clients</span>
          <h1 className="heading-1">Support inbox</h1>
          <p className="body muted">Valuation requests, messages, listing questions and career applications.</p>
        </div>
        <nav className="view-toggle" aria-label="Show">
          {tab('Open', '', !show && mine !== '1')}
          {tab('Mine', '?mine=1', mine === '1')}
          {tab('Closed', '?show=closed', show === 'closed')}
          {tab('All', '?show=all', show === 'all')}
        </nav>
      </div>
      <DataTable
        caption="Enquiries"
        rows={rows}
        rowKey={(r) => r.e.id}
        empty={<EmptyState icon="inbox" title="Inbox zero" text="New enquiries from the site land here, with a notification." />}
        columns={[
          { key: 'ref', header: 'Reference', num: true, cell: (r) => <Link href={`/portal/inbox/${r.e.id}`}>{r.e.refNo}</Link> },
          { key: 'type', header: 'Type', cell: (r) => ENQUIRY_TYPE[r.e.type] },
          { key: 'from', header: 'From', cell: (r) => r.from ?? '—' },
          { key: 'status', header: 'Status', cell: (r) => <StatusPill status={ENQUIRY_PILL[r.e.status]!.status} label={ENQUIRY_PILL[r.e.status]!.label} /> },
          { key: 'who', header: 'Assigned', cell: (r) => (r.e.assigneeId ? (assignees.get(r.e.assigneeId) ?? '—') : 'Nobody') },
          { key: 'when', header: 'Received', cell: (r) => <LocalTime iso={r.e.createdAt.toISOString()} /> },
        ]}
      />
    </div>
  );
}

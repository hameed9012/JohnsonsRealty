import { eq } from 'drizzle-orm';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RevisionActions } from '@/components/portal/RevisionActions';
import { Breadcrumbs, DataTable } from '@/components/ui/layout';
import { StatusPill } from '@/components/ui/StatusStamp';
import { db } from '@/db/client';
import { listingRevisions, users } from '@/db/schema';
import { date } from '@/lib/format';
import { can } from '@/lib/permissions';
import { requireStaff } from '@/server/session';
import { getSettings } from '@/server/settings';

export const metadata: Metadata = { title: 'Review edit' };

const FIELD = { description: 'Description', showingInstructions: 'Showing instructions', beds: 'Bedrooms', baths: 'Bathrooms', sqft: 'Living space (sq ft)' } as const;

export default async function RevisionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireStaff(`/portal/review/revisions/${id}`);
  if (!can(actor, 'listing.approve', undefined, await getSettings())) notFound();
  const r = await db.query.listingRevisions.findFirst({ where: eq(listingRevisions.id, id), with: { listing: true } });
  if (!r) notFound();
  const by = r.submittedBy ? await db.query.users.findFirst({ where: eq(users.id, r.submittedBy), columns: { displayName: true } }) : null;
  const changes = r.changes as Record<string, unknown>;
  const rows = (Object.keys(FIELD) as (keyof typeof FIELD)[])
    .map((k) => ({ key: k, before: r.listing[k] ?? null, after: changes[k] ?? null }))
    .filter((x) => String(x.before ?? '') !== String(x.after ?? ''));
  return (
    <div className="stack-lg">
      <Breadcrumbs items={[{ label: 'Review queue', href: '/portal/review' }, { label: `Edit to ${r.listing.addressLine || r.listing.refNo}` }]} />
      <div className="page-head">
        <div>
          <div className="row">
            <StatusPill status={r.status === 'pending' ? 'pending-review' : r.status === 'approved' ? 'active' : 'rejected'} label={r.status === 'pending' ? 'Edit waiting' : r.status === 'approved' ? 'Approved' : 'Declined'} />
            <span className="id muted">{r.listing.refNo}</span>
          </div>
          <h1 className="heading-1">Edit to {r.listing.addressLine || r.listing.refNo}</h1>
          <p className="body muted">
            From {by?.displayName ?? 'an agent'} on {date(r.submittedAt)}. The live listing is unchanged until you approve.
          </p>
        </div>
        {r.status === 'pending' ? <RevisionActions id={r.id} /> : null}
      </div>
      <DataTable
        caption="Proposed changes"
        rows={rows}
        rowKey={(x) => x.key}
        columns={[
          { key: 'field', header: 'Field', cell: (x) => FIELD[x.key] },
          { key: 'before', header: 'Now', cell: (x) => (x.before === null ? <span className="muted">empty</span> : <s>{String(x.before)}</s>) },
          { key: 'after', header: 'Proposed', cell: (x) => (x.after === null ? <span className="muted">empty</span> : String(x.after)) },
        ]}
      />
    </div>
  );
}

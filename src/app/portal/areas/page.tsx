import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/layout';
import { StatusPill } from '@/components/ui/StatusStamp';
import { can } from '@/lib/permissions';
import { areaListingCounts, getAreas } from '@/server/queries/areas';
import { requireStaff } from '@/server/session';

export const metadata: Metadata = { title: 'Areas' };

export default async function AreasAdmin() {
  const actor = await requireStaff('/portal/areas');
  if (!can(actor, 'areas.manage')) notFound();
  const [all, counts] = await Promise.all([getAreas(), areaListingCounts()]);
  const byId = new Map(all.map((a) => [a.id, a]));
  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <span className="label label--brass">Content</span>
          <h1 className="heading-1">Areas</h1>
          <p className="body muted">Areas power the pickers, the area pages and the documents. Postal codes and services are filled in here.</p>
        </div>
        <Button href="/portal/areas/new" icon="area">
          Add area
        </Button>
      </div>
      <DataTable
        caption="Areas"
        rows={all}
        rowKey={(a) => a.id}
        columns={[
          { key: 'name', header: 'Area', cell: (a) => <Link href={`/portal/areas/${a.id}`}>{a.name}</Link> },
          { key: 'parent', header: 'Inside', cell: (a) => (a.parentId ? byId.get(a.parentId)?.name : '—') },
          { key: 'postal', header: 'Postal codes', num: true, cell: (a) => (a.postalCodes.length ? a.postalCodes.join(', ') : '—') },
          { key: 'listings', header: 'On the market', num: true, align: 'right', cell: (a) => counts[a.id] ?? 0 },
          { key: 'pick', header: 'Listings', cell: (a) => (a.selectable ? <StatusPill status="active" label="Selectable" /> : <StatusPill status="off-market" label="Group only" />) },
        ]}
      />
    </div>
  );
}

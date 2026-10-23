import Link from 'next/link';
import type { Metadata } from 'next';
import { EmptyState } from '@/components/ui/blocks';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/layout';
import { StatusPill } from '@/components/ui/StatusStamp';
import { date, money } from '@/lib/format';
import { isPublic, statusKey, type ListingStatus } from '@/lib/listing-status';
import { portalListings } from '@/server/queries/listings';
import { requireStaff } from '@/server/session';
import { WIZARD_STATUSES } from '@/server/listings/service';

export const metadata: Metadata = { title: 'Listings' };

// Phase 2: a working list. Filters, bulk actions and quick edit arrive with the listings manager (Phase 5).
export default async function ListingsPage() {
  const actor = await requireStaff('/portal/listings');
  const rows = await portalListings(actor);
  type Row = (typeof rows)[number];
  const href = (r: Row) => (WIZARD_STATUSES.includes(r.status) ? `/portal/listings/${r.id}/edit` : `/portal/listings/${r.id}`);
  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <span className="label label--brass">Listings</span>
          <h1 className="heading-1">Listings</h1>
        </div>
        <Button href="/portal/listings/new" icon="key">
          Add listing
        </Button>
      </div>
      <DataTable
        caption="Listings"
        rows={rows}
        rowKey={(r) => r.id}
        empty={<EmptyState icon="key" title="No listings yet" text="Start one and it saves as a draft until you submit it." action={<Button href="/portal/listings/new">Add listing</Button>} />}
        columns={[
          { key: 'address', header: 'Property', cell: (r) => <Link href={href(r)}>{r.addressLine || 'Untitled draft'}{r.unit ? `, Unit ${r.unit}` : ''}</Link> },
          { key: 'ref', header: 'Reference', num: true, cell: (r) => r.refNo },
          {
            key: 'status',
            header: 'Status',
            cell: (r) => (
              <span className="row">
                <StatusPill status={statusKey(r.status as ListingStatus)} />
                {r.source === 'owner_submitted' ? <StatusPill status="listed-by-owner" /> : null}
              </span>
            ),
          },
          { key: 'area', header: 'Area', cell: (r) => r.areaName ?? '—' },
          { key: 'agent', header: 'Agent', cell: (r) => r.agentName ?? '—' },
          { key: 'price', header: 'Price', num: true, align: 'right', cell: (r) => (r.price ? money(r.price) + (r.purpose === 'rent' ? '/mo' : '') : '—') },
          { key: 'updated', header: 'Updated', num: true, cell: (r) => date(r.updatedAt) },
          { key: 'view', header: 'Public page', cell: (r) => (isPublic(r.status as ListingStatus) ? <Link href={`/property/${r.slug}`}>View</Link> : '—') },
        ]}
      />
    </div>
  );
}

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Wizard } from '@/components/listing-editor/Wizard';
import { Breadcrumbs } from '@/components/ui/layout';
import { StatusPill } from '@/components/ui/StatusStamp';
import { statusKey, type ListingStatus } from '@/lib/listing-status';
import { loadEditor } from '@/server/listings/editor';
import { requireStaff } from '@/server/session';

export const metadata: Metadata = { title: 'Edit listing' };

export default async function EditListing({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireStaff(`/portal/listings/${id}/edit`);
  const ed = await loadEditor(actor, id);
  if (!ed) notFound();
  const { data } = ed;
  return (
    <div className="stack-lg">
      <Breadcrumbs items={[{ label: 'Listings', href: '/portal/listings' }, { label: data.preview.title }]} />
      <div className="page-head">
        <div>
          <div className="row">
            <StatusPill status={statusKey(data.status as ListingStatus)} />
            <span className="id muted">{data.refNo}</span>
            {data.round > 0 ? <span className="id muted">Round {data.round}</span> : null}
          </div>
          <h1 className="heading-1">{data.property.addressLine || 'New listing'}</h1>
        </div>
      </div>
      <Wizard data={data} options={ed.options} confidential={ed.confidential} />
    </div>
  );
}

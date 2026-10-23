import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Wizard } from '@/components/listing-editor/Wizard';
import { Breadcrumbs, VisibilityLabel } from '@/components/ui/layout';
import { StatusPill } from '@/components/ui/StatusStamp';
import { statusKey, type ListingStatus } from '@/lib/listing-status';
import { loadEditor } from '@/server/listings/editor';
import { requireActor } from '@/server/session';

export const metadata: Metadata = { title: 'Edit my listing', robots: { index: false } };

export default async function EditMyListing({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor(`/account/listings/${id}/edit`);
  const ed = await loadEditor(actor, id);
  if (!ed || ed.data.source !== 'owner_submitted') notFound();
  const { data } = ed;
  return (
    <div className="stack-lg">
      <Breadcrumbs items={[{ label: 'My listings', href: '/account/listings' }, { label: data.preview.title }]} />
      <div className="stack">
        <div className="row">
          <StatusPill status={statusKey(data.status as ListingStatus)} />
          <span className="id muted">{data.refNo}</span>
          <VisibilityLabel />
        </div>
        <h1 className="heading-1">{data.property.addressLine || 'Your listing'}</h1>
      </div>
      <Wizard data={data} options={ed.options} confidential={false} />
    </div>
  );
}

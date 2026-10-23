import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { PropertyView } from '@/components/listing/PropertyView';
import { Button } from '@/components/ui/Button';
import { Breadcrumbs } from '@/components/ui/layout';
import { StatusPill } from '@/components/ui/StatusStamp';
import { isPublic, statusKey, type ListingStatus } from '@/lib/listing-status';
import { loadEditor } from '@/server/listings/editor';
import { WIZARD_STATUSES } from '@/server/listings/service';
import { requireStaff } from '@/server/session';

export const metadata: Metadata = { title: 'Listing' };

export default async function ListingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireStaff(`/portal/listings/${id}`);
  const ed = await loadEditor(actor, id);
  if (!ed) notFound();
  const { data } = ed;
  if (WIZARD_STATUSES.includes(data.status) && data.status !== 'pending_review') redirect(`/portal/listings/${id}/edit`);
  return (
    <div className="stack-lg">
      <Breadcrumbs items={[{ label: 'Listings', href: '/portal/listings' }, { label: data.preview.title }]} />
      <div className="page-head">
        <div>
          <div className="row">
            <StatusPill status={statusKey(data.status as ListingStatus)} />
            {data.source === 'owner_submitted' ? <StatusPill status="listed-by-owner" /> : null}
            <span className="id muted">{data.refNo}</span>
          </div>
          <h1 className="heading-1">{data.preview.title}</h1>
        </div>
        <div className="row">
          {isPublic(data.status as ListingStatus) ? (
            <Button variant="secondary" href={`/property/${data.preview.slug}`}>
              View public page
            </Button>
          ) : null}
          {data.status === 'pending_review' ? <Button href={`/portal/review/${id}`}>Open review</Button> : null}
        </div>
      </div>
      <div data-theme="light" className="preview-frame">
        <PropertyView view={data.preview} preview headingLevel={2} />
      </div>
    </div>
  );
}

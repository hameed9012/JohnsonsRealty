import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PropertyView } from '@/components/listing/PropertyView';
import { Button } from '@/components/ui/Button';
import { Breadcrumbs, ClientPanel, Timeline, type TimelineStep } from '@/components/ui/layout';
import { StatusPill } from '@/components/ui/StatusStamp';
import { date } from '@/lib/format';
import { isPublic, statusKey, type ListingStatus } from '@/lib/listing-status';
import { loadEditor } from '@/server/listings/editor';
import { requireActor } from '@/server/session';

export const metadata: Metadata = { title: 'My listing', robots: { index: false } };

export default async function MyListing({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor(`/account/listings/${id}`);
  const ed = await loadEditor(actor, id);
  if (!ed || ed.data.source !== 'owner_submitted') notFound();
  const { data } = ed;
  const s = data.status as ListingStatus;
  const live = isPublic(s);
  const stage = live ? 'live' : s === 'pending_review' ? 'pending_review' : 'draft';
  const at = { draft: 0, pending_review: 1, live: 2 }[stage];
  const steps: TimelineStep[] = ['Draft', 'In review', 'Live'].map((label, i) => ({ label, state: i < at ? 'done' : i === at ? 'current' : 'upcoming' }));
  const notes = data.lastReview?.decision && data.lastReview.decision !== 'approved' ? data.lastReview.notes : null;

  return (
    <div className="stack-lg">
      <Breadcrumbs items={[{ label: 'My listings', href: '/account/listings' }, { label: data.preview.title }]} />
      <div className="page-head">
        <div>
          <div className="row">
            <StatusPill status={statusKey(s)} />
            <span className="id muted">{data.refNo}</span>
          </div>
          <h1 className="heading-1">{data.preview.title}</h1>
        </div>
        <div className="row">
          {data.editable ? <Button href={`/account/listings/${id}/edit${s === 'changes_requested' ? '?step=review' : ''}`}>{s === 'changes_requested' ? 'Make changes' : 'Continue editing'}</Button> : null}
          {live ? (
            <Button variant="secondary" href={`/property/${data.preview.slug}`}>
              View public listing
            </Button>
          ) : null}
        </div>
      </div>
      <ClientPanel title="Where it stands">
        <div className="stack">
          <Timeline label="Listing progress" steps={steps} />
          {s === 'pending_review' ? <p className="body">Our team is reviewing your listing. We’ll notify you here when it’s decided.</p> : null}
          {s === 'changes_requested' ? <p className="body">The reviewer asked for changes. Edit your listing and resubmit it.</p> : null}
          {s === 'rejected' ? <p className="body">This listing wasn’t approved, so it won’t go public.</p> : null}
          {s === 'withdrawn' ? <p className="body">You withdrew this listing. You can edit it and resubmit it.</p> : null}
          {notes ? (
            <div className="review-note stack">
              <span className="label">
                Notes from the reviewer{data.lastReview?.decidedAt ? ` · ${date(data.lastReview.decidedAt)}` : ''}
              </span>
              <p className="body">{notes}</p>
            </div>
          ) : null}
        </div>
      </ClientPanel>
      <section className="stack">
        <h2 className="heading-2">{live ? 'Your public listing' : 'Preview'}</h2>
        <div className="preview-frame">
          <PropertyView view={data.preview} preview headingLevel={2} />
        </div>
      </section>
    </div>
  );
}

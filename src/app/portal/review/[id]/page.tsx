import Image from 'next/image';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PropertyView } from '@/components/listing/PropertyView';
import { SellerSheet } from '@/components/listing/SellerSheet';
import { ReviewActions } from '@/components/portal/ReviewActions';
import { Breadcrumbs, DataTable } from '@/components/ui/layout';
import { StatusPill } from '@/components/ui/StatusStamp';
import { db } from '@/db/client';
import { date } from '@/lib/format';
import { checklist } from '@/lib/listing-checklist';
import { can } from '@/lib/permissions';
import { checklistInput, diffSnapshots, loadBundle } from '@/server/listings/bundle';
import { toPropertyView } from '@/server/listings/view';
import { staffOptions } from '@/server/queries/review';
import { requireStaff } from '@/server/session';
import { getSettings } from '@/server/settings';

export const metadata: Metadata = { title: 'Review listing' };

const DECISION = { approved: 'Approved', changes_requested: 'Changes requested', rejected: 'Rejected' } as const;

export default async function ReviewDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireStaff(`/portal/review/${id}`);
  if (!can(actor, 'listing.approve', undefined, await getSettings())) notFound();
  const b = await loadBundle(db, id, { confidential: true });
  if (!b) notFound();
  const view = toPropertyView(b);
  const current = b.reviews.find((r) => r.round === b.round);
  const previous = b.reviews.find((r) => r.round === b.round - 1);
  const diff = current && previous ? diffSnapshots(previous.snapshot as Record<string, string>, current.snapshot as Record<string, string>) : [];
  const missing = checklist(checklistInput(b));
  const agents = await staffOptions();
  const conf = (b as typeof b & { confidential?: Parameters<typeof SellerSheet>[0]['confidential'] }).confidential ?? null;
  const clientConf = (b.seller as (typeof b.seller & { confidential?: Parameters<typeof SellerSheet>[0]['clientConfidential'] }) | null)?.confidential ?? null;
  const waiting = b.status === 'pending_review';

  return (
    <div className="stack-lg">
      <Breadcrumbs items={[{ label: 'Review queue', href: '/portal/review' }, { label: view.title }]} />
      <div className="page-head">
        <div>
          <div className="row">
            <StatusPill status={waiting ? 'pending-review' : 'archived'} label={waiting ? `Pending Review · round ${b.round}` : 'Decided'} />
            {b.source === 'owner_submitted' ? <StatusPill status="listed-by-owner" /> : null}
            <span className="id muted">{b.refNo}</span>
          </div>
          <h1 className="heading-1">{view.title}</h1>
          <p className="body muted">
            Submitted by {current?.submitter?.displayName ?? b.submitter?.displayName ?? 'unknown'}
            {current ? ` on ${date(current.submittedAt)}` : ''}
            {b.source === 'owner_submitted' ? ' (the property owner)' : ''}
          </p>
        </div>
        {waiting ? (
          <ReviewActions id={b.id} ownerListing={b.source === 'owner_submitted'} agents={agents} currentAgentId={b.listingAgentId} rent={b.purpose === 'rent'} />
        ) : null}
      </div>

      {missing.length ? (
        <ul className="checklist" aria-label="Missing">
          {missing.map((m, i) => (
            <li key={i}>{m.message}</li>
          ))}
        </ul>
      ) : null}

      {previous ? (
        <section className="panel stack">
          <h2 className="panel-title">Changes since round {previous.round}</h2>
          {previous.notes ? (
            <p className="body">
              <span className="label">Your notes · </span>
              {previous.notes}
            </p>
          ) : null}
          {diff.length ? (
            <DataTable
              caption="Changes"
              rows={diff}
              rowKey={(d) => d.key}
              columns={[
                { key: 'field', header: 'Field', num: true, cell: (d) => d.key },
                { key: 'before', header: `Round ${previous.round}`, cell: (d) => (d.before ? <s>{d.before}</s> : <span className="muted">empty</span>) },
                { key: 'after', header: `Round ${b.round}`, cell: (d) => d.after ?? <span className="muted">removed</span> },
              ]}
            />
          ) : (
            <p className="body muted">Nothing changed in the submission.</p>
          )}
        </section>
      ) : null}

      <div className="review-split">
        <section className="stack-lg jr-min0" aria-labelledby="sub-h">
          <h2 id="sub-h" className="heading-1">
            Submission
          </h2>
          <section className="stack">
            <h3 className="heading-2">Photos ({b.photos.length})</h3>
            <ol className="review-photos">
              {b.photos.map((p, i) => (
                <li key={p.id}>
                  <div className="uploader-thumb">
                    <Image src={p.media.storageId} alt={p.alt} fill sizes="200px" className="photo-grade" />
                    <span className="uploader-num id">{i + 1}</span>
                    {p.isCover ? <span className="uploader-cover label">Cover</span> : null}
                  </div>
                  <p className="caption">{p.alt || <span className="muted">No description</span>}</p>
                </li>
              ))}
            </ol>
          </section>
          <SellerSheet b={b} confidential={conf} clientConfidential={clientConf} />
        </section>
        <section className="stack jr-min0" aria-labelledby="pre-h">
          <h2 id="pre-h" className="heading-1">
            Public preview
          </h2>
          <div data-theme="light" className="preview-frame">
            <PropertyView view={view} preview headingLevel={2} />
          </div>
        </section>
      </div>

      {b.reviews.length ? (
        <section className="stack">
          <h2 className="heading-2">Review history</h2>
          <DataTable
            caption="Review history"
            rows={b.reviews}
            rowKey={(r) => r.id}
            columns={[
              { key: 'round', header: 'Round', num: true, cell: (r) => r.round },
              { key: 'sub', header: 'Submitted', num: true, cell: (r) => date(r.submittedAt) },
              { key: 'decision', header: 'Decision', cell: (r) => (r.decision ? DECISION[r.decision] : 'Waiting') },
              { key: 'by', header: 'By', cell: (r) => r.reviewer?.displayName ?? '—' },
              { key: 'notes', header: 'Notes', cell: (r) => r.notes ?? '—' },
            ]}
          />
        </section>
      ) : null}
    </div>
  );
}

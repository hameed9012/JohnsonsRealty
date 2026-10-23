import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EmptyState } from '@/components/ui/blocks';
import { Mark } from '@/components/ui/Logo';
import { StatusPill } from '@/components/ui/StatusStamp';
import { money } from '@/lib/format';
import { can } from '@/lib/permissions';
import { reviewQueue } from '@/server/queries/review';
import { requireStaff } from '@/server/session';
import { getSettings } from '@/server/settings';

export const metadata: Metadata = { title: 'Review queue' };

const WHEN = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });

export default async function ReviewQueuePage() {
  const actor = await requireStaff('/portal/review');
  if (!can(actor, 'listing.approve', undefined, await getSettings())) notFound();
  const rows = await reviewQueue();
  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <span className="label label--brass">Owner</span>
          <h1 className="heading-1">Review queue</h1>
          <p className="body muted">Oldest first. Nothing goes public until it’s approved here.</p>
        </div>
      </div>
      {rows.length === 0 ? (
        <EmptyState icon="stamp" title="Nothing waiting for review" text="New submissions from agents and property owners appear here, with a notification." />
      ) : (
        <ol className="queue">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/portal/review/${r.id}`} className="queue-item">
                <span className="queue-thumb">
                  {r.cover ? <Image src={r.cover} alt="" fill sizes="160px" className="photo-grade" /> : <Mark size={28} decorative />}
                </span>
                <span className="queue-main">
                  <span className="row">
                    <StatusPill status="pending-review" label={r.round > 1 ? `Round ${r.round}` : 'Pending Review'} />
                    {r.source === 'owner_submitted' ? <StatusPill status="listed-by-owner" /> : <StatusPill status="active" label="Agent" />}
                  </span>
                  <b className="heading-3">{r.addressLine || 'Address to be confirmed'}{r.unit ? `, Unit ${r.unit}` : ''}</b>
                  <span className="body-s muted">
                    {r.areaName ?? 'No area'} · {r.purpose === 'rent' ? 'For rent' : 'For sale'} · submitted by {r.submitter ?? 'unknown'}
                  </span>
                </span>
                <span className="queue-side">
                  <span className="figure">{r.price ? money(r.price) + (r.purpose === 'rent' ? '/mo' : '') : '—'}</span>
                  <time className="id muted" dateTime={r.submittedAt.toISOString()}>
                    {WHEN.format(r.submittedAt)} UTC
                  </time>
                  <span className="id muted">{r.refNo}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { EmptyState } from '@/components/ui/blocks';
import { Button } from '@/components/ui/Button';
import { Mark } from '@/components/ui/Logo';
import { ClientPanel } from '@/components/ui/layout';
import { StatusPill } from '@/components/ui/StatusStamp';
import { date, money } from '@/lib/format';
import { statusKey, type ListingStatus } from '@/lib/listing-status';
import { ownerListings } from '@/server/queries/listings';
import { requireActor } from '@/server/session';

export const metadata: Metadata = { title: 'My listings', robots: { index: false } };

export default async function MyListings() {
  const actor = await requireActor('/account/listings');
  const rows = await ownerListings(actor.id);
  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <span className="label label--brass">Your account</span>
          <h1 className="heading-1">My listings</h1>
          <p className="body muted">Properties you’ve listed yourself. Every listing is reviewed before it goes live.</p>
        </div>
        <Button href="/account/listings/new" withKey>
          List your property
        </Button>
      </div>
      <ClientPanel title="Your submissions">
        {rows.length === 0 ? (
          <EmptyState icon="key" title="You haven’t listed anything yet" text="List a home, rental or business you own. It takes a few minutes and needs at least three in-game photos." action={<Button href="/account/listings/new">List your property</Button>} />
        ) : (
          <ol className="queue">
            {rows.map((r) => (
              <li key={r.id}>
                <Link href={`/account/listings/${r.id}`} className="queue-item">
                  <span className="queue-thumb">{r.cover ? <Image src={r.cover} alt="" fill sizes="160px" className="photo-grade" /> : <Mark size={28} decorative />}</span>
                  <span className="queue-main">
                    <span className="row">
                      <StatusPill status={statusKey(r.status as ListingStatus)} />
                    </span>
                    <b className="heading-3">{r.addressLine || 'Untitled draft'}</b>
                    <span className="body-s muted">
                      {r.areaName ?? 'No area yet'} · {r.purpose === 'rent' ? 'For rent' : 'For sale'}
                    </span>
                    {r.status === 'changes_requested' && r.lastNotes ? <span className="body-s">Notes from the reviewer: {r.lastNotes}</span> : null}
                  </span>
                  <span className="queue-side">
                    <span className="figure">{r.price ? money(r.price) + (r.purpose === 'rent' ? '/mo' : '') : '—'}</span>
                    <span className="id muted">{r.refNo}</span>
                    <span className="id muted">Updated {date(r.updatedAt)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </ClientPanel>
    </div>
  );
}

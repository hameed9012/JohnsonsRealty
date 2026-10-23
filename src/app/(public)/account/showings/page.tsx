import { desc, eq } from 'drizzle-orm';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ShowingControls } from '@/components/account/ShowingControls';
import { EmptyState } from '@/components/ui/blocks';
import { Button } from '@/components/ui/Button';
import { ClientPanel } from '@/components/ui/layout';
import { LocalTime } from '@/components/ui/LocalTime';
import { StatusPill } from '@/components/ui/StatusStamp';
import { db } from '@/db/client';
import { agentProfiles, listings, showings } from '@/db/schema';
import { clientCanChange, isUpcoming, SHOWING_PILL, type ShowingStatus } from '@/lib/showings';
import { requireActor } from '@/server/session';

export const metadata: Metadata = { title: 'My showings', robots: { index: false } };

export default async function MyShowings() {
  const actor = await requireActor('/account/showings');
  const rows = await db
    .select({ s: showings, address: listings.addressLine, slug: listings.slug, agent: agentProfiles.publicName })
    .from(showings)
    .innerJoin(listings, eq(listings.id, showings.listingId))
    .leftJoin(agentProfiles, eq(agentProfiles.userId, showings.agentId))
    .where(eq(showings.requestedBy, actor.id))
    .orderBy(desc(showings.requestedFor));
  const at = (r: (typeof rows)[number]) => r.s.confirmedFor ?? r.s.requestedFor;
  const upcoming = rows.filter((r) => isUpcoming(r.s.status as ShowingStatus, at(r))).reverse();
  const past = rows.filter((r) => !isUpcoming(r.s.status as ShowingStatus, at(r)));

  const list = (items: typeof rows) => (
    <ul className="saved-list">
      {items.map((r) => {
        const pill = SHOWING_PILL[r.s.status as ShowingStatus];
        return (
          <li key={r.s.id}>
            <div className="stack">
              <div className="row">
                <StatusPill status={pill.status} label={pill.label} />
                <span className="id muted">{r.s.refNo}</span>
              </div>
              <Link href={`/property/${r.slug}`} className="heading-3">
                {r.address || 'Listing'}
              </Link>
              <span className="body-s">
                {r.s.confirmedFor ? 'Confirmed for ' : 'Requested for '}
                <LocalTime iso={at(r).toISOString()} />
                {r.agent ? ` · with ${r.agent}` : ''}
              </span>
              {r.s.notes ? <span className="body-s muted">{r.s.notes}</span> : null}
            </div>
            {clientCanChange(r.s.status as ShowingStatus, at(r)) ? <ShowingControls id={r.s.id} refNo={r.s.refNo} /> : null}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <span className="label label--brass">Your account</span>
          <h1 className="heading-1">My showings</h1>
        </div>
      </div>
      <ClientPanel title="Upcoming">
        {upcoming.length ? list(upcoming) : <EmptyState icon="calendar" title="No upcoming showings" text="Book one from any listing page and it appears here." action={<Button variant="secondary" href="/buy">Browse homes</Button>} />}
      </ClientPanel>
      {past.length ? (
        <ClientPanel title="Past and cancelled">{list(past)}</ClientPanel>
      ) : null}
    </div>
  );
}

import { and, asc, desc, eq, gte, inArray } from 'drizzle-orm';
import Link from 'next/link';
import type { Metadata } from 'next';
import { CardGrid } from '@/components/listing/CardGrid';
import { EmptyState } from '@/components/ui/blocks';
import { Button } from '@/components/ui/Button';
import { ClientPanel, Timeline, type TimelineStep } from '@/components/ui/layout';
import { LocalTime } from '@/components/ui/LocalTime';
import { StatusPill } from '@/components/ui/StatusStamp';
import { db } from '@/db/client';
import { listings, savedHomes, showings } from '@/db/schema';
import { dealTimeline } from '@/lib/deal-stage';
import { PUBLIC_STATUSES, statusKey, type ListingStatus } from '@/lib/listing-status';
import { SHOWING_PILL, upcomingCutoff, type ShowingStatus } from '@/lib/showings';
import { cardsWhere } from '@/server/queries/cards';
import { myDeals, unreadForUser } from '@/server/queries/deals';
import { ownerListings } from '@/server/queries/listings';
import { requireActor } from '@/server/session';

export const metadata: Metadata = { title: 'Your account', robots: { index: false } };

type Status = (typeof listings.status.enumValues)[number];

export default async function AccountDashboard() {
  const actor = await requireActor('/account');
  const [savedIds, upcoming, deals, unread, mine] = await Promise.all([
    db.select({ id: savedHomes.listingId }).from(savedHomes).where(eq(savedHomes.userId, actor.id)).orderBy(desc(savedHomes.createdAt)).limit(12),
    db
      .select({ s: showings, address: listings.addressLine, slug: listings.slug })
      .from(showings)
      .innerJoin(listings, eq(listings.id, showings.listingId))
      .where(and(eq(showings.requestedBy, actor.id), inArray(showings.status, ['requested', 'confirmed']), gte(showings.requestedFor, upcomingCutoff())))
      .orderBy(asc(showings.requestedFor))
      .limit(3),
    myDeals(actor.id),
    unreadForUser(actor.id),
    ownerListings(actor.id),
  ]);
  const saved = savedIds.length ? (await cardsWhere(and(inArray(listings.id, savedIds.map((s) => s.id)), inArray(listings.status, PUBLIC_STATUSES as Status[]), eq(listings.photosHold, false)), 3)) : [];
  const deal = deals.find((d) => d.stage !== 'closed' && d.stage !== 'fallen_through') ?? deals[0];

  // Without a deal, the journey shows how far they've got on their own.
  const steps: TimelineStep[] = deal
    ? dealTimeline(deal.stage)
    : [
        { label: 'Save homes', state: savedIds.length ? 'done' : 'current' },
        { label: 'Book a showing', state: upcoming.length ? 'done' : savedIds.length ? 'current' : 'upcoming' },
        { label: 'Make an offer', state: 'upcoming' },
        { label: 'Under contract', state: 'upcoming' },
        { label: 'Get the keys', state: 'upcoming' },
      ];

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <span className="label label--brass">Your account</span>
          <h1 className="heading-1">Welcome, {actor.displayName}</h1>
        </div>
        <Button href="/account/listings/new" withKey>
          List your property
        </Button>
      </div>

      <ClientPanel title={deal ? `Your deal: ${deal.address || 'in progress'}` : 'Your journey'}>
        <div className="stack">
          <Timeline label="Your progress" steps={steps} />
          <div className="row">
            {deal ? (
              <Button href={`/account/deal/${deal.id}`} variant="secondary" icon="document">
                Open my deal{unread ? ` (${unread} new ${unread === 1 ? 'message' : 'messages'})` : ''}
              </Button>
            ) : (
              <Button href="/buy" variant="secondary" icon="search">
                Browse homes
              </Button>
            )}
          </div>
        </div>
      </ClientPanel>

      <div className="split">
        <ClientPanel title="Saved homes">
          {saved.length ? (
            <div className="stack">
              <CardGrid cards={saved} layout="list" returnTo="/account" />
              <Link href="/account/saved" className="body-s">
                All saved homes
              </Link>
            </div>
          ) : (
            <EmptyState icon="heart" title="Nothing saved yet" text="Tap the heart on a listing to keep it here." />
          )}
        </ClientPanel>
        <div className="stack-lg">
          <ClientPanel title="Upcoming showings">
            {upcoming.length ? (
              <ul className="saved-list">
                {upcoming.map((u) => (
                  <li key={u.s.id}>
                    <div className="stack">
                      <StatusPill status={SHOWING_PILL[u.s.status as ShowingStatus].status} label={SHOWING_PILL[u.s.status as ShowingStatus].label} />
                      <Link href={`/property/${u.slug}`} className="ui">
                        {u.address || 'Listing'}
                      </Link>
                      <LocalTime iso={(u.s.confirmedFor ?? u.s.requestedFor).toISOString()} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="body-s muted">No showings booked. Book one from any listing page.</p>
            )}
            <Link href="/account/showings" className="body-s">
              All showings
            </Link>
          </ClientPanel>
          {mine.length ? (
            <ClientPanel title="Your listings">
              <ul className="saved-list">
                {mine.slice(0, 3).map((l) => (
                  <li key={l.id}>
                    <Link href={`/account/listings/${l.id}`} className="ui">
                      {l.addressLine || 'Untitled draft'}
                    </Link>
                    <StatusPill status={statusKey(l.status as ListingStatus)} />
                  </li>
                ))}
              </ul>
            </ClientPanel>
          ) : null}
        </div>
      </div>
    </div>
  );
}

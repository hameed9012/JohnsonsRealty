import { and, asc, desc, eq, gte, inArray, or, sql } from 'drizzle-orm';
import Link from 'next/link';
import type { Metadata } from 'next';
import { EmptyState, StatTile } from '@/components/ui/blocks';
import { Button } from '@/components/ui/Button';
import { LocalTime } from '@/components/ui/LocalTime';
import { StatusPill } from '@/components/ui/StatusStamp';
import { db } from '@/db/client';
import { activityLog, deals, listings, showings, users } from '@/db/schema';
import { count, money } from '@/lib/format';
import { stagePill } from '@/lib/deal-stage';
import { can } from '@/lib/permissions';
import { SHOWING_PILL, upcomingCutoff, type ShowingStatus } from '@/lib/showings';
import { STAGE_WORDS } from '@/server/ops/deals';
import { dashboardTiles } from '@/server/queries/portal';
import { reviewQueue } from '@/server/queries/review';
import { requireStaff } from '@/server/session';
import { getSettings } from '@/server/settings';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function PortalDashboard() {
  const actor = await requireStaff('/portal');
  const manager = actor.role === 'owner' || actor.role === 'admin';
  const approver = can(actor, 'listing.approve', undefined, await getSettings());
  const [t, stages, upcoming, activity, queue] = await Promise.all([
    dashboardTiles(),
    db
      .select({ stage: deals.stage, n: sql<number>`count(*)::int` })
      .from(deals)
      .where(and(inArray(deals.stage, ['active', 'under_offer', 'under_contract', 'settlement']), manager ? undefined : eq(deals.agentId, actor.id)))
      .groupBy(deals.stage),
    db
      .select({ s: showings, address: listings.addressLine })
      .from(showings)
      .innerJoin(listings, eq(listings.id, showings.listingId))
      .where(and(inArray(showings.status, ['requested', 'confirmed']), gte(showings.requestedFor, upcomingCutoff()), manager ? undefined : or(eq(showings.agentId, actor.id), eq(listings.listingAgentId, actor.id))))
      .orderBy(asc(showings.requestedFor))
      .limit(5),
    db
      .select({ id: activityLog.id, summary: activityLog.summary, createdAt: activityLog.createdAt, actor: users.displayName })
      .from(activityLog)
      .leftJoin(users, eq(users.id, activityLog.actorId))
      .where(manager ? undefined : eq(activityLog.actorId, actor.id))
      .orderBy(desc(activityLog.createdAt))
      .limit(8),
    approver ? reviewQueue() : Promise.resolve([]),
  ]);
  const stageCount = (s: string) => stages.find((x) => x.stage === s)?.n ?? 0;

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <span className="label label--brass">Dashboard</span>
          <h1 className="heading-1">Good to see you, {actor.displayName.split(' ')[0]}</h1>
        </div>
        <Button href="/portal/listings/new" icon="key">
          Add listing
        </Button>
      </div>
      <div className="tile-row">
        <StatTile label="Active listings" value={count(t.active)} />
        <StatTile label="Pending review" value={count(t.pendingReview)} />
        <StatTile label="Under offer" value={count(t.underOffer)} />
        <StatTile label="Showings today" value={count(t.showingsToday)} />
        <StatTile label="Volume this month" value={money(t.volumeThisMonth)} />
      </div>

      {approver && queue.length ? (
        <section className="panel stack" aria-labelledby="q-h">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2 id="q-h" className="heading-3">
              Waiting for your review
            </h2>
            <Link href="/portal/review" className="body-s">
              Review queue
            </Link>
          </div>
          <ul className="saved-list">
            {queue.slice(0, 3).map((q) => (
              <li key={q.id}>
                <Link href={`/portal/review/${q.id}`} className="ui">
                  {q.addressLine || q.refNo}
                </Link>
                <span className="row">
                  {q.source === 'owner_submitted' ? <StatusPill status="listed-by-owner" /> : null}
                  <span className="body-s muted">{q.submitter}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="split">
        <section className="panel stack" aria-labelledby="p-h">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2 id="p-h" className="heading-3">
              Pipeline
            </h2>
            <Link href="/portal/deals" className="body-s">
              Deal pipeline
            </Link>
          </div>
          <dl className="glance">
            {(['active', 'under_offer', 'under_contract', 'settlement'] as const).map((s) => (
              <div key={s}>
                <dt>
                  <StatusPill status={stagePill(s)} label={STAGE_WORDS[s]} />
                </dt>
                <dd>{stageCount(s)}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="panel stack" aria-labelledby="s-h">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2 id="s-h" className="heading-3">
              Upcoming showings
            </h2>
            <Link href="/portal/showings" className="body-s">
              Calendar
            </Link>
          </div>
          {upcoming.length ? (
            <ul className="saved-list">
              {upcoming.map((u) => (
                <li key={u.s.id}>
                  <span className="stack">
                    <b className="ui">{u.address || 'Listing'}</b>
                    <LocalTime iso={(u.s.confirmedFor ?? u.s.requestedFor).toISOString()} />
                  </span>
                  <StatusPill status={SHOWING_PILL[u.s.status as ShowingStatus].status} label={SHOWING_PILL[u.s.status as ShowingStatus].label} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="body-s muted">Nothing booked.</p>
          )}
        </section>
      </div>

      <section className="stack" aria-labelledby="a-h">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 id="a-h" className="heading-2">
            {manager ? 'Recent activity' : 'Your recent activity'}
          </h2>
          {manager ? (
            <Link href="/portal/activity" className="body-s">
              Activity log
            </Link>
          ) : null}
        </div>
        {activity.length ? (
          <ul className="saved-list">
            {activity.map((a) => (
              <li key={a.id}>
                <span className="body-s">
                  {a.summary}
                  {a.actor ? <span className="muted"> · {a.actor}</span> : null}
                </span>
                <LocalTime iso={a.createdAt.toISOString()} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon="activity" title="No activity yet" text="Listings, showings and deal changes appear here as your team works." />
        )}
      </section>
    </div>
  );
}

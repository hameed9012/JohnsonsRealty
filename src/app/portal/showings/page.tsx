import { and, asc, eq, gte, lt, or } from 'drizzle-orm';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ShowingStaffControls } from '@/components/portal/ShowingStaffControls';
import { EmptyState } from '@/components/ui/blocks';
import { Button } from '@/components/ui/Button';
import { LocalTime } from '@/components/ui/LocalTime';
import { StatusPill } from '@/components/ui/StatusStamp';
import { WeekCalendar } from '@/components/ui/WeekCalendar';
import { db } from '@/db/client';
import { listings, showings, users } from '@/db/schema';
import { SHOWING_PILL, type ShowingStatus } from '@/lib/showings';
import { requireStaff } from '@/server/session';

export const metadata: Metadata = { title: 'Showings' };

function mondayOf(d: Date) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (x.getUTCDay() + 6) % 7;
  return new Date(x.getTime() - day * 86400000);
}
const iso = (d: Date) => d.toISOString().slice(0, 10);

export default async function ShowingsPage({ searchParams }: { searchParams: Promise<{ week?: string; view?: string }> }) {
  const actor = await requireStaff('/portal/showings');
  const { week, view } = await searchParams;
  const base = week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? new Date(week + 'T00:00:00Z') : new Date();
  const start = mondayOf(base);
  const end = new Date(start.getTime() + 7 * 86400000);
  const manager = actor.role === 'owner' || actor.role === 'admin';
  const rows = await db
    .select({ s: showings, address: listings.addressLine, slug: listings.slug, client: users.displayName, listingAgent: listings.listingAgentId })
    .from(showings)
    .innerJoin(listings, eq(listings.id, showings.listingId))
    .leftJoin(users, eq(users.id, showings.requestedBy))
    .where(and(gte(showings.requestedFor, start), lt(showings.requestedFor, end), manager ? undefined : or(eq(showings.agentId, actor.id), eq(listings.listingAgentId, actor.id))))
    .orderBy(asc(showings.requestedFor));
  const when = (r: (typeof rows)[number]) => r.s.confirmedFor ?? r.s.requestedFor;
  const prev = iso(new Date(start.getTime() - 7 * 86400000));
  const next = iso(end);
  const list = view === 'list';

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <span className="label label--brass">Clients</span>
          <h1 className="heading-1">Showings</h1>
          <p className="body muted">
            Week of <LocalTime iso={start.toISOString()} withTime={false} />
          </p>
        </div>
        <div className="row">
          <Button size="sm" variant="ghost" href={`?week=${prev}${list ? '&view=list' : ''}`}>
            Previous week
          </Button>
          <Button size="sm" variant="ghost" href={`?${list ? 'view=list' : ''}`}>
            This week
          </Button>
          <Button size="sm" variant="ghost" href={`?week=${next}${list ? '&view=list' : ''}`}>
            Next week
          </Button>
          <nav className="view-toggle" aria-label="Layout">
            <Link href={`?week=${iso(start)}`} aria-current={!list ? 'true' : undefined}>
              Week
            </Link>
            <Link href={`?week=${iso(start)}&view=list`} aria-current={list ? 'true' : undefined}>
              List
            </Link>
          </nav>
        </div>
      </div>

      {!list ? (
        <>
          <WeekCalendar weekStart={start} events={rows.filter((r) => r.s.status !== 'cancelled').map((r) => ({ id: r.s.id, start: when(r), title: r.address || 'Listing', meta: `${SHOWING_PILL[r.s.status as ShowingStatus].label}${r.client ? ' · ' + r.client : ''}`, href: `#s-${r.s.id}` }))} />
          <p className="caption muted">The calendar grid is in UTC. The list below shows your local time.</p>
        </>
      ) : null}

      {rows.length ? (
        <ul className="saved-list">
          {rows.map((r) => {
            const pill = SHOWING_PILL[r.s.status as ShowingStatus];
            return (
              <li key={r.s.id} id={`s-${r.s.id}`}>
                <div className="stack">
                  <div className="row">
                    <StatusPill status={pill.status} label={pill.label} />
                    <span className="id muted">{r.s.refNo}</span>
                  </div>
                  <Link href={`/property/${r.slug}`} className="heading-3">
                    {r.address || 'Listing'}
                  </Link>
                  <span className="body-s">
                    <LocalTime iso={when(r).toISOString()} />
                    {r.client ? ` · ${r.client}` : ''}
                  </span>
                  {r.s.notes ? <span className="body-s muted">{r.s.notes}</span> : null}
                </div>
                <ShowingStaffControls id={r.s.id} refNo={r.s.refNo} status={r.s.status} />
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon="calendar" title="No showings this week" text="Requests from listing pages appear here for the listing’s agent." />
      )}
    </div>
  );
}

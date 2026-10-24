import Link from 'next/link';

export interface CalendarEvent {
  id: string;
  start: Date;
  title: string;
  meta?: string;
  href?: string;
}

const DAY = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' });
const TIME = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });

/** Seven-day grid starting at `weekStart` (UTC midnight). Collapses to a list under 900px. */
export function WeekCalendar({ weekStart, events, today = new Date() }: { weekStart: Date; events: CalendarEvent[]; today?: Date }) {
  const days = Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * 86400000));
  const key = (d: Date) => d.toISOString().slice(0, 10);
  return (
    <div className="cal" role="list" aria-label="Week">
      {days.map((d) => {
        const evs = events.filter((e) => key(e.start) === key(d)).sort((a, b) => a.start.getTime() - b.start.getTime());
        return (
          <section key={key(d)} className="cal-day" role="listitem" data-today={key(d) === key(today)} aria-label={d.toDateString()}>
            <header>
              {DAY.format(d)}
              <b>{d.getUTCDate()}</b>
            </header>
            {evs.length === 0 ? <span className="sr-only">No showings</span> : null}
            {evs.map((e) => {
              const inner = (
                <>
                  <time dateTime={e.start.toISOString()}>{TIME.format(e.start)}</time>
                  {e.title}
                  {e.meta ? <span className="muted"> · {e.meta}</span> : null}
                </>
              );
              return e.href ? (
                <Link key={e.id} href={e.href} className="cal-event">
                  {inner}
                </Link>
              ) : (
                <div key={e.id} className="cal-event">
                  {inner}
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}

import { desc, eq } from 'drizzle-orm';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AnnouncementForm } from '@/components/portal/DiscordControls';
import { EmptyState } from '@/components/ui/blocks';
import { LocalTime } from '@/components/ui/LocalTime';
import { db } from '@/db/client';
import { announcements, users } from '@/db/schema';
import { requireStaff } from '@/server/session';

export const metadata: Metadata = { title: 'Announcements' };

export default async function AnnouncementsPage() {
  const actor = await requireStaff('/portal/announcements');
  if (actor.role !== 'owner' && actor.role !== 'admin') notFound();
  const rows = await db
    .select({ a: announcements, author: users.displayName })
    .from(announcements)
    .leftJoin(users, eq(users.id, announcements.createdBy))
    .orderBy(desc(announcements.createdAt))
    .limit(50);
  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <span className="label label--brass">Discord</span>
          <h1 className="heading-1">Announcements</h1>
          <p className="body muted">Write it here and it posts to #announcements in the brokerage&apos;s style.</p>
        </div>
      </div>
      <section className="panel stack" aria-labelledby="new-h">
        <h2 id="new-h" className="panel-title">
          New announcement
        </h2>
        <AnnouncementForm />
      </section>
      <section className="stack" aria-labelledby="past-h">
        <h2 id="past-h" className="heading-2">
          Published
        </h2>
        {rows.length ? (
          <ul className="saved-list">
            {rows.map(({ a, author }) => (
              <li key={a.id}>
                <span className="stack">
                  <b className="ui">{a.title}</b>
                  <span className="body-s muted">
                    {author ?? 'Staff'} · {a.discordMessageId ? 'Posted to Discord' : 'Not posted'}
                  </span>
                </span>
                {a.publishedAt ? <LocalTime iso={a.publishedAt.toISOString()} /> : null}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon="bell" title="No announcements yet" text="Your first one will show here once it's published." />
        )}
      </section>
    </div>
  );
}

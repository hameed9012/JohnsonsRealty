import { desc, eq } from 'drizzle-orm';
import Link from 'next/link';
import type { Metadata } from 'next';
import { SavedSearchRow } from '@/components/search/SavedSearchControls';
import { EmptyState } from '@/components/ui/blocks';
import { Button } from '@/components/ui/Button';
import { ClientPanel } from '@/components/ui/layout';
import { db } from '@/db/client';
import { savedSearches, users } from '@/db/schema';
import { date } from '@/lib/format';
import { readSaved, savedHref } from '@/lib/saved-search';
import { requireActor } from '@/server/session';

export const metadata: Metadata = { title: 'Saved searches', robots: { index: false } };

export default async function SavedSearchesPage() {
  const actor = await requireActor('/account/searches');
  const [rows, me] = await Promise.all([
    db.select().from(savedSearches).where(eq(savedSearches.userId, actor.id)).orderBy(desc(savedSearches.createdAt)),
    db.query.users.findFirst({ where: eq(users.id, actor.id), columns: { notificationPrefs: true } }),
  ]);
  const alertsOff = me && !me.notificationPrefs.savedSearchAlerts;
  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <span className="label label--brass">Your account</span>
          <h1 className="heading-1">Saved searches</h1>
          <p className="body muted">We notify you here when a new listing that matches is approved.</p>
        </div>
      </div>
      {alertsOff ? (
        <p className="review-note body">
          Saved-search alerts are off in your <Link href="/account/profile">notification settings</Link>, so you won’t be notified even where alerts are on below.
        </p>
      ) : null}
      <ClientPanel title={`${rows.length} saved`}>
        {rows.length ? (
          <ul className="saved-list">
            {rows.map((r) => (
              <li key={r.id}>
                <div className="stack">
                  <Link href={savedHref(readSaved(r.params))} className="heading-3">
                    {r.name}
                  </Link>
                  <span className="id muted">Saved {date(r.createdAt)}</span>
                </div>
                <SavedSearchRow id={r.id} alerts={r.alerts} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon="search" title="No saved searches yet" text="Set your filters on Buy, Rent or Businesses, then choose “Save this search”." action={<Button variant="secondary" href="/buy">Start a search</Button>} />
        )}
      </ClientPanel>
    </div>
  );
}

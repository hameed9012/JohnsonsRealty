import { and, desc, eq, inArray } from 'drizzle-orm';
import type { Metadata } from 'next';
import { CardGrid } from '@/components/listing/CardGrid';
import { EmptyState } from '@/components/ui/blocks';
import { Button } from '@/components/ui/Button';
import { ClientPanel } from '@/components/ui/layout';
import { db } from '@/db/client';
import { listings, savedHomes } from '@/db/schema';
import { PUBLIC_STATUSES } from '@/lib/listing-status';
import { cardsWhere } from '@/server/queries/cards';
import { requireActor } from '@/server/session';

export const metadata: Metadata = { title: 'Saved homes', robots: { index: false } };

type Status = (typeof listings.status.enumValues)[number];

export default async function SavedHomesPage() {
  const actor = await requireActor('/account/saved');
  const rows = await db.select({ id: savedHomes.listingId }).from(savedHomes).where(eq(savedHomes.userId, actor.id)).orderBy(desc(savedHomes.createdAt));
  const ids = rows.map((r) => r.id);
  const cards = ids.length ? await cardsWhere(and(inArray(listings.id, ids), inArray(listings.status, PUBLIC_STATUSES as Status[])), 200) : [];
  // Keep the order they were saved in.
  const order = new Map(ids.map((id, i) => [id, i]));
  cards.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  const hidden = ids.length - cards.length;
  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <span className="label label--brass">Your account</span>
          <h1 className="heading-1">Saved homes</h1>
        </div>
      </div>
      <ClientPanel title={`${cards.length} saved`}>
        {cards.length ? (
          <CardGrid cards={cards} layout="list" returnTo="/account/saved" />
        ) : (
          <EmptyState icon="heart" title="No saved homes yet" text="Tap the heart on any listing to keep it here." action={<Button variant="secondary" href="/buy">Browse homes</Button>} />
        )}
        {hidden > 0 ? <p className="body-s muted">{hidden === 1 ? '1 saved home is' : `${hidden} saved homes are`} no longer listed.</p> : null}
      </ClientPanel>
    </div>
  );
}

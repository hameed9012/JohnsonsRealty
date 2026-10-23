import { desc, inArray } from 'drizzle-orm';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/blocks';
import { ListingCard } from '@/components/ui/ListingCard';
import { db } from '@/db/client';
import { listings } from '@/db/schema';
import { MARKET_STATUSES } from '@/lib/listing-status';
import { loadBundle } from '@/server/listings/bundle';
import { toPropertyView } from '@/server/listings/view';
import { getSettings } from '@/server/settings';

type Status = (typeof listings.status.enumValues)[number];

// Phase 2 shell with the newest listings. The full home page (hero, search, ledger figures) arrives in Phase 3.
export default async function HomePage() {
  const s = await getSettings();
  const rows = await db
    .select({ id: listings.id })
    .from(listings)
    .where(inArray(listings.status, MARKET_STATUSES as Status[]))
    .orderBy(desc(listings.publishedAt))
    .limit(6);
  const views = (await Promise.all(rows.map((r) => loadBundle(db, r.id, { confidential: false })))).filter((b) => !!b).map((b) => toPropertyView(b!));

  return (
    <div className="container section stack-lg">
      <div className="stack prose">
        <span className="label label--brass">{s.brokerageSubline}</span>
        <h1 className="display-xl">{s.heroHeadline || s.brokerageName}</h1>
        {s.tagline ? <p className="body-l muted">{s.tagline}</p> : null}
      </div>
      {views.length ? (
        <section className="stack" aria-labelledby="newest-h">
          <div className="section-head">
            <div>
              <span className="label label--brass">On the market</span>
              <h2 id="newest-h" className="heading-1">
                Newest listings
              </h2>
            </div>
          </div>
          <div className="card-grid">
            {views.map((v, i) => (
              <ListingCard
                key={v.id}
                href={`/property/${v.slug}`}
                address={v.title}
                area={v.areaName ?? undefined}
                price={v.price ?? 0}
                priceKind={v.purpose === 'rent' ? 'rent' : v.previousPrice ? 'reduced' : 'sale'}
                previousPrice={v.previousPrice ?? undefined}
                status={v.status}
                photo={v.cover?.src}
                photoAlt={v.cover?.alt}
                facts={v.cardFacts}
                ownerListed={v.ownerListed}
                priority={i < 3}
              />
            ))}
          </div>
        </section>
      ) : (
        <EmptyState
          icon="home"
          title="No listings yet"
          text="Approved listings will appear here. Have a property in Dauphin County? List it with us."
          action={
            <Button href="/account/listings/new" withKey>
              List your property
            </Button>
          }
        />
      )}
    </div>
  );
}

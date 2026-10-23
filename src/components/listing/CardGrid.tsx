import { and, eq, inArray } from 'drizzle-orm';
import { ListingCard } from '@/components/ui/ListingCard';
import { db } from '@/db/client';
import { savedHomes } from '@/db/schema';
import type { CardData } from '@/server/queries/cards';
import { getActor } from '@/server/session';
import { SaveButton } from './SaveButton';

const SAVEABLE = new Set<string>(['coming-soon', 'active', 'just-listed', 'price-reduced', 'for-lease', 'under-offer', 'under-contract']);

/** A grid or list of listing cards, with a save heart on homes still on the market. */
export async function CardGrid({ cards, layout = 'grid', priority = 0, returnTo = '/' }: { cards: CardData[]; layout?: 'grid' | 'list'; priority?: number; returnTo?: string }) {
  const actor = await getActor();
  const ids = cards.map((c) => c.id);
  const saved = new Set(
    actor && ids.length
      ? (await db.select({ id: savedHomes.listingId }).from(savedHomes).where(and(eq(savedHomes.userId, actor.id), inArray(savedHomes.listingId, ids)))).map((r) => r.id)
      : [],
  );
  return (
    <div className={layout === 'list' ? 'stack' : 'card-grid'}>
      {cards.map((c, i) => (
        <ListingCard
          key={c.id}
          layout={layout}
          href={`/property/${c.slug}`}
          address={c.title}
          area={c.areaName ?? undefined}
          price={c.price}
          priceKind={c.purpose === 'rent' ? 'rent' : c.previousPrice ? 'reduced' : c.status === 'sold' ? 'sold' : 'sale'}
          previousPrice={c.previousPrice ?? undefined}
          status={c.status}
          photo={c.cover?.src}
          photoAlt={c.cover?.alt}
          facts={c.facts}
          ownerListed={c.ownerListed}
          priority={i < priority}
          saveSlot={SAVEABLE.has(c.status) ? <SaveButton listingId={c.id} saved={saved.has(c.id)} signedIn={!!actor} returnTo={returnTo} /> : null}
        />
      ))}
    </div>
  );
}


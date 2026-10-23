import { ListingCard } from '@/components/ui/ListingCard';
import type { CardData } from '@/server/queries/cards';

/** A grid or list of listing cards from CardData. */
export function CardGrid({ cards, layout = 'grid', priority = 0 }: { cards: CardData[]; layout?: 'grid' | 'list'; priority?: number }) {
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
        />
      ))}
    </div>
  );
}

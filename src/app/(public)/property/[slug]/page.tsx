import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BookShowing, SaveShare } from '@/components/listing/PropertyActions';
import { PropertyView } from '@/components/listing/PropertyView';
import { Button } from '@/components/ui/Button';
import { Breadcrumbs } from '@/components/ui/layout';
import { ListingCard } from '@/components/ui/ListingCard';
import { MARKET_STATUSES, type ListingStatus } from '@/lib/listing-status';
import { money } from '@/lib/format';
import { publicImageUrl } from '@/lib/storage';
import { isSaved, publicListingBySlug, similarListings } from '@/server/queries/public-listings';
import { getActor } from '@/server/session';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const r = await publicListingBySlug(slug);
  if (!r) return { title: 'Listing not found' };
  const v = r.view;
  const price = v.price ? (v.purpose === 'rent' ? `${money(v.price)}/mo` : money(v.price)) : null;
  const description = [price, ...v.cardFacts.map((f) => f.text), v.areaName].filter(Boolean).join(' · ');
  const image = v.cover ? publicImageUrl(v.cover.src, { width: 1200, height: 630, crop: true }) : undefined;
  return {
    title: v.title,
    description,
    alternates: { canonical: `/property/${v.slug}` },
    openGraph: { title: v.title, description, type: 'website', images: image ? [{ url: image, width: 1200, height: 630, alt: v.cover?.alt }] : undefined },
    twitter: { card: image ? 'summary_large_image' : 'summary' },
  };
}

export default async function PropertyPage({ params }: Props) {
  const { slug } = await params;
  const r = await publicListingBySlug(slug);
  if (!r) notFound();
  const { view: v, bundle: b } = r;
  const actor = await getActor();
  const [saved, similar] = await Promise.all([isSaved(actor?.id, b.id), similarListings({ id: b.id, areaId: b.areaId, purpose: b.purpose, type: b.type })]);
  const onMarket = MARKET_STATUSES.includes(b.status as ListingStatus);
  const path = `/property/${v.slug}`;
  const section = v.type === 'business' ? { label: 'Businesses', href: '/businesses' } : v.purpose === 'rent' ? { label: 'Rent', href: '/rent' } : { label: 'Buy', href: '/buy' };

  return (
    <div className="container section stack-lg">
      <Breadcrumbs items={[section, ...(v.areaName && v.areaSlug ? [{ label: v.areaName, href: `/areas/${v.areaSlug}` }] : []), { label: v.title }]} />
      <PropertyView
        view={v}
        actions={onMarket ? <SaveShare listingId={b.id} saved={saved} signedIn={!!actor} title={v.title} path={path} /> : null}
        booking={
          onMarket ? (
            <>
              <BookShowing listingId={b.id} signedIn={!!actor} path={path} rent={v.purpose === 'rent'} />
              <Button variant="ghost" icon="chat" href={`/contact?listing=${v.slug}`}>
                Ask about this listing
              </Button>
            </>
          ) : null
        }
        similar={
          similar.length ? (
            <section className="stack" aria-labelledby="similar-h">
              <h2 id="similar-h" className="heading-1">
                Similar {v.purpose === 'rent' ? 'rentals' : 'homes'}
              </h2>
              <div className="card-grid">
                {similar.map((s) => (
                  <ListingCard
                    key={s.id}
                    href={`/property/${s.slug}`}
                    address={s.title}
                    area={s.areaName ?? undefined}
                    price={s.price ?? 0}
                    priceKind={s.purpose === 'rent' ? 'rent' : s.previousPrice ? 'reduced' : 'sale'}
                    previousPrice={s.previousPrice ?? undefined}
                    status={s.status}
                    photo={s.cover?.src}
                    photoAlt={s.cover?.alt}
                    facts={s.cardFacts}
                    ownerListed={s.ownerListed}
                  />
                ))}
              </div>
            </section>
          ) : null
        }
      />
    </div>
  );
}

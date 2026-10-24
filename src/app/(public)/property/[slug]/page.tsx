import { and, asc, eq, gte } from 'drizzle-orm';
import type { Metadata } from 'next';
import { LocalTime } from '@/components/ui/LocalTime';
import { db } from '@/db/client';
import { openHouses } from '@/db/schema';
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
import { BrochureDownload } from '@/components/studio/BrochureDownload';
import { MapPin } from '@/components/listing/MapPin';
import { studioDataFrom } from '@/server/listings/studio';
import { mediaSrc } from '@/server/queries/media';
import { getSettings } from '@/server/settings';
import { siteUrl } from '@/lib/discord';

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
  const settings = await getSettings();
  const [saved, similar, mapSrc, studio] = await Promise.all([
    isSaved(actor?.id, b.id),
    similarListings({ id: b.id, areaId: b.areaId, purpose: b.purpose, type: b.type }),
    b.mapX !== null && b.mapY !== null ? mediaSrc(settings.mapMediaId) : null,
    studioDataFrom(b, settings),
  ]);
  const openHouse = await db.query.openHouses.findFirst({ where: and(eq(openHouses.listingId, b.id), eq(openHouses.cancelled, false), gte(openHouses.endsAt, new Date())), orderBy: [asc(openHouses.startsAt)] });
  const onMarket = MARKET_STATUSES.includes(b.status as ListingStatus);
  const path = `/property/${v.slug}`;
  const section = v.type === 'business' ? { label: 'Businesses', href: '/businesses' } : v.purpose === 'rent' ? { label: 'Rent', href: '/rent' } : { label: 'Buy', href: '/buy' };

  // Structured data for search engines, from the listing's own fields only.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: v.title,
    url: siteUrl(path),
    datePosted: b.publishedAt?.toISOString(),
    image: v.cover ? publicImageUrl(v.cover.src, { width: 1200 }) : undefined,
    description: v.description ?? undefined,
    ...(v.price ? { offers: { '@type': 'Offer', price: v.price, priceCurrency: 'USD', availability: onMarket ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut' } } : {}),
    ...(v.areaName ? { contentLocation: { '@type': 'Place', name: [v.areaName, v.areaParentName, 'PA'].filter(Boolean).join(', ') } } : {}),
  };

  return (
    <div className="container section stack-lg">
      {/* JSON.stringify escapes quotes; replacing "<" keeps a listing's text from closing the script tag. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <Breadcrumbs items={[section, ...(v.areaName && v.areaSlug ? [{ label: v.areaName, href: `/areas/${v.areaSlug}` }] : []), { label: v.title }]} />
      <PropertyView
        view={v}
        actions={
          <>
            {onMarket ? <SaveShare listingId={b.id} saved={saved} signedIn={!!actor} title={v.title} path={path} /> : null}
            <BrochureDownload data={studio.data} name={v.title} />
          </>
        }
        map={mapSrc ? <MapPin src={publicImageUrl(mapSrc, { width: 1600 })} pins={[{ x: b.mapX!, y: b.mapY!, label: v.title }]} caption="Placed by hand by the brokerage. Ask the agent for directions in the city." /> : null}
        booking={
          onMarket ? (
            <div id="book" className="stack">
              {openHouse ? (
                <section className="owner-contact stack" aria-label="Open house">
                  <span className="label label--brass">Open house</span>
                  <p className="heading-3">
                    <LocalTime iso={openHouse.startsAt.toISOString()} />
                  </p>
                  {openHouse.notes ? <p className="body-s muted">{openHouse.notes}</p> : null}
                </section>
              ) : null}
              <BookShowing listingId={b.id} signedIn={!!actor} path={path} rent={v.purpose === 'rent'} />
              <Button variant="ghost" icon="chat" href={`/contact?listing=${v.slug}`}>
                Ask about this listing
              </Button>
            </div>
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

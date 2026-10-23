import Image from 'next/image';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { CardGrid } from '@/components/listing/CardGrid';
import { AreaChip } from '@/components/ui/AreaChip';
import { EmptyState, StatTile } from '@/components/ui/blocks';
import { Button } from '@/components/ui/Button';
import { Breadcrumbs, DataSheet } from '@/components/ui/layout';
import { SalesLedger } from '@/components/ui/SalesLedger';
import { listings } from '@/db/schema';
import { count, money } from '@/lib/format';
import { areaListingCounts, getAreas } from '@/server/queries/areas';
import { newestCards } from '@/server/queries/cards';
import { mediaSrc } from '@/server/queries/media';
import { salesLedger } from '@/server/queries/sales';

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  const all = await getAreas();
  const area = all.find((a) => a.slug === slug);
  if (!area) return null;
  return { area, parent: all.find((a) => a.id === area.parentId) ?? null, children: all.filter((a) => a.parentId === area.id) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = await load((await params).slug);
  if (!r) return { title: 'Area not found' };
  return {
    title: r.parent ? `${r.area.name}, ${r.parent.name}` : r.area.name,
    description: r.area.description?.slice(0, 160) ?? `Homes for sale and rent in ${r.area.name}.`,
    alternates: { canonical: `/areas/${r.area.slug}` },
  };
}

export default async function AreaPage({ params }: Props) {
  const r = await load((await params).slug);
  if (!r) notFound();
  const { area, parent, children } = r;
  const ids = [area.id, ...children.map((c) => c.id)];
  const [cards, sales, counts, hero] = await Promise.all([
    newestCards({ limit: 24, where: sql`${listings.areaId} in (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})` }),
    salesLedger({ areaSlug: area.slug }, 10),
    areaListingCounts(),
    mediaSrc(area.heroMediaId),
  ]);
  const sold = sales.filter((s) => s.purpose === 'sale');
  const avg = sold.length ? sold.reduce((n, s) => n + s.price, 0) / sold.length : 0;
  const services = [
    { label: 'Police', value: area.police },
    { label: 'Fire', value: area.fire },
    { label: 'School district', value: area.schoolDistrict },
    { label: 'Town', value: area.city },
  ].filter((x) => x.value);

  return (
    <>
      <section className="area-hero">
        {hero ? <Image src={hero} alt="" fill priority sizes="100vw" className="hero-media photo-grade" /> : null}
        <div className="hero-scrim" />
        <div className="container area-hero-inner stack">
          <Breadcrumbs items={[{ label: 'Areas', href: '/areas' }, ...(parent ? [{ label: parent.name, href: `/areas/${parent.slug}` }] : []), { label: area.name }]} />
          <span className="label hero-eyebrow">{parent ? parent.name : 'Dauphin County'}</span>
          <h1 className="display-m">{area.name}</h1>
          {area.postalCodes.length ? <p className="id">Postal {area.postalCodes.join(', ')}</p> : null}
        </div>
      </section>

      <div className="container section stack-lg">
        <div className="tile-row">
          <StatTile label="On the market" value={count(cards.length)} />
          {sold.length ? <StatTile label="Recent sales" value={count(sold.length)} /> : null}
          {sold.length ? <StatTile label="Average sale price" value={money(avg)} meta={`Last ${sold.length} sales`} /> : null}
        </div>

        {area.description ? (
          <div className="prose body-l">
            {area.description.split(/\n{2,}/).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        ) : null}

        {children.length ? (
          <section className="stack">
            <h2 className="heading-2">Neighbourhoods</h2>
            <div className="row">
              {children.map((c) => (
                <AreaChip key={c.id} name={c.name} zip={c.postalCodes[0]} count={counts[c.id] ?? 0} href={`/areas/${c.slug}`} />
              ))}
            </div>
          </section>
        ) : null}

        <section className="stack-lg" aria-labelledby="area-listings">
          <div className="section-head">
            <h2 id="area-listings" className="heading-1">
              On the market in {area.name}
            </h2>
            <div className="row">
              <Button variant="secondary" href={`/buy?area=${area.slug}`}>
                Homes for sale
              </Button>
              <Button variant="ghost" href={`/rent?area=${area.slug}`}>
                Rentals
              </Button>
            </div>
          </div>
          {cards.length ? (
            <CardGrid cards={cards} returnTo={`/areas/${area.slug}`} />
          ) : (
            <EmptyState icon="home" title={`Nothing on the market in ${area.name} right now`} text="New listings appear here as soon as they’re approved." />
          )}
        </section>

        {sales.length ? (
          <section className="stack" aria-labelledby="area-sales">
            <h2 id="area-sales" className="heading-1">
              Recent sales
            </h2>
            <SalesLedger rows={sales} columns={['no', 'date', 'property', 'agent', 'status', 'price']} />
          </section>
        ) : null}

        {services.length ? (
          <section className="stack" aria-labelledby="area-services">
            <h2 id="area-services" className="heading-2">
              Services
            </h2>
            <DataSheet rows={services} />
          </section>
        ) : null}
      </div>
    </>
  );
}

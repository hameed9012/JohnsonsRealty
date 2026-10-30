import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { CardGrid } from '@/components/listing/CardGrid';
import { LedgerFigures } from '@/components/public/LedgerFigures';
import { AgentCard } from '@/components/ui/AgentCard';
import { AreaChip } from '@/components/ui/AreaChip';
import { EmptyState, ProcessSteps } from '@/components/ui/blocks';
import { Button } from '@/components/ui/Button';
import { SalesLedger } from '@/components/ui/SalesLedger';
import { SearchBar } from '@/components/ui/SearchBar';
import { money } from '@/lib/format';
import { priceBands } from '@/lib/search';
import { areaListingCounts, getAreas } from '@/server/queries/areas';
import { newestCards } from '@/server/queries/cards';
import { mediaSrc } from '@/server/queries/media';
import { activeAgents, ledgerFigures, salesLedger } from '@/server/queries/sales';
import { getSettings } from '@/server/settings';
import { BUYING_STEPS } from '@/lib/copy';

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return { title: { absolute: s.heroHeadline ? `${s.brokerageName} · ${s.heroHeadline}` : s.brokerageName }, alternates: { canonical: '/' } };
}


export default async function HomePage() {
  const [s, figures, newest, allAreas, counts, sales, agents] = await Promise.all([
    getSettings(),
    ledgerFigures(),
    newestCards({ limit: 6, featuredFirst: true }),
    getAreas(),
    areaListingCounts(),
    salesLedger({}, 5),
    activeAgents(),
  ]);
  // Until a hero photo is set in Site settings, the newest listing's cover photo fills the hero.
  const hero = (await mediaSrc(s.heroMediaId)) ?? newest.find((c) => c.cover)?.cover?.src ?? null;
  const towns = allAreas.filter((a) => !a.parentId);
  const childrenOf = (id: string) => allAreas.filter((a) => a.parentId === id);
  const townCount = (id: string) => (counts[id] ?? 0) + childrenOf(id).reduce((n, c) => n + (counts[c.id] ?? 0), 0);

  return (
    <>
      <section className="hero">
        {s.heroVideoUrl ? (
          <video className="hero-media photo-grade" src={s.heroVideoUrl} autoPlay muted loop playsInline aria-hidden />
        ) : hero ? (
          <Image className="hero-media photo-grade" src={hero} alt="" fill priority sizes="100vw" />
        ) : null}
        <div className="hero-scrim" />
        <div className="container hero-inner">
          <div className="hero-copy stack">
            <span className="label hero-eyebrow">{s.brokerageSubline}</span>
            <h1 className="display-xl">{s.heroHeadline || s.brokerageName}</h1>
            {s.tagline ? <p className="body-l">{s.tagline}</p> : null}
          </div>
          <div className="hero-search">
            <SearchBar
              action="/buy"
              submitLabel="Search homes"
              fields={[
                { name: 'area', label: 'Area', options: [{ value: '', label: 'Any area' }, ...allAreas.map((a) => ({ value: a.slug, label: a.name }))] },
                {
                  name: 'type',
                  label: 'Type',
                  options: [
                    { value: '', label: 'Any type' },
                    { value: 'house', label: 'House' },
                    { value: 'apartment', label: 'Apartment' },
                    { value: 'land', label: 'Land' },
                  ],
                },
                { name: 'max', label: 'Max price', options: [{ value: '', label: 'No max' }, ...priceBands('sale').map((b) => ({ value: String(b), label: money(b) }))] },
              ]}
            />
            <p className="body-s hero-links">
              Or browse <Link href="/rent">rentals</Link> and <Link href="/businesses">businesses</Link>.
            </p>
          </div>
        </div>
      </section>

      {figures.sold || figures.active ? (
        <section className="container section">
          <LedgerFigures
            items={[
              { label: 'Homes sold', value: figures.sold, kind: 'count' },
              { label: 'Total volume', value: figures.volume, kind: 'money' },
              { label: 'On the market', value: figures.active, kind: 'count' },
            ]}
          />
        </section>
      ) : null}

      <section className="container section stack-lg" aria-labelledby="newest-h">
        <div className="section-head">
          <div>
            <span className="label label--brass">On the market</span>
            <h2 id="newest-h" className="heading-1">
              Newest listings
            </h2>
          </div>
          <Button variant="secondary" href="/buy" iconRight="arrow-right">
            See all homes
          </Button>
        </div>
        {newest.length ? (
          <CardGrid cards={newest} priority={3} />
        ) : (
          <EmptyState icon="home" title="No listings yet" text="Approved listings appear here. Have a property in Dauphin County? List it with us." action={<Button href="/account/listings/new">List your property</Button>} />
        )}
      </section>

      {towns.length ? (
        <section className="container section stack-lg" aria-labelledby="areas-h">
          <div className="section-head">
            <div>
              <span className="label label--brass">Dauphin County</span>
              <h2 id="areas-h" className="heading-1">
                Areas we cover
              </h2>
            </div>
            <Button variant="ghost" href="/areas" iconRight="arrow-right">
              All areas
            </Button>
          </div>
          <div className="area-grid">
            {towns.map((t) => (
              <div key={t.id} className="area-group stack">
                <Link href={`/areas/${t.slug}`} className="heading-3 area-town">
                  {t.name}
                  <span className="figure muted">{townCount(t.id)}</span>
                </Link>
                <div className="row">
                  {childrenOf(t.id).map((c) => (
                    <AreaChip key={c.id} name={c.name} zip={c.postalCodes[0]} count={counts[c.id] ?? 0} href={`/areas/${c.slug}`} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {sales.length ? (
        <section className="container section stack-lg" aria-labelledby="sales-h">
          <div className="section-head">
            <div>
              <span className="label label--brass">Track record</span>
              <h2 id="sales-h" className="heading-1">
                Latest sales
              </h2>
            </div>
            <Button variant="ghost" href="/sold" iconRight="arrow-right">
              Full sales ledger
            </Button>
          </div>
          <SalesLedger rows={sales} columns={['no', 'date', 'property', 'agent', 'status', 'price']} />
        </section>
      ) : null}

      <section className="container section stack-lg" aria-labelledby="process-h">
        <div className="section-head">
          <div>
            <span className="label label--brass">How it works</span>
            <h2 id="process-h" className="heading-1">
              From first look to keys
            </h2>
          </div>
        </div>
        <ProcessSteps steps={BUYING_STEPS} />
      </section>

      {agents.length ? (
        <section className="container section stack-lg" aria-labelledby="agents-h">
          <div className="section-head">
            <div>
              <span className="label label--brass">The team</span>
              <h2 id="agents-h" className="heading-1">
                Our agents
              </h2>
            </div>
            <Button variant="ghost" href="/agents" iconRight="arrow-right">
              Meet the team
            </Button>
          </div>
          <div className="card-grid">
            {agents.slice(0, 3).map((a) => (
              <AgentCard
                key={a.userId}
                name={a.name}
                title={a.title ?? undefined}
                handle={a.chirper ?? undefined}
                photo={a.photo ?? undefined}
                href={`/agents/${a.slug}`}
                actionLabel="View profile"
                stats={[...(a.listings ? [{ value: a.listings, label: 'Listings' }] : []), ...(a.sold ? [{ value: a.sold, label: 'Sales' }] : [])]}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="cta-band">
        <div className="container cta-inner">
          <div className="stack">
            <span className="label hero-eyebrow">Sell or let</span>
            <h2 className="display-m">List your property with us</h2>
            <p className="body-l">Homes, rentals, land and businesses. We review every listing before it goes live.</p>
          </div>
          <div className="row">
            <Button href="/account/listings/new" withKey className="cta-primary">
              List your property
            </Button>
            <Button href="/sell" variant="secondary" className="cta-secondary">
              Request a valuation
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}

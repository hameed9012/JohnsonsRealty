import Image from 'next/image';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { CardGrid } from '@/components/listing/CardGrid';
import { EmptyState, StatTile } from '@/components/ui/blocks';
import { Breadcrumbs } from '@/components/ui/layout';
import { SalesLedger } from '@/components/ui/SalesLedger';
import { listings } from '@/db/schema';
import { initials } from '@/lib/cx';
import { count, money } from '@/lib/format';
import { newestCards } from '@/server/queries/cards';
import { activeAgents, salesLedger } from '@/server/queries/sales';

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  return (await activeAgents()).find((a) => a.slug === slug) ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = await load((await params).slug);
  if (!a) return { title: 'Agent not found' };
  return { title: a.name, description: a.bio?.slice(0, 160) ?? `${a.name}, ${a.title ?? 'agent'} at Johnson’s Realty.`, alternates: { canonical: `/agents/${a.slug}` } };
}

export default async function AgentProfile({ params }: Props) {
  const a = await load((await params).slug);
  if (!a) notFound();
  const [cards, sales] = await Promise.all([newestCards({ limit: 24, where: eq(listings.listingAgentId, a.userId) }), salesLedger({ agentUserId: a.userId }, 50)]);
  const volume = sales.filter((s) => s.purpose === 'sale').reduce((n, s) => n + s.price, 0);
  return (
    <div className="container section stack-lg">
      <Breadcrumbs items={[{ label: 'Agents', href: '/agents' }, { label: a.name }]} />
      <header className="agent-head">
        <div className="agent-portrait">{a.photo ? <Image src={a.photo} alt={a.name} fill sizes="200px" className="photo-grade" /> : <span>{initials(a.name)}</span>}</div>
        <div className="stack">
          {a.title ? <span className="label label--brass">{a.title}</span> : null}
          <h1 className="display-m">{a.name}</h1>
          {a.chirper ? <p className="id">Chirper @{a.chirper}</p> : null}
          {a.contactLine ? <p className="body">{a.contactLine}</p> : null}
        </div>
      </header>
      {a.listings || sales.length ? (
        <div className="tile-row">
          {a.listings ? <StatTile label="On the market" value={count(a.listings)} /> : null}
          {sales.length ? <StatTile label="Sales" value={count(sales.length)} /> : null}
          {volume ? <StatTile label="Sales volume" value={money(volume)} /> : null}
        </div>
      ) : null}
      {a.bio ? (
        <div className="prose body-l">
          {a.bio.split(/\n{2,}/).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      ) : null}
      <section className="stack-lg" aria-labelledby="agent-listings">
        <h2 id="agent-listings" className="heading-1">
          {a.name.split(' ')[0]}’s listings
        </h2>
        {cards.length ? <CardGrid cards={cards} /> : <EmptyState icon="home" title="No listings on the market right now" />}
      </section>
      {sales.length ? (
        <section className="stack" aria-labelledby="agent-sales">
          <h2 id="agent-sales" className="heading-1">
            Sales
          </h2>
          <SalesLedger rows={sales} columns={['no', 'date', 'property', 'status', 'price']} />
        </section>
      ) : null}
    </div>
  );
}

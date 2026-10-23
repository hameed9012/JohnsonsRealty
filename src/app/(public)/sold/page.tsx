import type { Metadata } from 'next';
import { EmptyState, StatTile } from '@/components/ui/blocks';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/fields';
import { SalesLedger } from '@/components/ui/SalesLedger';
import { count, money } from '@/lib/format';
import { getAreas } from '@/server/queries/areas';
import { activeAgents, chartsFrom, salesLedger, salesYears } from '@/server/queries/sales';
import { SoldCharts } from './SoldCharts';

export const metadata: Metadata = {
  title: 'Sold',
  description: 'Every sale and lease Johnson’s Realty has closed, numbered in order.',
  alternates: { canonical: '/sold' },
};

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || null;

export default async function SoldPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const [areas, agents, years] = await Promise.all([getAreas(), activeAgents(), salesYears()]);
  const areaSlug = areas.some((a) => a.slug === one(sp.area)) ? one(sp.area) : null;
  const agent = agents.find((a) => a.slug === one(sp.agent)) ?? null;
  const yearRaw = Number(one(sp.year));
  const year = years.includes(yearRaw) ? yearRaw : null;
  const purpose = one(sp.kind) === 'leased' ? 'rent' : one(sp.kind) === 'sold' ? 'sale' : null;
  const rows = await salesLedger({ areaSlug, agentUserId: agent?.userId ?? null, year, purpose }, 500);
  const salesOnly = rows.filter((r) => r.purpose === 'sale');
  const volume = salesOnly.reduce((n, r) => n + r.price, 0);
  const charts = chartsFrom(rows);
  const filtered = !!(areaSlug || agent || year || purpose);

  return (
    <div className="container section stack-lg">
      <header className="stack prose">
        <span className="label label--brass">Track record</span>
        <h1 className="display-m">Sold</h1>
        <p className="body-l muted">Every sale and lease we’ve closed, numbered in the order it happened.</p>
      </header>

      <form method="get" action="/sold" className="sold-filters" aria-label="Filter sales">
        <SelectField label="Area" name="area" placeholder="Any area" options={areas.map((a) => ({ value: a.slug, label: a.name }))} defaultValue={areaSlug ?? ''} />
        <SelectField label="Agent" name="agent" placeholder="Any agent" options={agents.map((a) => ({ value: a.slug, label: a.name }))} defaultValue={agent?.slug ?? ''} />
        <SelectField label="Year" name="year" placeholder="All years" options={years.map(String)} defaultValue={year ? String(year) : ''} />
        <SelectField
          label="Kind"
          name="kind"
          placeholder="Sales and leases"
          options={[
            { value: 'sold', label: 'Sales' },
            { value: 'leased', label: 'Leases' },
          ]}
          defaultValue={purpose === 'sale' ? 'sold' : purpose === 'rent' ? 'leased' : ''}
        />
        <div className="row">
          <Button type="submit" size="sm" icon="filter">
            Apply
          </Button>
          {filtered ? (
            <Button variant="ghost" size="sm" href="/sold">
              Clear
            </Button>
          ) : null}
        </div>
      </form>

      {rows.length ? (
        <>
          <div className="tile-row">
            <StatTile label="Closed" value={count(rows.length)} />
            {salesOnly.length ? <StatTile label="Sales volume" value={money(volume)} /> : null}
            {salesOnly.length ? <StatTile label="Average sale" value={money(volume / salesOnly.length)} /> : null}
          </div>
          <SoldCharts volume={charts.volume} areas={charts.areas} />
          <SalesLedger rows={rows} columns={['no', 'date', 'property', 'agent', 'status', 'price']} caption="Sales ledger" total={volume || undefined} totalLabel="Sales volume" />
        </>
      ) : (
        <EmptyState
          icon="chart"
          title={filtered ? 'No sales match these filters' : 'No sales recorded yet'}
          text={filtered ? 'Try another area, agent or year.' : 'Closed sales appear here, numbered from Sale No. 001.'}
          action={filtered ? <Button variant="secondary" href="/sold">Clear filters</Button> : undefined}
        />
      )}
    </div>
  );
}

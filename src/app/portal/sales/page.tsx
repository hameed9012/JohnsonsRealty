import type { Metadata } from 'next';
import { EmptyState, StatTile } from '@/components/ui/blocks';
import { Button } from '@/components/ui/Button';
import { SalesLedger } from '@/components/ui/SalesLedger';
import { count, money } from '@/lib/format';
import { salesLedger } from '@/server/queries/sales';
import { requireStaff } from '@/server/session';

export const metadata: Metadata = { title: 'Sales' };

export default async function SalesPage() {
  const actor = await requireStaff('/portal/sales');
  const all = await salesLedger({ agentUserId: actor.role === 'agent' ? actor.id : null }, 1000);
  const sold = all.filter((r) => r.purpose === 'sale');
  const volume = sold.reduce((n, r) => n + r.price, 0);
  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <span className="label label--brass">Brokerage</span>
          <h1 className="heading-1">Sales</h1>
          <p className="body muted">Record a sale from its deal: open the deal and use Record the sale. Each takes the next Sale No.</p>
        </div>
        <Button variant="secondary" href="/portal/deals" icon="pipeline">
          Deal pipeline
        </Button>
      </div>
      <div className="tile-row">
        <StatTile label="Closed" value={count(all.length)} />
        <StatTile label="Sales volume" value={money(volume)} />
        <StatTile label="Leases" value={count(all.length - sold.length)} />
      </div>
      {all.length ? (
        <SalesLedger rows={all} columns={['no', 'date', 'property', 'agent', 'status', 'price']} caption="Sales ledger" total={volume || undefined} totalLabel="Sales volume" />
      ) : (
        <EmptyState icon="chart" title="No sales recorded yet" text="Sales appear here, numbered from Sale No. 001." />
      )}
    </div>
  );
}

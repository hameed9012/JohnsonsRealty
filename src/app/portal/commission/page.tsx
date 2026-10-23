import { desc, eq } from 'drizzle-orm';
import type { Metadata } from 'next';
import { EmptyState, StatTile } from '@/components/ui/blocks';
import { ConfidentialPanel } from '@/components/ui/documents';
import { DataTable } from '@/components/ui/layout';
import { db } from '@/db/client';
import { agentProfiles, listings, saleCommissions, sales } from '@/db/schema';
import { date, money, saleNo } from '@/lib/format';
import { can } from '@/lib/permissions';
import { requireStaff } from '@/server/session';

export const metadata: Metadata = { title: 'Commission' };

/** Commission splits are confidential: managers see every split, agents see only their own. */
export default async function CommissionPage() {
  const actor = await requireStaff('/portal/commission');
  const all = can(actor, 'commission.viewAll');
  const rows = await db
    .select({ id: saleCommissions.id, amount: saleCommissions.amount, rate: saleCommissions.ratePercent, agentId: saleCommissions.agentId, agent: agentProfiles.publicName, saleNo: sales.saleNo, soldOn: sales.soldOn, price: sales.price, address: listings.addressLine })
    .from(saleCommissions)
    .innerJoin(sales, eq(sales.id, saleCommissions.saleId))
    .innerJoin(listings, eq(listings.id, sales.listingId))
    .leftJoin(agentProfiles, eq(agentProfiles.userId, saleCommissions.agentId))
    .where(all ? undefined : eq(saleCommissions.agentId, actor.id))
    .orderBy(desc(sales.soldOn), desc(sales.saleNo));
  const total = rows.reduce((n, r) => n + r.amount, 0);
  const byAgent = new Map<string, number>();
  const byMonth = new Map<string, number>();
  for (const r of rows) {
    byAgent.set(r.agent ?? 'Brokerage', (byAgent.get(r.agent ?? 'Brokerage') ?? 0) + r.amount);
    byMonth.set(r.soldOn.slice(0, 7), (byMonth.get(r.soldOn.slice(0, 7)) ?? 0) + r.amount);
  }
  const fmtMonth = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <span className="label label--brass">Brokerage</span>
          <h1 className="heading-1">Commission</h1>
          <p className="body muted">{all ? 'Every commission split.' : 'Your commission splits.'} Never shown outside the portal.</p>
        </div>
      </div>
      {rows.length ? (
        <>
          <div className="tile-row">
            <StatTile label="Total commission" value={money(total)} />
            <StatTile label="Sales with splits" value={new Set(rows.map((r) => r.saleNo)).size} />
          </div>
          <div className="split">
            <ConfidentialPanel title="By agent" rows={[...byAgent.entries()].sort((a, b) => b[1] - a[1]).map(([label, v]) => ({ label, value: money(v), mono: true }))} />
            <ConfidentialPanel title="By month" rows={[...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([m, v]) => ({ label: fmtMonth.format(new Date(m + '-01T00:00:00Z')), value: money(v), mono: true }))} />
          </div>
          <DataTable
            caption="Commission ledger"
            rows={rows}
            rowKey={(r) => r.id}
            columns={[
              { key: 'no', header: 'Sale', num: true, cell: (r) => saleNo(r.saleNo) },
              { key: 'date', header: 'Date', num: true, cell: (r) => date(r.soldOn) },
              { key: 'p', header: 'Property', cell: (r) => r.address },
              { key: 'a', header: 'Agent', cell: (r) => r.agent ?? 'Brokerage' },
              { key: 'rate', header: 'Rate', num: true, cell: (r) => (r.rate !== null ? `${r.rate}%` : '—') },
              { key: 'amt', header: 'Commission', num: true, align: 'right', cell: (r) => money(r.amount) },
            ]}
          />
        </>
      ) : (
        <EmptyState icon="dollar" title="No commission recorded yet" text="Splits are entered when a sale is recorded from its deal." />
      )}
    </div>
  );
}

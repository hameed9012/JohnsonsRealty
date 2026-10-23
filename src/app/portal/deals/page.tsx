import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';
import Link from 'next/link';
import type { Metadata } from 'next';
import { PipelineBoard, type BoardDeal } from '@/components/portal/PipelineBoard';
import { EmptyState } from '@/components/ui/blocks';
import { Button } from '@/components/ui/Button';
import { db } from '@/db/client';
import { clients, dealConfidential, dealParties, deals, listings, users } from '@/db/schema';
import { date } from '@/lib/format';
import { stagePill } from '@/lib/deal-stage';
import { can } from '@/lib/permissions';
import { requireStaff } from '@/server/session';

export const metadata: Metadata = { title: 'Deals' };

export default async function DealsPage({ searchParams }: { searchParams: Promise<{ fallen?: string }> }) {
  const actor = await requireStaff('/portal/deals');
  const { fallen } = await searchParams;
  const manager = actor.role === 'owner' || actor.role === 'admin';
  const rows = await db
    .select({
      d: deals,
      address: listings.addressLine,
      price: listings.price,
      agent: users.displayName,
      offers: dealConfidential.offers,
      client: sql<string | null>`(select c.display_name from ${dealParties} dp join ${clients} c on c.id = dp.client_id where dp.deal_id = ${deals.id} and dp.side in ('buyer','tenant') limit 1)`,
    })
    .from(deals)
    .innerJoin(listings, eq(listings.id, deals.listingId))
    .leftJoin(users, eq(users.id, deals.agentId))
    .leftJoin(dealConfidential, eq(dealConfidential.dealId, deals.id))
    .where(and(manager || actor.wideConfidentialAccess ? undefined : or(eq(deals.agentId, actor.id)), fallen === '1' ? eq(deals.stage, 'fallen_through') : inArray(deals.stage, ['active', 'under_offer', 'under_contract', 'settlement', 'closed'])))
    .orderBy(desc(deals.updatedAt))
    .limit(300);

  const board: BoardDeal[] = rows.map((r) => {
    const seeOffers = can(actor, 'deal.viewConfidential', { agentId: r.d.agentId });
    const lastOffer = seeOffers && r.offers?.length ? r.offers[r.offers.length - 1]!.amount : null;
    const nextDue = [r.d.inspectionDeadline, r.d.financingDeadline, r.d.settlementDate].filter((x): x is string => !!x).sort()[0];
    return {
      id: r.d.id,
      stage: r.d.stage,
      status: stagePill(r.d.stage),
      address: r.address || 'Listing',
      value: lastOffer ?? r.price ?? 0,
      client: r.client ?? undefined,
      due: nextDue ? date(nextDue) : undefined,
      agent: r.agent ?? undefined,
      canManage: can(actor, 'deal.manage', { agentId: r.d.agentId }),
    };
  });

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <span className="label label--brass">Clients</span>
          <h1 className="heading-1">{fallen === '1' ? 'Deals that fell through' : 'Deal pipeline'}</h1>
          <p className="body muted">Open a deal from a listing page. Drag cards between columns, or use each card’s Move menu.</p>
        </div>
        <Button variant="ghost" href={fallen === '1' ? '/portal/deals' : '/portal/deals?fallen=1'}>
          {fallen === '1' ? 'Back to the pipeline' : 'Deals that fell through'}
        </Button>
      </div>
      {board.length ? (
        fallen === '1' ? (
          <ul className="saved-list">
            {board.map((d) => (
              <li key={d.id}>
                <Link href={`/portal/deals/${d.id}`} className="ui">
                  {d.address}
                </Link>
                <span className="body-s muted">{d.client}</span>
              </li>
            ))}
          </ul>
        ) : (
          <PipelineBoard deals={board} />
        )
      ) : (
        <EmptyState icon="pipeline" title="No deals yet" text="Open one from a listing that’s on the market: pick the client and choose Open deal." action={<Button href="/portal/listings?status=live">Listings on the site</Button>} />
      )}
    </div>
  );
}

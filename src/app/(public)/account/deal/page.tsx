import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { EmptyState } from '@/components/ui/blocks';
import { Button } from '@/components/ui/Button';
import { ClientPanel } from '@/components/ui/layout';
import { StatusPill } from '@/components/ui/StatusStamp';
import { date } from '@/lib/format';
import { myDeals, STAGE_LABEL } from '@/server/queries/deals';
import { requireActor } from '@/server/session';
import { stagePill } from '@/lib/deal-stage';

export const metadata: Metadata = { title: 'My deal', robots: { index: false } };

export default async function MyDealsPage() {
  const actor = await requireActor('/account/deal');
  const deals = await myDeals(actor.id);
  if (deals.length === 1) redirect(`/account/deal/${deals[0]!.id}`);
  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <span className="label label--brass">Your account</span>
          <h1 className="heading-1">My deals</h1>
        </div>
      </div>
      <ClientPanel title="Your deals">
        {deals.length ? (
          <ul className="saved-list">
            {deals.map((d) => (
              <li key={d.id}>
                <div className="stack">
                  <StatusPill status={stagePill(d.stage)} label={STAGE_LABEL[d.stage]} />
                  <Link href={`/account/deal/${d.id}`} className="heading-3">
                    {d.address || 'Your deal'}
                  </Link>
                  <span className="id muted">Updated {date(d.updatedAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon="document" title="No deal yet" text="When you make an offer or list with us, your agent opens a deal and it appears here with its timeline, documents and messages." action={<Button variant="secondary" href="/buy">Browse homes</Button>} />
        )}
      </ClientPanel>
    </div>
  );
}

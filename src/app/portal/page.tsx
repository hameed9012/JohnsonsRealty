import type { Metadata } from 'next';
import { EmptyState, StatTile } from '@/components/ui/blocks';
import { Button } from '@/components/ui/Button';
import { count, money } from '@/lib/format';
import { dashboardTiles } from '@/server/queries/portal';
import { requireStaff } from '@/server/session';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function PortalDashboard() {
  const actor = await requireStaff('/portal');
  const t = await dashboardTiles();
  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <span className="label label--brass">Dashboard</span>
          <h1 className="heading-1">Good to see you, {actor.displayName.split(' ')[0]}</h1>
        </div>
        <Button href="/portal/listings/new" icon="key">
          Add listing
        </Button>
      </div>
      <div className="tile-row">
        <StatTile label="Active listings" value={count(t.active)} />
        <StatTile label="Pending review" value={count(t.pendingReview)} />
        <StatTile label="Under offer" value={count(t.underOffer)} />
        <StatTile label="Showings today" value={count(t.showingsToday)} />
        <StatTile label="Volume this month" value={money(t.volumeThisMonth)} />
      </div>
      <EmptyState icon="activity" title="No activity yet" text="Listings, showings and deal changes appear here as your team works." />
    </div>
  );
}

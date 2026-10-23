import type { Metadata } from 'next';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/blocks';
import { ClientPanel } from '@/components/ui/layout';
import { requireActor } from '@/server/session';

export const metadata: Metadata = { title: 'Your account', robots: { index: false } };

export default async function AccountDashboard() {
  const actor = await requireActor('/account');
  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <span className="label label--brass">Your account</span>
          <h1 className="heading-1">Welcome, {actor.displayName}</h1>
        </div>
        <Button href="/account/listings/new" withKey>
          List your property
        </Button>
      </div>
      <ClientPanel title="Your journey">
        <EmptyState
          icon="key"
          title="Nothing in progress yet"
          text="Save homes you like, book a showing, or list your own property. Your deal timeline appears here once an agent opens one with you."
          action={<Button variant="secondary" href="/buy">Browse homes</Button>}
        />
      </ClientPanel>
    </div>
  );
}

import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/blocks';
import { getSettings } from '@/server/settings';

// Phase 1 shell. The full home page (hero, search, ledger figures, rails) arrives in Phase 3.
export default async function HomePage() {
  const s = await getSettings();
  return (
    <div className="container section stack-lg">
      <div className="stack prose">
        <span className="label label--brass">{s.brokerageSubline}</span>
        <h1 className="display-xl">{s.heroHeadline || s.brokerageName}</h1>
        {s.tagline ? <p className="body-l muted">{s.tagline}</p> : null}
      </div>
      <EmptyState
        icon="home"
        title="No listings yet"
        text="Approved listings will appear here. Have a property in Dauphin County? List it with us."
        action={
          <Button href="/account/listings/new" withKey>
            List your property
          </Button>
        }
      />
    </div>
  );
}

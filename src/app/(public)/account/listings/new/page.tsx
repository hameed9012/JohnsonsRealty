import type { Metadata } from 'next';
import { Button } from '@/components/ui/Button';
import { ProcessSteps } from '@/components/ui/blocks';
import { startListing } from '@/server/actions/listings';
import { requireActor } from '@/server/session';

export const metadata: Metadata = { title: 'List your property', robots: { index: false } };

export default async function ListYourProperty() {
  await requireActor('/account/listings/new');
  return (
    <div className="stack-lg prose">
      <div className="stack">
        <span className="label label--brass">List your property</span>
        <h1 className="heading-1">List your property with us</h1>
        <p className="body-l muted">
          Sell or let a home, apartment, land or business you own in Dauphin County. Your listing shows a “Listed by Owner” label, and our team reviews it before it goes
          live.
        </p>
      </div>
      <ProcessSteps
        steps={[
          { title: 'Describe it', text: 'The address, area and key facts.' },
          { title: 'Set your price', text: 'Asking price or monthly rent.' },
          { title: 'Add photos', text: 'At least three in-game photos.' },
          { title: 'Submit for review', text: 'We check it and let you know.' },
        ]}
      />
      <form action={startListing.bind(null, 'owner_submitted')}>
        <Button type="submit" withKey>
          Start my listing
        </Button>
      </form>
      <p className="caption muted">Drafts save as you go. You can come back any time from My listings.</p>
    </div>
  );
}

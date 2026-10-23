import type { Metadata } from 'next';
import { Button } from '@/components/ui/Button';
import { ProcessSteps } from '@/components/ui/blocks';
import { startListing } from '@/server/actions/listings';
import { requireStaff } from '@/server/session';

export const metadata: Metadata = { title: 'Add listing' };

export default async function NewListing() {
  await requireStaff('/portal/listings/new');
  return (
    <div className="stack-lg prose">
      <div className="stack">
        <span className="label label--brass">Listings</span>
        <h1 className="heading-1">Add a listing</h1>
        <p className="body-l muted">Every step saves as a draft. When it’s complete, submit it and the Owner reviews it before it goes public.</p>
      </div>
      <ProcessSteps
        steps={[
          { title: 'Describe the property', text: 'Type, address, area, facts and features.' },
          { title: 'Set the price and terms', text: 'Asking price or rent, lease or business terms, showings.' },
          { title: 'Add photos', text: 'At least three in-game photos, with a cover.' },
          { title: 'Fill in the seller file', text: 'People, ownership, disclosures and the confidential bottom line.' },
        ]}
      />
      <form action={startListing.bind(null, 'agent')}>
        <Button type="submit" withKey>
          Start a listing
        </Button>
      </form>
    </div>
  );
}

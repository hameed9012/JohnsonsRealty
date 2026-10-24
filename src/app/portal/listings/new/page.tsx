import type { Metadata } from 'next';
import { inArray } from 'drizzle-orm';
import { SellerFilePicker } from '@/components/portal/SellerFilePicker';
import { Button } from '@/components/ui/Button';
import { ProcessSteps } from '@/components/ui/blocks';
import { db } from '@/db/client';
import { clients } from '@/db/schema';
import { legacyKey } from '@/import/legacy/apply';
import { loadPlan } from '@/import/legacy/source';
import { money } from '@/lib/format';
import { startListing } from '@/server/actions/listings';
import { requireStaff } from '@/server/session';

export const metadata: Metadata = { title: 'Add listing' };

export default async function NewListing() {
  const actor = await requireStaff('/portal/listings/new');
  const manager = actor.role === 'owner' || actor.role === 'admin';
  // Properties in the seller files that aren't on the site yet. Each can be used once.
  const plan = await loadPlan().catch(() => null);
  const taken = plan
    ? new Set(
        (await db.select({ key: clients.legacyKey }).from(clients).where(inArray(clients.legacyKey, plan.listings.map((l) => legacyKey(l.key))))).map((r) => r.key),
      )
    : new Set<string | null>();
  const available = (plan?.listings ?? [])
    .filter((l) => !taken.has(legacyKey(l.key)) && (manager || !l.sale))
    .map((l) => ({
      key: l.key,
      seller: plan!.clients.find((c) => c.key === l.key)?.displayName ?? l.key,
      address: l.addressLine || (l.type === 'rental' ? 'Rental, address to be chosen' : 'Address to be chosen'),
      price: l.price ? money(l.price) + (l.purpose === 'rent' ? '/month' : '') : '',
      kind: l.status === 'sold' ? 'Sold' : l.type === 'business' ? 'Business' : l.purpose === 'rent' ? 'For lease' : 'For sale',
    }));
  return (
    <div className="stack-lg prose">
      <div className="stack">
        <span className="label label--brass">Listings</span>
        <h1 className="heading-1">Add a listing</h1>
        <p className="body-l muted">Every step saves as a draft. When it’s complete, submit it and the Owner reviews it before it goes public.</p>
      </div>
      {available.length ? (
        <section className="panel stack" aria-labelledby="from-file-h">
          <h2 className="heading-2" id="from-file-h">
            Start from a seller file
          </h2>
          <p className="body muted">
            {manager
              ? 'These properties are in the seller files but not on the site yet. Pick one and every detail and the seller file come in filled. It stays off the public site until it has 3 photos.'
              : 'These properties are in the seller files but not on the site yet. Pick one and every detail and the seller file come in filled; add photos, then submit it for review.'}{' '}
            Each one can only be listed once.
          </p>
          <SellerFilePicker options={available} />
        </section>
      ) : null}
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

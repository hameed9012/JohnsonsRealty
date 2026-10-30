'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/fields';
import { useToast } from '@/components/ui/Toaster';
import { createDocumentAction } from '@/server/actions/documents';

type Option = { value: string; label: string };
type ListingOption = Option & { sellerId?: string | null };

export function NewDocumentForm({ forms, defaultType, dealId, clients, listings, defaults }: { forms: Option[]; defaultType: string; dealId?: string; clients: Option[]; listings: ListingOption[]; defaults: { client: string; listing: string } }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const [v, setV] = useState({ formType: defaultType, sellerClientId: defaults.client, buyerClientId: '', listingId: defaults.listing });
  return (
    <form
      className="panel stack"
      style={{ maxWidth: 'var(--text-max)' }}
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await createDocumentAction({ ...v, dealId });
          if (r && !r.ok && r.message) toast({ message: r.message, tone: 'danger' });
        });
      }}
    >
      <SelectField label="Form" options={forms} value={v.formType} onChange={(e) => setV({ ...v, formType: e.target.value })} />
      {dealId ? null : (
        <>
          <SelectField
            label="Listing"
            placeholder="None yet"
            options={listings}
            value={v.listingId}
            hint="The property details, terms and seller file all come from the listing."
            onChange={(e) => {
              const id = e.target.value;
              const l = listings.find((x) => x.value === id);
              // The listing's own seller comes with it; you can still pick someone else below.
              setV({ ...v, listingId: id, sellerClientId: l?.sellerId ?? v.sellerClientId });
            }}
          />
          <SelectField label="Seller, owner or landlord" placeholder="None yet" options={clients} value={v.sellerClientId} onChange={(e) => setV({ ...v, sellerClientId: e.target.value })} hint="Filled in from the listing." />
          <SelectField label="Buyer or tenant (optional)" placeholder="None yet" options={clients} value={v.buyerClientId} onChange={(e) => setV({ ...v, buyerClientId: e.target.value })} />
        </>
      )}
      <div className="row">
        <Button type="submit" loading={pending} icon="document">
          Start document
        </Button>
      </div>
    </form>
  );
}

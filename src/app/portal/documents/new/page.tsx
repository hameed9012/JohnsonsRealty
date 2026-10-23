import type { Metadata } from 'next';
import { NewDocumentForm } from '@/components/documents/NewDocumentForm';
import { Breadcrumbs } from '@/components/ui/layout';
import { db } from '@/db/client';
import { deals, listings } from '@/db/schema';
import { FORM_DEFS, FORM_ORDER } from '@/forms/defs';
import { FORMS } from '@/lib/refs';
import { eq } from 'drizzle-orm';
import { clientList } from '@/server/queries/clients';
import { listingOptions } from '@/server/queries/documents';
import { requireStaff } from '@/server/session';

export const metadata: Metadata = { title: 'New document' };

type SP = { deal?: string; client?: string; listing?: string; type?: string };

export default async function NewDocumentPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requireStaff('/portal/documents/new');
  const sp = await searchParams;
  const [clientRows, listingRows, deal] = await Promise.all([
    clientList(actor),
    listingOptions(actor),
    sp.deal && /^[0-9a-f-]{36}$/.test(sp.deal) ? db.select({ id: deals.id, address: listings.addressLine, type: listings.type }).from(deals).innerJoin(listings, eq(listings.id, deals.listingId)).where(eq(deals.id, sp.deal)).then((r) => r[0] ?? null) : null,
  ]);
  const business = deal?.type === 'business';
  const forms = FORM_ORDER.filter((t) => !deal || FORM_DEFS[t].kind === 'any' || FORM_DEFS[t].kind === (business ? 'business' : 'home'));
  return (
    <div className="stack-lg">
      <Breadcrumbs items={[{ label: 'Documents', href: '/portal/documents' }, { label: 'New document' }]} />
      <div className="page-head">
        <div>
          <span className="label label--brass">Documents</span>
          <h1 className="heading-1">New document</h1>
          <p className="body muted">{deal ? `For the deal on ${deal.address || 'this listing'}. It fills from the deal’s client files.` : 'Choose the form, and who it’s for if you know. You can fill it from a client file later too.'}</p>
        </div>
      </div>
      <NewDocumentForm
        forms={forms.map((t) => ({ value: t, label: `${FORMS[t].title} · ${FORMS[t].formNo}` }))}
        defaultType={forms.includes(sp.type as never) ? sp.type! : forms[0]!}
        dealId={deal?.id}
        clients={clientRows.map((c) => ({ value: c.id, label: c.displayName }))}
        listings={listingRows}
        defaults={{ client: sp.client ?? '', listing: sp.listing ?? '' }}
      />
    </div>
  );
}

import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DocumentEditor } from '@/components/documents/DocumentEditor';
import { Breadcrumbs } from '@/components/ui/layout';
import { FORMS } from '@/lib/refs';
import { clientList } from '@/server/queries/clients';
import { areaPicks, brokerageLines, documentView, listingOptions } from '@/server/queries/documents';
import { requireStaff } from '@/server/session';

export const metadata: Metadata = { title: 'Document' };

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireStaff(`/portal/documents/${id}`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const v = await documentView(actor, id);
  if (!v) notFound();
  const [brokerage, areas, clientRows, listingRows] = await Promise.all([brokerageLines(), areaPicks(), clientList(actor), listingOptions(actor)]);
  const { doc } = v;
  const rent = v.listing?.purpose === 'rent';
  const link = (roles: string[]) => v.links.find((l) => roles.includes(l.role))?.clientId ?? '';
  const meta = FORMS[doc.formType];
  return (
    <div className="stack-lg">
      <div className="no-print stack">
        <Breadcrumbs items={[{ label: 'Documents', href: '/portal/documents' }, { label: `${meta.title} ${doc.docNo}` }]} />
        <div className="row body-s">
          {doc.dealId ? <Link href={`/portal/deals/${doc.dealId}`}>Open the deal</Link> : null}
          {v.listing ? <Link href={`/portal/listings/${v.listing.id}`}>{v.listing.addressLine || v.listing.refNo}</Link> : null}
          {v.links.map((l) => (
            <Link key={l.clientId} href={`/portal/clients/${l.clientId}`}>
              {clientRows.find((c) => c.id === l.clientId)?.displayName ?? 'Client file'}
            </Link>
          ))}
        </div>
      </div>
      <DocumentEditor
        id={doc.id}
        type={doc.formType}
        docNo={doc.docNo}
        status={doc.status}
        shared={doc.sharedWithClient}
        data={doc.data}
        signatures={v.signatures}
        agentName={v.agentName}
        brokerage={brokerage}
        areas={areas}
        canReopen={actor.role === 'owner' || actor.role === 'admin'}
        dealId={doc.dealId}
        picks={{ sellerClientId: link(['seller', 'landlord']), buyerClientId: link(['buyer', 'tenant']), listingId: doc.listingId ?? '' }}
        clientOptions={clientRows.map((c) => ({ value: c.id, label: c.displayName }))}
        listingOptions={listingRows}
        partyLabels={rent ? { seller: 'Landlord', buyer: 'Tenant' } : { seller: 'Seller or owner', buyer: 'Buyer' }}
      />
    </div>
  );
}

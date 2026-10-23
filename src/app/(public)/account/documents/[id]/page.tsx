import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DocSheet } from '@/components/documents/DocSheet';
import { PrintButton } from '@/components/portal/PrintButton';
import { Breadcrumbs, VisibilityLabel } from '@/components/ui/layout';
import { clientCopy } from '@/forms/model';
import { FORMS } from '@/lib/refs';
import { brokerageLines, documentView } from '@/server/queries/documents';
import { requireActor } from '@/server/session';

export const metadata: Metadata = { title: 'Document', robots: { index: false } };

/** The client's copy: read-only, without brokerage-only sections. Only reachable once the agent shares it. */
export default async function MyDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor(`/account/documents/${id}`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const v = await documentView({ ...actor, role: 'client' }, id);
  if (!v) notFound();
  const { doc } = v;
  const brokerage = await brokerageLines();
  return (
    <div className="stack-lg">
      <div className="no-print stack">
        <Breadcrumbs items={[{ label: 'My deal', href: doc.dealId ? `/account/deal/${doc.dealId}` : '/account/deal' }, { label: FORMS[doc.formType].title }]} />
        <div className="row">
          <PrintButton />
          <VisibilityLabel />
        </div>
      </div>
      <DocSheet type={doc.formType} docNo={doc.docNo} status={doc.status} data={clientCopy(doc.formType, doc.data)} signatures={v.signatures} agentName={v.agentName} brokerage={brokerage} hideInternal />
    </div>
  );
}

import Link from 'next/link';
import type { Metadata } from 'next';
import { EmptyState } from '@/components/ui/blocks';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/fields';
import { DataTable } from '@/components/ui/layout';
import { StatusPill } from '@/components/ui/StatusStamp';
import { db } from '@/db/client';
import { FORM_ORDER } from '@/forms/defs';
import { DOC_STATUS, type DocStatus } from '@/forms/status';
import { date } from '@/lib/format';
import { FORMS, type FormType } from '@/lib/refs';
import { documentList } from '@/server/ops/documents';
import { requireStaff } from '@/server/session';

export const metadata: Metadata = { title: 'Documents' };

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ type?: string; status?: string }> }) {
  const actor = await requireStaff('/portal/documents');
  const sp = await searchParams;
  const type = FORM_ORDER.includes(sp.type as FormType) ? (sp.type as FormType) : undefined;
  const rows = await documentList(db, actor, { type, status: sp.status });
  const filtered = !!(type || sp.status);
  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <span className="label label--brass">Documents</span>
          <h1 className="heading-1">Documents</h1>
          <p className="body muted">Agreements, disclosures and receipts. Start one from a deal or client file and it fills itself in.</p>
        </div>
        <Button href="/portal/documents/new" icon="document">
          New document
        </Button>
      </div>
      <form method="get" className="sold-filters" aria-label="Filter documents">
        <SelectField label="Form" name="type" placeholder="Every form" options={FORM_ORDER.map((t) => ({ value: t, label: FORMS[t].title }))} defaultValue={type ?? ''} />
        <SelectField label="Status" name="status" placeholder="Any status" options={(['draft', 'sent', 'signed'] as const).map((s) => ({ value: s, label: DOC_STATUS[s].l }))} defaultValue={sp.status ?? ''} />
        <div className="row">
          <Button type="submit" size="sm" icon="filter">
            Filter
          </Button>
          {filtered ? (
            <Button variant="ghost" size="sm" href="/portal/documents">
              Clear
            </Button>
          ) : null}
        </div>
      </form>
      <DataTable
        caption="Documents"
        rows={rows}
        rowKey={(r) => r.id}
        empty={<EmptyState icon="document" title={filtered ? 'No documents match' : 'No documents yet'} text={filtered ? 'Try clearing a filter.' : 'Open a deal or client file and choose New document, or start a blank one.'} action={<Button href="/portal/documents/new">New document</Button>} />}
        columns={[
          { key: 't', header: 'Document', cell: (r) => <Link href={`/portal/documents/${r.id}`}>{FORMS[r.formType as FormType].title}</Link> },
          { key: 'n', header: 'Number', cell: (r) => <span className="id">{r.docNo}</span> },
          { key: 'p', header: 'Property', cell: (r) => r.address || '—' },
          { key: 's', header: 'Status', cell: (r) => <StatusPill status={DOC_STATUS[r.status as DocStatus].s} label={DOC_STATUS[r.status as DocStatus].l} /> },
          { key: 'sh', header: 'Client', cell: (r) => (r.shared ? 'Shared' : '—') },
          { key: 'a', header: 'Prepared by', cell: (r) => r.author ?? '—' },
          { key: 'u', header: 'Updated', cell: (r) => date(r.updatedAt) },
        ]}
      />
    </div>
  );
}

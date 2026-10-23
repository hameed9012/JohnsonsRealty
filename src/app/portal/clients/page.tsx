import Link from 'next/link';
import type { Metadata } from 'next';
import { EmptyState } from '@/components/ui/blocks';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/layout';
import { date } from '@/lib/format';
import { clientList } from '@/server/queries/clients';
import { requireStaff } from '@/server/session';

export const metadata: Metadata = { title: 'Clients' };

const ROLE = { buyer: 'Buyer', seller: 'Seller', landlord: 'Landlord', tenant: 'Tenant', business_owner: 'Business owner' } as const;

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string; archived?: string }> }) {
  const actor = await requireStaff('/portal/clients');
  const { q, archived } = await searchParams;
  const rows = await clientList(actor, { q: q?.trim() || undefined, archived: archived === '1' });
  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <span className="label label--brass">Clients</span>
          <h1 className="heading-1">Client files</h1>
        </div>
        <Button href="/portal/clients/new" icon="users">
          New client file
        </Button>
      </div>
      <form method="get" className="row" role="search">
        <label className="sr-only" htmlFor="client-q">
          Name
        </label>
        <input id="client-q" className="jr-field-input" name="q" defaultValue={q} placeholder="Search by name" style={{ maxWidth: 'var(--text-max)' }} />
        <label className="jr-check">
          <input type="checkbox" name="archived" value="1" defaultChecked={archived === '1'} />
          <span>Archived</span>
        </label>
        <button className="jr-btn jr-btn--secondary jr-btn--sm" type="submit">
          Search
        </button>
      </form>
      <DataTable
        caption="Client files"
        rows={rows}
        rowKey={(r) => r.id}
        empty={<EmptyState icon="users" title={q ? 'No client files match' : 'No client files yet'} text="Client files are opened from a listing’s seller step, a deal, or here." action={<Button href="/portal/clients/new">New client file</Button>} />}
        columns={[
          { key: 'name', header: 'Client', cell: (r) => <Link href={`/portal/clients/${r.id}`}>{r.displayName}</Link> },
          { key: 'roles', header: 'Roles', cell: (r) => r.roles.map((x) => ROLE[x]).join(', ') || '—' },
          { key: 'agent', header: 'Agent', cell: (r) => r.agent ?? '—' },
          { key: 'contact', header: 'Contact', cell: (r) => r.bestContact ?? '—' },
          { key: 'counts', header: 'Listings / deals', num: true, cell: (r) => `${r.listings} / ${r.deals}` },
          { key: 'account', header: 'Account', cell: (r) => (r.hasAccount ? 'Yes' : '—') },
          { key: 'updated', header: 'Updated', num: true, cell: (r) => date(r.updatedAt) },
        ]}
      />
    </div>
  );
}

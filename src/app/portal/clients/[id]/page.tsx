import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArchiveClientButton } from '@/components/portal/ArchiveClientButton';
import { Button } from '@/components/ui/Button';
import { ConfidentialPanel } from '@/components/ui/documents';
import { Breadcrumbs, DataSheet, DataTable } from '@/components/ui/layout';
import { LocalTime } from '@/components/ui/LocalTime';
import { StatusPill } from '@/components/ui/StatusStamp';
import { date, money } from '@/lib/format';
import { stagePill } from '@/lib/deal-stage';
import { statusKey, type ListingStatus } from '@/lib/listing-status';
import { FORMS, type FormType } from '@/lib/refs';
import { SHOWING_PILL, type ShowingStatus } from '@/lib/showings';
import { STAGE_WORDS } from '@/server/ops/deals';
import { clientFile } from '@/server/queries/clients';
import { requireStaff } from '@/server/session';

export const metadata: Metadata = { title: 'Client file' };

const ROLE = { buyer: 'Buyer', seller: 'Seller', landlord: 'Landlord', tenant: 'Tenant', business_owner: 'Business owner' } as const;
const KIND = { person: 'A person', couple: 'A couple or co-owners', company: 'A company', estate: 'An estate' } as const;

export default async function ClientFilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireStaff(`/portal/clients/${id}`);
  const f = await clientFile(actor, id);
  if (!f) notFound();
  const c = f.client;
  return (
    <div className="stack-lg">
      <Breadcrumbs items={[{ label: 'Clients', href: '/portal/clients' }, { label: c.displayName }]} />
      <div className="page-head">
        <div>
          <span className="label label--brass">{c.roles.map((r) => ROLE[r]).join(' · ') || 'Client'}</span>
          <h1 className="heading-1">{c.displayName}</h1>
          <p className="body muted">
            {KIND[c.kind]}
            {c.agent?.displayName ? ` · Agent: ${c.agent.displayName}` : ''}
            {c.user ? ` · Has an account (${c.user.displayName})` : ''}
            {c.archived ? ' · Archived' : ''}
          </p>
        </div>
        <div className="row">
          {f.listings.length ? (
            <Button variant="secondary" icon="document" href={`/portal/clients/${id}/seller-file`}>
              Seller file
            </Button>
          ) : null}
          {f.canEdit ? <Button href={`/portal/clients/${id}/edit`}>Edit client file</Button> : null}
          {f.canEdit ? <ArchiveClientButton id={id} archived={c.archived} /> : null}
        </div>
      </div>

      <section className="stack">
        <h2 className="heading-2">Data sheet</h2>
        <DataSheet
          rows={[
            { label: 'Name on forms', value: c.legalNameOnForms },
            { label: 'Best way to reach them', value: c.bestContact },
            { label: 'How they found us', value: c.source },
            { label: 'Living in the property now?', value: c.currentlyOccupying },
            { label: 'Mailing address after the move', value: c.mailingAddressAfter },
            { label: 'Reason', value: c.reason },
            { label: 'Timeline', value: c.timeline },
            { label: 'Who helps them decide', value: c.whoDecides },
            { label: 'Emergency contact', value: c.emergencyContact },
            { label: 'Business address', value: c.businessAddress },
            ...(c.user ? [{ label: 'Roblox (account)', value: c.user.robloxUsername, mono: true }, { label: 'Chirper (account)', value: c.user.chirperHandle ? '@' + c.user.chirperHandle : null, mono: true }] : []),
          ]}
        />
        {c.background ? <p className="body prose">{c.background}</p> : null}
      </section>

      {c.people.length ? (
        <section className="stack">
          <h2 className="heading-2">People</h2>
          {c.people.map((p, i) => (
            <DataSheet
              key={i}
              rows={[
                { label: `Person ${i + 1}`, value: p.legalName },
                { label: 'Goes by', value: p.goesBy },
                { label: 'Age and occupation', value: p.ageOccupation },
                { label: 'Marital status', value: p.maritalStatus },
                { label: 'Role', value: p.roleLabel },
                { label: 'Signs', value: p.signs ? 'Yes' : 'No' },
                { label: 'Discord', value: p.discord, mono: true },
                { label: 'Roblox', value: p.robloxUsername, mono: true },
                { label: 'Chirper', value: p.chirper, mono: true },
              ]}
            />
          ))}
        </section>
      ) : null}

      <ConfidentialPanel
        redacted={!f.seeConf}
        note={f.seeConf ? 'Agents only. Never shown to the client.' : 'You don’t have access to these fields'}
        rows={
          f.seeConf
            ? [
                { label: 'Motivation', value: c.confidential?.motivation || '—' },
                { label: 'Negotiation notes', value: c.confidential?.negotiationNotes || '—' },
                { label: 'Lines to relay', value: c.confidential?.relayLines || '—' },
                { label: 'Commission terms', value: c.confidential?.commissionTerms || '—' },
              ]
            : [{ label: 'Motivation' }, { label: 'Negotiation notes' }, { label: 'Lines to relay' }, { label: 'Commission terms' }]
        }
      />

      <section className="stack">
        <h2 className="heading-2">Listings</h2>
        <DataTable
          caption="Listings"
          rows={f.listings}
          rowKey={(r) => r.id}
          empty={<p className="body-s muted">No listings.</p>}
          columns={[
            { key: 'a', header: 'Property', cell: (r) => <Link href={`/portal/listings/${r.id}`}>{r.addressLine || r.refNo}</Link> },
            { key: 's', header: 'Status', cell: (r) => <StatusPill status={statusKey(r.status as ListingStatus)} /> },
            { key: 'p', header: 'Price', num: true, align: 'right', cell: (r) => (r.price ? money(r.price) + (r.purpose === 'rent' ? '/mo' : '') : '—') },
          ]}
        />
      </section>

      <section className="stack">
        <h2 className="heading-2">Deals</h2>
        <DataTable
          caption="Deals"
          rows={f.deals}
          rowKey={(r) => r.id}
          empty={<p className="body-s muted">No deals.</p>}
          columns={[
            { key: 'a', header: 'Property', cell: (r) => <Link href={`/portal/deals/${r.id}`}>{r.address || 'Deal'}</Link> },
            { key: 'side', header: 'Side', cell: (r) => r.side[0]!.toUpperCase() + r.side.slice(1) },
            { key: 's', header: 'Stage', cell: (r) => <StatusPill status={stagePill(r.stage)} label={STAGE_WORDS[r.stage]} /> },
            { key: 'u', header: 'Updated', num: true, cell: (r) => date(r.updatedAt) },
          ]}
        />
      </section>

      <section className="stack">
        <h2 className="heading-2">Showings</h2>
        <DataTable
          caption="Showings"
          rows={f.showings}
          rowKey={(r) => r.id}
          empty={<p className="body-s muted">No showings.</p>}
          columns={[
            { key: 'r', header: 'Reference', num: true, cell: (r) => r.refNo },
            { key: 'a', header: 'Property', cell: (r) => r.address },
            { key: 'w', header: 'When', cell: (r) => <LocalTime iso={(r.confirmedFor ?? r.at).toISOString()} /> },
            { key: 's', header: 'Status', cell: (r) => <StatusPill status={SHOWING_PILL[r.status as ShowingStatus].status} label={SHOWING_PILL[r.status as ShowingStatus].label} /> },
          ]}
        />
      </section>

      <section className="stack">
        <h2 className="heading-2">Documents</h2>
        <DataTable
          caption="Documents"
          rows={f.documents}
          rowKey={(r) => r.id}
          empty={<p className="body-s muted">No documents.</p>}
          columns={[
            { key: 't', header: 'Document', cell: (r) => <Link href={`/portal/documents/${r.id}`}>{FORMS[r.formType as FormType].title}</Link> },
            { key: 'n', header: 'Number', num: true, cell: (r) => r.docNo },
            { key: 's', header: 'Status', cell: (r) => r.status[0]!.toUpperCase() + r.status.slice(1) },
          ]}
        />
      </section>

      <section className="stack">
        <h2 className="heading-2">Activity</h2>
        {f.activity.length ? (
          <ul className="saved-list">
            {f.activity.map((a) => (
              <li key={a.id}>
                <span className="body-s">
                  {a.summary}
                  {a.actor ? <span className="muted"> · {a.actor}</span> : null}
                </span>
                <LocalTime iso={a.createdAt.toISOString()} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="body-s muted">No activity yet.</p>
        )}
      </section>
    </div>
  );
}

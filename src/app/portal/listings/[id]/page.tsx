import { and, asc, desc, eq } from 'drizzle-orm';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { PropertyView } from '@/components/listing/PropertyView';
import { ListingManage } from '@/components/portal/ListingManage';
import { Button } from '@/components/ui/Button';
import { Breadcrumbs, DataTable } from '@/components/ui/layout';
import { LocalTime } from '@/components/ui/LocalTime';
import { StatusPill } from '@/components/ui/StatusStamp';
import { db } from '@/db/client';
import { clients, deals, listingRevisions, listings, showings } from '@/db/schema';
import { stagePill } from '@/lib/deal-stage';
import { canTransition, isPublic, label, statusKey, type ListingStatus } from '@/lib/listing-status';
import { can } from '@/lib/permissions';
import { SHOWING_PILL, type ShowingStatus } from '@/lib/showings';
import { loadEditor } from '@/server/listings/editor';
import { WIZARD_STATUSES } from '@/server/listings/service';
import { MANUAL_STATUSES } from '@/server/ops/listings';
import { STAGE_WORDS } from '@/server/ops/deals';
import { requireStaff } from '@/server/session';

export const metadata: Metadata = { title: 'Listing' };

export default async function ListingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireStaff(`/portal/listings/${id}`);
  const ed = await loadEditor(actor, id);
  if (!ed) notFound();
  const { data } = ed;
  if (WIZARD_STATUSES.includes(data.status) && data.status !== 'pending_review') redirect(`/portal/listings/${id}/edit`);
  const row = (await db.query.listings.findFirst({ where: eq(listings.id, id) }))!;
  const subject = { source: row.source, status: row.status, listingAgentId: row.listingAgentId, submittedByUserId: row.submittedByUserId };
  const manage = can(actor, 'listing.changeStatus', subject) && !WIZARD_STATUSES.includes(row.status);
  const manager = actor.role === 'owner' || actor.role === 'admin';
  const [listingDeals, listingShowings, revision, clientRows] = await Promise.all([
    db.select().from(deals).where(eq(deals.listingId, id)).orderBy(desc(deals.updatedAt)),
    db.select().from(showings).where(eq(showings.listingId, id)).orderBy(desc(showings.requestedFor)).limit(20),
    db.query.listingRevisions.findFirst({ where: and(eq(listingRevisions.listingId, id), eq(listingRevisions.status, 'pending')) }),
    db
      .select({ id: clients.id, name: clients.displayName })
      .from(clients)
      .where(manager ? eq(clients.archived, false) : and(eq(clients.archived, false), eq(clients.agentId, actor.id)))
      .orderBy(asc(clients.displayName)),
  ]);
  const statusOptions = MANUAL_STATUSES.filter((s) => s !== row.status && canTransition(row.status as ListingStatus, s, row.purpose)).map((s) => ({ value: s, label: label(s) }));

  return (
    <div className="stack-lg">
      <Breadcrumbs items={[{ label: 'Listings', href: '/portal/listings' }, { label: data.preview.title }]} />
      <div className="page-head">
        <div>
          <div className="row">
            <StatusPill status={statusKey(data.status as ListingStatus)} />
            {data.source === 'owner_submitted' ? <StatusPill status="listed-by-owner" /> : null}
            <span className="id muted">{data.refNo}</span>
          </div>
          <h1 className="heading-1">{data.preview.title}</h1>
        </div>
        <div className="row">
          {isPublic(data.status as ListingStatus) ? (
            <Button variant="secondary" href={`/property/${data.preview.slug}`}>
              View public page
            </Button>
          ) : null}
          {data.status === 'pending_review' ? <Button href={`/portal/review/${id}`}>Open review</Button> : null}
          {row.sellerClientId ? (
            <Button variant="ghost" href={`/portal/clients/${row.sellerClientId}/seller-file`} icon="document">
              Seller file
            </Button>
          ) : null}
        </div>
      </div>

      {manage ? (
        <ListingManage
          id={id}
          purpose={row.purpose}
          statusOptions={statusOptions}
          price={String(row.price ?? '')}
          live={{ description: row.description ?? '', showingInstructions: row.showingInstructions ?? '', beds: String(row.beds ?? ''), baths: String(row.baths ?? ''), sqft: String(row.sqft ?? '') }}
          pendingRevision={!!revision}
          reviewNote={null}
          clients={clientRows.map((c) => ({ value: c.id, label: c.name }))}
        />
      ) : null}

      <section className="stack">
        <h2 className="heading-2">Deals</h2>
        <DataTable
          caption="Deals on this listing"
          rows={listingDeals}
          rowKey={(d) => d.id}
          empty={<p className="body-s muted">No deals yet.</p>}
          columns={[
            { key: 'stage', header: 'Stage', cell: (d) => <StatusPill status={stagePill(d.stage)} label={STAGE_WORDS[d.stage]} /> },
            { key: 'open', header: 'Deal', cell: (d) => <Link href={`/portal/deals/${d.id}`}>Open deal</Link> },
            { key: 'offer', header: 'Offer date', num: true, cell: (d) => d.offerDate ?? '—' },
            { key: 'settle', header: 'Settlement', num: true, cell: (d) => d.settlementDate ?? '—' },
          ]}
        />
      </section>

      <section className="stack">
        <h2 className="heading-2">Showings</h2>
        <DataTable
          caption="Showings"
          rows={listingShowings}
          rowKey={(s) => s.id}
          empty={<p className="body-s muted">No showings yet.</p>}
          columns={[
            { key: 'ref', header: 'Reference', num: true, cell: (s) => s.refNo },
            { key: 'when', header: 'When', cell: (s) => <LocalTime iso={(s.confirmedFor ?? s.requestedFor).toISOString()} /> },
            { key: 'status', header: 'Status', cell: (s) => <StatusPill status={SHOWING_PILL[s.status as ShowingStatus].status} label={SHOWING_PILL[s.status as ShowingStatus].label} /> },
          ]}
        />
        <div>
          <Button variant="ghost" size="sm" href="/portal/showings">
            Showings calendar
          </Button>
        </div>
      </section>

      <section className="stack">
        <h2 className="heading-2">Public page</h2>
        <div data-theme="light" className="preview-frame">
          <PropertyView view={data.preview} preview headingLevel={2} />
        </div>
      </section>
    </div>
  );
}

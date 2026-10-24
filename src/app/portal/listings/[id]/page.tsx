import { and, asc, desc, eq, gte } from 'drizzle-orm';
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
import { clients, deals, listingRevisions, listings, openHouses, showings } from '@/db/schema';
import { stagePill } from '@/lib/deal-stage';
import { canTransition, isPublic, label, statusKey, type ListingStatus } from '@/lib/listing-status';
import { can } from '@/lib/permissions';
import { SHOWING_PILL, type ShowingStatus } from '@/lib/showings';
import { loadEditor } from '@/server/listings/editor';
import { WIZARD_STATUSES } from '@/server/listings/service';
import { MANUAL_STATUSES } from '@/server/ops/listings';
import { STAGE_WORDS } from '@/server/ops/deals';
import { requireStaff } from '@/server/session';
import { MapPinPicker } from '@/components/portal/MapPinPicker';
import { CancelOpenHouseButton, OpenHouseForm, PostToDiscordButton } from '@/components/portal/DiscordControls';
import { HeldPhotos } from '@/components/portal/HeldPhotos';
import { publicImageUrl } from '@/lib/storage';
import { mediaSrc } from '@/server/queries/media';
import { getSettings } from '@/server/settings';

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
  const settings = await getSettings();
  const [upcomingOpenHouses, mapSrc, listingDeals, listingShowings, revision, clientRows] = await Promise.all([
    db.select().from(openHouses).where(and(eq(openHouses.listingId, id), eq(openHouses.cancelled, false), gte(openHouses.endsAt, new Date()))).orderBy(asc(openHouses.startsAt)),
    mediaSrc(settings.mapMediaId),
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
          <Button variant="ghost" href={`/portal/studio?listing=${id}`} icon="image">
            Marketing
          </Button>
          {manager && isPublic(data.status as ListingStatus) ? <PostToDiscordButton listingId={id} posted={!!row.discordMessageId} /> : null}
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

      {row.photosHold ? (
        <section className="panel stack" aria-labelledby="hold-h">
          <div className="row">
            <StatusPill status="pending-review" label="Needs photos" />
          </div>
          <h2 id="hold-h" className="heading-2">
            Add photos to put it on the site
          </h2>
          <p className="body-s muted">This listing was imported and is approved, but it stays off the public site until it has at least 3 in-game photos, each with a short description.</p>
          {manage ? <HeldPhotos listingId={id} initial={data.photos} /> : null}
        </section>
      ) : null}

      {manage && isPublic(row.status as ListingStatus) ? (
        <section className="stack" aria-labelledby="oh-h">
          <h2 id="oh-h" className="heading-2">
            Open houses
          </h2>
          {upcomingOpenHouses.length ? (
            <ul className="saved-list">
              {upcomingOpenHouses.map((o) => (
                <li key={o.id}>
                  <span className="stack">
                    <LocalTime iso={o.startsAt.toISOString()} />
                    {o.notes ? <span className="body-s muted">{o.notes}</span> : null}
                  </span>
                  <CancelOpenHouseButton id={o.id} />
                </li>
              ))}
            </ul>
          ) : null}
          <div className="panel">
            <OpenHouseForm listingId={id} />
          </div>
        </section>
      ) : null}

      {mapSrc && manage && can(actor, 'listing.placePin') ? (
        <section className="stack" aria-labelledby="pin-h">
          <h2 id="pin-h" className="heading-2">
            Map pin
          </h2>
          <MapPinPicker id={id} src={publicImageUrl(mapSrc, { width: 1600 })} initial={row.mapX !== null && row.mapY !== null ? { x: row.mapX, y: row.mapY } : null} title={data.preview.title} />
        </section>
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

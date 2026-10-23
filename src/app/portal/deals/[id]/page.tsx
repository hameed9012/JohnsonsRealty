import { asc, desc, eq } from 'drizzle-orm';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MessageThread } from '@/components/deal/MessageThread';
import { DealDetailsForm, OfferForm, RecordSaleForm } from '@/components/portal/DealControls';
import { DealStageControl } from '@/components/portal/DealStageControl';
import { Button } from '@/components/ui/Button';
import { ConfidentialPanel } from '@/components/ui/documents';
import { Breadcrumbs, DataTable, Timeline } from '@/components/ui/layout';
import { StatusPill } from '@/components/ui/StatusStamp';
import { db } from '@/db/client';
import { clients, dealConfidential, dealParties, sales } from '@/db/schema';
import { date, money, saleNo } from '@/lib/format';
import { dealTimeline, stagePill } from '@/lib/deal-stage';
import { can } from '@/lib/permissions';
import { STAGE_WORDS } from '@/server/ops/deals';
import { dealForViewer, markThreadRead } from '@/server/queries/deals';
import { staffOptions } from '@/server/queries/review';
import { requireStaff } from '@/server/session';

export const metadata: Metadata = { title: 'Deal' };

export default async function PortalDeal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireStaff(`/portal/deals/${id}`);
  const d = await dealForViewer(actor, id);
  if (!d) notFound();
  const { deal } = d;
  const manage = can(actor, 'deal.manage', { agentId: deal.agentId });
  const seeConf = can(actor, 'deal.viewConfidential', { agentId: deal.agentId });
  const [parties, conf, sale, agents] = await Promise.all([
    db.select({ id: clients.id, name: clients.displayName, side: dealParties.side }).from(dealParties).innerJoin(clients, eq(clients.id, dealParties.clientId)).where(eq(dealParties.dealId, id)).orderBy(asc(dealParties.side)),
    seeConf ? db.query.dealConfidential.findFirst({ where: eq(dealConfidential.dealId, id) }) : Promise.resolve(undefined),
    db.query.sales.findFirst({ where: eq(sales.dealId, id), orderBy: [desc(sales.saleNo)] }),
    staffOptions(),
  ]);
  await markThreadRead(id, actor.id);
  const rent = d.listing?.purpose === 'rent';
  const open = deal.stage !== 'closed' && deal.stage !== 'fallen_through';
  const agentOpts = agents.map((a) => ({ value: a.id, label: a.name ?? 'Agent' }));

  return (
    <div className="stack-lg">
      <Breadcrumbs items={[{ label: 'Deals', href: '/portal/deals' }, { label: d.listing?.title ?? 'Deal' }]} />
      <div className="page-head">
        <div>
          <div className="row">
            <StatusPill status={stagePill(deal.stage)} label={STAGE_WORDS[deal.stage]} />
            {!deal.sharedWithClient ? <StatusPill status="off-market" label="Hidden from client" /> : null}
            {sale ? <span className="id">{saleNo(sale.saleNo)}</span> : null}
          </div>
          <h1 className="heading-1">{d.listing?.title ?? 'Deal'}</h1>
          <p className="body muted">{parties.map((p) => `${p.side[0]!.toUpperCase() + p.side.slice(1)}: ${p.name}`).join(' · ')}</p>
        </div>
        <div className="row">
          {manage && open ? <DealStageControl id={id} stage={deal.stage} /> : null}
          {d.listing ? (
            <Button variant="ghost" href={`/portal/listings/${d.listing.id}`}>
              Listing
            </Button>
          ) : null}
        </div>
      </div>

      {deal.stage !== 'fallen_through' ? <Timeline label="Deal progress" steps={dealTimeline(deal.stage)} /> : <p className="review-note body">This deal fell through.</p>}

      <div className="split">
        <div className="stack-lg">
          <section className="panel stack">
            <h2 className="panel-title">Dates and sharing</h2>
            {manage ? (
              <DealDetailsForm
                id={id}
                values={{ offerDate: deal.offerDate ?? '', acceptedDate: deal.acceptedDate ?? '', inspectionDeadline: deal.inspectionDeadline ?? '', financingDeadline: deal.financingDeadline ?? '', settlementDate: deal.settlementDate ?? '', notes: deal.notes ?? '', sharedWithClient: deal.sharedWithClient }}
              />
            ) : (
              <p className="body-s muted">Only the deal’s agent and the Owner can change it.</p>
            )}
          </section>

          <ConfidentialPanel
            title="Offers"
            note={seeConf ? 'Agents only. Never shown to the client.' : 'You don’t have access to these fields'}
            redacted={!seeConf}
            rows={
              seeConf
                ? conf?.offers.length
                  ? conf.offers.map((o) => ({ label: `${date(o.on)} · ${o.by === 'buyer' ? 'Buyer' : 'Seller'}`, value: `${money(o.amount)}${o.note ? ' · ' + o.note : ''}`, mono: true }))
                  : [{ label: 'Offers', value: 'None logged yet' }]
                : [{ label: 'Latest offer' }, { label: 'Counter' }]
            }
          />
          {seeConf && manage && open ? (
            <section className="panel stack">
              <h2 className="heading-3">Log an offer</h2>
              <OfferForm id={id} />
            </section>
          ) : null}

          {manage && open ? (
            <section className="panel stack" id="record-sale">
              <h2 className="panel-title">{rent ? 'Record the lease' : 'Record the sale'}</h2>
              <RecordSaleForm id={id} rent={rent} price={String(d.listing?.price ?? '')} agents={agentOpts} dealAgentId={deal.agentId} />
            </section>
          ) : null}
          {sale ? (
            <p className="body">
              Recorded as <span className="id">{saleNo(sale.saleNo)}</span> on {date(sale.soldOn)} for {money(sale.price)}
              {rent ? '/mo' : ''}. <Link href="/portal/sales">Sales ledger</Link>
            </p>
          ) : null}
        </div>

        <div className="stack-lg">
          <section className="panel stack">
            <h2 className="panel-title">Messages with the client</h2>
            {deal.sharedWithClient ? null : <p className="body-s muted">The client can’t see this deal yet, so they won’t see messages until you share it.</p>}
            <MessageThread dealId={id} meId={actor.id} messages={d.messages.map((m) => ({ id: m.id, body: m.body, createdAt: m.createdAt.toISOString(), authorId: m.authorId, author: m.author, staff: !!m.role && m.role !== 'client' }))} />
          </section>
          <section className="panel stack">
            <h2 className="panel-title">Documents</h2>
            <DataTable
              caption="Documents"
              rows={d.documents}
              rowKey={(x) => x.id}
              empty={<p className="body-s muted">No documents yet.</p>}
              columns={[
                { key: 't', header: 'Document', cell: (x) => <Link href={`/portal/documents/${x.id}`}>{x.title}</Link> },
                { key: 'n', header: 'Number', num: true, cell: (x) => x.docNo },
                { key: 's', header: 'Status', cell: (x) => x.status[0]!.toUpperCase() + x.status.slice(1) },
              ]}
            />
            <div>
              <Button size="sm" variant="secondary" icon="document" href={`/portal/documents/new?deal=${id}`}>
                New document
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

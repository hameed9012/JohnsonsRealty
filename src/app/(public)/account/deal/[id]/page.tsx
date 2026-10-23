import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CardGrid } from '@/components/listing/CardGrid';
import { MessageThread } from '@/components/deal/MessageThread';
import { AgentCard } from '@/components/ui/AgentCard';
import { EmptyState } from '@/components/ui/blocks';
import { Breadcrumbs, ClientPanel, DataSheet, Timeline, VisibilityLabel } from '@/components/ui/layout';
import { StatusPill } from '@/components/ui/StatusStamp';
import { date } from '@/lib/format';
import { dealTimeline, stagePill } from '@/lib/deal-stage';
import { dealForViewer, markThreadRead, STAGE_LABEL } from '@/server/queries/deals';
import { requireActor } from '@/server/session';

export const metadata: Metadata = { title: 'My deal', robots: { index: false } };

const SIDE = { buyer: 'You’re buying', seller: 'You’re selling', tenant: 'You’re renting', landlord: 'You’re letting' } as const;
const DOC_STATUS = { draft: { s: 'draft', l: 'Draft' }, sent: { s: 'pending-review', l: 'Waiting for signatures' }, signed: { s: 'settled', l: 'Signed' } } as const;

export default async function MyDealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor(`/account/deal/${id}`);
  const d = await dealForViewer(actor, id);
  if (!d) notFound();
  await markThreadRead(id, actor.id);
  const { deal } = d;
  const title = d.listing?.title ?? 'Your deal';
  return (
    <div className="stack-lg">
      <Breadcrumbs items={[{ label: 'My deal', href: '/account/deal' }, { label: title }]} />
      <div className="page-head">
        <div>
          <div className="row">
            <StatusPill status={stagePill(deal.stage)} label={STAGE_LABEL[deal.stage]} />
            <VisibilityLabel />
          </div>
          <h1 className="heading-1">{title}</h1>
          {d.side ? <p className="body muted">{SIDE[d.side]}</p> : null}
        </div>
      </div>

      <ClientPanel title="Where your deal stands">
        <div className="stack-lg">
          {deal.stage === 'fallen_through' ? (
            <p className="body">This deal didn’t go ahead. Your agent can tell you what happens next.</p>
          ) : (
            <Timeline
              label="Deal progress"
              steps={dealTimeline(deal.stage, {
                under_offer: deal.offerDate ? date(deal.offerDate) : null,
                under_contract: deal.acceptedDate ? date(deal.acceptedDate) : null,
                settlement: deal.settlementDate ? date(deal.settlementDate) : null,
                closed: deal.closedAt ? date(deal.closedAt) : null,
              })}
            />
          )}
          <DataSheet
            rows={[
              { label: 'Offer made', value: deal.offerDate ? date(deal.offerDate) : null, mono: true },
              { label: 'Offer accepted', value: deal.acceptedDate ? date(deal.acceptedDate) : null, mono: true },
              { label: 'Inspection deadline', value: deal.inspectionDeadline ? date(deal.inspectionDeadline) : null, mono: true },
              { label: 'Financing deadline', value: deal.financingDeadline ? date(deal.financingDeadline) : null, mono: true },
              { label: 'Settlement', value: deal.settlementDate ? date(deal.settlementDate) : null, mono: true },
            ]}
          />
        </div>
      </ClientPanel>

      <div className="split">
        <ClientPanel title="Messages with your agent">
          <MessageThread
            dealId={deal.id}
            meId={actor.id}
            messages={d.messages.map((m) => ({ id: m.id, body: m.body, createdAt: m.createdAt.toISOString(), authorId: m.authorId, author: m.author, staff: !!m.role && m.role !== 'client' }))}
          />
        </ClientPanel>
        <div className="stack-lg">
          {d.agent ? (
            <AgentCard name={d.agent.name} title={d.agent.title ?? undefined} handle={d.agent.chirper ?? undefined} photo={d.agent.photo ?? undefined} href={`/agents/${d.agent.slug}`} actionLabel="View profile" />
          ) : null}
          <ClientPanel title="Documents">
            {d.documents.length ? (
              <ul className="saved-list">
                {d.documents.map((doc) => {
                  const st = DOC_STATUS[doc.status];
                  return (
                    <li key={doc.id}>
                      <div className="stack">
                        <b className="ui">{doc.title}</b>
                        <span className="id muted">
                          Form {doc.formNo} · {doc.docNo}
                        </span>
                      </div>
                      <StatusPill status={st.s} label={st.l} />
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState icon="document" title="No documents yet" text="Your agent shares agreements and receipts here as they’re prepared." />
            )}
          </ClientPanel>
        </div>
      </div>

      {d.listing ? (
        <section className="stack">
          <h2 className="heading-2">The property</h2>
          <div style={{ maxWidth: '420px' }}>
            <CardGrid cards={[d.listing]} returnTo={`/account/deal/${deal.id}`} />
          </div>
        </section>
      ) : null}
    </div>
  );
}

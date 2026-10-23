import { desc, eq } from 'drizzle-orm';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SellerSheet } from '@/components/listing/SellerSheet';
import { PrintButton } from '@/components/portal/PrintButton';
import { DocumentHeader } from '@/components/ui/documents';
import { Breadcrumbs } from '@/components/ui/layout';
import { db } from '@/db/client';
import { clients, listings } from '@/db/schema';
import { docDate, money } from '@/lib/format';
import { can } from '@/lib/permissions';
import { loadBundle } from '@/server/listings/bundle';
import { publicTitle } from '@/server/listings/present';
import { requireStaff } from '@/server/session';
import { getSettings } from '@/server/settings';

export const metadata: Metadata = { title: 'Seller file' };

/**
 * The seller file, generated from the database on every view (never stored as text), so edits to the client
 * or the listing show up here at once. Matches the depth of the brokerage's previous seller files.
 */
export default async function SellerFilePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ listing?: string }> }) {
  const { id } = await params;
  const { listing: pick } = await searchParams;
  const actor = await requireStaff(`/portal/clients/${id}/seller-file`);
  const c = await db.query.clients.findFirst({ where: eq(clients.id, id) });
  if (!c || !can(actor, 'client.view', { agentId: c.agentId, userId: c.userId })) notFound();
  const all = await db.select({ id: listings.id, addressLine: listings.addressLine, refNo: listings.refNo }).from(listings).where(eq(listings.sellerClientId, id)).orderBy(desc(listings.updatedAt));
  if (!all.length) notFound();
  const chosen = all.find((l) => l.id === pick) ?? all[0]!;
  const seeConf = can(actor, 'client.viewConfidential', { agentId: c.agentId, userId: c.userId });
  const b = (await loadBundle(db, chosen.id, { confidential: seeConf }))!;
  const settings = await getSettings();
  const conf = seeConf ? ((b as typeof b & { confidential?: Parameters<typeof SellerSheet>[0]['confidential'] }).confidential ?? null) : undefined;
  const clientConf = seeConf ? ((b.seller as (typeof b.seller & { confidential?: Parameters<typeof SellerSheet>[0]['clientConfidential'] }) | null)?.confidential ?? null) : undefined;
  const rent = b.purpose === 'rent';
  const glance = [
    { label: rent ? 'Landlord' : 'Seller', value: c.displayName },
    { label: rent ? 'Letting' : 'Selling', value: `${publicTitle(b)}${b.beds !== null ? ` (${b.beds} bed, ${b.baths} bath)` : ''}` },
    { label: rent ? 'Rent' : 'Asking', value: b.price ? money(b.price) + (rent ? '/month' : '') : '—' },
    { label: rent ? 'Lowest rent' : 'Lowest they’ll take', value: seeConf ? (conf?.bottomLine ? money(conf.bottomLine) : '—') : null },
    { label: 'Timeline', value: c.timeline ?? b.terms?.targetSettlement ?? '—' },
  ];

  return (
    <div className="stack-lg">
      <div className="no-print stack">
        <Breadcrumbs items={[{ label: 'Clients', href: '/portal/clients' }, { label: c.displayName, href: `/portal/clients/${id}` }, { label: 'Seller file' }]} />
        <div className="row">
          <PrintButton />
          {all.length > 1
            ? all.map((l) => (
                <Link key={l.id} href={`?listing=${l.id}`} className="body-s" aria-current={l.id === chosen.id ? 'true' : undefined}>
                  {l.addressLine || l.refNo}
                </Link>
              ))
            : null}
        </div>
      </div>
      <article className="paper-sheet" data-theme="light">
        <DocumentHeader
          title={rent ? 'Landlord file' : 'Seller file'}
          subtitle={`${c.legalNameOnForms ?? c.displayName} · ${publicTitle(b)}`}
          formNo={`${b.refNo} · Prepared ${docDate(new Date())}`}
          contact={[...(settings.officeLocation ? [{ label: 'Office', value: settings.officeLocation }] : []), ...(settings.chirperHandle ? [{ label: 'Chirper', value: '@' + settings.chirperHandle }] : [])]}
        />
        <div className="paper-body stack-lg">
          <section className="stack">
            <h2 className="sheet-bar">At a glance</h2>
            <dl className="glance">
              {glance.map((g) => (
                <div key={g.label}>
                  <dt>{g.label}</dt>
                  <dd>{g.value === null ? <span className="jr-redact" role="img" aria-label="Hidden" /> : g.value}</dd>
                </div>
              ))}
            </dl>
          </section>
          <SellerSheet b={b} confidential={conf} clientConfidential={clientConf} />
        </div>
        <footer className="paper-foot id">
          {settings.brokerageName} · {settings.brokerageSubline} · {b.refNo} · Confidential: for brokerage use only
        </footer>
      </article>
    </div>
  );
}

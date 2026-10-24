import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { inArray, sql } from 'drizzle-orm';
import { ImportRunner } from '@/components/portal/ImportRunner';
import { Breadcrumbs } from '@/components/ui/layout';
import { db } from '@/db/client';
import { clients, listings } from '@/db/schema';
import { legacyKey } from '@/import/legacy/apply';
import { FORMS_FILE, loadPlan, SELLER_FILES } from '@/import/legacy/source';
import { money } from '@/lib/format';
import { can } from '@/lib/permissions';
import { requireStaff } from '@/server/session';

export const metadata: Metadata = { title: 'Import seller files' };
// Uploading the 6012 Estate Drive photos takes a while.
export const maxDuration = 300;

const STATUS = { active: 'Active', for_lease: 'For lease', sold: 'Sold' } as const;

export default async function ImportPage() {
  const actor = await requireStaff('/portal/settings/import');
  if (!can(actor, 'settings.manage')) notFound();
  const plan = await loadPlan();
  const done = await db
    .select({ key: clients.legacyKey, id: clients.id })
    .from(clients)
    .where(inArray(clients.legacyKey, plan.clients.map((c) => legacyKey(c.key))));
  const imported = new Map(done.map((d) => [d.key!.replace(/^legacy:/, ''), d.id]));
  const made = imported.size
    ? await db
        .select({ id: listings.id, seller: listings.sellerClientId, photos: sql<number>`(select count(*)::int from listing_photos p where p.listing_id = "listings"."id")` })
        .from(listings)
        .where(inArray(listings.sellerClientId, [...imported.values()]))
    : [];
  const madeOf = (key: string) => made.find((m) => m.seller === imported.get(key));
  const listingOf = (key: string) => madeOf(key)?.id;
  // A listing imported while photo uploads were failing: Import again adds its photos.
  const missingPhotos = (key: string) => !!plan.listings.find((l) => l.key === key)?.photosDir && madeOf(key)?.photos === 0;
  const retryPhotos = plan.listings.some((l) => missingPhotos(l.key));
  const sold = plan.listings.find((l) => l.sale);
  const remaining = plan.clients.filter((c) => !imported.has(c.key)).length;

  return (
    <div className="stack-lg">
      <Breadcrumbs items={[{ label: 'Site settings', href: '/portal/settings' }, { label: 'Import seller files' }]} />
      <div className="page-head">
        <div>
          <span className="label label--brass">Owner</span>
          <h1 className="heading-1">Import seller files</h1>
          <p className="body muted">
            Reads <code className="id">{SELLER_FILES}</code> and <code className="id">{FORMS_FILE}</code>. Check what will be created, then import. Sellers already imported are skipped, so running it again changes nothing.
          </p>
        </div>
      </div>

      <section className="panel stack" aria-labelledby="imp-listings">
        <h2 className="panel-title" id="imp-listings">
          Listings ({plan.listings.length})
        </h2>
        <div className="dt-wrap">
          <table className="dt">
            <caption className="sr-only">Listings to import</caption>
            <thead>
              <tr>
                <th scope="col">Seller</th>
                <th scope="col">Address</th>
                <th scope="col">Postal</th>
                <th scope="col">Status</th>
                <th scope="col" className="right">
                  Price
                </th>
                <th scope="col">Photos</th>
                <th scope="col">Imported</th>
              </tr>
            </thead>
            <tbody>
              {plan.listings.map((l) => {
                const c = plan.clients.find((x) => x.key === l.key)!;
                const id = listingOf(l.key);
                return (
                  <tr key={l.key}>
                    <td data-label="Seller">{c.displayName}</td>
                    <td data-label="Address">{l.addressLine || <span className="muted">Not in the file</span>}</td>
                    <td data-label="Postal">{l.postal ?? <span className="muted">None</span>}</td>
                    <td data-label="Status">{STATUS[l.status]}</td>
                    <td data-label="Price" className="num right">
                      {money(l.price)}
                      {l.purpose === 'rent' ? '/month' : ''}
                      {l.terms?.furnishedPrice ? (
                        <span className="body-s muted" style={{ display: 'block' }}>
                          {money(l.terms.furnishedPrice as number)} furnished
                        </span>
                      ) : null}
                    </td>
                    <td data-label="Photos">{missingPhotos(l.key) ? 'Missing: import again' : l.photosDir ? 'From the kit' : l.sale ? 'Not needed' : 'Needs photos'}</td>
                    <td data-label="Imported">{id ? <Link href={`/portal/listings/${id}`}>Open</Link> : imported.has(l.key) ? 'Yes' : 'Not yet'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel stack" aria-labelledby="imp-clients">
        <h2 className="panel-title" id="imp-clients">
          Client files ({plan.clients.length})
        </h2>
        <ul className="stack">
          {plan.clients.map((c) => (
            <li key={c.key} className="body">
              {imported.has(c.key) ? <Link href={`/portal/clients/${imported.get(c.key)}`}>{c.displayName}</Link> : c.displayName}
              {c.legalNameOnForms && c.legalNameOnForms !== c.displayName ? <span className="muted"> · {c.legalNameOnForms}</span> : null}
              {c.tags.map((t) => (
                <span key={t} className="label" style={{ marginInlineStart: 'var(--space-2)' }}>
                  {t}
                </span>
              ))}
            </li>
          ))}
        </ul>
      </section>

      {plan.flags.length ? (
        <section className="panel stack" aria-labelledby="imp-flags">
          <h2 className="panel-title" id="imp-flags">
            Check before importing
          </h2>
          <ul className="stack">
            {plan.flags.map((f, i) => (
              <li key={i} className="body">
                <strong>{plan.clients.find((c) => c.key === f.key)?.displayName ?? f.key}:</strong> {f.message}
              </li>
            ))}
          </ul>
          <p className="body-s muted">Anything missing can be filled in on the listing after the import.</p>
        </section>
      ) : null}

      <ImportRunner remaining={remaining} retryPhotos={retryPhotos} sale={sold && !imported.has(sold.key) ? { label: plan.clients.find((c) => c.key === sold.key)!.displayName, price: sold.sale!.price, soldOn: sold.sale!.soldOn } : null} />
    </div>
  );
}

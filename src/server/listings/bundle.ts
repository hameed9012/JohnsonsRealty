import 'server-only';
import { desc, eq } from 'drizzle-orm';
import type { Executor } from '@/db/client';
import { listingReviews, listings } from '@/db/schema';
import type { ChecklistInput } from '@/lib/listing-checklist';

/** Everything about one listing. Confidential parts are only loaded when asked for. */
export async function loadBundle(ex: Executor, id: string, opts: { confidential: boolean }) {
  const l = await ex.query.listings.findFirst({
    where: eq(listings.id, id),
    with: {
      area: { with: { parent: true } },
      agent: { columns: { id: true, displayName: true, name: true, chirperHandle: true, robloxUsername: true }, with: { agentProfile: { with: { photo: true } } } },
      submitter: { columns: { id: true, displayName: true, name: true, robloxUsername: true, chirperHandle: true, discordId: true, role: true } },
      seller: { with: { people: { orderBy: (p, { asc }) => [asc(p.sortOrder)] }, ...(opts.confidential ? { confidential: true } : {}) } },
      photos: { with: { media: true }, orderBy: (p, { asc }) => [asc(p.sortOrder)] },
      features: { with: { feature: true } },
      details: true,
      ownership: true,
      terms: true,
      lease: true,
      business: true,
      disclosures: true,
      priceHistory: { orderBy: (p, { desc }) => [desc(p.on)] },
      ...(opts.confidential ? { confidential: true } : {}),
    },
  });
  if (!l) return null;
  const reviews = await ex.query.listingReviews.findMany({
    where: eq(listingReviews.listingId, id),
    orderBy: [desc(listingReviews.round)],
    with: { reviewer: { columns: { displayName: true, name: true } }, submitter: { columns: { displayName: true, name: true } } },
  });
  return { ...l, reviews };
}

export type ListingBundle = NonNullable<Awaited<ReturnType<typeof loadBundle>>>;

export function checklistInput(b: ListingBundle): ChecklistInput {
  return {
    source: b.source,
    type: b.type,
    purpose: b.purpose,
    addressLine: b.addressLine,
    areaId: b.areaId,
    price: b.price,
    beds: b.beds,
    baths: b.baths,
    description: b.description,
    availableFrom: b.availableFrom,
    sellerClientId: b.sellerClientId,
    photos: b.photos.map((p) => ({ alt: p.alt })),
    lease: b.lease ? { leaseLengthMonths: b.lease.leaseLengthMonths, deposit: b.lease.deposit } : null,
    business: b.business ? { businessName: b.business.businessName, nameWithheld: b.business.nameWithheld, teaser: b.business.teaser } : null,
  };
}

type Flat = Record<string, string>;

function flatten(prefix: string, v: unknown, out: Flat) {
  if (v === null || v === undefined || v === '') return;
  if (Array.isArray(v)) {
    v.forEach((x, i) => flatten(`${prefix}[${i + 1}]`, x, out));
    return;
  }
  if (typeof v === 'object' && !(v instanceof Date)) {
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) flatten(prefix ? `${prefix}.${k}` : k, x, out);
    return;
  }
  out[prefix] = v instanceof Date ? v.toISOString().slice(0, 10) : String(v);
}

const SKIP = new Set(['id', 'listingId', 'clientId', 'mediaId', 'createdAt', 'updatedAt', 'round', 'status', 'refNo', 'slug', 'submittedByUserId']);

/**
 * The submission as reviewed, for diffing between rounds. Never includes confidential tables,
 * since review snapshots are readable by the submitter's side too.
 */
export function snapshotOf(b: ListingBundle): Flat {
  const strip = (o: Record<string, unknown> | null | undefined) =>
    o ? Object.fromEntries(Object.entries(o).filter(([k]) => !SKIP.has(k))) : null;
  const out: Flat = {};
  flatten(
    '',
    {
      listing: strip({
        type: b.type,
        purpose: b.purpose,
        addressLine: b.addressLine,
        unit: b.unit,
        area: b.area?.name,
        postalCode: b.postalCode,
        parcelId: b.parcelId,
        price: b.price,
        beds: b.beds,
        baths: b.baths,
        sqft: b.sqft,
        lot: b.lot,
        yearBuilt: b.yearBuilt,
        garage: b.garage,
        description: b.description,
        availableFrom: b.availableFrom,
        showingInstructions: b.showingInstructions,
      }),
      features: b.features.map((f) => f.feature.label).sort(),
      photos: b.photos.map((p) => `${p.isCover ? '(cover) ' : ''}${p.alt || 'no description'}${p.caption ? ' — ' + p.caption : ''}`),
      details: strip(b.details),
      ownership: strip(b.ownership),
      terms: strip(b.terms),
      lease: strip(b.lease),
      business: strip(b.business),
      disclosures: b.disclosures
        .filter((d) => d.answer || d.detail)
        .sort((x, y) => x.item.localeCompare(y.item))
        .map((d) => `${d.item}: ${d.answer ?? '—'}${d.detail ? ' (' + d.detail + ')' : ''}`),
      seller: b.seller ? { name: b.seller.displayName, onForms: b.seller.legalNameOnForms, people: b.seller.people.map((p) => p.legalName) } : null,
    },
    out,
  );
  return out;
}

export interface DiffRow {
  key: string;
  before: string | null;
  after: string | null;
}

export function diffSnapshots(before: Flat | null | undefined, after: Flat): DiffRow[] {
  if (!before) return [];
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  return keys.filter((k) => before[k] !== after[k]).map((k) => ({ key: k, before: before[k] ?? null, after: after[k] ?? null }));
}


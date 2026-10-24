// Saves a LegacyPlan. Idempotent: each seller's client file carries legacy_key "legacy:{key}", and a seller
// whose file already exists is skipped whole, so running the import twice changes nothing.
// One transaction per seller, so a failure never leaves half a seller behind.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import type { DB, Executor } from '@/db/client';
import {
  activityLog,
  areas,
  clientConfidential,
  clientPeople,
  clients,
  listingBusiness,
  listingConfidential,
  listingDisclosures,
  listingLeaseTerms,
  listingOwnership,
  listingPhotos,
  listingPropertyDetails,
  listings,
  listingTerms,
  media,
  postalZones,
  priceHistory,
  saleAgents,
  sales,
} from '@/db/schema';
import { nextRef, nextSaleNo } from '@/lib/refs';
import { listingSlug } from '@/lib/slug';
import type { ClientPlan, LegacyPlan, ListingPlan } from './map';

export const IMPORT_SUMMARY = 'Imported from legacy seller files';

export type Upload = (file: Buffer, type: string) => Promise<{ storageId: string; width: number; height: number; bytes?: number; format?: string }>;

export interface ApplyOptions {
  actorId: string | null;
  /** The Owner's sale price and date for the sold listing (the preview's inputs). */
  sale?: { price: number; soldOn: string };
  upload?: Upload;
  root?: string;
  now?: Date;
}

export interface ApplyReport {
  created: { key: string; client: string; listing?: string; refNo?: string; saleNo?: number; photos?: number }[];
  skipped: string[];
}

export const legacyKey = (key: string) => `legacy:${key}`;

async function log(ex: Executor, actorId: string | null, action: string, entity: string, entityId: string, what: string) {
  await ex.insert(activityLog).values({ actorId, action, entity, entityId, summary: `${IMPORT_SUMMARY}: ${what}` });
}

async function createClient(ex: Executor, c: ClientPlan, actorId: string | null): Promise<string> {
  const [row] = await ex
    .insert(clients)
    .values({
      kind: c.kind,
      displayName: c.displayName,
      legalNameOnForms: c.legalNameOnForms,
      roles: c.roles,
      agentId: actorId,
      source: 'Legacy seller files',
      bestContact: c.bestContact,
      emergencyContact: c.emergencyContact,
      businessAddress: c.businessAddress,
      currentlyOccupying: c.currentlyOccupying,
      mailingAddressAfter: c.mailingAddressAfter,
      reason: c.reason,
      timeline: c.timeline,
      whoDecides: c.whoDecides,
      background: c.background,
      notes: c.notes,
      legacyKey: legacyKey(c.key),
      tags: c.tags,
      createdBy: actorId,
    })
    .returning({ id: clients.id });
  const id = row!.id;
  if (c.people.length) await ex.insert(clientPeople).values(c.people.map((p, i) => ({ ...p, clientId: id, sortOrder: i })));
  await ex.insert(clientConfidential).values({ clientId: id, ...c.confidential });
  await log(ex, actorId, 'client.create', 'client', id, c.displayName);
  return id;
}

const MIME: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

/** "03-kitchen.jpg" → "Kitchen"; "11-bedroom-3-twin.jpg" → "Bedroom 3 twin". */
export function altFromFilename(name: string): string {
  const words = path.basename(name, path.extname(name)).replace(/^\d+[-_]?/, '').replace(/[-_]+/g, ' ').trim();
  return words ? words[0]!.toUpperCase() + words.slice(1) : 'Photo';
}

export async function photoFiles(dir: string): Promise<string[]> {
  const names = await readdir(dir).catch(() => [] as string[]);
  return names.filter((n) => MIME[path.extname(n).toLowerCase()]).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
}

async function createListing(ex: Executor, l: ListingPlan, clientId: string, opts: ApplyOptions, address: string) {
  const now = opts.now ?? new Date();
  const zone = l.postal ? await ex.query.postalZones.findFirst({ where: eq(postalZones.code, l.postal) }) : undefined;
  const area = zone?.areaId ? await ex.query.areas.findFirst({ where: eq(areas.id, zone.areaId) }) : undefined;
  const refNo = await nextRef(ex, now);
  const published = l.listedOn ? new Date(`${l.listedOn}T12:00:00Z`) : now;
  const files = l.photosDir ? await photoFiles(path.join(opts.root ?? process.cwd(), l.photosDir)) : [];
  if (files.length && !opts.upload) throw new Error(`Photo uploads aren’t set up, so ${address}'s photos can’t be imported.`);

  const [row] = await ex
    .insert(listings)
    .values({
      refNo,
      slug: listingSlug(l.addressLine || null, area?.name ?? null, refNo),
      type: l.type,
      purpose: l.purpose,
      source: 'agent',
      status: l.status,
      addressLine: l.addressLine,
      areaId: area?.id ?? null,
      postalCode: l.postalCode,
      postal: l.postal,
      county: l.county,
      price: l.price,
      beds: l.beds,
      baths: l.baths,
      sqft: l.sqft,
      lot: l.lot,
      yearBuilt: l.yearBuilt,
      garage: l.garage,
      description: l.description,
      showingInstructions: l.showingInstructions,
      availableFrom: l.availableFrom,
      listingAgentId: opts.actorId,
      sellerClientId: clientId,
      submittedByUserId: opts.actorId,
      round: 1,
      publishedAt: published,
      // The Owner approved these already; without photos they wait off the public site.
      photosHold: l.status !== 'sold' && files.length < 3,
    })
    .returning({ id: listings.id });
  const id = row!.id;

  await ex.insert(listingPropertyDetails).values({ listingId: id, ...l.property });
  await ex.insert(listingOwnership).values({ listingId: id, ...l.ownership });
  if (l.terms) await ex.insert(listingTerms).values({ listingId: id, ...(l.terms as object) });
  if (l.lease) await ex.insert(listingLeaseTerms).values({ listingId: id, ...(l.lease as object) });
  if (l.business) await ex.insert(listingBusiness).values({ listingId: id, ...(l.business as object) });
  if (l.disclosures.length) await ex.insert(listingDisclosures).values(l.disclosures.map((d) => ({ listingId: id, ...d })));
  await ex.insert(listingConfidential).values({ listingId: id, ...(l.confidential as object) });
  if (l.price) await ex.insert(priceHistory).values({ listingId: id, price: l.price, event: 'listed', on: published });
  await log(ex, opts.actorId, 'listing.create', 'listing', id, `${refNo}, ${address}`);

  let photos = 0;
  for (const [i, name] of files.entries()) {
    const buf = await readFile(path.join(opts.root ?? process.cwd(), l.photosDir!, name));
    const up = await opts.upload!(buf, MIME[path.extname(name).toLowerCase()]!);
    const [m] = await ex.insert(media).values({ storageId: up.storageId, width: up.width, height: up.height, bytes: up.bytes, format: up.format, uploadedBy: opts.actorId }).returning({ id: media.id });
    await ex.insert(listingPhotos).values({ listingId: id, mediaId: m!.id, alt: altFromFilename(name), sortOrder: i, isCover: i === 0 });
    photos++;
  }

  let saleNo: number | undefined;
  if (l.status === 'sold') {
    const price = opts.sale?.price ?? l.sale?.price ?? l.price;
    const soldOn = opts.sale?.soldOn ?? l.sale?.soldOn;
    if (!price || !soldOn) throw new Error(`Enter the sale price and date for ${address}.`);
    saleNo = await nextSaleNo(ex);
    const [s] = await ex.insert(sales).values({ saleNo, listingId: id, sellerClientId: clientId, price, soldOn, createdBy: opts.actorId }).returning({ id: sales.id });
    if (opts.actorId) await ex.insert(saleAgents).values({ saleId: s!.id, agentId: opts.actorId, side: 'seller' });
    await ex.insert(priceHistory).values({ listingId: id, price, event: 'sold', on: new Date(`${soldOn}T12:00:00Z`) });
    await log(ex, opts.actorId, 'sale.create', 'sale', s!.id, `Sale No. ${String(saleNo).padStart(3, '0')}, ${address}`);
  }
  return { id, refNo, saleNo, photos };
}

export async function applyPlan(db: DB, plan: LegacyPlan, opts: ApplyOptions): Promise<ApplyReport> {
  const report: ApplyReport = { created: [], skipped: [] };
  for (const c of plan.clients) {
    const existing = await db.query.clients.findFirst({ where: eq(clients.legacyKey, legacyKey(c.key)), columns: { id: true } });
    if (existing) {
      report.skipped.push(c.key);
      continue;
    }
    const l = plan.listings.find((x) => x.key === c.key);
    await db.transaction(async (tx) => {
      const clientId = await createClient(tx, c, opts.actorId);
      if (!l) {
        report.created.push({ key: c.key, client: c.displayName });
        return;
      }
      const made = await createListing(tx, l, clientId, opts, l.addressLine || c.displayName);
      report.created.push({ key: c.key, client: c.displayName, listing: made.id, refNo: made.refNo, saleNo: made.saleNo, photos: made.photos });
    });
  }
  return report;
}

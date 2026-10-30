// Saves a LegacyPlan. Idempotent: each seller's client file carries legacy_key "legacy:{key}", and a seller
// whose file already exists is skipped whole, so running the import twice changes nothing.
// One transaction per seller, so a failure never leaves half a seller behind.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { and, eq } from 'drizzle-orm';
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
  /** Import only this seller (the import page sends one request per seller). */
  only?: string;
  /** Leave the kit photos for a separate step (addKitPhoto), so importing never waits on uploads. */
  skipPhotos?: boolean;
  /** An agent starting a listing from a seller file: a draft for them to finish and submit for review. */
  asDraft?: boolean;
}

export interface ApplyReport {
  created: { key: string; client: string; listing?: string; refNo?: string; saleNo?: number; photos?: number; photoError?: string }[];
  skipped: string[];
  /** A seller whose import failed. Nothing of theirs was saved; the others carry on. */
  failed: { key: string; client: string; message: string }[];
  /** Photos added on a re-run to a listing imported earlier without them. */
  photosAdded: { key: string; photos: number; photoError?: string }[];
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

/** Photo folders live under photos/ in the repo; scoping the path keeps Vercel from tracing the whole project. */
const photosPath = (root: string | undefined, dir: string, name = '') => path.join(root ?? process.cwd(), 'photos', path.basename(dir), name);

const MIME: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

/** "03-kitchen.jpg" → "Kitchen"; "11-bedroom-3-twin.jpg" → "Bedroom 3 twin". */
export function altFromFilename(name: string): string {
  const words = path.basename(name, path.extname(name)).replace(/^\d+[-_]?/, '').replace(/[-_]+/g, ' ').trim();
  return words ? words[0]!.toUpperCase() + words.slice(1) : 'Photo';
}

export async function photoFiles(dir: string): Promise<string[]> {
  const names = await readdir(dir);
  return names.filter((n) => MIME[path.extname(n).toLowerCase()]).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
}

async function createListing(ex: Executor, l: ListingPlan, clientId: string, opts: ApplyOptions, address: string) {
  const now = opts.now ?? new Date();
  const zone = l.postal ? await ex.query.postalZones.findFirst({ where: eq(postalZones.code, l.postal) }) : undefined;
  // The postal zone's area; failing that, the selectable area the file names ("Susquehanna Township (Fairview)").
  let area = zone?.areaId ? await ex.query.areas.findFirst({ where: eq(areas.id, zone.areaId) }) : undefined;
  if (!area && l.areaHint) {
    const hint = l.areaHint.toLowerCase();
    const named = (await ex.select().from(areas).where(eq(areas.selectable, true))).filter((a) => hint.includes(a.name.toLowerCase()));
    area = named.sort((a, b) => b.name.length - a.name.length)[0];
  }
  const refNo = await nextRef(ex, now);
  const published = l.listedOn ? new Date(`${l.listedOn}T12:00:00Z`) : now;
  const listed = l.photosDir && !opts.skipPhotos ? await listPhotos(opts.root, l.photosDir) : { files: [] as string[] };
  const files = listed.files;

  const [row] = await ex
    .insert(listings)
    .values({
      refNo,
      slug: listingSlug(l.addressLine || null, area?.name ?? null, refNo),
      type: l.type,
      purpose: l.purpose,
      source: 'agent',
      status: opts.asDraft ? 'draft' : l.status,
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
      round: opts.asDraft ? 0 : 1,
      publishedAt: opts.asDraft ? null : published,
      // The Owner approved these already; without photos they wait off the public site.
      photosHold: !opts.asDraft && l.status !== 'sold' && files.length < 3,
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
  if (l.price && !opts.asDraft) await ex.insert(priceHistory).values({ listingId: id, price: l.price, event: 'listed', on: published });
  await log(ex, opts.actorId, 'listing.create', 'listing', id, `${refNo}, ${address}`);

  const { photos, photoError } =
    opts.skipPhotos || !l.photosDir ? { photos: 0, photoError: undefined } : listed.error ? { photos: 0, photoError: listed.error } : await addPhotos(ex, id, l, files, opts);
  if (photos < 3 && l.status !== 'sold' && !opts.asDraft) await ex.update(listings).set({ photosHold: true }).where(eq(listings.id, id));

  let saleNo: number | undefined;
  if (l.status === 'sold' && !opts.asDraft) {
    const price = opts.sale?.price ?? l.sale?.price ?? l.price;
    const soldOn = opts.sale?.soldOn ?? l.sale?.soldOn;
    if (!price || !soldOn) throw new Error(`Enter the sale price and date for ${address}.`);
    saleNo = await nextSaleNo(ex);
    const [s] = await ex.insert(sales).values({ saleNo, listingId: id, sellerClientId: clientId, price, soldOn, createdBy: opts.actorId }).returning({ id: sales.id });
    if (opts.actorId) await ex.insert(saleAgents).values({ saleId: s!.id, agentId: opts.actorId, side: 'seller' });
    await ex.insert(priceHistory).values({ listingId: id, price, event: 'sold', on: new Date(`${soldOn}T12:00:00Z`) });
    await log(ex, opts.actorId, 'sale.create', 'sale', s!.id, `Sale No. ${String(saleNo).padStart(3, '0')}, ${address}`);
  }
  return { id, refNo, saleNo, photos, photoError };
}

/** The kit photo files, or why they can't be read (reported, never fatal). */
async function listPhotos(root: string | undefined, dir: string): Promise<{ files: string[]; error?: string }> {
  try {
    const files = await photoFiles(photosPath(root, dir));
    return files.length ? { files } : { files, error: `No photos found in ${dir}.` };
  } catch (e) {
    return { files: [], error: `Couldn’t read the photos in ${dir}: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/**
 * Uploads a listing's kit photos in order (01 = cover). A failed upload never stops the import: the listing
 * keeps the photos that made it, stays off the public site if it has fewer than 3, and the error is reported.
 */
async function addPhotos(ex: Executor, listingId: string, l: ListingPlan, files: string[], opts: ApplyOptions): Promise<{ photos: number; photoError?: string }> {
  if (!files.length) return { photos: 0 };
  if (!opts.upload) return { photos: 0, photoError: 'Photo uploads aren’t set up (add the Cloudinary keys).' };
  let photos = 0;
  for (const [i, name] of files.entries()) {
    try {
      const buf = await readFile(photosPath(opts.root, l.photosDir!, name));
      const up = await opts.upload(buf, MIME[path.extname(name).toLowerCase()]!);
      const [m] = await ex.insert(media).values({ storageId: up.storageId, width: up.width, height: up.height, bytes: up.bytes, format: up.format, uploadedBy: opts.actorId }).returning({ id: media.id });
      await ex.insert(listingPhotos).values({ listingId, mediaId: m!.id, alt: altFromFilename(name), sortOrder: i, isCover: i === 0 });
      photos++;
    } catch (e) {
      return { photos, photoError: `Photo upload failed: ${e instanceof Error ? e.message : String(e)}` };
    }
  }
  return { photos };
}

export async function applyPlan(db: DB, plan: LegacyPlan, opts: ApplyOptions): Promise<ApplyReport> {
  const report: ApplyReport = { created: [], skipped: [], failed: [], photosAdded: [] };
  for (const c of plan.clients) {
    if (opts.only && c.key !== opts.only) continue;
    const l = plan.listings.find((x) => x.key === c.key);
    const existing = await db.query.clients.findFirst({ where: eq(clients.legacyKey, legacyKey(c.key)), columns: { id: true } });
    if (existing) {
      report.skipped.push(c.key);
      // Imported earlier without its photos (an upload failed): try them again.
      if (l?.photosDir && !opts.skipPhotos) {
        const row = await db.query.listings.findFirst({ where: eq(listings.sellerClientId, existing.id), columns: { id: true, status: true } });
        if (row && !(await db.$count(listingPhotos, eq(listingPhotos.listingId, row.id)))) {
          const listed = await listPhotos(opts.root, l.photosDir);
          const r = listed.error ? { photos: 0, photoError: listed.error } : await db.transaction((tx) => addPhotos(tx, row.id, l, listed.files, opts));
          if (r.photos >= 3) await db.update(listings).set({ photosHold: false }).where(eq(listings.id, row.id));
          if (r.photos || r.photoError) report.photosAdded.push({ key: c.key, ...r });
        }
      }
      continue;
    }
    try {
      await db.transaction(async (tx) => {
        const clientId = await createClient(tx, c, opts.actorId);
        if (!l) {
          report.created.push({ key: c.key, client: c.displayName });
          return;
        }
        const made = await createListing(tx, l, clientId, opts, l.addressLine || c.displayName);
        report.created.push({ key: c.key, client: c.displayName, listing: made.id, refNo: made.refNo, saleNo: made.saleNo, photos: made.photos, photoError: made.photoError });
      });
    } catch (e) {
      // One seller's problem never stops the rest.
      report.failed.push({ key: c.key, client: c.displayName, message: e instanceof Error ? e.message : String(e) });
    }
  }
  return report;
}

// ---- Kit photos, one per request ----

export interface PhotoJob {
  key: string;
  listingId: string;
  total: number;
  have: number;
}

/** Imported listings whose kit photos aren't all on the listing yet. */
export async function photoJobs(db: DB, plan: LegacyPlan, root?: string): Promise<PhotoJob[]> {
  const jobs: PhotoJob[] = [];
  for (const l of plan.listings.filter((x) => x.photosDir)) {
    const c = await db.query.clients.findFirst({ where: eq(clients.legacyKey, legacyKey(l.key)), columns: { id: true } });
    const row = c ? await db.query.listings.findFirst({ where: eq(listings.sellerClientId, c.id), columns: { id: true } }) : undefined;
    if (!row) continue;
    const listed = await listPhotos(root, l.photosDir!);
    const have = await db.$count(listingPhotos, eq(listingPhotos.listingId, row.id));
    if (listed.files.length && have < listed.files.length) jobs.push({ key: l.key, listingId: row.id, total: listed.files.length, have });
  }
  return jobs;
}

/**
 * Uploads one kit photo (by position, 01 = cover) to an imported listing. Safe to repeat: a photo already in
 * that position is skipped. With 3 photos the listing comes off hold and goes live.
 */
export async function addKitPhoto(
  db: DB,
  plan: LegacyPlan,
  key: string,
  index: number,
  opts: Pick<ApplyOptions, 'actorId' | 'upload' | 'root'>,
): Promise<{ added: boolean; released: boolean }> {
  const l = plan.listings.find((x) => x.key === key && x.photosDir);
  if (!l) throw new Error('That listing has no photos in the kit.');
  if (!opts.upload) throw new Error('Photo uploads aren’t set up. Add the Cloudinary keys.');
  const c = await db.query.clients.findFirst({ where: eq(clients.legacyKey, legacyKey(key)), columns: { id: true } });
  const row = c ? await db.query.listings.findFirst({ where: eq(listings.sellerClientId, c.id), columns: { id: true, status: true } }) : undefined;
  if (!row) throw new Error('Import the seller first.');
  const listed = await listPhotos(opts.root, l.photosDir!);
  if (listed.error) throw new Error(listed.error);
  const name = listed.files[index];
  if (!name) throw new Error('There’s no photo in that position.');
  const already = await db.query.listingPhotos.findFirst({ where: and(eq(listingPhotos.listingId, row.id), eq(listingPhotos.sortOrder, index)) });
  let added = false;
  if (!already) {
    const buf = await readFile(photosPath(opts.root, l.photosDir!, name));
    const up = await opts.upload(buf, MIME[path.extname(name).toLowerCase()]!);
    await db.transaction(async (tx) => {
      const [m] = await tx
        .insert(media)
        .values({ storageId: up.storageId, width: up.width, height: up.height, bytes: up.bytes, format: up.format, uploadedBy: opts.actorId })
        .returning({ id: media.id });
      await tx.insert(listingPhotos).values({ listingId: row.id, mediaId: m!.id, alt: altFromFilename(name), sortOrder: index, isCover: index === 0 });
    });
    added = true;
  }
  const have = await db.$count(listingPhotos, eq(listingPhotos.listingId, row.id));
  let released = false;
  if (have >= 3 && row.status !== 'sold') {
    const r = await db.update(listings).set({ photosHold: false }).where(and(eq(listings.id, row.id), eq(listings.photosHold, true))).returning({ id: listings.id });
    released = r.length > 0;
  }
  return { added, released };
}

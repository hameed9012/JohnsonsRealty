import 'server-only';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { postalFromAddress } from '@/lib/map';
import type { DB, Executor } from '@/db/client';
import {
  areas,
  clientConfidential,
  clientPeople,
  clients,
  listingBusiness,
  listingConfidential,
  listingDisclosures,
  listingFeatures,
  listingLeaseTerms,
  listingOwnership,
  listingPhotos,
  listingPropertyDetails,
  listingReviews,
  listings,
  listingTerms,
  media,
  priceHistory,
  siteSettings,
  users,
} from '@/db/schema';
import { fieldErrors } from '@/lib/action-result';
import { checklist, type ChecklistItem } from '@/lib/listing-checklist';
import { approvedStatus, assertTransition, type ListingStatus } from '@/lib/listing-status';
import { can, type Actor, type PermissionSettings } from '@/lib/permissions';
import { nextRef } from '@/lib/refs';
import {
  ownerDetailsStep,
  photoMetaSchema,
  photoOrderSchema,
  propertyStep,
  reviewDecisionSchema,
  sellerStep,
  termsStep,
  uploadedSchema,
} from '@/lib/schemas/listing';
import { listingSlug } from '@/lib/slug';
import { audit } from '@/server/audit';
import { notifyUsers, reviewerIds } from '@/server/notify';
import { alertSavedSearches } from './alerts';
import { checklistInput, loadBundle, snapshotOf, type ListingBundle } from './bundle';
import { generatorFacts, sellerFormValues, storeGeneratedSeller } from './generate-seller';

export class ServiceError extends Error {
  constructor(
    message: string,
    public fieldErrors?: Record<string, string>,
    public checklist?: ChecklistItem[],
  ) {
    super(message);
  }
}

type Listing = typeof listings.$inferSelect;

/** Statuses the submission wizard can edit. */
export const WIZARD_STATUSES: string[] = ['draft', 'pending_review', 'changes_requested', 'withdrawn'];

function subjectOf(l: Listing) {
  return { source: l.source, status: l.status, listingAgentId: l.listingAgentId, submittedByUserId: l.submittedByUserId };
}

function parse<T>(schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: import('zod').ZodError } }, input: unknown): T {
  const r = schema.safeParse(input);
  if (!r.success) throw new ServiceError('Check the highlighted fields.', fieldErrors(r.error));
  return r.data;
}

/**
 * Staff can edit a live listing in full (every step, saved straight to the site): the Owner and Admins
 * always, the listing's agent unless "live edits need review" is on. Property owners can't.
 */
export async function canEditLive(ex: Executor, actor: Actor): Promise<boolean> {
  if (actor.role === 'owner' || actor.role === 'admin') return true;
  if (actor.role !== 'agent') return false;
  const s = await ex.query.siteSettings.findFirst({ where: eq(siteSettings.id, 1), columns: { liveEditsNeedReview: true } });
  return !s?.liveEditsNeedReview;
}

export const isLiveStatus = (status: string) => !WIZARD_STATUSES.includes(status);

async function getForEdit(ex: Executor, actor: Actor, id: string, opts: { photos?: boolean } = {}): Promise<Listing> {
  const l = await ex.query.listings.findFirst({ where: eq(listings.id, id) });
  if (!l) throw new ServiceError('That listing doesn’t exist.');
  const manager = actor.role === 'owner' || actor.role === 'admin';
  if (l.status === 'pending_review' && !manager) throw new ServiceError('This listing is waiting for review, so it can’t be edited right now.');
  if (!can(actor, 'listing.edit', subjectOf(l))) throw new ServiceError('You can’t edit this listing.');
  // Live listings: staff edit them in full (see canEditLive). Imported listings held for photos also take photos.
  if (isLiveStatus(l.status) && !(opts.photos && l.photosHold) && !(await canEditLive(ex, actor))) {
    throw new ServiceError('Edits to live listings need the Owner’s review. Use the quick edit on the listing page.');
  }
  return l;
}

/** A held listing goes live once it has 3 photos, each with a description. No new review (the Owner approved it). */
export async function releasePhotoHold(ex: Executor, id: string): Promise<boolean> {
  const l = await ex.query.listings.findFirst({ where: eq(listings.id, id), columns: { photosHold: true, refNo: true, addressLine: true } });
  if (!l?.photosHold) return false;
  // An imported listing without its address (the seller file said "You choose") waits for one too.
  if (!l.addressLine.trim()) return false;
  const rows = await ex.select({ alt: listingPhotos.alt }).from(listingPhotos).where(eq(listingPhotos.listingId, id));
  if (rows.length < 3 || rows.some((r) => !r.alt.trim())) return false;
  await ex.update(listings).set({ photosHold: false }).where(eq(listings.id, id));
  await audit(ex, { actorId: null, action: 'listing.release', entity: 'listing', entityId: id, summary: `${l.refNo} has its photos and is now on the public site` });
  return true;
}

/** Fields only staff fill in; property owners never send them. */
function editableByOwner(l: Listing) {
  return l.source === 'owner_submitted';
}

async function upsert<T extends { listingId: unknown }>(
  ex: Executor,
  table: typeof listingPropertyDetails | typeof listingTerms | typeof listingLeaseTerms | typeof listingBusiness | typeof listingOwnership | typeof listingConfidential,
  values: T,
) {
  const { listingId, ...rest } = values as any;
  await (ex.insert(table) as any).values(values).onConflictDoUpdate({ target: (table as any).listingId, set: rest });
}

// ---------- Drafts ----------

export async function createDraft(ex: Executor, actor: Actor, source: 'agent' | 'owner_submitted'): Promise<Listing> {
  if (source === 'agent' ? !can(actor, 'listing.create') : !can(actor, 'listing.submitOwn')) {
    throw new ServiceError('You can’t create listings.');
  }
  const refNo = await nextRef(ex);
  const [l] = await ex
    .insert(listings)
    .values({
      refNo,
      slug: listingSlug(null, null, refNo),
      type: 'house',
      purpose: 'sale',
      source,
      status: 'draft',
      submittedByUserId: actor.id,
      listingAgentId: source === 'agent' ? actor.id : null,
    })
    .returning();
  await audit(ex, { actorId: actor.id, action: 'listing.create', entity: 'listing', entityId: l!.id, summary: `Started listing ${refNo}` });
  return l!;
}

export async function saveProperty(ex: Executor, actor: Actor, id: string, input: unknown) {
  const l = await getForEdit(ex, actor, id);
  const d = parse(propertyStep, input);
  const purpose = d.type === 'rental' ? 'rent' : (d.purpose ?? l.purpose);
  // Statuses differ for sale and rent (Active vs For lease), so a live listing keeps its purpose.
  if (isLiveStatus(l.status) && purpose !== l.purpose) {
    throw new ServiceError('Check the highlighted fields.', { purpose: 'A live listing can’t switch between sale and rent. Withdraw it and start a new one.' });
  }
  if (d.areaId) {
    const a = await ex.query.areas.findFirst({ where: and(eq(areas.id, d.areaId), eq(areas.selectable, true)) });
    if (!a) throw new ServiceError('Check the highlighted fields.', { areaId: 'Choose the area from the list.' });
  }
  await ex
    .update(listings)
    .set({
      type: d.type ?? l.type,
      purpose,
      addressLine: d.addressLine ?? '',
      unit: d.unit,
      areaId: d.areaId,
      postalCode: d.postalCode,
      postal: d.postal ?? postalFromAddress(d.addressLine),
      parcelId: d.parcelId,
      beds: d.beds,
      baths: d.baths,
      sqft: d.sqft,
      lot: d.lot,
      yearBuilt: d.yearBuilt,
      garage: d.garage,
      description: d.description,
    })
    .where(eq(listings.id, id));

  await upsert(ex, listingPropertyDetails, {
    listingId: id,
    propertyStyle: d.propertyStyle,
    otherRooms: d.otherRooms,
    parking: d.parking,
    basement: d.basement,
    heating: d.heating,
    cooling: d.cooling,
    waterHeater: d.waterHeater,
    waterSewer: d.waterSewer,
    electrical: d.electrical,
    roof: d.roof,
    windows: d.windows,
    appliancesProvided: d.appliancesProvided,
    furnished: d.furnished,
    taxes: d.taxes,
    hoa: d.hoa,
    utilities: d.utilities,
    zoning: d.zoning,
    occupancy: d.occupancy,
  });

  if ((d.type ?? l.type) === 'business') {
    await upsert(ex, listingBusiness, {
      listingId: id,
      businessName: d.businessName,
      nameWithheld: d.nameWithheld,
      teaser: d.teaser,
      businessType: d.businessType,
      openedYear: d.openedYear,
      employees: d.employees,
      hours: d.hours,
      seats: d.seats,
      whatIsSold: d.whatIsSold,
      buildingSize: d.buildingSize,
      tradingHistory: d.tradingHistory,
    });
  }

  await ex.delete(listingFeatures).where(eq(listingFeatures.listingId, id));
  if (d.featureIds.length) await ex.insert(listingFeatures).values(d.featureIds.map((featureId) => ({ listingId: id, featureId }))).onConflictDoNothing();

  await audit(ex, { actorId: actor.id, action: 'listing.update', entity: 'listing', entityId: id, summary: `Saved property details for ${l.refNo}` });
  // Adding the address can be the last thing a held listing was waiting for.
  if (l.photosHold) await releasePhotoHold(ex, id);
}

/** On a live listing a price change lands in price history, as from the listings manager. */
export type TermsResult = { priceChange?: { from: number; to: number } };

export async function saveTerms(ex: Executor, actor: Actor, id: string, input: unknown): Promise<TermsResult> {
  const l = await getForEdit(ex, actor, id);
  const d = parse(termsStep, input);
  const repriced = isLiveStatus(l.status) && l.price != null && d.price != null && d.price !== l.price;
  await ex
    .update(listings)
    .set({ price: d.price, availableFrom: d.availableFrom, showingInstructions: d.showingInstructions, ...(repriced ? { previousPrice: l.price } : {}) })
    .where(eq(listings.id, id));
  if (repriced) {
    await ex.insert(priceHistory).values({ listingId: id, price: d.price!, event: d.price! < l.price! ? 'reduced' : 'increased' });
    await audit(ex, { actorId: actor.id, action: 'listing.price', entity: 'listing', entityId: id, summary: `${d.price! < l.price! ? 'Reduced' : 'Raised'} ${l.refNo} to $${d.price!.toLocaleString('en-US')}`, diff: { price: { from: l.price, to: d.price } } });
  }

  if (l.purpose === 'rent') {
    await upsert(ex, listingLeaseTerms, {
      listingId: id,
      leaseLengthMonths: d.leaseLengthMonths,
      deposit: d.deposit,
      dueAtSigning: d.dueAtSigning,
      rentDue: d.rentDue,
      lateFee: d.lateFee,
      paymentMethod: d.paymentMethod,
      renewal: d.renewal,
      utilities: d.leaseUtilities,
      yardAndSnow: d.yardAndSnow,
      maxOccupants: d.maxOccupants,
      pets: d.pets,
      smoking: d.smoking,
      subletting: d.subletting,
      insurance: d.insurance,
      moveInInspection: d.moveInInspection,
      leasingFee: d.leasingFee,
      incomeRequirement: d.incomeRequirement,
      checks: d.checks,
      references: d.references,
      applicationFee: d.applicationFee,
      decisionTime: d.decisionTime,
    });
  }

  await upsert(ex, listingTerms, {
    listingId: id,
    agreementStart: d.agreementStart,
    agreementEnd: d.agreementEnd,
    earnestMoneyExpected: d.earnestMoneyExpected,
    targetSettlement: d.targetSettlement,
    possession: d.possession,
    included: d.included,
    excluded: d.excluded,
    leasedItems: d.leasedItems,
    transferTax: d.transferTax,
    titleCompany: d.titleCompany,
    attorney: d.attorney,
    homeWarranty: d.homeWarranty,
    financingAccepted: d.financingAccepted,
    offerReplies: d.offerReplies,
    asIs: d.asIs,
    yardSign: d.yardSign,
    photosAllowed: d.photosAllowed,
    lockbox: d.lockbox,
    showingNotice: d.showingNotice,
  });

  if (l.type === 'business') {
    await ex
      .insert(listingBusiness)
      .values({ listingId: id })
      .onConflictDoNothing();
    await ex
      .update(listingBusiness)
      .set({
        ownerFinancing: d.ownerFinancing,
        priceBuilding: d.priceBuilding,
        priceEquipment: d.priceEquipment,
        priceInventory: d.priceInventory,
        priceGoodwill: d.priceGoodwill,
        included: d.included,
        excluded: d.excluded,
        licences: d.licences,
        training: d.training,
        nonCompete: d.nonCompete,
        staffTerms: d.staffTerms,
        premisesRent: d.premisesRent,
        premisesLeaseEnd: d.premisesLeaseEnd,
        premisesLandlord: d.premisesLandlord,
        confidential: d.businessConfidential,
      })
      .where(eq(listingBusiness.listingId, id));
  }
  await audit(ex, { actorId: actor.id, action: 'listing.update', entity: 'listing', entityId: id, summary: `Saved price and terms for ${l.refNo}` });
  return repriced ? { priceChange: { from: l.price!, to: d.price! } } : {};
}

// ---------- Seller ----------

async function writeClient(ex: Executor, actor: Actor, clientId: string | null, input: NonNullable<ReturnType<typeof sellerStep.parse>['client']>, conf?: ReturnType<typeof sellerStep.parse>['clientConfidential']) {
  if (!input.displayName) throw new ServiceError('Check the highlighted fields.', { 'client.displayName': 'Add the seller’s name.' });
  const values = {
    kind: input.kind ?? 'person',
    displayName: input.displayName,
    legalNameOnForms: input.legalNameOnForms,
    source: input.source,
    bestContact: input.bestContact,
    emergencyContact: input.emergencyContact,
    businessAddress: input.businessAddress,
    currentlyOccupying: input.currentlyOccupying,
    mailingAddressAfter: input.mailingAddressAfter,
    reason: input.reason,
    timeline: input.timeline,
    whoDecides: input.whoDecides,
    background: input.background,
    generatedSeed: input.generatedSeed,
  };
  let id = clientId;
  if (id) {
    await ex.update(clients).set(values).where(eq(clients.id, id));
  } else {
    const [c] = await ex
      .insert(clients)
      .values({ ...values, roles: ['seller'], agentId: actor.role === 'client' ? null : actor.id, createdBy: actor.id })
      .returning({ id: clients.id });
    id = c!.id;
    await audit(ex, { actorId: actor.id, action: 'client.create', entity: 'client', entityId: id, summary: `Opened client file for ${values.displayName}` });
  }
  await ex.delete(clientPeople).where(eq(clientPeople.clientId, id));
  const people = input.people.filter((p) => p.legalName);
  if (people.length) {
    await ex.insert(clientPeople).values(
      people.map((p, i) => ({
        clientId: id!,
        legalName: p.legalName!,
        goesBy: p.goesBy,
        ageOccupation: p.ageOccupation,
        maritalStatus: p.maritalStatus,
        signs: p.signs,
        roleLabel: p.roleLabel,
        discord: p.discord,
        robloxUsername: p.robloxUsername,
        chirper: p.chirper,
        sortOrder: i,
      })),
    );
  }
  if (conf) {
    await ex
      .insert(clientConfidential)
      .values({ clientId: id, ...conf })
      .onConflictDoUpdate({ target: clientConfidential.clientId, set: conf });
  }
  return id;
}

export async function saveSeller(ex: Executor, actor: Actor, id: string, input: unknown) {
  const l = await getForEdit(ex, actor, id);
  if (editableByOwner(l) && actor.role === 'client') throw new ServiceError('You can’t edit this part of the listing.');
  const d = parse(sellerStep, input);

  let clientId = d.clientId;
  if (clientId) {
    const c = await ex.query.clients.findFirst({ where: eq(clients.id, clientId) });
    // Imported spare sellers are shared: any agent can put one on a listing.
    if (!c || (!can(actor, 'client.edit', { agentId: c.agentId, userId: c.userId }) && !c.tags.includes('Spare seller'))) {
      throw new ServiceError('Check the highlighted fields.', { clientId: 'Choose one of your client files.' });
    }
    if (!c.roles.includes('seller') && !c.roles.includes('landlord') && !c.roles.includes('business_owner')) {
      await ex.update(clients).set({ roles: sql`array_append(${clients.roles}, ${l.purpose === 'rent' ? 'landlord' : 'seller'}::client_role)` }).where(eq(clients.id, clientId));
    }
  }
  // Confidential fields are only written by people who can see them, so a blank form never wipes them.
  const seesConfidential = can(actor, 'listing.viewConfidential', subjectOf(l));
  if (d.client) clientId = await writeClient(ex, actor, clientId, d.client, seesConfidential ? d.clientConfidential : undefined);

  await ex.update(listings).set({ sellerClientId: clientId }).where(eq(listings.id, id));
  await upsert(ex, listingOwnership, {
    listingId: id,
    vesting: d.vesting,
    whoSigns: d.whoSigns,
    boughtOn: d.boughtOn,
    boughtFor: d.boughtFor,
    ownedSince: d.ownedSince,
    deedReference: d.deedReference,
    mortgage: d.mortgage,
    liens: d.liens,
  });
  await ex.delete(listingDisclosures).where(eq(listingDisclosures.listingId, id));
  const disc = d.disclosures.filter((x) => x.answer || x.detail);
  if (disc.length) await ex.insert(listingDisclosures).values(disc.map((x) => ({ listingId: id, item: x.item, answer: x.answer, detail: x.detail })));
  if (seesConfidential) await upsert(ex, listingConfidential, {
    listingId: id,
    bottomLine: d.bottomLine,
    negotiationRules: d.negotiationRules,
    relayLines: d.relayLines,
    commissionTerms: d.commissionTerms,
    yearlySales: d.yearlySales,
    yearlyProfit: d.yearlyProfit,
    inventoryValue: d.inventoryValue,
    disclosureNotes: d.disclosureNotes,
  });
  await audit(ex, { actorId: actor.id, action: 'listing.update', entity: 'listing', entityId: id, summary: `Saved seller details for ${l.refNo}` });
  return clientId;
}

/** Property owners: their own client file, built from their account and the contact fields they enter. */
/**
 * A fictional RP seller for the Seller step, as editable form values. Seeded by the listing ID, so it's the
 * same seller every time until Regenerate picks a new seed. Owner-submitted listings have a real seller.
 */
export async function generatedSellerValues(ex: Executor, actor: Actor, id: string, regenerate: boolean) {
  const l = await getForEdit(ex, actor, id);
  if (l.source === 'owner_submitted') throw new ServiceError('Listings by the property owner have a real seller.');
  const facts = (await generatorFacts(ex, id))!;
  const { generateSeller } = await import('@/lib/seller-generator');
  const seed = regenerate ? crypto.randomUUID() : id;
  return sellerFormValues(generateSeller(seed, facts.input, { agentName: facts.agentName ?? undefined }));
}

export async function saveOwnerDetails(ex: Executor, actor: Actor, id: string, input: unknown) {
  const l = await getForEdit(ex, actor, id);
  if (l.source !== 'owner_submitted') throw new ServiceError('This listing isn’t an owner listing.');
  const d = parse(ownerDetailsStep, input);
  const u = await ex.query.users.findFirst({ where: eq(users.id, l.submittedByUserId!) });
  const name = d.legalName || u?.displayName || u?.name;
  if (!name) throw new ServiceError('Check the highlighted fields.', { legalName: 'Add your name as it should appear on paperwork.' });

  let clientId = l.sellerClientId;
  if (!clientId) {
    const existing = await ex.query.clients.findFirst({ where: and(eq(clients.userId, l.submittedByUserId!), eq(clients.archived, false)) });
    clientId = existing?.id ?? null;
  }
  const role = l.purpose === 'rent' ? 'landlord' : l.type === 'business' ? 'business_owner' : 'seller';
  const values = {
    displayName: name,
    legalNameOnForms: d.coOwners ? `${name} and ${d.coOwners}` : name,
    bestContact: d.bestContact,
    reason: d.reason,
    timeline: d.timeline,
    source: 'Listed their own property online',
  };
  if (clientId) {
    await ex.update(clients).set(values).where(eq(clients.id, clientId));
    await ex
      .update(clients)
      .set({ roles: sql`(select array_agg(distinct r) from unnest(array_append(${clients.roles}, ${role}::client_role)) r)` })
      .where(eq(clients.id, clientId));
  } else {
    const [c] = await ex
      .insert(clients)
      .values({ ...values, kind: d.coOwners ? 'couple' : 'person', roles: [role], userId: l.submittedByUserId, createdBy: actor.id })
      .returning({ id: clients.id });
    clientId = c!.id;
  }
  await ex.delete(clientPeople).where(eq(clientPeople.clientId, clientId));
  await ex.insert(clientPeople).values({
    clientId,
    legalName: name,
    signs: true,
    discord: u?.discordId ? (u.displayName ?? u.name) : null,
    robloxUsername: u?.robloxUsername ?? null,
    chirper: u?.chirperHandle ?? null,
  });
  await ex.update(listings).set({ sellerClientId: clientId, ownerContact: d.ownerContact }).where(eq(listings.id, id));
  await audit(ex, { actorId: actor.id, action: 'listing.update', entity: 'listing', entityId: id, summary: `Saved owner details for ${l.refNo}` });
  return clientId;
}

// ---------- Photos ----------

export async function addPhoto(ex: Executor, actor: Actor, id: string, input: unknown) {
  await getForEdit(ex, actor, id, { photos: true });
  const f = parse(uploadedSchema, input);
  const [m] = await ex
    .insert(media)
    .values({ storageId: f.storageId, width: f.width, height: f.height, bytes: f.bytes, format: f.format, uploadedBy: actor.id })
    .returning();
  const [{ n } = { n: 0 }] = await ex.select({ n: sql<number>`count(*)::int` }).from(listingPhotos).where(eq(listingPhotos.listingId, id));
  const [p] = await ex.insert(listingPhotos).values({ listingId: id, mediaId: m!.id, sortOrder: n, isCover: n === 0 }).returning();
  return { id: p!.id, storageId: m!.storageId, width: m!.width, height: m!.height, alt: '', caption: null as string | null, isCover: p!.isCover };
}

export async function updatePhotos(ex: Executor, actor: Actor, id: string, input: { order: unknown; meta: unknown[] }) {
  const l = await getForEdit(ex, actor, id, { photos: true });
  const o = parse(photoOrderSchema, input.order);
  const meta = input.meta.map((m) => parse(photoMetaSchema, m));
  const rows = await ex.select({ id: listingPhotos.id }).from(listingPhotos).where(eq(listingPhotos.listingId, id));
  const own = new Set(rows.map((r) => r.id));
  if (o.order.some((x) => !own.has(x)) || (o.coverId && !own.has(o.coverId))) throw new ServiceError('Those photos don’t belong to this listing.');
  for (const [i, pid] of o.order.entries()) {
    const m = meta.find((x) => x.id === pid);
    await ex
      .update(listingPhotos)
      .set({ sortOrder: i, isCover: pid === (o.coverId ?? o.order[0]), ...(m ? { alt: m.alt ?? '', caption: m.caption } : {}) })
      .where(eq(listingPhotos.id, pid));
  }
  await audit(ex, { actorId: actor.id, action: 'listing.photos', entity: 'listing', entityId: id, summary: `Updated photos for ${l.refNo}` });
  return { released: await releasePhotoHold(ex, id) };
}

export async function removePhoto(ex: Executor, actor: Actor, id: string, photoId: string): Promise<string | null> {
  const l = await getForEdit(ex, actor, id, { photos: true });
  const p = await ex.query.listingPhotos.findFirst({ where: and(eq(listingPhotos.id, photoId), eq(listingPhotos.listingId, id)), with: { media: true } });
  if (!p) return null;
  await ex.delete(listingPhotos).where(eq(listingPhotos.id, photoId));
  await ex.delete(media).where(eq(media.id, p.mediaId));
  if (p.isCover) {
    const first = await ex.query.listingPhotos.findFirst({ where: eq(listingPhotos.listingId, id), orderBy: (x, { asc }) => [asc(x.sortOrder)] });
    if (first) await ex.update(listingPhotos).set({ isCover: true }).where(eq(listingPhotos.id, first.id));
  }
  await audit(ex, { actorId: actor.id, action: 'listing.photos', entity: 'listing', entityId: id, summary: `Removed a photo from ${l.refNo}` });
  return p.media.storageId;
}

// ---------- Submit and review ----------

export interface SubmitResult {
  refNo: string;
  round: number;
  reviewers: string[];
  bundle: ListingBundle;
}

export async function submitForReview(db: DB, actor: Actor, settings: PermissionSettings, id: string): Promise<SubmitResult> {
  return db.transaction(async (tx) => {
    const l = await getForEdit(tx, actor, id);
    const bundle = (await loadBundle(tx, id, { confidential: false }))!;
    const missing = checklist(checklistInput(bundle));
    if (missing.length) throw new ServiceError('A few things are still missing.', undefined, missing);

    assertTransition(l.status as ListingStatus, 'pending_review', l.purpose);
    const round = l.round + 1;
    await tx.update(listings).set({ status: 'pending_review', round }).where(eq(listings.id, id));
    await tx.insert(listingReviews).values({ listingId: id, round, submittedBy: actor.id, snapshot: snapshotOf(bundle) });
    await audit(tx, {
      actorId: actor.id,
      action: 'listing.submit',
      entity: 'listing',
      entityId: id,
      summary: round > 1 ? `Resubmitted ${l.refNo} for review (round ${round})` : `Submitted ${l.refNo} for review`,
    });
    const reviewers = (await reviewerIds(tx, settings.adminsCanApprove)).filter((r) => r !== actor.id || actor.role === 'owner');
    await notifyUsers(tx, reviewers, {
      kind: 'review.pending',
      title: round > 1 ? 'Listing resubmitted for review' : 'Listing waiting for review',
      body: `${bundle.addressLine || l.refNo}${bundle.area ? ', ' + bundle.area.name : ''}`,
      link: `/portal/review/${id}`,
    });
    return { refNo: l.refNo, round, reviewers, bundle: { ...bundle, status: 'pending_review', round } };
  });
}

export interface DecisionResult {
  decision: 'approved' | 'changes_requested' | 'rejected';
  status: ListingStatus;
  bundle: ListingBundle;
}

export async function decideReview(db: DB, actor: Actor, settings: PermissionSettings, id: string, input: unknown): Promise<DecisionResult> {
  if (!can(actor, 'listing.approve', undefined, settings)) throw new ServiceError('Only the Owner can review listings.');
  const d = parse(reviewDecisionSchema, input);
  return db.transaction(async (tx) => {
    const l = await tx.query.listings.findFirst({ where: eq(listings.id, id), with: { area: true } });
    if (!l) throw new ServiceError('That listing doesn’t exist.');
    if (l.status !== 'pending_review') throw new ServiceError('This listing isn’t waiting for review any more.');
    const review = await tx.query.listingReviews.findFirst({ where: and(eq(listingReviews.listingId, id), eq(listingReviews.round, l.round), isNull(listingReviews.decision)) });
    if (!review) throw new ServiceError('This listing isn’t waiting for review any more.');

    const status: ListingStatus =
      d.decision === 'approved' ? approvedStatus(l.purpose, d.comingSoon) : d.decision === 'changes_requested' ? 'changes_requested' : 'rejected';
    assertTransition('pending_review', status, l.purpose);

    const now = new Date();
    const patch: Partial<Listing> = { status };
    if (d.decision === 'approved') {
      patch.publishedAt = l.publishedAt ?? now;
      patch.slug = listingSlug(l.addressLine, l.area?.name ?? null, l.refNo);
      if (d.agentId !== undefined && l.source === 'owner_submitted') {
        if (d.agentId) {
          const agent = await tx.query.users.findFirst({ where: and(eq(users.id, d.agentId), inArray(users.role, ['owner', 'admin', 'agent']), eq(users.status, 'active')) });
          if (!agent) throw new ServiceError('Check the highlighted fields.', { agentId: 'Choose an active agent.' });
        }
        patch.listingAgentId = d.agentId || null;
        if (d.agentId && l.sellerClientId) await tx.update(clients).set({ agentId: d.agentId }).where(and(eq(clients.id, l.sellerClientId), isNull(clients.agentId)));
      }
    }
    await tx.update(listings).set(patch).where(eq(listings.id, id));
    await tx.update(listingReviews).set({ decision: d.decision, reviewerId: actor.id, notes: d.notes, decidedAt: now }).where(eq(listingReviews.id, review.id));
    if (d.decision === 'approved' && l.price) {
      const had = await tx.query.priceHistory.findFirst({ where: and(eq(priceHistory.listingId, id), eq(priceHistory.event, 'listed')) });
      if (!had) await tx.insert(priceHistory).values({ listingId: id, price: l.price, event: 'listed', on: now });
    }

    const words = { approved: 'Approved', changes_requested: 'Requested changes on', rejected: 'Rejected' } as const;
    await audit(tx, { actorId: actor.id, action: `listing.review.${d.decision}`, entity: 'listing', entityId: id, summary: `${words[d.decision]} ${l.refNo} (round ${l.round})`, diff: d.notes ? { notes: d.notes } : undefined });

    const place = l.addressLine || l.refNo;
    const msg = {
      approved: { title: 'Listing approved', body: `${place} is now live.` },
      changes_requested: { title: 'Changes requested', body: `${place}: ${d.notes}` },
      rejected: { title: 'Listing not approved', body: `${place}: ${d.notes}` },
    }[d.decision];
    // The submitter sees it where they submitted from; the listing agent (if different) in the portal.
    if (l.submittedByUserId && l.submittedByUserId !== actor.id) {
      const link = l.source === 'owner_submitted' ? `/account/listings/${id}` : `/portal/listings/${id}`;
      await notifyUsers(tx, [l.submittedByUserId], { kind: `review.${d.decision}`, ...msg, link });
    }
    const agentId = patch.listingAgentId !== undefined ? patch.listingAgentId : l.listingAgentId;
    if (agentId && agentId !== actor.id && agentId !== l.submittedByUserId) {
      await notifyUsers(tx, [agentId], { kind: `review.${d.decision}`, ...msg, link: `/portal/listings/${id}` });
    }

    // An agent listing approved with the Seller step skipped gets a fictional RP seller.
    if (d.decision === 'approved' && l.source === 'agent' && !l.sellerClientId) await storeGeneratedSeller(tx, id, id, actor.id);
    if (d.decision === 'approved') await alertSavedSearches(tx, id);

    const bundle = (await loadBundle(tx, id, { confidential: false }))!;
    return { decision: d.decision, status, bundle };
  });
}

export async function withdrawListing(db: DB, actor: Actor, id: string) {
  return db.transaction(async (tx) => {
    const l = await tx.query.listings.findFirst({ where: eq(listings.id, id) });
    if (!l) throw new ServiceError('That listing doesn’t exist.');
    if (!can(actor, 'listing.withdraw', subjectOf(l))) throw new ServiceError('You can’t withdraw this listing.');
    assertTransition(l.status as ListingStatus, 'withdrawn', l.purpose);
    await tx.update(listings).set({ status: 'withdrawn', withdrawnAt: new Date() }).where(eq(listings.id, id));
    await audit(tx, { actorId: actor.id, action: 'listing.withdraw', entity: 'listing', entityId: id, summary: `Withdrew ${l.refNo}` });
  });
}

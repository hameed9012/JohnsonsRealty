import 'server-only';
import { and, asc, eq, inArray, or, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { clients, features, postalZones, users } from '@/db/schema';
import { DISCLOSURE_ITEMS } from '@/db/schema/enums';
import type { ClientConfValues, ClientValues, EditorData, EditorOptions, PersonValues } from '@/components/listing-editor/types';
import type { IconName } from '@/components/ui/Icon';
import { checklist } from '@/lib/listing-checklist';
import { can, type Actor } from '@/lib/permissions';
import { areaOptions, getAreas } from '@/server/queries/areas';
import { checklistInput, loadBundle } from './bundle';
import { WIZARD_STATUSES } from './service';
import { toPropertyView } from './view';

const SPARE = 'Spare seller';
const s = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const yn = (v: boolean | null | undefined) => (v === true ? 'yes' : v === false ? 'no' : '');

type ClientRow = typeof clients.$inferSelect & {
  people: { legalName: string; goesBy: string | null; ageOccupation: string | null; maritalStatus: string | null; signs: boolean; roleLabel: string | null; discord: string | null; robloxUsername: string | null; chirper: string | null }[];
  confidential?: { motivation: string | null; negotiationNotes: string | null; relayLines: string | null; commissionTerms: string | null } | null;
};

const EMPTY_PERSON: PersonValues = { legalName: '', goesBy: '', ageOccupation: '', maritalStatus: '', signs: true, roleLabel: '', discord: '', robloxUsername: '', chirper: '' };

export function clientValues(c: ClientRow | null | undefined): ClientValues {
  return {
    kind: c?.kind ?? 'person',
    displayName: s(c?.displayName),
    legalNameOnForms: s(c?.legalNameOnForms),
    source: s(c?.source),
    bestContact: s(c?.bestContact),
    emergencyContact: s(c?.emergencyContact),
    businessAddress: s(c?.businessAddress),
    currentlyOccupying: s(c?.currentlyOccupying),
    mailingAddressAfter: s(c?.mailingAddressAfter),
    reason: s(c?.reason),
    timeline: s(c?.timeline),
    whoDecides: s(c?.whoDecides),
    background: s(c?.background),
    generatedSeed: s(c?.generatedSeed),
    people: c?.people.length
      ? c.people.map((p) => ({
          legalName: p.legalName,
          goesBy: s(p.goesBy),
          ageOccupation: s(p.ageOccupation),
          maritalStatus: s(p.maritalStatus),
          signs: p.signs,
          roleLabel: s(p.roleLabel),
          discord: s(p.discord),
          robloxUsername: s(p.robloxUsername),
          chirper: s(p.chirper),
        }))
      : [{ ...EMPTY_PERSON }],
  };
}

export function confValues(c: ClientRow['confidential']): ClientConfValues {
  return { motivation: s(c?.motivation), negotiationNotes: s(c?.negotiationNotes), relayLines: s(c?.relayLines), commissionTerms: s(c?.commissionTerms) };
}

export async function loadEditor(actor: Actor, id: string): Promise<{ data: EditorData; options: EditorOptions; confidential: boolean } | null> {
  const subjectRow = await db.query.listings.findFirst({ where: (l, { eq }) => eq(l.id, id) });
  if (!subjectRow) return null;
  const subject = { source: subjectRow.source, status: subjectRow.status, listingAgentId: subjectRow.listingAgentId, submittedByUserId: subjectRow.submittedByUserId };
  if (!can(actor, 'listing.view', subject)) return null;
  const confidential = can(actor, 'listing.viewConfidential', subject);
  const b = (await loadBundle(db, id, { confidential }))!;
  const manager = actor.role === 'owner' || actor.role === 'admin';
  const editable =
    can(actor, 'listing.edit', subject) && WIZARD_STATUSES.includes(subjectRow.status) && (subjectRow.status !== 'pending_review' || manager);

  const [allAreas, feats, zones] = await Promise.all([
    getAreas(),
    db.select().from(features).where(eq(features.active, true)).orderBy(asc(features.displayOrder)),
    db.select({ code: postalZones.code, label: postalZones.label, areaId: postalZones.areaId }).from(postalZones).orderBy(asc(postalZones.code)),
  ]);

  const sellerClient = b.seller ? ({ ...b.seller, confidential: (b.seller as ClientRow).confidential ?? null } as ClientRow) : null;
  const terms = b.terms;
  const lease = b.lease;
  const biz = b.business;
  const det = b.details;
  const own = b.ownership;
  const conf = confidential ? (b as typeof b & { confidential?: Record<string, unknown> | null }).confidential ?? null : null;
  const lastReview = b.reviews[0] ?? null;

  const data: EditorData = {
    id: b.id,
    refNo: b.refNo,
    source: b.source,
    status: b.status,
    round: b.round,
    editable,
    property: {
      type: b.type,
      purpose: b.purpose,
      addressLine: s(b.addressLine),
      unit: s(b.unit),
      areaId: s(b.areaId),
      postalCode: s(b.postalCode),
      postal: s(b.postal),
      parcelId: s(b.parcelId),
      beds: s(b.beds),
      baths: s(b.baths),
      sqft: s(b.sqft),
      lot: s(b.lot),
      yearBuilt: s(b.yearBuilt),
      garage: s(b.garage),
      featureIds: b.features.map((f) => f.featureId),
      description: s(b.description),
      propertyStyle: s(det?.propertyStyle),
      otherRooms: s(det?.otherRooms),
      parking: s(det?.parking),
      basement: s(det?.basement),
      heating: s(det?.heating),
      cooling: s(det?.cooling),
      waterHeater: s(det?.waterHeater),
      waterSewer: s(det?.waterSewer),
      electrical: s(det?.electrical),
      roof: s(det?.roof),
      windows: s(det?.windows),
      appliancesProvided: s(det?.appliancesProvided),
      furnished: s(det?.furnished),
      taxes: s(det?.taxes),
      hoa: s(det?.hoa),
      utilities: s(det?.utilities),
      zoning: s(det?.zoning),
      occupancy: s(det?.occupancy),
      businessName: s(biz?.businessName),
      nameWithheld: biz?.nameWithheld ?? false,
      teaser: s(biz?.teaser),
      businessType: s(biz?.businessType),
      openedYear: s(biz?.openedYear),
      employees: s(biz?.employees),
      hours: s(biz?.hours),
      seats: s(biz?.seats),
      whatIsSold: s(biz?.whatIsSold),
      buildingSize: s(biz?.buildingSize),
      tradingHistory: s(biz?.tradingHistory),
    },
    terms: {
      price: s(b.price),
      availableFrom: s(b.availableFrom),
      showingInstructions: s(b.showingInstructions),
      agreementStart: s(terms?.agreementStart),
      agreementEnd: s(terms?.agreementEnd),
      earnestMoneyExpected: s(terms?.earnestMoneyExpected),
      targetSettlement: s(terms?.targetSettlement),
      possession: s(terms?.possession),
      included: s(terms?.included ?? biz?.included),
      excluded: s(terms?.excluded ?? biz?.excluded),
      leasedItems: s(terms?.leasedItems),
      transferTax: s(terms?.transferTax),
      titleCompany: s(terms?.titleCompany),
      attorney: s(terms?.attorney),
      homeWarranty: s(terms?.homeWarranty),
      financingAccepted: s(terms?.financingAccepted),
      offerReplies: s(terms?.offerReplies),
      asIs: terms?.asIs ?? false,
      yardSign: yn(terms?.yardSign),
      photosAllowed: yn(terms?.photosAllowed),
      lockbox: yn(terms?.lockbox),
      showingNotice: s(terms?.showingNotice),
      leaseLengthMonths: s(lease?.leaseLengthMonths),
      deposit: s(lease?.deposit),
      dueAtSigning: s(lease?.dueAtSigning),
      rentDue: s(lease?.rentDue),
      lateFee: s(lease?.lateFee),
      paymentMethod: s(lease?.paymentMethod),
      renewal: s(lease?.renewal),
      leaseUtilities: s(lease?.utilities),
      yardAndSnow: s(lease?.yardAndSnow),
      maxOccupants: s(lease?.maxOccupants),
      pets: s(lease?.pets),
      smoking: s(lease?.smoking),
      subletting: s(lease?.subletting),
      insurance: s(lease?.insurance),
      moveInInspection: s(lease?.moveInInspection),
      leasingFee: s(lease?.leasingFee),
      incomeRequirement: s(lease?.incomeRequirement),
      checks: s(lease?.checks),
      references: s(lease?.references),
      applicationFee: s(lease?.applicationFee),
      decisionTime: s(lease?.decisionTime),
      ownerFinancing: s(biz?.ownerFinancing),
      priceBuilding: s(biz?.priceBuilding),
      priceEquipment: s(biz?.priceEquipment),
      priceInventory: s(biz?.priceInventory),
      priceGoodwill: s(biz?.priceGoodwill),
      licences: s(biz?.licences),
      training: s(biz?.training),
      nonCompete: s(biz?.nonCompete),
      staffTerms: s(biz?.staffTerms),
      premisesRent: s(biz?.premisesRent),
      premisesLeaseEnd: s(biz?.premisesLeaseEnd),
      premisesLandlord: s(biz?.premisesLandlord),
      businessConfidential: biz?.confidential ?? true,
    },
    seller:
      b.source === 'agent'
        ? {
            clientId: s(b.sellerClientId),
            client: clientValues(sellerClient),
            clientConfidential: confValues(sellerClient?.confidential),
            vesting: s(own?.vesting),
            whoSigns: s(own?.whoSigns),
            boughtOn: s(own?.boughtOn),
            boughtFor: s(own?.boughtFor),
            ownedSince: s(own?.ownedSince),
            deedReference: s(own?.deedReference),
            mortgage: s(own?.mortgage),
            liens: s(own?.liens),
            disclosures: DISCLOSURE_ITEMS.map((item) => {
              const d = b.disclosures.find((x) => x.item === item);
              return { item, answer: s(d?.answer), detail: s(d?.detail) };
            }),
            bottomLine: s(conf?.bottomLine),
            negotiationRules: s(conf?.negotiationRules),
            relayLines: s(conf?.relayLines),
            commissionTerms: s(conf?.commissionTerms),
            yearlySales: s(conf?.yearlySales),
            yearlyProfit: s(conf?.yearlyProfit),
            inventoryValue: s(conf?.inventoryValue),
            disclosureNotes: s(conf?.disclosureNotes),
          }
        : null,
    owner:
      b.source === 'owner_submitted'
        ? {
            legalName: s(sellerClient?.people[0]?.legalName ?? b.submitter?.displayName),
            coOwners:
              sellerClient?.legalNameOnForms && sellerClient.people[0] && sellerClient.legalNameOnForms.startsWith(sellerClient.people[0].legalName + ' and ')
                ? sellerClient.legalNameOnForms.slice(sellerClient.people[0].legalName.length + 5)
                : '',
            bestContact: s(sellerClient?.bestContact),
            reason: s(sellerClient?.reason),
            timeline: s(sellerClient?.timeline),
            ownerContact: { discord: false, roblox: true, chirper: true, ...(b.ownerContact ?? {}) },
          }
        : null,
    photos: b.photos.map((p) => ({ id: p.id, storageId: p.media.storageId, width: p.media.width, height: p.media.height, alt: p.alt, caption: p.caption, isCover: p.isCover })),
    lastReview: lastReview ? { decision: lastReview.decision, notes: lastReview.notes, round: lastReview.round, decidedAt: lastReview.decidedAt?.toISOString() ?? null } : null,
    checklist: checklist(checklistInput(b)),
    preview: toPropertyView(b),
  };

  let clientOptions: EditorOptions['clients'] = [];
  if (b.source === 'agent') {
    const manager = actor.role === 'owner' || actor.role === 'admin';
    const rows = (await db.query.clients.findMany({
      // Agents see their own clients plus the imported spare sellers, which anyone may use.
      where: manager ? eq(clients.archived, false) : and(eq(clients.archived, false), or(eq(clients.agentId, actor.id), sql`${SPARE} = any(${clients.tags})`)),
      with: { people: { orderBy: (p, { asc }) => [asc(p.sortOrder)] }, confidential: true },
      orderBy: [asc(clients.displayName)],
      limit: 300,
    })) as ClientRow[];
    clientOptions = rows.map((c) => ({ id: c.id, label: c.tags.includes(SPARE) ? `${c.displayName} (spare seller)` : c.displayName, client: clientValues(c), confidential: confValues(c.confidential) }));
  }

  const account =
    b.source === 'owner_submitted' && b.submittedByUserId
      ? await db.query.users.findFirst({ where: inArray(users.id, [b.submittedByUserId]), columns: { displayName: true, robloxUsername: true, chirperHandle: true } })
      : null;

  return {
    data,
    confidential,
    options: {
      areas: areaOptions(allAreas).map((o) => ({ value: o.value, label: o.label, postalCodes: o.area.postalCodes })),
      zones,
      features: feats.map((f) => ({ value: f.id, label: f.label, icon: (f.icon as IconName | null) ?? undefined })),
      clients: clientOptions,
      account: account ? { displayName: account.displayName ?? '', robloxUsername: account.robloxUsername, chirperHandle: account.chirperHandle } : undefined,
    },
  };
}

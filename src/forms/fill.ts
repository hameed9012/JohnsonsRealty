// "Fill from client file": maps the client file, listing and deal onto the shared field ids. One map serves every
// form; applyFill() keeps the keys a form actually has. Pure, so it is unit-tested without a database.
import { BUSINESS_TYPES, DEPOSIT_METHODS, OCCUPANCY, PROPERTY_TYPES, WHAT_IS_SOLD } from './defs';
import type { DocData } from './types';

export interface FillParty {
  displayName: string;
  legalNameOnForms: string | null;
  bestContact: string | null;
  mailingAddressAfter: string | null;
  currentlyOccupying?: string | null;
  businessAddress: string | null;
  people: { legalName: string; signs: boolean; robloxUsername: string | null }[];
}

export interface FillListing {
  addressLine: string;
  unit: string | null;
  postalCode: string | null;
  parcelId: string | null;
  county: string;
  price: number | null;
  beds: number | null;
  baths: number | null;
  yearBuilt: number | null;
  garage: string | null;
  showingInstructions: string | null;
  area: { name: string; city: string | null; postalCodes: string[]; parent: { name: string } | null } | null;
  details: { propertyStyle: string | null; parking: string | null; legalDescription: string | null; zoning: string | null; occupancy: string | null; taxes: string | null; hoa: string | null } | null;
  ownership: { vesting: string | null; ownedSince: string | null; mortgage: string | null } | null;
  terms: {
    agreementStart: string | null;
    agreementEnd: string | null;
    included: string | null;
    excluded: string | null;
    leasedItems: string | null;
    transferTax: string | null;
    titleCompany: string | null;
    attorney: string | null;
    possession: string | null;
    yardSign: boolean | null;
    photosAllowed: boolean | null;
    lockbox: boolean | null;
    showingNotice: string | null;
  } | null;
  business: {
    businessName: string | null;
    entity: string | null;
    signerCapacity: string | null;
    businessType: string | null;
    openedYear: number | null;
    employees: number | null;
    hours: string | null;
    whatIsSold: string | null;
    buildingSize: string | null;
    premisesRent: string | null;
    premisesLeaseEnd: string | null;
    premisesLandlord: string | null;
    ownerFinancing: string | null;
    priceBuilding: number | null;
    priceEquipment: number | null;
    priceInventory: number | null;
    priceGoodwill: number | null;
    included: string | null;
    excluded: string | null;
    licences: string | null;
    training: string | null;
  } | null;
  disclosures: { item: string; answer: 'yes' | 'no' | 'unknown' | 'na' | null; detail: string | null }[];
}

export interface FillContext {
  seller?: FillParty | null;
  buyer?: FillParty | null;
  listing?: FillListing | null;
  /** Only passed when the actor may see the listing's confidential figures. */
  confidential?: { yearlySales: number | null; yearlyProfit: number | null; inventoryValue: number | null } | null;
  deal?: { settlementDate: string | null; depositMethod?: string | null } | null;
  agentName?: string | null;
  brokerageName?: string | null;
  /** The Agreement of Sale (or Business Sale Agreement) number on the same deal. */
  agreementNo?: string | null;
  now?: Date;
}

/** The name exactly as it goes on forms: the file's form name, else everyone who signs, else the file name. */
export function partyName(p: FillParty): string {
  if (p.legalNameOnForms) return p.legalNameOnForms;
  const signers = p.people.filter((x) => x.signs).map((x) => x.legalName);
  return signers.length ? signers.join(' & ') : p.displayName;
}

const s = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const yn = (v: boolean | null | undefined) => (v === true ? 'Yes' : v === false ? 'No' : '');
/** Only sets a select when the stored text is one of its options. */
const pick = (v: string | null | undefined, options: readonly string[]) => (v && options.includes(v) ? v : '');
const ANSWER = { yes: 'Yes', no: 'No', unknown: 'Unknown', na: 'N/A' } as const;

function party(prefix: 'seller' | 'buyer', p: FillParty | null | undefined, out: DocData) {
  if (!p) return;
  out[`${prefix}_name`] = partyName(p);
  out[`${prefix}_contact`] = p.people.find((x) => x.robloxUsername)?.robloxUsername ?? p.bestContact ?? '';
  out[`${prefix}_addr`] = s(p.mailingAddressAfter ?? (prefix === 'buyer' ? p.currentlyOccupying : null) ?? p.businessAddress);
}

export function fillFrom(ctx: FillContext): DocData {
  const out: DocData = {};
  party('seller', ctx.seller, out);
  party('buyer', ctx.buyer, out);
  if (ctx.agentName) out.agent_name = ctx.agentName;
  if (ctx.brokerageName) {
    out.listing_broker = ctx.brokerageName;
    out.escrow_account = `${ctx.brokerageName} · Real Estate Escrow Account`;
  }
  if (ctx.agreementNo) out.agreement_no = ctx.agreementNo;
  if (ctx.deal?.settlementDate) out.settle_date = ctx.deal.settlementDate;
  if (ctx.deal?.depositMethod) out.deposit_method = pick(ctx.deal.depositMethod, DEPOSIT_METHODS);

  const l = ctx.listing;
  if (l) {
    Object.assign(out, {
      prop_address: l.addressLine + (l.unit ? `, Unit ${l.unit}` : ''),
      prop_area: l.area ? (l.area.parent ? `${l.area.name} · ${l.area.parent.name}` : l.area.name) : '',
      prop_city: s(l.area?.city ?? l.area?.parent?.name ?? l.area?.name),
      prop_zip: s(l.postalCode ?? l.area?.postalCodes[0]),
      prop_county: l.county,
      parcel: s(l.parcelId),
      price: s(l.price),
      prop_beds: s(l.beds),
      prop_baths: s(l.baths),
      prop_year: s(l.yearBuilt),
      prop_park: s(l.details?.parking ?? l.garage),
      prop_type: pick(l.details?.propertyStyle, PROPERTY_TYPES),
      prop_legal: s(l.details?.legalDescription),
      prop_zoning: s(l.details?.zoning),
      occupancy: pick(l.details?.occupancy, OCCUPANCY),
      taxes: s(l.details?.taxes),
      hoa: s(l.details?.hoa),
      seller_vesting: s(l.ownership?.vesting),
      owned_since: s(l.ownership?.ownedSince),
      mortgage: s(l.ownership?.mortgage),
      show_notes: s(l.showingInstructions ?? l.terms?.showingNotice),
    });
    const t = l.terms;
    if (t) {
      Object.assign(out, {
        listing_start: s(t.agreementStart),
        listing_end: s(t.agreementEnd),
        included: s(t.included),
        excluded: s(t.excluded),
        leased_items: s(t.leasedItems),
        transfer_tax: pick(t.transferTax, ['Split equally between Buyer and Seller', 'Paid by Buyer', 'Paid by Seller']),
        settle_co: s(t.titleCompany),
        seller_lawyer: s(t.attorney),
        possession: pick(t.possession, ['At settlement, by delivery of deed and keys', 'Subject to existing lease']),
        yard_sign: yn(t.yardSign),
        photos_allowed: yn(t.photosAllowed),
        lockbox: yn(t.lockbox),
      });
    }
    for (const d of l.disclosures) {
      if (d.answer) out[`cond.${d.item}.a`] = ANSWER[d.answer];
      if (d.detail) out[`cond.${d.item}.d`] = d.detail;
    }
    const b = l.business;
    if (b) {
      const year = (ctx.now ?? new Date()).getUTCFullYear();
      Object.assign(out, {
        biz_name: s(b.businessName),
        biz_entity: s(b.entity),
        biz_signer: s(b.signerCapacity),
        biz_type: pick(b.businessType, BUSINESS_TYPES),
        biz_years: b.openedYear ? String(Math.max(year - b.openedYear, 0)) : '',
        biz_emp: s(b.employees),
        biz_hours: s(b.hours),
        biz_re: pick(b.whatIsSold, WHAT_IS_SOLD),
        biz_sqft: s(b.buildingSize),
        biz_rent: s(b.premisesRent),
        biz_lease_end: s(b.premisesLeaseEnd),
        biz_landlord: s(b.premisesLandlord),
        biz_sf: pick(b.ownerFinancing, ['No', 'Yes, up to 15% of the price', 'Yes, up to 20% of the price', 'Yes, up to 25% of the price']),
        biz_included: s(b.included),
        biz_excluded: s(b.excluded),
        biz_licenses: s(b.licences),
        biz_training: s(b.training),
        'alloc.building.amt': s(b.priceBuilding),
        'alloc.equipment.amt': s(b.priceEquipment),
        'alloc.inventory.amt': s(b.priceInventory),
        'alloc.goodwill.amt': s(b.priceGoodwill),
      });
    }
  }
  if (ctx.confidential) {
    Object.assign(out, { biz_sales: s(ctx.confidential.yearlySales), biz_profit: s(ctx.confidential.yearlyProfit), biz_inv: s(ctx.confidential.inventoryValue) });
  }
  return out;
}

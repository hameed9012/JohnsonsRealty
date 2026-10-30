// "Fill from client file": maps the client file, listing and deal onto the shared field ids. One map serves every
// form; applyFill() keeps the keys a form actually has. Pure, so it is unit-tested without a database.
import { BUSINESS_TYPES, DEPOSIT_METHODS, OCCUPANCY, PROPERTY_TYPES, WHAT_IS_SOLD } from './defs';
import type { DocData } from './types';

export interface FillParty {
  kind?: string | null;
  displayName: string;
  legalNameOnForms: string | null;
  bestContact: string | null;
  mailingAddressAfter: string | null;
  currentlyOccupying?: string | null;
  businessAddress: string | null;
  people: { legalName: string; signs: boolean; robloxUsername: string | null; discord?: string | null }[];
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
  purpose?: string | null;
  details: {
    propertyStyle: string | null;
    parking: string | null;
    legalDescription: string | null;
    zoning: string | null;
    occupancy: string | null;
    taxes: string | null;
    hoa: string | null;
    roof?: string | null;
    basement?: string | null;
    heating?: string | null;
    cooling?: string | null;
    waterHeater?: string | null;
    waterSewer?: string | null;
    electrical?: string | null;
    windows?: string | null;
  } | null;
  ownership: { vesting: string | null; ownedSince: string | null; mortgage: string | null; boughtOn?: string | null } | null;
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
    earnestMoneyExpected?: string | null;
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
  confidential?: { yearlySales: number | null; yearlyProfit: number | null; inventoryValue: number | null; commissionTerms?: string | null } | null;
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
const words = (x: string) => new Set(x.toLowerCase().replace(/[^a-z0-9%]+/g, ' ').split(' ').filter((w) => w.length > 2));

/**
 * Sets a select from free text: an exact match, then an option the text starts with (or that starts with the
 * text), then the option sharing the most words. "Split equally" → "Split equally between Buyer and Seller";
 * "Single-family detached, two storeys" → "Single-family detached". Leaves it blank when nothing fits.
 */
export function pick(v: string | null | undefined, options: readonly string[]): string {
  if (!v) return '';
  const t = v.trim().toLowerCase();
  const exact = options.find((o) => o.toLowerCase() === t);
  if (exact) return exact;
  const prefix = options.find((o) => t.startsWith(o.toLowerCase()) || o.toLowerCase().startsWith(t));
  if (prefix) return prefix;
  const w = words(v);
  let best = '';
  let score = 0;
  for (const o of options) {
    const n = [...words(o)].filter((x) => w.has(x)).length;
    if (n > score) [best, score] = [o, n];
  }
  return best;
}

/** The first dollar amount in a line of text: "At least $10,000" → 10000. */
function firstAmount(v: string | null | undefined): number | null {
  const m = /\$\s?([\d,]+(?:\.\d+)?)/.exec(v ?? '');
  return m ? Math.round(Number(m[1]!.replace(/,/g, ''))) : null;
}

/** "5% total, 2.5% to each side" → 5 / 2.5 / 2.5; "10%" → 10 / 10. */
function commission(terms: string | null | undefined): DocData {
  const pcts = [...(terms ?? '').matchAll(/(\d+(?:\.\d+)?)\s?%/g)].map((m) => m[1]!);
  if (!pcts.length) return {};
  const [total, side = total] = pcts;
  return { comm_total: total!, comm_side: side!, comm_coop: pcts.length > 1 ? side! : '' };
}

/** "Yes, up to 20% of the price, over three years at 6%" → the seller note's amount, term and rate. */
function sellerFinancing(v: string | null | undefined, price: number | null): DocData {
  if (!v || /^\s*no/i.test(v)) return {};
  const share = /up to (\d+(?:\.\d+)?)\s?%/i.exec(v)?.[1];
  const years = /over (\w+) years?/i.exec(v)?.[1];
  const rate = /at (\d+(?:\.\d+)?)\s?%/i.exec(v)?.[1];
  const words: Record<string, string> = { one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', ten: '10' };
  const n = years ? (words[years.toLowerCase()] ?? years) : null;
  return {
    sf_amount: share && price ? String(Math.round((price * Number(share)) / 100)) : '',
    sf_term: n ? `${n} years, monthly payments` : '',
    sf_rate: rate ? `${rate}% per year` : '',
  };
}

/** "Yes, until settlement" → Owner-occupied; "No. The house is vacant." → Vacant. */
function occupancyOf(l: FillListing, seller: FillParty | null | undefined): string {
  const stored = l.details?.occupancy;
  if (stored) {
    if (/tenant|rent|lease/i.test(stored)) return 'Tenant-occupied';
    if (/vacant|empty/i.test(stored)) return 'Vacant';
    if (/owner/i.test(stored)) return 'Owner-occupied';
  }
  const living = seller?.currentlyOccupying ?? '';
  if (/vacant/i.test(living) || /^\s*no\b/i.test(living)) return 'Vacant';
  if (/^\s*yes\b/i.test(living)) return 'Owner-occupied';
  return pick(stored, OCCUPANCY);
}

/**
 * The condition table from the property's own facts, for listings whose seller file has no item-by-item
 * answers. Each line says what the file says ("Asphalt shingle, replaced 2017") with "No" known problem.
 */
function derivedConditions(l: FillListing, out: DocData) {
  const d = l.details;
  const line = (item: string, answer: string, detail: string | null | undefined) => {
    if (!detail) return;
    out[`cond.${item}.a`] = answer;
    out[`cond.${item}.d`] = detail;
  };
  line('roof', 'No', d?.roof);
  if (d?.basement) line('basement_water', /^\s*none|slab/i.test(d.basement) ? 'N/A' : 'No', d.basement);
  line('heating', 'No', d?.heating);
  line('cooling', /^\s*none/i.test(d?.cooling ?? '') ? 'N/A' : 'No', d?.cooling);
  line('water_heater', 'No', d?.waterHeater);
  line('electrical', 'No', d?.electrical);
  line('water_sewer', 'No', d?.waterSewer);
  line('windows_doors', 'No', d?.windows);
  if (l.yearBuilt) {
    line('lead_paint', l.yearBuilt < 1978 ? 'Unknown' : 'N/A', l.yearBuilt < 1978 ? `Built ${l.yearBuilt}, before 1978: the lead-based paint disclosure is required` : `Built ${l.yearBuilt}`);
  }
  if (d?.hoa) line('hoa', /^\s*none/i.test(d.hoa) ? 'N/A' : 'No', d.hoa);
}
const ANSWER = { yes: 'Yes', no: 'No', unknown: 'Unknown', na: 'N/A' } as const;

function party(prefix: 'seller' | 'buyer', p: FillParty | null | undefined, out: DocData) {
  if (!p) return;
  out[`${prefix}_name`] = partyName(p);
  out[`${prefix}_contact`] = p.people.find((x) => x.robloxUsername)?.robloxUsername ?? p.people.find((x) => x.discord)?.discord ?? p.bestContact ?? '';
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
      occupancy: occupancyOf(l, ctx.seller),
      taxes: s(l.details?.taxes),
      hoa: s(l.details?.hoa),
      seller_vesting: s(l.ownership?.vesting),
      owned_since: s(l.ownership?.ownedSince ?? l.ownership?.boughtOn),
      seller_capacity: ctx.seller?.kind === 'estate' ? 'Executor of an estate' : ctx.seller ? 'The owner' : '',
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
        // "At least $10,000" → 10000. The deposit is still the buyer's to offer; this is what the seller expects.
        deposit: s(firstAmount(t.earnestMoneyExpected)),
      });
    }
    if (!l.disclosures.length) derivedConditions(l, out);
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
        biz_type: b.businessType ? pick(b.businessType, BUSINESS_TYPES) || 'Other' : '',
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
        ...sellerFinancing(b.ownerFinancing, l.price),
      });
    }
  }
  if (ctx.confidential) {
    Object.assign(out, { biz_sales: s(ctx.confidential.yearlySales), biz_profit: s(ctx.confidential.yearlyProfit), biz_inv: s(ctx.confidential.inventoryValue) });
    Object.assign(out, commission(ctx.confidential.commissionTerms));
  }
  return out;
}

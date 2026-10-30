// Turns the parsed seller files and forms data into the records the importer creates. Pure, so the
// preview (import/legacy.json and Settings → Import) shows exactly what will be saved.
import { DISCLOSURE_ITEMS } from '@/db/schema/enums';
import { postalFromAddress } from '@/lib/map';
import type { Block, FormExtra, FormSeller, GlanceRow, LegacySection } from './parse';

type ClientKind = 'person' | 'couple' | 'company' | 'estate';
type ClientRole = 'seller' | 'landlord' | 'business_owner';
type Answer = 'yes' | 'no' | 'unknown' | 'na';

export interface PersonPlan {
  legalName: string;
  goesBy: string | null;
  ageOccupation: string | null;
  maritalStatus: string | null;
  signs: boolean;
  roleLabel: string | null;
  discord: string | null;
}

export interface ClientPlan {
  key: string;
  kind: ClientKind;
  displayName: string;
  legalNameOnForms: string | null;
  roles: ClientRole[];
  tags: string[];
  bestContact: string | null;
  emergencyContact: string | null;
  businessAddress: string | null;
  currentlyOccupying: string | null;
  mailingAddressAfter: string | null;
  reason: string | null;
  timeline: string | null;
  whoDecides: string | null;
  background: string | null;
  notes: string | null;
  people: PersonPlan[];
  confidential: { motivation: string | null; negotiationNotes: string | null; relayLines: string | null; commissionTerms: string | null };
}

export interface ListingPlan {
  key: string;
  type: 'house' | 'rental' | 'business';
  purpose: 'sale' | 'rent';
  status: 'active' | 'for_lease' | 'sold';
  addressLine: string;
  postal: string | null;
  postalCode: string | null;
  /** Town or area named in the file ("Susquehanna Township (Fairview)"), used when the postal code has no zone yet. */
  areaHint: string | null;
  county: string;
  price: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  lot: string | null;
  yearBuilt: number | null;
  garage: string | null;
  description: string | null;
  showingInstructions: string | null;
  availableFrom: string | null;
  /** The "Listed" date: becomes published_at and the price history's first entry. */
  listedOn: string | null;
  property: Record<string, string | null>;
  ownership: { vesting: string | null; whoSigns: string | null; boughtOn: string | null; boughtFor: number | null; ownedSince: string | null; deedReference: string | null; mortgage: string | null; liens: string | null };
  terms: Record<string, string | number | boolean | null> | null;
  lease: Record<string, string | number | null> | null;
  business: Record<string, string | number | boolean | null> | null;
  disclosures: { item: (typeof DISCLOSURE_ITEMS)[number]; answer: Answer | null; detail: string | null }[];
  confidential: Record<string, string | number | null>;
  /** Folder under the repo with this listing's photos, in order (01 is the cover). */
  photosDir: string | null;
  /** Sold listings get a sale record. The Owner confirms price and date in the preview. */
  sale: { price: number | null; soldOn: string | null } | null;
}

export interface Flag {
  key: string;
  field: string;
  message: string;
}

export interface LegacyPlan {
  clients: ClientPlan[];
  listings: ListingPlan[];
  flags: Flag[];
}

/** Sellers with a real property in the files; everyone else is a spare client file. */
export const REAL = ['porter', 'kowalski', 'raman', 'castellano', 'hartmann', 'hayes', 'novak', 'lindqvist'] as const;
const SOLD = new Set(['castellano']);
/** Postal codes the files can't give by the house-number rule (the 601 houses share one postal code). */
const POSTAL: Record<string, string> = { raman: '601', castellano: '601', hartmann: '601', kowalski: '809' };
const PHOTOS: Record<string, string> = { hartmann: 'photos/6012-estate-drive', novak: 'photos/novak-two-storey-house', lindqvist: 'photos/common-cents-laundromat' };

// ---- Small readers ----

const YOU_CHOOSE = /you choose|fill in from/i;

export function money(s: string | null | undefined): number | null {
  const m = /\$\s?([\d,]+(?:\.\d+)?)/.exec(s ?? '');
  return m ? Math.round(Number(m[1]!.replace(/,/g, ''))) : null;
}

export function int(s: string | null | undefined): number | null {
  const m = /(\d[\d,]*)/.exec(s ?? '');
  return m ? Number(m[1]!.replace(/,/g, '')) : null;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
/** "Oct 14, 2026" → "2026-10-14". */
export function isoDate(s: string | null | undefined): string | null {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s.trim())) return s.trim();
  const m = /([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),\s*(\d{4})/.exec(s);
  if (!m) return null;
  const mo = MONTHS.indexOf(m[1]!.toLowerCase());
  return mo < 0 ? null : `${m[3]}-${String(mo + 1).padStart(2, '0')}-${m[2]!.padStart(2, '0')}`;
}

const clean = (s: string | null | undefined): string | null => {
  const t = (s ?? '').replace(/\*\*/g, '').trim();
  return t && !YOU_CHOOSE.test(t) ? t : null;
};
const yesNo = (s: string | null | undefined): boolean | null => (s == null ? null : /^\s*(yes|both allowed)/i.test(s) ? true : /^\s*no\b/i.test(s) ? false : null);
const table = (b: Block | undefined): Record<string, string> => (b && !Array.isArray(b) ? b : {});
const list = (b: Block | undefined): string[] => (Array.isArray(b) ? b.map((x) => x.replace(/\*\*/g, '')) : []);
/** The first value whose label matches. */
function pick(t: Record<string, string>, ...labels: (string | RegExp)[]): string | null {
  for (const l of labels) {
    const k = Object.keys(t).find((k) => (typeof l === 'string' ? k.toLowerCase() === l.toLowerCase() : l.test(k)));
    if (k && t[k] != null) return t[k]!;
  }
  return null;
}
const lines = (xs: string[]) => (xs.length ? xs.map((x) => `- ${x}`).join('\n') : null);
const fieldsText = (t: Record<string, string>) => Object.entries(t).map(([k, v]) => `${k}: ${v}`).join('\n');

// ---- People ----

/** "Priya Raman and Daniel James Raman" → two names; "Anthony Joseph Castellano and Renée Marie Castellano" likewise. */
function splitNames(s: string): string[] {
  return s.split(/\s+and\s+/).map((x) => x.trim()).filter(Boolean);
}

/** "PRaman_MD (Priya), DanRaman (Daniel)" → { priya: PRaman_MD, daniel: DanRaman }. */
function handles(s: string | null): { byName: Record<string, string>; all: string[] } {
  const byName: Record<string, string> = {};
  const all: string[] = [];
  for (const part of (s ?? '').split(/,|\//)) {
    const m = /^\s*([^\s(]+)\s*(?:\(([^)]+)\))?/.exec(part);
    if (!m || !m[1]) continue;
    all.push(m[1]);
    if (m[2]) byName[m[2].trim().toLowerCase()] = m[1];
  }
  return { byName, all };
}

/**
 * "Priya 39, anesthesiologist. Daniel 41, software architect." → per first name. When one sentence names
 * both ("Anthony 52, Renée 49. Co-owners of …"), the next sentence is their shared occupation.
 */
function agesByName(s: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  const sentences = (s ?? '').split(/\.\s+|\.$/).map((x) => x.trim()).filter(Boolean);
  sentences.forEach((sentence, i) => {
    const hits = [...sentence.matchAll(/([A-Z][\p{L}]+)\s+(\d{2})\b/gu)];
    if (hits.length === 1) {
      const rest = sentence.slice(hits[0]!.index! + hits[0]![0].length).replace(/^,\s*/, '');
      out[hits[0]![1]!.toLowerCase()] = [hits[0]![2], rest].filter(Boolean).join(', ');
    } else if (hits.length > 1) {
      const shared = sentences[i + 1] && !/\d{2}/.test(sentences[i + 1]!) ? sentences[i + 1] : null;
      for (const h of hits) out[h[1]!.toLowerCase()] = [h[2], shared].filter(Boolean).join(', ');
    }
  });
  return out;
}

function peopleOf(sec: LegacySection, t: Record<string, string>): PersonPlan[] {
  const contact = handles(pick(t, 'Contact'));
  const marital = pick(t, 'Marital status');
  if (sec.key === 'hayes') {
    return [{ legalName: 'Victor Allen Hayes', goesBy: 'Victor', ageOccupation: pick(t, 'Age and background'), maritalStatus: null, signs: true, roleLabel: 'Managing member', discord: contact.all[0] ?? null }];
  }
  if (sec.key === 'brennan') {
    const ex = pick(t, "Executor's full legal name") ?? '';
    return [{ legalName: ex.replace(/\s*\(.*$/, ''), goesBy: null, ageOccupation: pick(t, 'Age and occupation'), maritalStatus: null, signs: true, roleLabel: 'Executor', discord: contact.all[0] ?? null }];
  }
  const names = splitNames(pick(t, 'Full legal names', 'Full legal name') ?? sec.name);
  const ages = agesByName(pick(t, 'Ages and occupations'));
  const owner = /Owner/.test(Object.keys(sec.blocks)[0] ?? '');
  return names.map((n, i) => {
    const first = n.split(/\s+/)[0]!.toLowerCase();
    return {
      legalName: n,
      goesBy: (names.length === 1 ? pick(t, 'Goes by') : null) ?? /"([^"]+)"/.exec(n)?.[1] ?? n.split(/\s+/)[0]!,
      ageOccupation: names.length === 1 ? pick(t, 'Age and occupation', 'Age') : ages[first] ?? null,
      maritalStatus: marital,
      signs: true,
      roleLabel: owner ? pick(t, 'Signing as') : null,
      discord: contact.byName[first] ?? contact.all[i] ?? null,
    };
  });
}

// ---- Clients ----

function clientOf(sec: LegacySection, real: boolean): ClientPlan {
  const first = Object.keys(sec.blocks)[0] ?? '';
  const t = table(sec.blocks[first]);
  const isBusiness = first === 'Owner';
  const people = peopleOf(sec, t);
  const kind: ClientKind = sec.key === 'brennan' ? 'estate' : sec.key === 'hayes' ? 'company' : isBusiness ? 'company' : people.length > 1 ? 'couple' : 'person';
  const legal = pick(t, 'Seller name on forms', 'Landlord (legal name)', 'Selling company') ?? (people.length ? people.map((p) => p.legalName).join(' and ') : null);
  const neg = list(sec.blocks['Negotiation (Hameed only)']);
  const relay = list(sec.blocks['Lines Hameed can relay']);
  const terms = table(sec.blocks['Listing terms']);
  const role: ClientRole = sec.key === 'hayes' ? 'landlord' : isBusiness ? 'business_owner' : 'seller';
  // Spare files keep the property / business blocks as notes, so nothing in the file is lost.
  const extra = real
    ? null
    : Object.entries(sec.blocks)
        .filter(([b]) => !/^(Seller|Sellers|Owner|Negotiation|Lines Hameed)/.test(b))
        .map(([b, v]) => `${b}\n${Array.isArray(v) ? lines(v) : fieldsText(v)}`)
        .join('\n\n');
  const background = [sec.intro, pick(t, 'Owner who died') && `Owner who died: ${pick(t, 'Owner who died')}`, pick(t, 'Heirs') && `Heirs: ${pick(t, 'Heirs')}`, pick(t, 'Proof she can sell') && `Proof she can sell: ${pick(t, 'Proof she can sell')}`, pick(t, 'Other rentals') && `Other rentals: ${pick(t, 'Other rentals')}`]
    .filter(Boolean)
    .join('\n\n');
  return {
    key: sec.key,
    kind,
    displayName: sec.name.replace(/\s*\(.*\)$/, ''),
    legalNameOnForms: legal,
    roles: [role],
    tags: real ? [] : ['Spare seller'],
    bestContact: pick(t, /^Best way to reach/),
    emergencyContact: pick(t, 'Emergency repairs'),
    businessAddress: pick(t, 'Business address'),
    currentlyOccupying: pick(t, 'Living in the house now?'),
    mailingAddressAfter: pick(t, 'Mailing address after the move', 'Mailing address', 'Her mailing address'),
    reason: pick(t, 'Reason for selling'),
    timeline: clean(pick(terms, 'Settlement date')),
    whoDecides: pick(t, /^Who (helps|decides|must approve)/),
    background: background || null,
    notes: extra || null,
    people,
    confidential: {
      motivation: pick(t, 'Reason for selling'),
      negotiationNotes: lines(neg),
      relayLines: lines(relay),
      commissionTerms: pick(terms, 'Commission'),
    },
  };
}

// ---- Listings ----

function addressOf(sec: LegacySection, form: FormSeller | undefined): string {
  const p = table(sec.blocks.Property);
  const b = table(sec.blocks.Business);
  const raw = form?.f.prop_address || pick(p, 'Street address', 'Street address and postal code') || pick(b, 'Address') || '';
  if (YOU_CHOOSE.test(raw)) return '';
  // "8095 Lakeway Street, Fairview (Postal 809)" → the street line only; the area comes from the postal zone.
  if (sec.key === 'lindqvist') return 'Building 8061';
  return raw.replace(/\s*\(.*?\)\s*/g, ' ').split(/[,.]/)[0]!.trim();
}

function zipOf(sec: LegacySection): string | null {
  const t = { ...table(sec.blocks.Property), ...table(sec.blocks.Business) };
  const v = pick(t, /town \/ area, ZIP/i);
  return /\b(1\d{4})\b/.exec(v ?? '')?.[1] ?? null;
}

function bedsBaths(sec: LegacySection, form: FormSeller | undefined): { beds: number | null; baths: number | null } {
  const s = pick(table(sec.blocks.Property), 'Bedrooms and bathrooms') ?? '';
  const beds = form?.f.prop_beds ? Number(form.f.prop_beds) : int(/(\d+)\s*bed/.exec(s)?.[1]);
  let baths = form?.f.prop_baths ? Number(form.f.prop_baths) : int(/(\d+)\s*full bath/.exec(s)?.[1]);
  if (!form?.f.prop_baths && /half bath/.test(s) && baths != null) baths += 0.5;
  return { beds, baths };
}

/** The forms tool's SPDS answers (r1…r20, in DISCLOSURE_ITEMS order). Files without them keep their notes only. */
const lowerFirst = (x: string) => (/^[A-Z][a-z]/.test(x) ? x[0]!.toLowerCase() + x.slice(1) : x);

/**
 * Item-by-item answers for a file without the forms tool's SPDS: each system as the file describes it, with
 * "no" known problem, plus the file's own disclosure notes where they name an item (radon, lead paint).
 */
function derivedDisclosures(p: Record<string, string>, notes: string[], yearBuilt: number | null): ListingPlan['disclosures'] {
  const out: ListingPlan['disclosures'] = [];
  const add = (item: (typeof DISCLOSURE_ITEMS)[number], answer: Answer, detail: string | null | undefined) => {
    if (detail) out.push({ item, answer, detail });
  };
  const v = (label: string) => clean(pick(p, label));
  add('roof', 'no', v('Roof'));
  const basement = v('Basement');
  if (basement) add('basement_water', /^none|slab/i.test(basement) ? 'na' : 'no', basement);
  add('heating', 'no', v('Heating') ?? v('Heating and cooling'));
  const cooling = v('Cooling');
  if (cooling) add('cooling', /^none/i.test(cooling) ? 'na' : 'no', cooling);
  add('water_heater', 'no', v('Water heater') ?? v('Water heaters'));
  add('electrical', 'no', v('Electrical'));
  add('water_sewer', 'no', v('Water and sewer'));
  // A disclosure note about the windows ("two upstairs windows are stiff") is a known problem.
  const windowNote = notes.find((n) => /window/i.test(n) && /stiff|stick|hard to|leak|crack|broken/i.test(n));
  if (windowNote) add('windows_doors', 'yes', windowNote);
  else add('windows_doors', 'no', v('Windows'));
  const pool = v('Pool');
  add('pool_spa', pool ? 'no' : 'na', pool ?? 'No pool');
  const hoa = v('HOA');
  if (hoa) add('hoa', /^none/i.test(hoa) ? 'na' : 'no', hoa);
  const radon = notes.find((n) => /radon/i.test(n));
  if (radon) add('radon', /never tested/i.test(radon) ? 'unknown' : 'no', radon);
  if (yearBuilt) add('lead_paint', yearBuilt < 1978 ? 'unknown' : 'na', yearBuilt < 1978 ? `Built ${yearBuilt}, before 1978: the lead-based paint disclosure is required` : `Built ${yearBuilt}`);
  return out;
}

function disclosuresOf(extra: FormExtra | undefined): ListingPlan['disclosures'] {
  const ans = (s: string): Answer | null => ({ yes: 'yes', no: 'no', unknown: 'unknown', 'n/a': 'na' } as Record<string, Answer>)[s.trim().toLowerCase()] ?? null;
  if (!extra?.spds) return [];
  return DISCLOSURE_ITEMS.map((item, i) => {
      const [a = '', d = ''] = extra.spds![`r${i + 1}`] ?? [];
    return { item, answer: ans(a), detail: d.trim() || null };
  }).filter((x) => x.answer || x.detail);
}

function listingOf(sec: LegacySection, form: FormSeller | undefined, extra: FormExtra | undefined, flags: Flag[]): ListingPlan {
  const p = table(sec.blocks.Property);
  const own = table(sec.blocks['Ownership and money']);
  const terms = table(sec.blocks['Listing terms']);
  const lease = table(sec.blocks['Lease terms']);
  const appl = table(sec.blocks['What he needs from an applicant']);
  const biz = table(sec.blocks.Business);
  const fin = table(sec.blocks.Financials);
  const neg = list(sec.blocks['Negotiation (Hameed only)']);
  const relay = list(sec.blocks['Lines Hameed can relay']);
  const discNotes = list(sec.blocks.Disclosures);
  const ef = extra?.f ?? {};
  const flag = (field: string, message: string) => flags.push({ key: sec.key, field, message });

  const isRent = sec.key === 'hayes';
  const isBiz = sec.key === 'lindqvist';
  const addressLine = addressOf(sec, form);
  if (!addressLine) flag('addressLine', 'The file says "You choose": add the street address before it goes live.');
  if (/^601 Cardinal Court/.test(addressLine)) flag('addressLine', 'Two homes share 601 Cardinal Court in the files (Raman and Castellano). Confirm the address.');
  const postal = POSTAL[sec.key] ?? pick(biz, 'Postal code') ?? postalFromAddress(addressLine);
  if (!postal) flag('postal', 'No postal code: it won’t appear on the property map until one is set.');
  const postalCode = zipOf(sec);
  if (!postalCode) flag('postalCode', 'No ZIP code in the file.');

  const { beds, baths } = bedsBaths(sec, form);
  const price = isRent ? money(pick(lease, 'Monthly rent')) : money(form?.f.price ?? pick(terms, 'Asking price'));
  const listedOn = isoDate(ef['lc-start'] ?? pick(terms, 'Listed'));
  if (!listedOn) flag('listedOn', 'No "Listed" date: published today.');
  const furnished = /\$[\d,]+\s*total/.exec(pick(terms, 'Furnished option') ?? '');
  const sign = pick(terms, 'Yard sign and photos');
  const neg1 = neg.find((x) => /^Lowest price/i.test(x));

  // The public description: what a buyer sees first. Built from the file's own words, never invented.
  const facts = bedsBaths(sec, form);
  const kind = clean(pick(p, 'Property type'))?.split(',')[0];
  const size = int(pick(p, 'Living space'));
  const year = int(form?.f.prop_year ?? pick(p, 'Year built'));
  const opener =
    kind && !isBiz
      ? `${kind}${facts.beds ? ` with ${facts.beds} bedroom${facts.beds === 1 ? '' : 's'}` : ''}${facts.baths ? ` and ${facts.baths} bathroom${facts.baths === 1 ? '' : 's'}` : ''}${size ? `, about ${size.toLocaleString('en-US')} sq ft` : ''}${year ? `, built ${year}` : ''}.`
      : null;
  const description =
    [
      opener ?? form?.f.prop_legal,
      pick(p, 'Other rooms') && `Inside: ${lowerFirst(pick(p, 'Other rooms')!)}.`,
      pick(p, 'Kitchen') && `Kitchen: ${lowerFirst(pick(p, 'Kitchen')!)}.`,
      pick(p, 'Bathroom') && `Bathroom: ${lowerFirst(pick(p, 'Bathroom')!)}.`,
      pick(p, 'Laundry'),
      pick(p, 'Exterior'),
      pick(p, 'Outdoor'),
      pick(p, 'Pool') && `Pool: ${lowerFirst(pick(p, 'Pool')!)}`,
      clean(pick(p, 'Parking')),
      pick(p, 'Community') && /gated/i.test(pick(p, 'Community')!) ? 'In a gated community.' : null,
      ...(isBiz ? [pick(biz, 'Type'), pick(biz, 'Opening hours') && `Open ${pick(biz, 'Opening hours')!.toLowerCase()}`, pick(biz, 'Equipment') && `Equipment: ${lowerFirst(pick(biz, 'Equipment')!)}`, pick(biz, 'Pricing')] : []),
    ]
      .filter(Boolean)
      .map((s) => s!.replace(/\.?$/, '.'))
      .join(' ') || null;

  const plan: ListingPlan = {
    key: sec.key,
    type: isBiz ? 'business' : isRent ? 'rental' : 'house',
    purpose: isRent ? 'rent' : 'sale',
    status: SOLD.has(sec.key) ? 'sold' : isRent ? 'for_lease' : 'active',
    addressLine,
    postal,
    postalCode,
    areaHint: clean(pick({ ...p, ...biz }, /town \/ area/i)) ?? clean(pick(p, 'Street address and postal code', 'Street address')?.split(',').slice(1).join(',')) ?? null,
    county: pick(p, 'County') ?? 'Dauphin',
    price,
    beds: isBiz ? null : beds,
    baths: isBiz ? null : baths,
    sqft: int(pick(p, 'Living space') ?? pick(biz, 'Unit size')),
    lot: clean(pick(p, 'Lot size')),
    yearBuilt: int(form?.f.prop_year ?? pick(p, 'Year built')),
    garage: clean(form?.f.prop_park ?? pick(p, 'Parking')),
    description,
    showingInstructions: ef.show_notes ?? clean(pick(terms, 'Showings')),
    availableFrom: isoDate(pick(lease, 'Available from')),
    listedOn,
    property: {
      propertyStyle: clean(pick(p, 'Property type') ?? form?.f.prop_type),
      otherRooms: clean(pick(p, 'Other rooms')),
      parking: clean(pick(p, 'Parking')),
      basement: clean(pick(p, 'Basement')),
      heating: clean(pick(p, 'Heating', 'Heating and cooling')),
      cooling: clean(pick(p, 'Cooling')),
      waterHeater: clean(pick(p, 'Water heater', 'Water heaters')),
      waterSewer: clean(pick(p, 'Water and sewer')),
      electrical: clean(pick(p, 'Electrical')),
      roof: clean(pick(p, 'Roof')),
      windows: clean(pick(p, 'Windows')),
      appliancesProvided: clean(pick(p, 'Appliances provided')),
      furnished: clean(pick(p, 'Furnished')),
      taxes: clean(ef.taxes ?? pick(p, 'Property taxes') ?? pick(fin, 'Property taxes')),
      hoa: clean(ef.hoa ?? pick(p, 'HOA')),
      utilities: clean(pick(p, 'Average utilities')),
      legalDescription: clean(form?.f.prop_legal),
      zoning: clean(form?.f.prop_zoning),
      occupancy: clean(ef.occupancy),
    },
    ownership: {
      vesting: clean(ef.seller_vesting ?? pick(table(sec.blocks.Seller ?? sec.blocks.Sellers), 'How title is held')),
      whoSigns: clean(pick(table(sec.blocks.Seller ?? sec.blocks.Sellers ?? sec.blocks.Landlord ?? sec.blocks.Owner), 'Who signs', 'Signs for the landlord', 'Signing as')),
      boughtOn: clean(pick(own, 'Bought')?.split(/,\s*for/)[0]),
      boughtFor: money(pick(own, 'Bought')),
      ownedSince: clean(ef['spds-since'] ?? pick(table(sec.blocks.Landlord), 'Owned the property since') ?? pick(biz, 'Opened')),
      deedReference: clean(pick(own, 'Deed reference')),
      mortgage: clean(ef.mortgage ?? pick(own, 'Mortgage')),
      liens: clean(pick(own, 'Liens')),
    },
    terms: isRent
      ? null
      : {
          agreementStart: isoDate(ef['lc-start'] ?? pick(terms, 'Listed')),
          agreementEnd: isoDate(ef['lc-end'] ?? pick(terms, 'Listing agreement ends')),
          earnestMoneyExpected: clean(pick(terms, /^Earnest money/)),
          targetSettlement: clean(pick(terms, 'Settlement date')),
          possession: clean(pick(terms, 'Possession')),
          included: clean(pick(terms, 'Included')),
          excluded: clean(pick(terms, 'Excluded', 'Taking with him')),
          leasedItems: clean(pick(terms, 'Leased items')),
          transferTax: clean(pick(terms, 'Realty transfer tax')),
          titleCompany: clean(pick(terms, 'Title company')),
          attorney: clean(pick(terms, 'Attorney')),
          homeWarranty: clean(pick(terms, 'Home warranty')),
          financingAccepted: clean(pick(terms, /^Financing/)),
          offerReplies: clean(pick(terms, 'Offer replies')),
          asIs: /as-is/i.test(pick(terms, 'Sale terms') ?? ''),
          yardSign: extra?.radios?.includes('lc-sign-y') ? true : extra?.radios?.includes('lc-sign-n') ? false : sign ? !/not allow yard signs/i.test(sign) && /sign|both/i.test(sign) : null,
          photosAllowed: extra?.radios?.includes('lc-photo-y') ? true : sign ? /photos allowed|both allowed/i.test(sign) : null,
          lockbox: extra?.radios?.includes('lc-lock-y') ? true : extra?.radios?.includes('lc-lock-n') ? false : /no lockbox/i.test(pick(terms, 'Showings') ?? '') ? false : /lockbox/i.test(pick(terms, 'Showings') ?? '') ? true : null,
          showingNotice: clean(/^([^.]*notice)/i.exec(pick(terms, 'Showings') ?? '')?.[1]),
          furnishedPrice: furnished ? money(furnished[0]) : null,
        },
    lease: isRent
      ? {
          leaseLengthMonths: int(pick(lease, 'Lease length')),
          deposit: money(pick(lease, 'Security deposit')),
          dueAtSigning: clean(pick(lease, 'Due at signing')),
          rentDue: clean(pick(lease, 'Rent due')),
          lateFee: clean(pick(lease, 'Late fee')),
          paymentMethod: clean(pick(lease, 'How rent is paid')),
          renewal: clean(pick(lease, 'Renewal')),
          utilities: clean(pick(lease, 'Utilities')),
          yardAndSnow: clean(pick(lease, 'Yard and snow')),
          maxOccupants: int(pick(lease, 'Maximum occupants')),
          pets: clean(pick(lease, 'Pets')),
          smoking: clean(pick(lease, 'Smoking')),
          subletting: clean(pick(lease, 'Subletting')),
          insurance: clean(pick(lease, "Renter's insurance")),
          moveInInspection: clean(pick(lease, 'Move-in inspection')),
          leasingFee: clean(pick(lease, /^Leasing fee/)),
          incomeRequirement: clean(pick(appl, 'Income')),
          checks: clean(pick(appl, 'Checks')),
          references: clean(pick(appl, 'References')),
          applicationFee: clean(pick(appl, 'Application fee')),
          decisionTime: clean(pick(appl, 'Decision time')),
        }
      : null,
    business: isBiz ? businessOf(sec, biz, terms) : null,
    disclosures: extra?.spds ? disclosuresOf(extra) : isBiz || isRent ? [] : derivedDisclosures(p, discNotes, int(form?.f.prop_year ?? pick(p, 'Year built'))),
    confidential: {
      bottomLine: money(neg1) ?? (isRent ? money(neg.find((x) => /\$/.test(x))) : null),
      negotiationRules: lines(neg),
      relayLines: lines(relay),
      commissionTerms: clean(pick(terms, 'Commission') ?? pick(lease, /^Leasing fee/)),
      yearlySales: money(pick(fin, 'Yearly sales')),
      yearlyProfit: money(pick(fin, 'Yearly owner profit')),
      inventoryValue: money(pick(fin, 'Inventory on hand')),
      disclosureNotes: [lines(discNotes), ef['spds-notes']].filter(Boolean).join('\n\n') || null,
      furnitureLowest: money(neg.find((x) => /^Furniture/i.test(x))?.split(/will take/i)[1]),
    },
    photosDir: PHOTOS[sec.key] ?? null,
    sale: SOLD.has(sec.key) ? { price, soldOn: isoDate(form?.f.settle_date) } : null,
  };
  if (plan.sale) flag('sale', 'Sold: check the sale price and date before importing.');
  if (!plan.photosDir && !plan.sale) flag('photos', 'No photos yet: imports Active but hidden from the public site until 3 photos are added.');
  return plan;
}

function businessOf(sec: LegacySection, biz: Record<string, string>, terms: Record<string, string>): Record<string, string | number | boolean | null> {
  const owner = table(sec.blocks.Owner);
  const split = pick(terms, 'Price split') ?? '';
  const part = (re: RegExp) => money(split.split('·').find((x) => re.test(x)));
  const confidentiality = pick(terms, 'Confidentiality') ?? '';
  const name = pick(biz, 'Business name');
  return {
    businessName: name,
    // "Light" confidentiality: the name can show publicly. Anything stricter keeps it withheld.
    nameWithheld: !/^light/i.test(confidentiality),
    teaser: pick(biz, 'Type') ? `${pick(biz, 'Type')}, Fairview` : null,
    entity: pick(owner, 'Selling company'),
    signerCapacity: pick(owner, 'Signing as'),
    businessType: pick(biz, 'Type'),
    openedYear: int(pick(biz, 'Opened')),
    employees: int(pick(biz, 'Employees')),
    hours: pick(biz, 'Opening hours'),
    seats: int(pick(biz, 'Seats')),
    whatIsSold: pick(biz, 'What is being sold'),
    buildingSize: pick(biz, 'Unit size', 'Shop size', 'Building'),
    premisesRent: pick(biz, 'Rent'),
    premisesLeaseEnd: pick(biz, 'Lease'),
    premisesLandlord: pick(biz, 'Landlord'),
    tradingHistory: pick(table(sec.blocks.Financials), 'Trend'),
    ownerFinancing: pick(terms, 'Owner financing'),
    priceBuilding: part(/building/i),
    priceEquipment: part(/equipment|machines/i),
    priceInventory: part(/inventory/i),
    priceGoodwill: part(/goodwill/i),
    included: pick(terms, 'Included'),
    excluded: pick(terms, 'Excluded'),
    licences: pick(terms, 'Licenses'),
    training: pick(terms, 'Training'),
    nonCompete: pick(terms, 'Non-compete'),
    staffTerms: pick(terms, 'Staff'),
  };
}

export function buildPlan(sections: LegacySection[], forms: { sellers: Record<string, FormSeller>; extra: Record<string, FormExtra> }, glance: GlanceRow[] = []): LegacyPlan {
  const flags: Flag[] = [];
  const clients: ClientPlan[] = [];
  const listings: ListingPlan[] = [];
  for (const sec of sections) {
    const real = (REAL as readonly string[]).includes(sec.key);
    const c = clientOf(sec, real);
    // The at-a-glance timeline is shorter and clearer than the full settlement line.
    const g = glance.find((r) => r.seller.replace(/\s*\(.*\)$/, '').trim() === c.displayName);
    if (g?.timeline) c.timeline = g.timeline;
    clients.push(c);
    if (real) listings.push(listingOf(sec, forms.sellers[sec.key], forms.extra[sec.key], flags));
  }
  for (const k of REAL) if (!sections.some((s) => s.key === k)) flags.push({ key: k, field: 'file', message: `No section for "${k}" in the seller files.` });
  return { clients, listings, flags };
}

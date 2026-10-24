// Fictional RP sellers for listings with no real seller. Pure and deterministic: the same seed (the listing ID,
// or the seed Regenerate stored) always gives the same seller. The output is stored as ordinary client and
// listing rows, so everything downstream works exactly as for imported sellers.
import { DISCLOSURE_ITEMS } from '@/db/schema/enums';
import * as P from './pools';

export interface GeneratorListing {
  type: 'house' | 'apartment' | 'business' | 'land' | 'rental';
  purpose: 'sale' | 'rent';
  price: number | null;
  beds: number | null;
  sqft: number | null;
  yearBuilt: number | null;
  garage: string | null;
  basement: string | null;
  /** Feature names from the listing ("Pool", "Fenced yard", …). */
  features: string[];
  furnishedPrice: number | null;
}

type Answer = 'yes' | 'no' | 'unknown' | 'na';
type Item = (typeof DISCLOSURE_ITEMS)[number];

export interface GeneratedSeller {
  seed: string;
  client: {
    kind: 'person' | 'couple' | 'company' | 'estate';
    displayName: string;
    legalNameOnForms: string;
    roles: ('seller' | 'landlord' | 'business_owner')[];
    bestContact: string;
    currentlyOccupying: string;
    mailingAddressAfter: string;
    reason: string;
    timeline: string;
    whoDecides: string;
    background: string;
  };
  people: { legalName: string; goesBy: string; ageOccupation: string; maritalStatus: string | null; signs: boolean; roleLabel: string | null; discord: string }[];
  clientConfidential: { motivation: string; negotiationNotes: string; relayLines: string; commissionTerms: string };
  ownership: { vesting: string; whoSigns: string; boughtOn: string; boughtFor: number | null; ownedSince: string; deedReference: string; mortgage: string; liens: string };
  terms: { earnestMoneyExpected: string; targetSettlement: string; possession: string; included: string; excluded: string; leasedItems: string; transferTax: string; titleCompany: string; attorney: string; homeWarranty: string; financingAccepted: string; offerReplies: string } | null;
  property: { taxes: string | null; utilities: string | null };
  showingInstructions: string;
  disclosures: { item: Item; answer: Answer; detail: string | null }[];
  listingConfidential: { bottomLine: number | null; negotiationRules: string; relayLines: string; commissionTerms: string; furnitureLowest: number | null };
  /** The numbers behind the rules, for tests and the portal. */
  numbers: { asking: number | null; lowest: number | null; decline: number | null; counter: number | null; yearBought: number; leadPaint: boolean };
}

// ---- Seeded randomness ----

/** FNV-1a: a string seed to 32 bits. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32. */
export function prng(seed: string): () => number {
  let a = hash(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const usd = (n: number) => `$${n.toLocaleString('en-US')}`;
/** "orthodontist" → "an orthodontist"; "retired steelworker" → "a retired steelworker". */
const withArticle = (s: string) => `${/^[aeiou]/i.test(s) ? 'an' : 'a'} ${s}`;
const round = (n: number, to: number) => Math.round(n / to) * to;

export function generateSeller(seed: string, l: GeneratorListing, opts: { today?: Date; agentName?: string } = {}): GeneratedSeller {
  const r = prng(seed);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
  const between = (lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
  const year = (opts.today ?? new Date()).getUTCFullYear();
  const price = l.price;
  const business = l.type === 'business';
  const rent = l.purpose === 'rent';
  const has = (re: RegExp) => l.features.some((f) => re.test(f));
  const pool = has(/pool/i);
  const noBasement = !l.basement || /^none|slab/i.test(l.basement);
  const built = l.yearBuilt ?? year - 30;
  const band: keyof typeof P.JOBS = !price || rent ? 'mid' : price < 250_000 ? 'low' : price < 500_000 ? 'mid' : 'high';

  // ---- Who ----
  const motive: P.Motive = business ? pick(['retiring', 'downsizing', 'job'] as const) : built < 1970 && r() < 0.35 ? 'estate' : pick(['downsizing', 'job', 'upsizing', 'divorce', 'retiring'] as const);
  const m = P.MOTIVES[motive];
  const kind: GeneratedSeller['client']['kind'] = business || rent ? 'company' : motive === 'estate' ? 'estate' : motive === 'divorce' || motive === 'upsizing' || r() < 0.5 ? 'couple' : 'person';
  const surname = pick(P.SURNAMES);
  const [ageLo, ageHi] = band === 'high' ? [42, 68] : motive === 'upsizing' ? [29, 40] : motive === 'retiring' ? [63, 74] : [30, 76];
  const person = (female: boolean, last = surname, age = between(ageLo, ageHi)) => {
    const first = pick(female ? P.FIRST_F : P.FIRST_M);
    const job = pick(P.JOBS[band]);
    const occupation = age >= 66 ? `retired ${job}` : job;
    return { first, last, female, age, job, occupation, legal: `${first} ${pick(female ? P.MIDDLE_F : P.MIDDLE_M)} ${last}` };
  };
  const a = person(r() < 0.5);
  const b = kind === 'couple' ? person(!a.female, surname, Math.max(25, a.age + between(-4, 4))) : null;
  const handle = (p: { first: string; last: string; job: string }) => {
    const style = between(0, 3);
    if (style === 0) return `${p.first[0]}${p.last}${between(10, 99)}`;
    if (style === 1) return `${P.SHORT[p.first] ?? p.first}${p.last[0]}_${pick(P.PA_TOWNS)}`;
    if (style === 2 && P.HANDLE_SUFFIX[p.job]) return `${p.first}${p.last}${P.HANDLE_SUFFIX[p.job]}`;
    return `${P.SHORT[p.first] ?? p.first}${p.last}`;
  };
  const goesBy = (p: { first: string }) => P.SHORT[p.first] && r() < 0.5 ? P.SHORT[p.first]! : p.first;
  const [city, state, zip] = pick(P.CITIES);
  const mailing = `${between(12, 9800)} ${pick(P.STREETS)}, ${city}, ${state} ${zip}${String(between(1, 99)).padStart(2, '0')}`;
  const they = kind === 'couple' || kind === 'company' || kind === 'estate' ? 'They' : a.female ? 'She' : 'He';
  const their = they === 'They' ? 'their' : they === 'She' ? 'her' : 'his';

  const company = business ? `${surname} Holdings LLC` : rent ? `${surname} Property Holdings LLC` : null;
  const displayName = kind === 'couple' ? `${a.first} and ${b!.first} ${surname}` : kind === 'estate' ? `Estate of ${a.first} ${surname}` : `${a.first} ${surname}`;
  const legalNameOnForms = company ?? (kind === 'couple' ? `${a.legal} and ${b!.legal}` : kind === 'estate' ? `Executor of the Estate of ${a.legal}` : a.legal);

  // ---- Money ----
  // An estate's owner held the house a long time; everyone else 3 to 35 years. Never before it was built.
  const yearBought = Math.min(year - 2, Math.max(built, year - (motive === 'estate' ? between(22, 45) : between(3, 35))));
  const held = year - yearBought;
  const boughtFor = price && !rent ? round(price / Math.pow(1.045, held), 500) : null;
  const mortgage = held > 22 ? `None. Paid off in ${yearBought + between(15, 22)}.` : `${pick(P.LENDERS)}, payoff about ${usd(round((boughtFor ?? 200_000) * 0.8 * Math.max(0.1, 1 - held / 30), 1000))}`;
  const taxes = price && !rent ? `About ${usd(round(price * (0.014 + r() * 0.004), 100))} per year` : null;
  const utilities = l.sqft ? `About ${usd(round(l.sqft * (0.15 + r() * 0.04), 10))} per month` : l.beds ? `About ${usd(round(140 + l.beds * 60, 10))} per month` : null;

  // ---- Negotiation (confidential) ----
  const [lo, hi] = business ? [0.9, 0.95] : m.lowest;
  const pct = lo + r() * (hi - lo);
  const step = rent ? 25 : price && price < 300_000 ? 1000 : 5000;
  // decline < lowest < counter < asking, always.
  const lowest = price ? Math.max(step * 2, Math.min(price - step, round(price * pct, step))) : null;
  const decline = price && lowest ? Math.min(lowest - step, round(lowest * (rent ? 0.97 : 0.95), step)) : null;
  let counter = price && lowest ? round((lowest + price) / 2, rent ? step : step / 2) : null;
  if (price && lowest && counter && (counter <= lowest || counter >= price)) counter = lowest + Math.floor((price - lowest) / 2);
  const furnitureAsk = l.furnishedPrice && price ? l.furnishedPrice - price : null;
  const furnitureLowest = furnitureAsk ? round(furnitureAsk * (0.65 + r() * 0.15), 1000) : null;
  const pron = they === 'They' ? 'they' : they.toLowerCase();
  const rules = price
    ? rent
      ? [
          `Lowest rent: **${usd(lowest!)}** per month, on an 18-month lease. Will not go lower.`,
          `Under ${usd(decline!)} a month: ${pron} decline.`,
          'Will waive the application fee for a strong applicant who signs within a week.',
          'No exceptions on the income requirement without a co-signer.',
        ]
      : [
          `Lowest price: **${usd(lowest!)}**.`,
          `Under ${usd(decline!)}: ${pron} decline${pron === 'they' ? '' : 's'}.`,
          `${usd(decline!)} to ${usd(lowest! - 1)}: ${pron} counter${pron === 'they' ? '' : 's'} at **${usd(counter!)}**.`,
          `${usd(lowest!)} or more with clean terms: ${pron} accept${pron === 'they' ? '' : 's'}.`,
          m.days[1] <= 45 ? 'Speed matters more than price: a quick settlement wins over a slightly higher offer that settles later.' : 'Flexible on dates, within the settlement window.',
          r() < 0.5 ? 'Accepts mortgage, inspection and appraisal contingencies. Will not accept a contingency on the sale of the buyer’s home.' : `Prefers a repair credit of up to ${usd(round((price ?? 0) * 0.008, 500))} over doing repairs.`,
          ...(furnitureAsk ? [`Furniture: ${pron} would like ${usd(furnitureAsk)} but will take **${usd(furnitureLowest!)}**. Not sold piece by piece.`] : []),
        ]
    : ['Price to be set by the listing agent.'];
  const agent = opts.agentName ?? 'the listing agent';
  const relay = [
    counter && !rent ? `"The seller has countered at ${usd(counter)}. ${they === 'They' ? 'They’re' : `${they}’s`} flexible on the settlement date if that helps you."` : null,
    rent ? `"If you're open to an 18-month lease, the landlord is willing to bring the rent down to ${usd(lowest!)}."` : null,
    `"${agent} can share the full disclosure statement before you make an offer."`,
    r() < 0.5 ? `"${they === 'They' ? 'They’d' : `${they}’d`} prefer an offer with a pre-approval letter or proof of funds."` : `"${they === 'They' ? 'They’ve' : `${they}’s`} kept the house well and ${they === 'They' ? 'are' : 'is'} happy to answer questions about any repair."`,
  ].filter((x): x is string => !!x);

  // ---- Disclosures (they follow the agent's facts, never contradict them) ----
  const roofYear = Math.max(built, year - between(3, 18));
  const hvacYear = Math.max(built, year - between(2, 15));
  const heaterYear = Math.max(built, year - between(1, 12));
  const leadPaint = built < 1978;
  const base: Record<Item, [Answer, string | null]> = {
    roof: ['no', roofYear > built ? `Asphalt shingle, replaced ${roofYear}` : `Asphalt shingle, original (${built})`],
    basement_water: noBasement ? ['na', 'No basement, slab foundation'] : ['no', null],
    foundation: ['no', null],
    heating: ['no', `Gas forced air, installed ${hvacYear}`],
    cooling: ['no', `Central air, installed ${hvacYear}`],
    water_heater: ['no', `Gas water heater, installed ${heaterYear}`],
    plumbing: ['no', null],
    electrical: ['no', built < 1965 ? 'Updated to 200-amp service' : '200-amp service'],
    water_sewer: ['no', 'Public water and public sewer'],
    wood_insects: ['no', 'No known infestation'],
    radon: ['unknown', 'Never tested'],
    lead_paint: leadPaint ? ['unknown', `Built ${built}, before 1978: the lead-based paint disclosure and pamphlet are required`] : ['na', `Built ${built}`],
    fuel_tanks: ['no', null],
    mold: ['no', null],
    pool_spa: pool ? ['no', 'In-ground pool, equipment in working order'] : ['na', 'No pool'],
    windows_doors: ['no', null],
    appliances: ['no', 'All included appliances in working order'],
    hoa: ['na', 'No HOA'],
    liens_violations: ['no', null],
    flooding: ['no', null],
  };
  const fits = (d: (typeof P.DEFECTS)[number]) => !d.needs || (d.needs === 'garage' ? !!l.garage && /garage/i.test(l.garage) : d.needs === 'basement' ? !noBasement : d.needs === 'pool' ? pool : has(/yard|fence/i));
  const defects = P.DEFECTS.filter(fits);
  for (let i = 0, n = between(1, 2); i < n && defects.length; i++) {
    const d = defects.splice(Math.floor(r() * defects.length), 1)[0]!;
    base[d.item as Item] = ['yes', d.detail];
  }
  const disclosures = DISCLOSURE_ITEMS.map((item) => ({ item, answer: base[item][0], detail: base[item][1] }));

  // ---- Story ----
  const ageLine = b
    ? `${a.first} is ${a.age}, ${withArticle(a.occupation)}, and ${b.first} is ${b.age}, ${withArticle(b.occupation)}.`
    : kind === 'estate'
      ? `${a.first} ${surname} owned the house from ${yearBought} until ${a.female ? 'her' : 'his'} death last year.`
      : `${a.first} is ${a.age}, ${withArticle(a.occupation)}.`;
  const boughtLine = rent ? `${company} has owned the property since ${yearBought} and rents it out.` : business ? `${a.first} has run the business since ${yearBought}.` : kind === 'estate' ? `The family is selling through the estate.` : `${they} bought the house in ${yearBought}.`;
  const background = [ageLine, boughtLine, m.story, `${they === 'They' ? 'They are' : `${they} is`} ${pick(P.PERSONALITY)}.`].join(' ');
  const excluded = pick(P.EXCLUDED);
  const included = ['Refrigerator', 'range', 'dishwasher', ...(r() < 0.6 ? ['washer', 'dryer'] : []), ...(pool ? ['pool equipment and cover'] : [])].join(', ');
  const earnest = price && !rent ? usd(round(price * 0.03, price < 300_000 ? 1000 : 5000)) : '';
  const signer = kind === 'couple' ? 'Both, on every document' : kind === 'estate' ? 'The executor' : company ? `${a.first} ${surname}, managing member` : `${a.first} alone`;

  return {
    seed,
    client: {
      kind,
      displayName,
      legalNameOnForms,
      roles: [business ? 'business_owner' : rent ? 'landlord' : 'seller'],
      bestContact: pick(P.BEST_TIME),
      currentlyOccupying: rent || business || kind === 'estate' ? 'No' : 'Yes, until settlement',
      mailingAddressAfter: mailing,
      reason: m.reason,
      timeline: rent ? 'Lease starts as soon as an applicant is approved' : m.timeline,
      whoDecides: kind === 'couple' ? `Both. ${pick([a, b!]).first} usually replies first.` : kind === 'estate' ? 'The executor, with the heirs’ approval' : `${a.first} alone`,
      background,
    },
    people:
      kind === 'estate'
        ? [(() => { const ex = person(r() < 0.5, r() < 0.6 ? surname : pick(P.SURNAMES), between(40, 62)); return { legalName: ex.legal, goesBy: goesBy(ex), ageOccupation: `${ex.age}, ${ex.occupation}`, maritalStatus: null, signs: true, roleLabel: 'Executor', discord: handle(ex) }; })()]
        : [a, ...(b ? [b] : [])].map((p) => ({ legalName: p.legal, goesBy: goesBy(p), ageOccupation: `${p.age}, ${p.occupation}`, maritalStatus: b ? 'Married' : company ? null : pick(['Single', 'Widowed', 'Divorced']), signs: true, roleLabel: company ? 'Managing member' : null, discord: handle(p) })),
    clientConfidential: { motivation: m.reason, negotiationNotes: rules.map((x) => `- ${x}`).join('\n'), relayLines: relay.map((x) => `- ${x}`).join('\n'), commissionTerms: rent ? "One month's rent, paid by the landlord" : '5% total, 2.5% to each side' },
    ownership: {
      vesting: kind === 'couple' ? 'Jointly, as a married couple (tenants by the entirety)' : kind === 'estate' ? 'Estate of the late owner' : company ? `${company}` : 'Sole owner',
      whoSigns: signer,
      boughtOn: String(yearBought),
      boughtFor,
      ownedSince: String(yearBought),
      deedReference: `Deed Book ${1000 + (yearBought - 1975) * 110 + between(0, 99)}, Page ${between(1, 400)}`,
      mortgage,
      liens: 'None known',
    },
    terms: rent
      ? null
      : {
          earnestMoneyExpected: earnest ? `At least ${earnest}` : '',
          targetSettlement: `${m.days[0]} to ${m.days[1]} days after acceptance`,
          possession: 'At settlement',
          included,
          excluded,
          leasedItems: 'None',
          transferTax: 'Split equally',
          titleCompany: pick(P.TITLE_COMPANIES),
          attorney: 'None',
          homeWarranty: r() < 0.5 ? 'Will add a one-year warranty if a buyer asks' : 'No',
          financingAccepted: band === 'low' ? 'Conventional, FHA, VA or cash' : 'Any, with a pre-approval letter or proof of funds',
          offerReplies: pick(['Within 24 hours', 'Within 12 hours', 'Same day']),
        },
    property: { taxes, utilities },
    showingInstructions: pick(P.SHOWINGS),
    disclosures,
    listingConfidential: { bottomLine: lowest, negotiationRules: rules.map((x) => `- ${x}`).join('\n'), relayLines: relay.map((x) => `- ${x}`).join('\n'), commissionTerms: rent ? "One month's rent, paid by the landlord" : '5% total, 2.5% to each side', furnitureLowest },
    numbers: { asking: price, lowest, decline, counter, yearBought, leadPaint },
  };
}

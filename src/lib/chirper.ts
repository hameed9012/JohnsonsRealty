// Chirper post drafts from a listing's real fields. Templates only: nothing is invented, and empty fields drop out.

export const CHIRP_LIMIT = 280;

export type ChirpKind = 'listed' | 'reduced' | 'open' | 'contract' | 'sold' | 'lease' | 'leased';

export interface ChirpInput {
  kind: ChirpKind;
  address: string;
  area: string;
  facts: string[];
  price: string | null;
  blurb: string;
  url: string;
  agentHandle: string | null;
  brokerageHandle: string | null;
  /** For an open house: "Saturday 2–4 pm". Typed by the agent. */
  when?: string;
}

const OPENERS: Record<ChirpKind, string> = {
  listed: 'Just listed',
  reduced: 'Price reduced',
  open: 'Open house',
  contract: 'Under contract',
  sold: 'Sold',
  lease: 'For lease',
  leased: 'Leased',
};

const CLOSERS: Record<ChirpKind, string> = {
  listed: 'Book a showing:',
  reduced: 'Book a showing:',
  open: 'Details:',
  contract: 'Thinking of selling? Talk to us:',
  sold: 'Thinking of selling? Talk to us:',
  lease: 'Apply or book a viewing:',
  leased: 'Looking to rent? See what’s available:',
};

const at = (h: string | null) => (h ? '@' + h.replace(/^@/, '') : null);

/** One draft. Lines with no data are left out; the blurb is trimmed first if the post runs long. */
export function draftChirp(i: ChirpInput): string {
  const where = [i.address, i.area].filter(Boolean).join(', ');
  const head = `${OPENERS[i.kind]}${i.kind === 'open' && i.when ? ` · ${i.when}` : ''}: ${where}`;
  const price = i.price ? (i.kind === 'sold' ? `Sold for ${i.price}` : i.kind === 'reduced' ? `Now ${i.price}` : i.price) : null;
  const facts = [i.facts.join(' · '), price].filter(Boolean).join(' · ');
  const tags = [at(i.agentHandle), at(i.brokerageHandle)].filter((x, n, a) => x && a.indexOf(x) === n).join(' ');
  const tail = [`${CLOSERS[i.kind]} ${i.url}`, tags].filter(Boolean).join('\n');
  const build = (blurb: string) => [head, facts, blurb, tail].filter(Boolean).join('\n\n');
  let blurb = i.blurb.trim();
  let text = build(blurb);
  while (text.length > CHIRP_LIMIT && blurb) {
    const words = blurb.replace(/…$/, '').split(' ');
    words.pop();
    blurb = words.length ? words.join(' ') + '…' : '';
    text = build(blurb);
  }
  return text;
}

// ---- The two listing posts: the regular "Just Listed" post and the Marketplace version ----

export interface ListingPostInput {
  address: string;
  /** The area name: "Fairview". */
  area: string;
  /** In-game postal code: "601". */
  postal: string | null;
  /** "$760,000" or "$1,900/month". */
  price: string | null;
  description: string;
  /** "$795,000" when the listing is also offered furnished. */
  furnishedPrice: string | null;
  agentName: string;
  brokerageName: string;
  purpose: 'sale' | 'rent';
}

/** "Johnson’s Realty" → "#JohnsonsRealty"; "North Residential" → "#NorthResidential". */
export function hashtag(s: string): string {
  const t = s
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join('');
  return t ? `#${t}` : '';
}

function signOff(i: ListingPostInput, tags: string[]): string {
  return [`— ${i.agentName}, ${i.brokerageName}`, [...new Set(tags.filter(Boolean))].join(' ')].filter(Boolean).join('\n\n');
}

/** "🏡 Just Listed: {address}, {area} (Postal {postal})", the price and "Message me to book a showing." */
export function justListedPost(i: ListingPostInput): string {
  const where = [i.address, i.area].filter(Boolean).join(', ') + (i.postal ? ` (Postal ${i.postal})` : '');
  const head = `🏡 ${i.purpose === 'rent' ? 'For Lease' : 'Just Listed'}: ${where}`;
  return [head, i.price, 'Message me to book a showing.', signOff(i, [i.purpose === 'rent' ? '#ForLease' : '#JustListed', hashtag(i.area), hashtag(i.brokerageName)])].filter(Boolean).join('\n\n');
}

/** Marketplace: no price in the text (it goes in Chirper's price box), the description, and the furnished line. */
export function marketplacePost(i: ListingPostInput): string {
  const where = [i.address, i.area].filter(Boolean).join(', ');
  return [
    `Address: ${where}`,
    i.description.trim(),
    'Private showings by appointment.',
    i.furnishedPrice ? `Available fully furnished for ${i.furnishedPrice}.` : null,
    signOff(i, [i.purpose === 'rent' ? '#ForRent' : '#HomeForSale', hashtag(i.area), hashtag(i.brokerageName)]),
  ]
    .filter(Boolean)
    .join('\n\n');
}

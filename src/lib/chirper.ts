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

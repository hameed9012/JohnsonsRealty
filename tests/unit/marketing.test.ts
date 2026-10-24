import { describe, expect, it } from 'vitest';
import { CHIRP_LIMIT, draftChirp, type ChirpInput } from '@/lib/chirper';

const base: ChirpInput = { kind: 'listed', address: 'Example Lane', area: 'Fairview', facts: ['3 bedrooms', '2 bathrooms'], price: '$365,000', blurb: 'Example blurb.', url: 'https://example.test/property/example-lane', agentHandle: 'ExampleAgent', brokerageHandle: 'ExampleBrokerage' };

describe('Chirper drafts', () => {
  it('builds a post from the listing’s fields only', () => {
    expect(draftChirp(base)).toBe(
      'Just listed: Example Lane, Fairview\n\n3 bedrooms · 2 bathrooms · $365,000\n\nExample blurb.\n\nBook a showing: https://example.test/property/example-lane\n@ExampleAgent @ExampleBrokerage',
    );
  });

  it('drops empty lines and duplicate handles', () => {
    const t = draftChirp({ ...base, facts: [], price: null, blurb: '', agentHandle: 'Same', brokerageHandle: '@Same' });
    expect(t).toBe('Just listed: Example Lane, Fairview\n\nBook a showing: https://example.test/property/example-lane\n@Same');
  });

  it('words sold and reduced prices, and adds the open house time', () => {
    expect(draftChirp({ ...base, kind: 'sold' })).toContain('Sold for $365,000');
    expect(draftChirp({ ...base, kind: 'reduced' })).toContain('Now $365,000');
    expect(draftChirp({ ...base, kind: 'open', when: 'Saturday 2–4 pm' }).split('\n')[0]).toBe('Open house · Saturday 2–4 pm: Example Lane, Fairview');
  });

  it('trims the blurb to fit one post', () => {
    const t = draftChirp({ ...base, blurb: 'word '.repeat(80).trim() });
    expect(t.length).toBeLessThanOrEqual(CHIRP_LIMIT);
    expect(t).toContain('…');
    expect(t).toContain(base.url);
  });
});

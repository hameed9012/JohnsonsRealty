import { describe, expect, it } from 'vitest';
import { CHIRP_LIMIT, draftChirp, hashtag, justListedPost, marketplacePost, type ChirpInput } from '@/lib/chirper';

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

describe('Just Listed and Marketplace posts', () => {
  const base = { address: '6012 Estate Drive', area: 'Fairview', postal: '601', price: '$760,000', description: 'Example four bedroom farmhouse with a pool.', furnishedPrice: null, agentName: 'Example Agent', brokerageName: 'Johnson’s Realty', purpose: 'sale' as const };

  it('the regular post names the postal code, shows the price and signs off', () => {
    expect(justListedPost(base)).toBe(
      '🏡 Just Listed: 6012 Estate Drive, Fairview (Postal 601)\n\n$760,000\n\nMessage me to book a showing.\n\n— Example Agent, Johnson’s Realty\n\n#JustListed #Fairview #JohnsonsRealty',
    );
    expect(justListedPost({ ...base, postal: null })).toMatch(/^🏡 Just Listed: 6012 Estate Drive, Fairview\n/);
  });

  it('the Marketplace post keeps the price out of the text and adds the furnished line', () => {
    const plain = marketplacePost(base);
    expect(plain).toMatch(/^Address: 6012 Estate Drive, Fairview\n\nExample four bedroom farmhouse with a pool\.\n\nPrivate showings by appointment\./);
    expect(plain).not.toMatch(/\$760,000/);
    expect(plain).not.toMatch(/furnished/);
    const furnished = marketplacePost({ ...base, furnishedPrice: '$795,000' });
    expect(furnished).toContain('Available fully furnished for $795,000.');
    expect(furnished.endsWith('— Example Agent, Johnson’s Realty\n\n#HomeForSale #Fairview #JohnsonsRealty')).toBe(true);
  });

  it('hashtags drop punctuation and join words', () => {
    expect(hashtag('North Residential')).toBe('#NorthResidential');
    expect(hashtag('Johnson’s Realty')).toBe('#JohnsonsRealty');
    expect(hashtag('')).toBe('');
  });
});

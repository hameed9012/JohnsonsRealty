import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Markdown } from '@/components/public/Markdown';
import { DEFAULT_QUERY, parseSearch, searchCriteria, toQueryString } from '@/lib/search';
import { careerApplicationSchema, contactSchema, valuationSchema } from '@/lib/schemas/enquiry';

describe('search URL', () => {
  it('parses a full query and writes it back unchanged', () => {
    const q = parseSearch({ area: 'fairview', type: 'house', min: '200000', max: '500000', beds: '3', baths: '2', features: 'pool,gate', owner: 'exclude', sort: 'price-asc', view: 'list', page: '2' });
    expect(q).toEqual({ area: 'fairview', type: 'house', min: 200000, max: 500000, beds: 3, baths: 2, features: ['gate', 'pool'], owner: 'exclude', sort: 'price-asc', view: 'list', page: 2 });
    expect(parseSearch(Object.fromEntries(new URLSearchParams(toQueryString(q).slice(1))))).toEqual(q);
  });
  it('drops bad values instead of failing', () => {
    const q = parseSearch({ area: 'Fair View!', type: 'castle', min: 'lots', sort: 'random', page: '-4', features: ['pool', '<script>'] });
    expect(q).toEqual({ ...DEFAULT_QUERY, features: ['pool'] });
  });
  it('accepts repeated feature params from a plain GET form', () => {
    expect(parseSearch({ features: ['pool', 'office', 'pool'] }).features).toEqual(['office', 'pool']);
  });
  it('leaves defaults out of the URL', () => {
    expect(toQueryString(DEFAULT_QUERY)).toBe('');
    expect(toQueryString({ area: 'fairview' })).toBe('?area=fairview');
  });
  it('separates what is searched from how it is shown', () => {
    const c = searchCriteria(parseSearch({ area: 'fairview', sort: 'price-desc', page: '3' }));
    expect(c).toEqual({ area: 'fairview', type: null, min: null, max: null, beds: null, baths: null, features: [], owner: 'include' });
  });
});

describe('Markdown', () => {
  const html = (s: string) => renderToStaticMarkup(<Markdown source={s} />);
  it('renders headings, lists, emphasis and links', () => {
    const out = html('## Title\n\nText with **bold** and *italic* and [a link](/buy).\n\n- one\n- two\n\n1. first\n2. second');
    expect(out).toContain('<h2 class="heading-2">Title</h2>');
    expect(out).toContain('<strong>bold</strong>');
    expect(out).toContain('<em>italic</em>');
    expect(out).toContain('href="/buy"');
    expect(out).toContain('<ul><li>one</li><li>two</li></ul>');
    expect(out).toContain('<ol><li>first</li><li>second</li></ol>');
  });
  it('never injects HTML or unsafe links', () => {
    const out = html('<script>alert(1)</script>\n\n[x](javascript:alert(1)) <img src=x onerror=alert(1)>');
    expect(out).not.toContain('<script>');
    expect(out).not.toContain('<img');
    expect(out).not.toContain('javascript:');
    expect(out).toContain('&lt;script&gt;');
  });
});

describe('enquiry schemas', () => {
  it('needs an address and a way to reach you for a valuation', () => {
    const r = valuationSchema.safeParse({ addressLine: '', bestContact: '' });
    expect(r.success).toBe(false);
    const msgs = r.error!.issues.map((i) => i.message);
    expect(msgs).toContain('Add the property’s address.');
    expect(msgs).toContain('Tell us the best way to reach you.');
  });
  it('needs a message and a known topic for contact', () => {
    expect(contactSchema.safeParse({ topic: 'Buying', message: 'Hello' }).success).toBe(true);
    expect(contactSchema.safeParse({ topic: 'Spam', message: 'Hello' }).error?.issues[0]?.message).toBe('Choose what it’s about.');
  });
  it('needs a role, experience and a reason for an application', () => {
    const r = careerApplicationSchema.safeParse({ careerId: '', experience: '', why: '' });
    expect(r.error!.issues.map((i) => i.path[0])).toEqual(['careerId', 'experience', 'why']);
  });
});

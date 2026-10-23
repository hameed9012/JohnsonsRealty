import { describe, expect, it } from 'vitest';
import { dealTimeline, stagePill } from '@/lib/deal-stage';
import { describeSaved, matchesSaved, readSaved, savedHref, toSaved, type ListingFacts } from '@/lib/saved-search';
import { parseSearch } from '@/lib/search';
import { clientCanChange, isUpcoming } from '@/lib/showings';

const home: ListingFacts = { purpose: 'sale', type: 'house', areaSlug: 'fairview', areaParentSlug: 'susquehanna-township', price: 365000, beds: 3, baths: 2, ownerListed: false, featureKeys: ['pool', 'garage'] };

describe('saved search matching', () => {
  const saved = (scope: 'buy' | 'rent' | 'businesses', q: Record<string, string>) => toSaved(scope, parseSearch(q));
  it('matches on area, its town, price, rooms and features', () => {
    expect(matchesSaved(saved('buy', {}), home)).toBe(true);
    expect(matchesSaved(saved('buy', { area: 'fairview', beds: '3', max: '400000', features: 'pool' }), home)).toBe(true);
    expect(matchesSaved(saved('buy', { area: 'susquehanna-township' }), home)).toBe(true);
    expect(matchesSaved(saved('buy', { area: 'springfield' }), home)).toBe(false);
    expect(matchesSaved(saved('buy', { min: '400000' }), home)).toBe(false);
    expect(matchesSaved(saved('buy', { beds: '4' }), home)).toBe(false);
    expect(matchesSaved(saved('buy', { features: 'gate' }), home)).toBe(false);
  });
  it('keeps Buy, Rent and Businesses apart', () => {
    expect(matchesSaved(saved('rent', {}), home)).toBe(false);
    expect(matchesSaved(saved('rent', {}), { ...home, purpose: 'rent', type: 'rental' })).toBe(true);
    expect(matchesSaved(saved('buy', {}), { ...home, type: 'business' })).toBe(false);
    expect(matchesSaved(saved('businesses', {}), { ...home, type: 'business' })).toBe(true);
  });
  it('respects the owner-listing filter', () => {
    expect(matchesSaved(saved('buy', { owner: 'exclude' }), { ...home, ownerListed: true })).toBe(false);
    expect(matchesSaved(saved('buy', { owner: 'only' }), home)).toBe(false);
  });
  it('round-trips through storage and back to a search link', () => {
    const c = saved('rent', { area: 'springfield', max: '2000', beds: '2' });
    expect(readSaved(JSON.parse(JSON.stringify(c)))).toEqual(c);
    expect(savedHref(c)).toBe('/rent?area=springfield&max=2000&beds=2');
    expect(readSaved({ scope: 'nonsense', min: 'x' }).scope).toBe('buy');
  });
  it('describes itself in plain words', () => {
    const name = describeSaved(saved('rent', { area: 'springfield', max: '2000', beds: '2' }), (s) => (s === 'springfield' ? 'Springfield' : undefined));
    expect(name).toBe('Homes for rent in Springfield · up to $2,000/mo · 2+ beds');
  });
});

describe('showings', () => {
  const now = new Date('2026-10-24T12:00:00Z');
  const later = new Date('2026-10-25T12:00:00Z');
  const earlier = new Date('2026-10-23T12:00:00Z');
  it('lets clients change future requested or confirmed showings only', () => {
    expect(clientCanChange('requested', later, now)).toBe(true);
    expect(clientCanChange('confirmed', later, now)).toBe(true);
    expect(clientCanChange('confirmed', earlier, now)).toBe(false);
    expect(clientCanChange('cancelled', later, now)).toBe(false);
    expect(clientCanChange('completed', later, now)).toBe(false);
  });
  it('treats showings within the last hour as still upcoming', () => {
    expect(isUpcoming('confirmed', new Date(now.getTime() - 30 * 60000), now)).toBe(true);
    expect(isUpcoming('confirmed', earlier, now)).toBe(false);
  });
});

describe('deal timeline', () => {
  it('marks stages done, current and upcoming', () => {
    expect(dealTimeline('under_contract').map((s) => s.state)).toEqual(['done', 'done', 'current', 'upcoming', 'upcoming']);
    expect(dealTimeline('closed').map((s) => s.state)).toEqual(['done', 'done', 'done', 'done', 'done']);
    expect(dealTimeline('active', { under_offer: 'Oct 1, 2026' })[1]!.date).toBe('Oct 1, 2026');
  });
  it('never shows a stage by colour alone', () => {
    expect(stagePill('under_offer')).toBe('under-offer');
    expect(stagePill('fallen_through')).toBe('withdrawn');
  });
});

import { describe, expect, it } from 'vitest';
import { checklist, type ChecklistInput } from '@/lib/listing-checklist';
import { dollars, halves, int, isoDate, text } from '@/lib/schemas/fields';
import { propertyStep, reviewDecisionSchema, termsStep } from '@/lib/schemas/listing';
import { listingSlug, slugify } from '@/lib/slug';
import { cloudinarySignature } from '@/lib/storage';

describe('field parsers', () => {
  it('reads dollars the way people type them', () => {
    const p = dollars();
    expect(p.parse('365000')).toBe(365000);
    expect(p.parse('$365,000')).toBe(365000);
    expect(p.parse('')).toBeNull();
    expect(p.parse(undefined)).toBeNull();
    expect(p.safeParse('365k').error?.issues[0]?.message).toBe('Enter a price in dollars, like 365000.');
    expect(p.safeParse('-5').success).toBe(false);
  });
  it('checks whole numbers and halves', () => {
    expect(int('x', 0, 50).parse('3')).toBe(3);
    expect(int('Too many', 0, 50).safeParse('51').error?.issues[0]?.message).toBe('Too many');
    expect(halves('x').parse('1.5')).toBe(1.5);
    expect(halves('Halves only').safeParse('1.3').error?.issues[0]?.message).toBe('Halves only');
  });
  it('checks dates and text length', () => {
    expect(isoDate().parse('2026-11-01')).toBe('2026-11-01');
    expect(isoDate().safeParse('11/01/2026').success).toBe(false);
    expect(text(5, 'The name').safeParse('toolong').error?.issues[0]?.message).toBe('The name is too long. Keep it under 5 characters.');
    expect(text().parse('  trimmed  ')).toBe('trimmed');
  });
});

describe('step schemas', () => {
  it('accept a partial draft', () => {
    const r = propertyStep.safeParse({ type: 'house', addressLine: 'Example Lane' });
    expect(r.success).toBe(true);
    expect(r.data!.beds).toBeNull();
    expect(r.data!.featureIds).toEqual([]);
  });
  it('reject unknown types and bad area IDs', () => {
    expect(propertyStep.safeParse({ type: 'castle' }).success).toBe(false);
    expect(propertyStep.safeParse({ areaId: 'fairview' }).error?.issues[0]?.message).toBe('Choose the area from the list.');
  });
  it('parse terms with yes/no selects', () => {
    const r = termsStep.parse({ price: '1,900', yardSign: 'yes', lockbox: 'no', photosAllowed: '' });
    expect(r).toMatchObject({ price: 1900, yardSign: true, lockbox: false, photosAllowed: null });
  });
  it('require notes unless approving', () => {
    expect(reviewDecisionSchema.safeParse({ decision: 'approved' }).success).toBe(true);
    expect(reviewDecisionSchema.safeParse({ decision: 'rejected', notes: '' }).success).toBe(false);
    expect(reviewDecisionSchema.safeParse({ decision: 'changes_requested', notes: 'Add the lot size.' }).success).toBe(true);
  });
});

const complete: ChecklistInput = {
  source: 'agent',
  type: 'house',
  purpose: 'sale',
  addressLine: 'Example Lane',
  areaId: 'a',
  price: 365000,
  beds: 3,
  baths: 2,
  description: 'An example description that is comfortably over forty characters.',
  sellerClientId: 'c',
  photos: [{ alt: 'a' }, { alt: 'b' }, { alt: 'c' }],
};

describe('submission checklist', () => {
  it('passes a complete listing', () => {
    expect(checklist(complete)).toEqual([]);
  });
  it('counts photos in house style', () => {
    expect(checklist({ ...complete, photos: [{ alt: 'a' }, { alt: 'b' }] }).map((c) => c.message)).toEqual(['Add at least 3 photos. You have 2.']);
  });
  it('asks for photo descriptions', () => {
    expect(checklist({ ...complete, photos: [{ alt: 'a' }, { alt: '' }, { alt: null }] }).map((c) => c.message)).toEqual(['Describe 2 photos for people using screen readers.']);
  });
  it('needs lease terms for rentals', () => {
    const r = checklist({ ...complete, purpose: 'rent', type: 'rental', lease: { leaseLengthMonths: null, deposit: null } });
    expect(r.map((c) => c.field)).toEqual(['availableFrom', 'leaseLengthMonths', 'deposit']);
  });
  it('needs a public line when a business name is withheld', () => {
    const r = checklist({ ...complete, type: 'business', beds: null, baths: null, business: { businessName: 'Example Diner', nameWithheld: true, teaser: '' } });
    expect(r.map((c) => c.field)).toEqual(['teaser']);
  });
  it('does not ask land for bedrooms', () => {
    expect(checklist({ ...complete, type: 'land', beds: null, baths: null })).toEqual([]);
  });
  it('points property owners to their details step', () => {
    expect(checklist({ ...complete, source: 'owner_submitted', sellerClientId: null })[0]!.step).toBe('owner');
  });
});

describe('slugs', () => {
  it('builds readable, unique listing slugs', () => {
    expect(slugify('Renée’s Café & Bar')).toBe('renees-cafe-bar');
    expect(listingSlug('7063 Franklin Court', 'Fairview', 'JR-2026-00041')).toBe('7063-franklin-court-fairview-00041');
    expect(listingSlug(null, null, 'JR-2026-00041')).toBe('jr-2026-00041');
  });
});

describe('cloudinary signing', () => {
  it('matches the documented example', () => {
    // From Cloudinary's "Generating authentication signatures" documentation.
    expect(cloudinarySignature({ eager: 'w_400,h_300,c_pad|w_260,h_200,c_crop', public_id: 'sample_image', timestamp: 1315060510 }, 'abcd')).toBe('bfd09f95f331f558cbd1320e67aa8d488770583e');
  });
});

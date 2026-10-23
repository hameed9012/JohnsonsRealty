import { describe, expect, it } from 'vitest';
import { listingStatusEnum } from '@/db/schema';
import {
  LISTING_STATUSES,
  TRANSITIONS,
  TransitionError,
  approvedStatus,
  assertTransition,
  canTransition,
  displayStatus,
  isPublic,
  label,
} from '@/lib/listing-status';
import { STATUS } from '@/components/ui/status';
import { statusKey } from '@/lib/listing-status';

describe('listing status machine', () => {
  it('matches the database enum exactly', () => {
    expect([...LISTING_STATUSES]).toEqual(listingStatusEnum.enumValues);
  });

  it('every status maps to a design-system status key', () => {
    for (const s of LISTING_STATUSES) expect(STATUS[statusKey(s)]).toBeDefined();
  });

  it('runs the review loop: draft → pending → changes → pending → active', () => {
    expect(canTransition('draft', 'pending_review', 'sale')).toBe(true);
    expect(canTransition('pending_review', 'changes_requested', 'sale')).toBe(true);
    expect(canTransition('changes_requested', 'pending_review', 'sale')).toBe(true);
    expect(canTransition('pending_review', 'active', 'sale')).toBe(true);
    expect(canTransition('pending_review', 'rejected', 'sale')).toBe(true);
  });

  it('never skips review', () => {
    expect(canTransition('draft', 'active', 'sale')).toBe(false);
    expect(canTransition('draft', 'for_lease', 'rent')).toBe(false);
    expect(canTransition('changes_requested', 'active', 'sale')).toBe(false);
    expect(canTransition('rejected', 'active', 'sale')).toBe(false);
    expect(canTransition('rejected', 'pending_review', 'sale')).toBe(false);
  });

  it('follows the lifecycle after approval', () => {
    expect(canTransition('active', 'under_offer', 'sale')).toBe(true);
    expect(canTransition('under_offer', 'under_contract', 'sale')).toBe(true);
    expect(canTransition('under_contract', 'sold', 'sale')).toBe(true);
    expect(canTransition('sold', 'archived', 'sale')).toBe(true);
    expect(canTransition('for_lease', 'leased', 'rent')).toBe(true);
    expect(canTransition('leased', 'for_lease', 'rent')).toBe(true);
  });

  it('can fall back from an offer or contract', () => {
    expect(canTransition('under_offer', 'active', 'sale')).toBe(true);
    expect(canTransition('under_contract', 'active', 'sale')).toBe(true);
    expect(canTransition('under_contract', 'for_lease', 'rent')).toBe(true);
  });

  it('keeps sale and rent statuses apart', () => {
    expect(canTransition('pending_review', 'for_lease', 'sale')).toBe(false);
    expect(canTransition('pending_review', 'active', 'rent')).toBe(false);
    expect(canTransition('under_contract', 'leased', 'sale')).toBe(false);
    expect(canTransition('under_contract', 'sold', 'rent')).toBe(false);
  });

  it('treats archived as terminal and sold as nearly terminal', () => {
    for (const to of LISTING_STATUSES) expect(canTransition('archived', to, 'sale')).toBe(false);
    expect(TRANSITIONS.sold).toEqual(['archived']);
  });

  it('assertTransition throws a readable error', () => {
    expect(() => assertTransition('draft', 'sold', 'sale')).toThrow(TransitionError);
    expect(() => assertTransition('draft', 'sold', 'sale')).toThrow('A listing can’t move from Draft to Sold.');
    expect(() => assertTransition('draft', 'pending_review', 'sale')).not.toThrow();
  });

  it('approves into the right status', () => {
    expect(approvedStatus('sale')).toBe('active');
    expect(approvedStatus('rent')).toBe('for_lease');
    expect(approvedStatus('sale', true)).toBe('coming_soon');
  });

  it('only shows approved statuses publicly', () => {
    expect(isPublic('active')).toBe(true);
    expect(isPublic('sold')).toBe(true);
    for (const s of ['draft', 'pending_review', 'changes_requested', 'rejected', 'withdrawn', 'off_market', 'archived'] as const) {
      expect(isPublic(s)).toBe(false);
    }
  });

  it('labels statuses in title case', () => {
    expect(label('pending_review')).toBe('Pending Review');
    expect(label('for_lease')).toBe('For Lease');
  });
});

describe('derived display status', () => {
  const now = new Date('2026-10-23T12:00:00Z');
  it('shows Just Listed for the first 14 days', () => {
    expect(displayStatus({ status: 'active', publishedAt: new Date('2026-10-20T00:00:00Z') }, now)).toBe('just-listed');
    expect(displayStatus({ status: 'active', publishedAt: new Date('2026-10-01T00:00:00Z') }, now)).toBe('active');
  });
  it('shows Price Reduced when the price went down', () => {
    expect(displayStatus({ status: 'active', publishedAt: new Date('2026-10-20T00:00:00Z'), price: 350000, previousPrice: 365000 }, now)).toBe('price-reduced');
  });
  it('never derives on non-active statuses', () => {
    expect(displayStatus({ status: 'under_offer', publishedAt: new Date('2026-10-20T00:00:00Z') }, now)).toBe('under-offer');
    expect(displayStatus({ status: 'for_lease', publishedAt: new Date('2026-10-20T00:00:00Z') }, now)).toBe('for-lease');
  });
});

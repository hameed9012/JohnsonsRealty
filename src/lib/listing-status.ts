// The listing lifecycle as a state machine. Every status change goes through assertTransition.
import type { StatusKey } from '@/components/ui/status';

export const LISTING_STATUSES = [
  'draft',
  'pending_review',
  'changes_requested',
  'rejected',
  'coming_soon',
  'active',
  'for_lease',
  'under_offer',
  'under_contract',
  'sold',
  'leased',
  'off_market',
  'withdrawn',
  'archived',
] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];
export type Purpose = 'sale' | 'rent';

export const TRANSITIONS: Record<ListingStatus, readonly ListingStatus[]> = {
  draft: ['pending_review', 'withdrawn'],
  pending_review: ['active', 'for_lease', 'coming_soon', 'changes_requested', 'rejected', 'withdrawn'],
  changes_requested: ['pending_review', 'withdrawn'],
  rejected: ['archived'],
  coming_soon: ['active', 'for_lease', 'off_market', 'withdrawn'],
  active: ['under_offer', 'under_contract', 'sold', 'off_market', 'withdrawn'],
  for_lease: ['under_offer', 'leased', 'off_market', 'withdrawn'],
  under_offer: ['under_contract', 'active', 'for_lease', 'sold', 'leased'],
  under_contract: ['sold', 'leased', 'active', 'for_lease'],
  sold: ['archived'],
  leased: ['for_lease', 'archived'],
  off_market: ['active', 'for_lease', 'withdrawn', 'archived'],
  withdrawn: ['pending_review', 'archived'],
  archived: [],
};

/** Transitions out of review. Only someone with `listing.approve` may make them. */
export const REVIEW_DECISIONS: readonly ListingStatus[] = ['active', 'for_lease', 'coming_soon', 'changes_requested', 'rejected'];

const SALE_ONLY: ListingStatus[] = ['active', 'sold'];
const RENT_ONLY: ListingStatus[] = ['for_lease', 'leased'];

/** Statuses the public site may show. */
export const PUBLIC_STATUSES: readonly ListingStatus[] = ['coming_soon', 'active', 'for_lease', 'under_offer', 'under_contract', 'sold', 'leased'];
/** Statuses that count as "on the market" for search and counts. */
export const MARKET_STATUSES: readonly ListingStatus[] = ['coming_soon', 'active', 'for_lease', 'under_offer', 'under_contract'];

export function fitsPurpose(status: ListingStatus, purpose: Purpose): boolean {
  if (purpose === 'sale') return !RENT_ONLY.includes(status);
  return !SALE_ONLY.includes(status);
}

export function canTransition(from: ListingStatus, to: ListingStatus, purpose: Purpose): boolean {
  return TRANSITIONS[from].includes(to) && fitsPurpose(to, purpose);
}

export class TransitionError extends Error {
  constructor(
    public from: ListingStatus,
    public to: ListingStatus,
  ) {
    super(`A listing can’t move from ${label(from)} to ${label(to)}.`);
  }
}

export function assertTransition(from: ListingStatus, to: ListingStatus, purpose: Purpose): void {
  if (!canTransition(from, to, purpose)) throw new TransitionError(from, to);
}

/** The status a listing takes when approved. */
export function approvedStatus(purpose: Purpose, comingSoon = false): ListingStatus {
  if (comingSoon) return 'coming_soon';
  return purpose === 'rent' ? 'for_lease' : 'active';
}

export function isPublic(status: ListingStatus) {
  return PUBLIC_STATUSES.includes(status);
}

const KEY: Record<ListingStatus, StatusKey> = {
  draft: 'draft',
  pending_review: 'pending-review',
  changes_requested: 'changes-requested',
  rejected: 'rejected',
  coming_soon: 'coming-soon',
  active: 'active',
  for_lease: 'for-lease',
  under_offer: 'under-offer',
  under_contract: 'under-contract',
  sold: 'sold',
  leased: 'leased',
  off_market: 'off-market',
  withdrawn: 'withdrawn',
  archived: 'archived',
};

export function statusKey(s: ListingStatus): StatusKey {
  return KEY[s];
}

export function label(s: ListingStatus): string {
  return statusKey(s)
    .split('-')
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(' ');
}

const JUST_LISTED_DAYS = 14;

/**
 * What the public sees. "Just Listed" (first 14 days) and "Price Reduced" are derived, never stored.
 * The stored status still decides visibility.
 */
export function displayStatus(
  l: { status: ListingStatus; publishedAt?: Date | null; price?: number | null; previousPrice?: number | null },
  now = new Date(),
): StatusKey {
  if (l.status === 'active') {
    if (l.previousPrice && l.price && l.previousPrice > l.price) return 'price-reduced';
    if (l.publishedAt && now.getTime() - l.publishedAt.getTime() < JUST_LISTED_DAYS * 86400000) return 'just-listed';
  }
  return statusKey(l.status);
}

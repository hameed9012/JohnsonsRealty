export type StatusKey =
  | 'available'
  | 'active'
  | 'just-listed'
  | 'coming-soon'
  | 'price-reduced'
  | 'under-offer'
  | 'under-contract'
  | 'sold'
  | 'settled'
  | 'for-lease'
  | 'leased'
  | 'draft'
  | 'off-market'
  | 'withdrawn'
  | 'archived'
  | 'pending-review'
  | 'changes-requested'
  | 'rejected'
  | 'listed-by-owner'
  | 'confidential';

export type StatusTone = 'available' | 'new' | 'offer' | 'sold' | 'lease' | 'off' | 'confidential';

export const STATUS: Record<StatusKey, [label: string, tone: StatusTone]> = {
  available: ['Available', 'available'],
  active: ['Active', 'available'],
  'just-listed': ['Just Listed', 'new'],
  'coming-soon': ['Coming Soon', 'new'],
  'price-reduced': ['Price Reduced', 'new'],
  'under-offer': ['Under Offer', 'offer'],
  'under-contract': ['Under Contract', 'offer'],
  sold: ['Sold', 'sold'],
  settled: ['Settled', 'sold'],
  'for-lease': ['For Lease', 'lease'],
  leased: ['Leased', 'lease'],
  draft: ['Draft', 'off'],
  'off-market': ['Off Market', 'off'],
  withdrawn: ['Withdrawn', 'off'],
  archived: ['Archived', 'off'],
  'pending-review': ['Pending Review', 'offer'],
  'changes-requested': ['Changes Requested', 'offer'],
  rejected: ['Rejected', 'confidential'],
  'listed-by-owner': ['Listed by Owner', 'lease'],
  confidential: ['Confidential', 'confidential'],
};

export function statusOf(s: string | undefined): [string, StatusTone] {
  return (s && STATUS[s as StatusKey]) || [String(s ?? ''), 'off'];
}

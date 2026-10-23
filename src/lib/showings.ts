import type { StatusKey } from '@/components/ui/status';

export const SHOWING_STATUSES = ['requested', 'confirmed', 'completed', 'cancelled', 'no_show'] as const;
export type ShowingStatus = (typeof SHOWING_STATUSES)[number];

export const SHOWING_PILL: Record<ShowingStatus, { status: StatusKey; label: string }> = {
  requested: { status: 'pending-review', label: 'Requested' },
  confirmed: { status: 'active', label: 'Confirmed' },
  completed: { status: 'sold', label: 'Completed' },
  cancelled: { status: 'withdrawn', label: 'Cancelled' },
  no_show: { status: 'off-market', label: 'No show' },
};

/** Clients can change a showing until it has happened or been cancelled. */
export function clientCanChange(status: ShowingStatus, at: Date, now = new Date()): boolean {
  return (status === 'requested' || status === 'confirmed') && at.getTime() > now.getTime();
}

export function isUpcoming(status: ShowingStatus, at: Date, now = new Date()): boolean {
  return (status === 'requested' || status === 'confirmed') && at.getTime() > now.getTime() - 3600_000;
}

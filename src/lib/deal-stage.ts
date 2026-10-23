import type { StatusKey } from '@/components/ui/status';
import type { TimelineStep } from '@/components/ui/layout';

export const DEAL_TIMELINE = ['active', 'under_offer', 'under_contract', 'settlement', 'closed'] as const;
const LABEL = { active: 'Active', under_offer: 'Under Offer', under_contract: 'Under Contract', settlement: 'Settlement', closed: 'Closed' } as const;

export function stagePill(stage: string): StatusKey {
  return (
    ({ active: 'active', under_offer: 'under-offer', under_contract: 'under-contract', settlement: 'under-contract', closed: 'settled', fallen_through: 'withdrawn' } as Record<string, StatusKey>)[stage] ?? 'draft'
  );
}

/** The client's journey through a deal. A deal that fell through shows where it stopped. */
export function dealTimeline(stage: string, dates: Partial<Record<(typeof DEAL_TIMELINE)[number], string | null>> = {}): TimelineStep[] {
  const at = DEAL_TIMELINE.indexOf(stage as (typeof DEAL_TIMELINE)[number]);
  return DEAL_TIMELINE.map((s, i) => ({
    label: LABEL[s],
    state: at < 0 ? 'upcoming' : i < at ? 'done' : i === at ? (s === 'closed' ? 'done' : 'current') : 'upcoming',
    date: dates[s] ?? undefined,
  }));
}

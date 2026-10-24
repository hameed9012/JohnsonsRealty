// The property map's rules, shared by the website's interactive map, the server-drawn PNG and Discord.
// A listing is placed at its postal zone (never an exact house) as a soft circle: one circle per zone per
// status group, with the count inside when there's more than one. A listing with a manual override (the
// phase 1 pin) gets its own circle there.

/** In-game postal code from an address: the house number without its last digit (6012 → 601, 10031 → 1003). */
export function postalFromAddress(address: string | null | undefined): string | null {
  const m = /^\s*(\d{2,})\b/.exec(address ?? '');
  return m ? m[1]!.slice(0, -1) : null;
}

export type MapGroup = 'available' | 'lease' | 'offer' | 'sold';

export const MAP_GROUPS: { key: MapGroup; label: string; token: string }[] = [
  { key: 'available', label: 'Available', token: 'brass-500' },
  { key: 'lease', label: 'For lease', token: 'status-lease' },
  { key: 'offer', label: 'Under offer', token: 'status-offer' },
  { key: 'sold', label: 'Sold', token: 'green-900' },
];

export function mapGroup(status: string): MapGroup | null {
  switch (status) {
    case 'active':
    case 'coming_soon':
      return 'available';
    case 'for_lease':
      return 'lease';
    case 'under_offer':
    case 'under_contract':
      return 'offer';
    case 'sold':
    case 'leased':
      return 'sold';
    default:
      return null;
  }
}

export interface MapZone {
  code: string;
  label: string;
  x: number;
  y: number;
}

export interface MapListing {
  id: string;
  slug: string;
  title: string;
  status: string;
  price: number | null;
  purpose: string;
  postal: string | null;
  mapX: number | null;
  mapY: number | null;
  /** When it sold or leased, for the "stays on the map for N days" rule. */
  closedAt: Date | null;
}

export interface MapCircle {
  key: string;
  x: number;
  y: number;
  group: MapGroup;
  zone: string | null;
  label: string;
  listings: MapListing[];
}

export interface MapLayout {
  circles: MapCircle[];
  counts: Record<MapGroup, number>;
  /** Listings whose postal code has no zone yet (the Owner is asked to place it). */
  unplaced: string[];
}

export function layoutMap(listings: MapListing[], zones: MapZone[], o: { soldDays: number; now?: Date }): MapLayout {
  const now = (o.now ?? new Date()).getTime();
  const byCode = new Map(zones.map((z) => [z.code, z]));
  const circles = new Map<string, MapCircle>();
  const counts: Record<MapGroup, number> = { available: 0, lease: 0, offer: 0, sold: 0 };
  const unplaced = new Set<string>();
  for (const l of listings) {
    const group = mapGroup(l.status);
    if (!group) continue;
    if (group === 'sold' && (!l.closedAt || now - l.closedAt.getTime() > o.soldDays * 86400000)) continue;
    let key: string;
    let x: number;
    let y: number;
    let zone: string | null = null;
    let label: string;
    if (l.mapX !== null && l.mapY !== null) {
      key = `pin:${l.id}`;
      x = l.mapX;
      y = l.mapY;
      label = l.title;
    } else {
      const z = l.postal ? byCode.get(l.postal) : undefined;
      if (!z) {
        if (l.postal) unplaced.add(l.postal);
        continue;
      }
      key = `${z.code}:${group}`;
      x = z.x;
      y = z.y;
      zone = z.code;
      label = `${z.label} (Postal ${z.code})`;
    }
    const c = circles.get(key) ?? { key, x, y, group, zone, label, listings: [] };
    c.listings.push(l);
    circles.set(key, c);
    counts[group]++;
  }
  // Several groups in one zone sit side by side instead of on top of each other.
  const byZone = new Map<string, MapCircle[]>();
  for (const c of circles.values()) if (c.zone) byZone.set(c.zone, [...(byZone.get(c.zone) ?? []), c]);
  for (const list of byZone.values()) {
    if (list.length < 2) continue;
    list.sort((a, b) => MAP_GROUPS.findIndex((g) => g.key === a.group) - MAP_GROUPS.findIndex((g) => g.key === b.group));
    list.forEach((c, i) => (c.x += (i - (list.length - 1) / 2) * 2.6));
  }
  return { circles: [...circles.values()], counts, unplaced: [...unplaced].sort() };
}

/** Circle radius in % of the map width: grows a little with the count. */
export function circleRadius(count: number): number {
  return Math.min(3.2, 1.4 + Math.log2(Math.max(1, count)) * 0.55);
}

/** A stable digest of everything the map shows, so the PNG and the Discord message change only when it does. */
export function mapHash(layout: MapLayout, zones: MapZone[], imageId: string | null): string {
  const s = JSON.stringify([imageId, zones.map((z) => [z.code, z.x, z.y]), layout.circles.map((c) => [c.key, c.x, c.y, c.listings.length]).sort()]);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

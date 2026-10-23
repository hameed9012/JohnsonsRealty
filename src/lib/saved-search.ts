// Saved searches store the scope (Buy, Rent or Businesses) and the search criteria. When a listing is
// approved, matchesSaved decides who gets an alert. Pure, so it's tested directly.
import { money } from './format';
import { DEFAULT_QUERY, searchCriteria, toQueryString, type SearchQuery } from './search';

export const SAVED_SCOPES = ['buy', 'rent', 'businesses'] as const;
export type SavedScope = (typeof SAVED_SCOPES)[number];

export type SavedCriteria = ReturnType<typeof searchCriteria> & { scope: SavedScope };

export function toSaved(scope: SavedScope, q: SearchQuery): SavedCriteria {
  return { scope, ...searchCriteria(q) };
}

/** Reads a stored params object defensively (older rows, hand edits). */
export function readSaved(p: Record<string, unknown>): SavedCriteria {
  const scope = SAVED_SCOPES.includes(p.scope as SavedScope) ? (p.scope as SavedScope) : 'buy';
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const s = (v: unknown) => (typeof v === 'string' && v ? v : null);
  return {
    scope,
    area: s(p.area),
    type: s(p.type) as SavedCriteria['type'],
    min: n(p.min),
    max: n(p.max),
    beds: n(p.beds),
    baths: n(p.baths),
    features: Array.isArray(p.features) ? p.features.filter((f): f is string => typeof f === 'string') : [],
    owner: p.owner === 'exclude' || p.owner === 'only' ? p.owner : 'include',
  };
}

export function savedHref(c: SavedCriteria): string {
  const { scope, ...rest } = c;
  return `/${scope}${toQueryString({ ...DEFAULT_QUERY, ...rest })}`;
}

export interface ListingFacts {
  purpose: 'sale' | 'rent';
  type: string;
  areaSlug: string | null;
  areaParentSlug: string | null;
  price: number | null;
  beds: number | null;
  baths: number | null;
  ownerListed: boolean;
  featureKeys: string[];
}

export function matchesSaved(c: SavedCriteria, l: ListingFacts): boolean {
  if (c.scope === 'businesses' ? l.type !== 'business' : l.type === 'business') return false;
  if (c.scope === 'buy' && l.purpose !== 'sale') return false;
  if (c.scope === 'rent' && l.purpose !== 'rent') return false;
  if (c.type && l.type !== c.type) return false;
  if (c.area && c.area !== l.areaSlug && c.area !== l.areaParentSlug) return false;
  if (c.min !== null && (l.price === null || l.price < c.min)) return false;
  if (c.max !== null && (l.price === null || l.price > c.max)) return false;
  if (c.beds !== null && (l.beds === null || l.beds < c.beds)) return false;
  if (c.baths !== null && (l.baths === null || l.baths < c.baths)) return false;
  if (c.owner === 'exclude' && l.ownerListed) return false;
  if (c.owner === 'only' && !l.ownerListed) return false;
  return c.features.every((f) => l.featureKeys.includes(f));
}

const SCOPE_NOUN: Record<SavedScope, string> = { buy: 'Homes for sale', rent: 'Homes for rent', businesses: 'Businesses for sale' };

/** "Homes for sale in Fairview · 3+ beds · up to $500,000" */
export function describeSaved(c: SavedCriteria, areaName: (slug: string) => string | undefined): string {
  const parts: string[] = [];
  let head = SCOPE_NOUN[c.scope];
  if (c.area) head += ` in ${areaName(c.area) ?? c.area}`;
  parts.push(head);
  if (c.type) parts.push(c.type[0]!.toUpperCase() + c.type.slice(1));
  const unit = c.scope === 'rent' ? '/mo' : '';
  if (c.min !== null && c.max !== null) parts.push(`${money(c.min)}${unit} to ${money(c.max)}${unit}`);
  else if (c.min !== null) parts.push(`from ${money(c.min)}${unit}`);
  else if (c.max !== null) parts.push(`up to ${money(c.max)}${unit}`);
  if (c.beds !== null) parts.push(`${c.beds}+ beds`);
  if (c.baths !== null) parts.push(`${c.baths}+ baths`);
  if (c.features.length) parts.push(c.features.join(', '));
  if (c.owner === 'exclude') parts.push('no owner listings');
  if (c.owner === 'only') parts.push('owner listings only');
  return parts.join(' · ');
}

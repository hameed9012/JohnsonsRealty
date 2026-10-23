// Buy, Rent and Businesses searches live in the URL, so every search is shareable. Parsing is lenient:
// a bad value is dropped rather than shown as an error. The same object is stored in saved searches.
import { z } from 'zod';

export const SORTS = ['newest', 'price-asc', 'price-desc', 'beds'] as const;
export const SEARCH_TYPES = ['house', 'apartment', 'land', 'rental', 'business'] as const;
export type Sort = (typeof SORTS)[number];

export const SORT_LABELS: Record<Sort, string> = {
  newest: 'Newest first',
  'price-asc': 'Price, low to high',
  'price-desc': 'Price, high to low',
  beds: 'Most bedrooms',
};

export interface SearchQuery {
  area: string | null;
  type: (typeof SEARCH_TYPES)[number] | null;
  min: number | null;
  max: number | null;
  beds: number | null;
  baths: number | null;
  features: string[];
  owner: 'include' | 'exclude' | 'only';
  sort: Sort;
  view: 'grid' | 'list';
  page: number;
}

export const DEFAULT_QUERY: SearchQuery = { area: null, type: null, min: null, max: null, beds: null, baths: null, features: [], owner: 'include', sort: 'newest', view: 'grid', page: 1 };

type Params = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function num(v: string | undefined, max: number): number | null {
  if (!v) return null;
  const n = Number(v.replace(/[$,\s]/g, ''));
  return Number.isFinite(n) && n >= 0 && n <= max ? Math.round(n) : null;
}

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(80);

export function parseSearch(p: Params): SearchQuery {
  const featuresRaw = p.features;
  const features = (Array.isArray(featuresRaw) ? featuresRaw : featuresRaw ? featuresRaw.split(',') : [])
    .map((f) => f.trim())
    .filter((f) => slug.safeParse(f).success)
    .slice(0, 20);
  const type = first(p.type);
  const sort = first(p.sort);
  const owner = first(p.owner);
  const area = first(p.area);
  return {
    area: area && slug.safeParse(area).success ? area : null,
    type: SEARCH_TYPES.includes(type as SearchQuery['type'] & string) ? (type as SearchQuery['type']) : null,
    min: num(first(p.min), 100_000_000),
    max: num(first(p.max), 100_000_000),
    beds: num(first(p.beds), 20),
    baths: num(first(p.baths), 20),
    features: [...new Set(features)].sort(),
    owner: owner === 'exclude' || owner === 'only' ? owner : 'include',
    sort: SORTS.includes(sort as Sort) ? (sort as Sort) : 'newest',
    view: first(p.view) === 'list' ? 'list' : 'grid',
    page: Math.max(1, Math.min(500, num(first(p.page), 500) ?? 1)),
  };
}

/** Query string with defaults left out, in a stable order. */
export function toQueryString(q: Partial<SearchQuery>): string {
  const s = new URLSearchParams();
  const full = { ...DEFAULT_QUERY, ...q };
  if (full.area) s.set('area', full.area);
  if (full.type) s.set('type', full.type);
  if (full.min !== null) s.set('min', String(full.min));
  if (full.max !== null) s.set('max', String(full.max));
  if (full.beds !== null) s.set('beds', String(full.beds));
  if (full.baths !== null) s.set('baths', String(full.baths));
  if (full.features.length) s.set('features', [...full.features].sort().join(','));
  if (full.owner !== 'include') s.set('owner', full.owner);
  if (full.sort !== 'newest') s.set('sort', full.sort);
  if (full.view !== 'grid') s.set('view', full.view);
  if (full.page > 1) s.set('page', String(full.page));
  const str = s.toString();
  return str ? `?${str}` : '';
}

/** The part of a query that defines *what* is searched (for saved searches and alerts). */
export function searchCriteria(q: SearchQuery) {
  const { area, type, min, max, beds, baths, features, owner } = q;
  return { area, type, min, max, beds, baths, features, owner };
}

/** Price bands for the selects, per purpose. */
export function priceBands(purpose: 'sale' | 'rent'): number[] {
  return purpose === 'rent' ? [1000, 1500, 2000, 2500, 3000, 4000, 5000] : [100000, 150000, 200000, 300000, 400000, 500000, 750000, 1000000, 1500000];
}

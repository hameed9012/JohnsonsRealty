'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { FeatureChips } from '@/components/ui/controls';
import type { IconName } from '@/components/ui/Icon';
import { SelectField } from '@/components/ui/fields';
import { money } from '@/lib/format';
import { SORT_LABELS, SORTS, toQueryString, type SearchQuery } from '@/lib/search';

export interface FilterOptions {
  basePath: string;
  purpose: 'sale' | 'rent';
  areas: { value: string; label: string }[];
  types: { value: string; label: string }[];
  features: { value: string; label: string; icon?: IconName }[];
  bands: number[];
  rooms: boolean;
}

function activeCount(q: SearchQuery) {
  return [q.area, q.type, q.min, q.max, q.beds, q.baths].filter((x) => x !== null).length + q.features.length + (q.owner !== 'include' ? 1 : 0);
}

/** A plain GET form, so search works without JavaScript. Under 900px it becomes a bottom sheet. */
export function SearchFilters({ q, o }: { q: SearchQuery; o: FilterOptions }) {
  const [open, setOpen] = useState(false);
  const n = activeCount(q);
  const fmt = (v: number) => (o.purpose === 'rent' ? `${money(v)}/mo` : money(v));
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="filters">
      <Button variant="secondary" icon="filter" className="filters-toggle" aria-expanded={open} aria-controls="search-filters" onClick={() => setOpen(true)}>
        Filters{n ? ` (${n})` : ''}
      </Button>
      {open ? <div className="filters-scrim" aria-hidden onClick={() => setOpen(false)} /> : null}
      <form id="search-filters" className={open ? 'filters-panel filters-panel--open' : 'filters-panel'} method="get" action={o.basePath} role="search" aria-label="Filter listings">
        <div className="filters-head">
          <h2 className="heading-3">Filters</h2>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)} className="filters-close">
            Close
          </Button>
        </div>
        <div className="filters-grid">
          <SelectField label="Area" name="area" placeholder="Any area" options={o.areas} defaultValue={q.area ?? ''} />
          {o.types.length > 1 ? <SelectField label="Type" name="type" placeholder="Any type" options={o.types} defaultValue={q.type ?? ''} /> : null}
          <SelectField label="Min price" name="min" placeholder="No min" options={o.bands.map((b) => ({ value: String(b), label: fmt(b) }))} defaultValue={q.min?.toString() ?? ''} />
          <SelectField label="Max price" name="max" placeholder="No max" options={o.bands.map((b) => ({ value: String(b), label: fmt(b) }))} defaultValue={q.max?.toString() ?? ''} />
          {o.rooms ? (
            <>
              <SelectField label="Bedrooms" name="beds" placeholder="Any" options={[1, 2, 3, 4, 5].map((b) => ({ value: String(b), label: `${b}+` }))} defaultValue={q.beds?.toString() ?? ''} />
              <SelectField label="Bathrooms" name="baths" placeholder="Any" options={[1, 2, 3].map((b) => ({ value: String(b), label: `${b}+` }))} defaultValue={q.baths?.toString() ?? ''} />
            </>
          ) : null}
          <SelectField
            label="Owner listings"
            name="owner"
            options={[
              { value: 'include', label: 'Include' },
              { value: 'exclude', label: 'Leave out' },
              { value: 'only', label: 'Only owner listings' },
            ]}
            defaultValue={q.owner}
          />
        </div>
        {o.features.length ? <FeatureChips legend="Features" name="features" options={o.features} defaultSelected={q.features} /> : null}
        {q.sort !== 'newest' ? <input type="hidden" name="sort" value={q.sort} /> : null}
        {q.view !== 'grid' ? <input type="hidden" name="view" value={q.view} /> : null}
        <div className="row filters-actions">
          <Button type="submit" icon="search">
            Show results
          </Button>
          {n ? (
            <Button variant="ghost" href={o.basePath + toQueryString({ sort: q.sort, view: q.view })}>
              Clear filters
            </Button>
          ) : null}
        </div>
      </form>
    </div>
  );
}

export function SortSelect({ q, basePath }: { q: SearchQuery; basePath: string }) {
  const router = useRouter();
  return (
    <div className="sort-select">
      <label className="jr-field-label" htmlFor="sort-select">
        Sort
      </label>
      <select id="sort-select" className="jr-field-input" value={q.sort} onChange={(e) => router.push(basePath + toQueryString({ ...q, sort: e.target.value as SearchQuery['sort'], page: 1 }))}>
        {SORTS.map((s) => (
          <option key={s} value={s}>
            {SORT_LABELS[s]}
          </option>
        ))}
      </select>
    </div>
  );
}

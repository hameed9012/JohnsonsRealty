import Link from 'next/link';
import { asc, eq } from 'drizzle-orm';
import { CardGrid } from '@/components/listing/CardGrid';
import { EmptyState } from '@/components/ui/blocks';
import { Button } from '@/components/ui/Button';
import type { IconName } from '@/components/ui/Icon';
import { Pagination } from '@/components/ui/layout';
import { db } from '@/db/client';
import { features } from '@/db/schema';
import { count } from '@/lib/format';
import { priceBands, toQueryString, type SearchQuery } from '@/lib/search';
import { TYPE_LABELS, type ListingType } from '@/lib/schemas/listing';
import { getAreas } from '@/server/queries/areas';
import { searchCards, type SearchScope } from '@/server/queries/cards';
import { SearchFilters, SortSelect } from './SearchFilters';
import { SaveSearchButton } from './SavedSearchControls';
import type { SavedScope } from '@/lib/saved-search';
import { getActor } from '@/server/session';
import { MapPin } from '@/components/listing/MapPin';
import { publicImageUrl } from '@/lib/storage';
import { mediaSrc } from '@/server/queries/media';
import { getSettings } from '@/server/settings';

export interface SearchPageProps {
  scopeKey: SavedScope;
  eyebrow: string;
  title: string;
  intro?: string;
  basePath: string;
  purpose: 'sale' | 'rent';
  scope: SearchScope;
  types: ListingType[];
  rooms: boolean;
  noun: [string, string];
  q: SearchQuery;
}

export async function SearchPage(p: SearchPageProps) {
  const settings = await getSettings();
  // The map view exists only when the Owner has uploaded a map image.
  const mapSrc = await mediaSrc(settings.mapMediaId);
  const mapView = !!mapSrc && p.q.view === 'map';
  const [actor, allAreas, feats, res] = await Promise.all([
    getActor(),
    getAreas(),
    db.select().from(features).where(eq(features.active, true)).orderBy(asc(features.displayOrder)),
    searchCards(p.scope, p.q, { pins: mapView }),
  ]);
  const byId = new Map(allAreas.map((a) => [a.id, a]));
  const areaOpts = allAreas.map((a) => ({ value: a.slug, label: a.parentId ? `${a.name} · ${byId.get(a.parentId)?.name ?? ''}` : `${a.name} (all)` }));
  const href = (page: number) => p.basePath + toQueryString({ ...p.q, page });
  const view = (v: 'grid' | 'list' | 'map') => p.basePath + toQueryString({ ...p.q, view: v, page: 1 });
  const noun = res.total === 1 ? p.noun[0] : p.noun[1];

  return (
    <div className="container section stack-lg">
      <header className="stack prose">
        <span className="label label--brass">{p.eyebrow}</span>
        <h1 className="display-m">{p.title}</h1>
        {p.intro ? <p className="body-l muted">{p.intro}</p> : null}
      </header>

      <div className="search-layout">
        <SearchFilters
          q={p.q}
          o={{
            basePath: p.basePath,
            purpose: p.purpose,
            areas: areaOpts,
            types: p.types.map((t) => ({ value: t, label: TYPE_LABELS[t] })),
            features: feats.map((f) => ({ value: f.key, label: f.label, icon: (f.icon as IconName | null) ?? undefined })),
            bands: priceBands(p.purpose),
            rooms: p.rooms,
          }}
        />

        <section className="stack jr-min0" aria-labelledby="results-h">
          <div className="results-head">
            <h2 id="results-h" className="heading-3" aria-live="polite">
              <span className="figure">{count(res.total)}</span> {noun}
            </h2>
            <div className="row">
              <SaveSearchButton scope={p.scopeKey} query={toQueryString(p.q)} signedIn={!!actor} returnTo={p.basePath + toQueryString(p.q)} />
              <SortSelect q={p.q} basePath={p.basePath} />
              <nav className="view-toggle" aria-label="Layout">
                <Link href={view('grid')} aria-current={p.q.view === 'grid' ? 'true' : undefined}>
                  Grid
                </Link>
                <Link href={view('list')} aria-current={p.q.view === 'list' ? 'true' : undefined}>
                  List
                </Link>
                {mapSrc ? (
                  <Link href={view('map')} aria-current={mapView ? 'true' : undefined}>
                    Map
                  </Link>
                ) : null}
              </nav>
            </div>
          </div>
          {mapView ? (
            <MapPin
              src={publicImageUrl(mapSrc!, { width: 1600 })}
              pins={res.pins}
              caption={res.pins.length ? `${count(res.pins.length)} of ${count(res.total)} ${noun} have a pin, placed by hand by the brokerage. Choose a pin to open the listing.` : 'None of these listings has a pin on the map yet. Use the grid or list to see them.'}
            />
          ) : null}
          {res.cards.length ? (
            <>
              <CardGrid cards={res.cards} layout={p.q.view === 'map' ? 'list' : p.q.view} priority={3} returnTo={p.basePath + toQueryString(p.q)} />
              <Pagination page={p.q.page} pages={res.pages} href={href} />
            </>
          ) : (
            <EmptyState
              title={`No ${p.noun[1]} match these filters`}
              text="Try a wider price range, another area, or fewer features."
              action={
                <Button variant="secondary" href={p.basePath}>
                  Clear filters
                </Button>
              }
            />
          )}
        </section>
      </div>
    </div>
  );
}

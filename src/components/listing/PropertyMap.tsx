'use client';

import Link from 'next/link';
import { useState } from 'react';
import { money } from '@/lib/format';
import { circleRadius, MAP_GROUPS, type MapGroup } from '@/lib/map';

export interface MapCircleView {
  key: string;
  x: number;
  y: number;
  group: MapGroup;
  label: string;
  listings: { id: string; slug: string; title: string; price: number | null; purpose: string }[];
}

export interface PropertyMapProps {
  src: string;
  width: number;
  height: number;
  circles: MapCircleView[];
  counts: Record<MapGroup, number>;
  /** Property page: one zone highlighted, no list. */
  highlight?: boolean;
  caption?: string;
}

const GROUP_WORD: Record<MapGroup, string> = { available: 'available', lease: 'for lease', offer: 'under offer', sold: 'sold recently' };

/**
 * The interactive property map: soft circles at postal zones (never exact houses), a count inside when
 * there's more than one. Circles are buttons; choosing one lists its listings beside the map.
 */
export function PropertyMap({ src, width, height, circles, counts, highlight, caption }: PropertyMapProps) {
  const [open, setOpen] = useState<string | null>(null);
  const selected = circles.find((c) => c.key === open) ?? null;
  const ratio = height / width;
  return (
    <figure className={highlight ? 'pmap pmap--small' : 'pmap'}>
      <div className="pmap-layout">
        <div className="pmap-frame" style={{ aspectRatio: `${width} / ${height}` }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- one uploaded map image whose geometry the circles depend on */}
          <img src={src} alt="Map of the playable area" className="pmap-img" />
          <svg className="pmap-overlay" viewBox={`0 0 100 ${100 * ratio}`} preserveAspectRatio="none" aria-hidden={highlight ? true : undefined}>
            {[...circles]
              .sort((a, b) => b.listings.length - a.listings.length)
              .map((c) => {
                const r = circleRadius(c.listings.length) * (highlight ? 1.8 : 1);
                const cy = c.y * ratio;
                const n = c.listings.length;
                const name = `${n} ${n === 1 ? 'listing' : 'listings'} ${GROUP_WORD[c.group]} in ${c.label}`;
                const body = (
                  <>
                    <circle cx={c.x} cy={cy} r={r + 0.9} className={`pmap-halo pmap--${c.group}`} />
                    <circle cx={c.x} cy={cy} r={r} className={`pmap-dot pmap--${c.group}`} />
                    {n > 1 ? (
                      <text x={c.x} y={cy} className="pmap-count" fontSize={r * 1.05} textAnchor="middle" dominantBaseline="central">
                        {n}
                      </text>
                    ) : null}
                  </>
                );
                return highlight ? (
                  <g key={c.key}>{body}</g>
                ) : (
                  <g
                    key={c.key}
                    role="button"
                    tabIndex={0}
                    aria-label={name}
                    aria-pressed={open === c.key}
                    className="pmap-hit"
                    onClick={() => setOpen(open === c.key ? null : c.key)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setOpen(open === c.key ? null : c.key);
                      }
                    }}
                  >
                    <title>{name}</title>
                    {body}
                  </g>
                );
              })}
          </svg>
        </div>
        {highlight ? null : (
          <div className="pmap-side stack">
            <ul className="pmap-legend" aria-label="Legend">
              {MAP_GROUPS.filter((g) => g.key !== 'sold' || counts.sold > 0).map((g) => (
                <li key={g.key}>
                  <span className={`pmap-swatch pmap--${g.key}`} aria-hidden />
                  {g.label}
                  <span className="figure">{counts[g.key]}</span>
                </li>
              ))}
            </ul>
            {selected ? (
              <section className="stack" aria-live="polite" aria-labelledby="pmap-sel">
                <h3 id="pmap-sel" className="heading-3">
                  {selected.label}
                </h3>
                <ul className="saved-list">
                  {selected.listings.map((l) => (
                    <li key={l.id}>
                      <Link href={`/property/${l.slug}`} className="ui">
                        {l.title}
                      </Link>
                      {l.price ? <span className="figure">{money(l.price) + (l.purpose === 'rent' ? '/mo' : '')}</span> : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : (
              <p className="body-s muted">Choose a circle to see the listings there. Circles show the postal zone, not the exact house.</p>
            )}
          </div>
        )}
      </div>
      {caption ? <figcaption className="body-s muted">{caption}</figcaption> : null}
    </figure>
  );
}

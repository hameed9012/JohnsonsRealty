import Link from 'next/link';
import type * as React from 'react';
import { AgentCard } from '@/components/ui/AgentCard';
import { AreaChip } from '@/components/ui/AreaChip';
import { Icon } from '@/components/ui/Icon';
import { DataSheet } from '@/components/ui/layout';
import { PriceDisplay, StatRow } from '@/components/ui/PriceDisplay';
import { StatusPill, StatusStamp } from '@/components/ui/StatusStamp';
import { money } from '@/lib/format';
import type { PropertyView as View } from '@/lib/listing-view';
import { Gallery } from './Gallery';

export interface PropertyViewProps {
  view: View;
  /** Save, share, brochure. */
  actions?: React.ReactNode;
  /** Booking form or sign-in prompt. */
  booking?: React.ReactNode;
  /** Similar listings rail. */
  similar?: React.ReactNode;
  /** The hand-placed map pin, when the brokerage has a map and this listing has a pin. */
  map?: React.ReactNode;
  /** Wizard and review previews render without links out of the page. */
  preview?: boolean;
  headingLevel?: 1 | 2;
}

export function PropertyView({ view: v, actions, booking, similar, map, preview, headingLevel = 1 }: PropertyViewProps) {
  const H = headingLevel === 1 ? 'h1' : 'h2';
  const kind = v.purpose === 'rent' ? 'rent' : v.previousPrice ? 'reduced' : v.rawStatus === 'sold' ? 'sold' : 'sale';
  return (
    <article className="property">
      <Gallery photos={v.photos} postalCode={v.postalCode} title={v.title} />

      <header className="property-head">
        <div className="stack">
          <div className="row">
            <StatusStamp status={v.status} size="lg" />
            {v.ownerListed ? <StatusPill status="listed-by-owner" /> : null}
          </div>
          <p className="label label--brass">
            {v.typeLabel}
            {v.purpose === 'rent' ? ' for rent' : ' for sale'}
            {v.areaName ? ` · ${v.areaName}${v.areaParentName ? ', ' + v.areaParentName : ''}` : ''}
          </p>
          <H className="display-l property-title">{v.title}</H>
          {v.areaName ? (
            <div className="row">
              <AreaChip name={v.areaName} zip={v.postalCode ?? undefined} href={preview || !v.areaSlug ? undefined : `/areas/${v.areaSlug}`} />
            </div>
          ) : null}
        </div>
        <div className="property-price">
          {v.price ? <PriceDisplay amount={v.price} kind={kind} previous={v.previousPrice ?? undefined} size="xl" /> : <p className="body muted">Price on request</p>}
          {actions ? <div className="row">{actions}</div> : null}
        </div>
      </header>

      {v.stats.length ? <StatRow items={v.stats} className="property-stats" /> : null}

      <div className="property-body">
        <div className="stack-lg jr-min0">
          {v.description ? (
            <section className="stack">
              <h2 className="heading-2">About this {v.type === 'business' ? 'business' : 'property'}</h2>
              <div className="prose body-l">
                {v.description.split(/\n{2,}/).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </section>
          ) : null}

          {v.features.length ? (
            <section className="stack">
              <h2 className="heading-2">Features</h2>
              <ul className="feature-list">
                {v.features.map((f) => (
                  <li key={f.label}>
                    {f.icon ? <Icon name={f.icon} size={20} /> : <Icon name="check" size={20} />}
                    {f.label}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="stack">
            <h2 className="heading-2">Key facts</h2>
            <DataSheet rows={v.facts} />
          </section>

          {v.priceHistory.length ? (
            <section className="stack">
              <h2 className="heading-2">Price history</h2>
              <div className="jr-ledger-wrap">
                <table className="jr-ledger">
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col">Event</th>
                      <th scope="col" className="right">
                        Price
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {v.priceHistory.map((p, i) => (
                      <tr key={i}>
                        <td className="num">{p.date}</td>
                        <td>{p.event}</td>
                        <td className="num right">
                          {money(p.price)}
                          {v.purpose === 'rent' ? '/mo' : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {map ? (
            <section className="stack">
              <h2 className="heading-2">On the map</h2>
              {map}
            </section>
          ) : null}

          {v.areaFacts.length ? (
            <section className="stack">
              <h2 className="heading-2">The area{v.areaName ? `: ${v.areaName}` : ''}</h2>
              <DataSheet rows={v.areaFacts} />
              {v.areaSlug && !preview ? (
                <p className="body">
                  <Link href={`/areas/${v.areaSlug}`}>More about {v.areaName}</Link>
                </p>
              ) : null}
            </section>
          ) : null}
        </div>

        <aside className="property-aside stack">
          {v.agent ? (
            <AgentCard
              name={v.agent.name}
              title={v.agent.title ?? undefined}
              handle={v.agent.handle ?? undefined}
              photo={v.agent.photo ?? undefined}
              href={preview || !v.agent.slug ? undefined : `/agents/${v.agent.slug}`}
              actionLabel={v.agent.slug ? 'View profile' : undefined}
              action={v.agent.slug && !preview ? undefined : false}
            />
          ) : null}
          {v.ownerContact ? (
            <section className="owner-contact stack" aria-label="Listed by Owner">
              <StatusPill status="listed-by-owner" />
              <p className="heading-3">{v.ownerContact.name}</p>
              <p className="body-s muted">The owner listed this property themselves{v.agent ? `. ${v.agent.name} is the brokerage contact.` : '.'}</p>
              {v.ownerContact.lines.length ? (
                <dl className="sheet">
                  {v.ownerContact.lines.map((l) => (
                    <div key={l.label}>
                      <dt>{l.label}</dt>
                      <dd className="num">{l.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </section>
          ) : null}
          {booking}
          <p className="id muted">Reference {v.refNo}</p>
        </aside>
      </div>

      {similar}
    </article>
  );
}

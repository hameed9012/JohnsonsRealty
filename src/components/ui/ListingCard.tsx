import Image from 'next/image';
import Link from 'next/link';
import type * as React from 'react';
import { cx } from '@/lib/cx';
import { Icon, type IconName } from './Icon';
import { Mark } from './Logo';
import { PriceDisplay, type PriceKind } from './PriceDisplay';
import { StatusPill, StatusStamp } from './StatusStamp';
import type { StatusKey } from './status';

export interface Fact {
  icon?: IconName;
  text: string;
}

export interface ListingCardProps {
  address: string;
  price: number;
  status?: StatusKey;
  statusLabel?: string;
  area?: string;
  /** Image src for next/image: a storage ID or URL. */
  photo?: string;
  photoAlt?: string;
  href?: string;
  facts?: Fact[];
  priceKind?: PriceKind;
  priceLabel?: string;
  previousPrice?: number;
  saved?: boolean;
  onSave?: React.MouseEventHandler;
  layout?: 'grid' | 'list';
  className?: string;
  /** Addition: shows the "Listed by Owner" pill beside the status. */
  ownerListed?: boolean;
  /** Addition: preload the photo (first cards above the fold). */
  priority?: boolean;
  /** Addition: replaces the save button, e.g. with a client SaveButton. */
  saveSlot?: React.ReactNode;
}

export function ListingCard(p: ListingCardProps) {
  const media = p.photo ? (
    <Image
      className="jr-card-img"
      src={p.photo}
      alt={p.photoAlt || 'Photo of ' + p.address}
      fill
      priority={p.priority}
      sizes={p.layout === 'list' ? '(max-width: 560px) 100vw, 40vw' : '(max-width: 640px) 100vw, (max-width: 1240px) 50vw, 400px'}
    />
  ) : (
    <div className="jr-card-ph">
      <Mark size={40} decorative />
      Photos coming soon
    </div>
  );
  const mediaInner = (
    <>
      {media}
      {p.status ? (
        <span className="jr-card-flag">
          <StatusStamp status={p.status} label={p.statusLabel} variant="ribbon" />
        </span>
      ) : null}
    </>
  );
  return (
    <article className={cx('jr-card', p.layout === 'list' && 'jr-card--list', p.className)}>
      {p.href ? (
        <Link className="jr-card-media" href={p.href} tabIndex={-1} aria-hidden>
          {mediaInner}
        </Link>
      ) : (
        <div className="jr-card-media">{mediaInner}</div>
      )}
      <div className="jr-card-body">
        {p.area || p.ownerListed ? (
          <div className="jr-card-meta">
            {p.area ? <p className="jr-card-area">{p.area}</p> : null}
            {p.ownerListed ? <StatusPill status="listed-by-owner" /> : null}
          </div>
        ) : null}
        <h3 className="jr-card-addr">{p.href ? <Link href={p.href}>{p.address}</Link> : p.address}</h3>
        {p.facts && p.facts.length ? (
          <ul className="jr-card-facts">
            {p.facts.map((f, i) => (
              <li key={i}>
                {f.icon ? <Icon name={f.icon} size={16} /> : null}
                {f.text}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="jr-card-foot">
          <PriceDisplay amount={p.price} kind={p.priceKind || 'sale'} label={p.priceLabel} previous={p.previousPrice} />
          {p.saveSlot ??
            (p.onSave !== undefined || p.saved !== undefined ? (
              <button
                type="button"
                className="jr-card-save"
                aria-pressed={!!p.saved}
                aria-label={p.saved ? 'Remove from saved homes' : 'Save home'}
                onClick={p.onSave}
              >
                <Icon name="heart" size={20} />
              </button>
            ) : null)}
        </div>
      </div>
    </article>
  );
}

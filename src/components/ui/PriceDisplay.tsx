import type * as React from 'react';
import { cx } from '@/lib/cx';
import { money } from '@/lib/format';
import { Icon, type IconName } from './Icon';

export type PriceKind = 'sale' | 'rent' | 'sold' | 'reduced';

export interface PriceDisplayProps {
  amount: number;
  kind?: PriceKind;
  previous?: number;
  label?: string;
  size?: 'md' | 'xl';
  className?: string;
}

const LABELS: Record<PriceKind, string> = { sale: 'Asking', sold: 'Sold for', rent: 'Rent', reduced: 'Now' };

export function PriceDisplay({ amount, kind = 'sale', previous, label, size, className }: PriceDisplayProps) {
  const l = label !== undefined ? label : LABELS[kind];
  return (
    <div className={cx('jr-price', size === 'xl' && 'jr-price--xl', className)}>
      {l ? <span className="jr-price-label">{l}</span> : null}
      <div className="jr-price-line">
        {previous ? (
          <s className="jr-price-prev" aria-label={'Was ' + money(previous)}>
            {money(previous)}
          </s>
        ) : null}
        <span className="jr-price-amt">
          {money(amount)}
          {kind === 'rent' ? <span className="jr-price-unit">/mo</span> : null}
        </span>
      </div>
    </div>
  );
}

export interface StatRowProps {
  items: { icon?: IconName; value: React.ReactNode; label: string }[];
  className?: string;
}

export function StatRow({ items, className }: StatRowProps) {
  return (
    <div className={cx('jr-stats', className)}>
      {items.map((it, i) => (
        <div className="jr-stat" key={i}>
          {it.icon ? <Icon name={it.icon} size={20} /> : null}
          <b>{it.value}</b>
          <span>{it.label}</span>
        </div>
      ))}
    </div>
  );
}

import type * as React from 'react';
import { Icon } from './Icon';

export interface FilterChipProps {
  selected?: boolean;
  count?: number;
  onClick?: React.MouseEventHandler;
  children?: React.ReactNode;
}

export function FilterChip({ selected, count, onClick, children }: FilterChipProps) {
  return (
    <button type="button" className="jr-filter" aria-pressed={!!selected} onClick={onClick}>
      {selected ? <Icon name="check" size={16} /> : null}
      {children}
      {count !== undefined ? <span className="jr-filter-count">{count}</span> : null}
    </button>
  );
}

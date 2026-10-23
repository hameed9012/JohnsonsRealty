import Link from 'next/link';
import { Fragment } from 'react';
import type * as React from 'react';
import { cx } from '@/lib/cx';
import { Icon } from './Icon';

export function Skeleton({ kind = 'line', width, className }: { kind?: 'line' | 'card' | 'block'; width?: string; className?: string }) {
  return (
    <span
      className={cx('jr-skel', kind === 'line' && 'jr-skel-line', kind === 'card' && 'jr-skel-card', className)}
      style={width ? { width } : undefined}
      aria-hidden
    />
  );
}

export function CardSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="card-grid" role="status" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="stack">
          <Skeleton kind="card" />
          <Skeleton width="40%" />
          <Skeleton width="80%" />
          <Skeleton width="60%" />
        </div>
      ))}
    </div>
  );
}

export interface PaginationProps {
  page: number;
  pages: number;
  href: (page: number) => string;
}

export function Pagination({ page, pages, href }: PaginationProps) {
  if (pages <= 1) return null;
  const nums = new Set([1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages));
  const list = [...nums].sort((a, b) => a - b);
  return (
    <nav className="jr-pages" aria-label="Pagination">
      {page > 1 ? <Link href={href(page - 1)} rel="prev">Previous</Link> : null}
      {list.map((n, i) => (
        <Fragment key={n}>
          {i > 0 && n - list[i - 1]! > 1 ? <span className="gap" aria-hidden>…</span> : null}
          {n === page ? (
            <span aria-current="page">{n}</span>
          ) : (
            <Link href={href(n)} aria-label={`Page ${n}`}>
              {n}
            </Link>
          )}
        </Fragment>
      ))}
      {page < pages ? <Link href={href(page + 1)} rel="next">Next</Link> : null}
    </nav>
  );
}

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav className="jr-crumbs" aria-label="Breadcrumb">
      <ol>
        {items.map((it, i) => (
          <li key={i}>
            {it.href && i < items.length - 1 ? <Link href={it.href}>{it.label}</Link> : <span aria-current={i === items.length - 1 ? 'page' : undefined}>{it.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export interface TimelineStep {
  label: string;
  state: 'done' | 'current' | 'upcoming';
  date?: string;
}

/** Lifecycle / journey timeline. State is spelled out for screen readers, never colour alone. */
export function Timeline({ steps, label }: { steps: TimelineStep[]; label: string }) {
  const words = { done: 'Done', current: 'Current step', upcoming: 'Upcoming' };
  return (
    <ol className="jr-timeline" aria-label={label}>
      {steps.map((s, i) => (
        <li key={i} data-state={s.state} aria-current={s.state === 'current' ? 'step' : undefined}>
          {s.label}
          <span className="sr-state">{words[s.state]}</span>
          {s.date ? <time>{s.date}</time> : null}
        </li>
      ))}
    </ol>
  );
}

/** The client visibility layer marker. */
export function VisibilityLabel({ children = 'Only you can see this' }: { children?: React.ReactNode }) {
  return (
    <span className="visibility-label">
      <Icon name="user" size={16} />
      {children}
    </span>
  );
}

export function ClientPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="client-panel" aria-label={title}>
      <header>
        <h2 className="heading-3">{title}</h2>
        <VisibilityLabel />
      </header>
      <div>{children}</div>
    </section>
  );
}

/** form-label / form-value pairs, used by client files and the seller file. */
export function DataSheet({ rows }: { rows: { label: string; value?: React.ReactNode; mono?: boolean }[] }) {
  return (
    <dl className="sheet">
      {rows.map((r, i) => (
        <div key={i}>
          <dt>{r.label}</dt>
          <dd className={r.mono ? 'num' : undefined}>{r.value === undefined || r.value === null || r.value === '' ? '—' : r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  num?: boolean;
  align?: 'right';
}

/** Dense table that becomes stacked cards under 640px (each cell carries its header). */
export function DataTable<T>({ columns, rows, rowKey, caption, empty }: { columns: Column<T>[]; rows: T[]; rowKey: (r: T) => string; caption?: string; empty?: React.ReactNode }) {
  if (!rows.length && empty) return <>{empty}</>;
  return (
    <div className="dt-wrap">
      <table className="dt">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={c.align === 'right' ? 'right' : undefined}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={rowKey(r)}>
              {columns.map((c) => (
                <td key={c.key} data-label={c.header} className={cx(c.num && 'num', c.align === 'right' && 'right')}>
                  {c.cell(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

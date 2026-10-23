import type * as React from 'react';
import { Icon, type IconName } from './Icon';

export interface ProcessStepsProps {
  steps: { title: string; text: string }[];
}

export function ProcessSteps({ steps }: ProcessStepsProps) {
  return (
    <ol className="jr-steps">
      {steps.map((s, i) => (
        <li key={i}>
          <h4>{s.title}</h4>
          <p>{s.text}</p>
        </li>
      ))}
    </ol>
  );
}

export interface ReferenceReceiptProps {
  title: string;
  reference: string;
  eyebrow?: string;
  refLabel?: string;
  text?: string;
  action?: React.ReactNode;
}

export function ReferenceReceipt({ title, reference, eyebrow, refLabel, text, action }: ReferenceReceiptProps) {
  return (
    <section className="jr-receipt" role="status">
      <span className="jr-eyebrow">{eyebrow || 'Request received'}</span>
      <h3>{title}</h3>
      <div className="jr-receipt-ref">
        <span>{refLabel || 'Your reference number'}</span>
        <b>{reference}</b>
      </div>
      {text ? <p>{text}</p> : null}
      {action || null}
    </section>
  );
}

export interface EmptyStateProps {
  title: string;
  text?: string;
  icon?: IconName;
  action?: React.ReactNode;
}

export function EmptyState({ title, text, icon, action }: EmptyStateProps) {
  return (
    <section className="jr-empty">
      <Icon name={icon || 'search'} size={28} />
      <h3>{title}</h3>
      {text ? <p>{text}</p> : null}
      {action || null}
    </section>
  );
}

export interface StatTileProps {
  label: string;
  value: React.ReactNode;
  meta?: string;
  trend?: 'up' | 'down';
}

export function StatTile({ label, value, meta, trend }: StatTileProps) {
  return (
    <div className="jr-tile">
      <span className="jr-tile-label">{label}</span>
      <span className="jr-tile-value">{value}</span>
      {meta ? (
        <span className={trend ? 'jr-tile-meta jr-tile-meta--' + trend : 'jr-tile-meta'}>
          {trend === 'up' ? '▲ ' : trend === 'down' ? '▼ ' : ''}
          {meta}
        </span>
      ) : null}
    </div>
  );
}

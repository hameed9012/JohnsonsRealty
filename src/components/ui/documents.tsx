import type * as React from 'react';
import { cx, initials } from '@/lib/cx';
import { money } from '@/lib/format';
import { Icon } from './Icon';
import { Logo } from './Logo';
import { StatusPill } from './StatusStamp';
import type { StatusKey } from './status';

export interface DocumentHeaderProps {
  title: string;
  subtitle?: string;
  formNo?: string;
  contact?: { label?: string; value: string }[];
  subline?: string;
}

export function DocumentHeader({ title, subtitle, formNo, contact, subline }: DocumentHeaderProps) {
  return (
    <header className="jr-doc">
      <div className="jr-doc-band">
        <Logo tone="dark" subline={subline} />
        {contact ? (
          <div className="jr-doc-contact">
            {contact.map((c, i) => (
              <div key={i}>
                {c.label ? <b>{c.label} </b> : null}
                {c.value}
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <div className="jr-doc-title">
        <h1>{title}</h1>
        {subtitle ? <div className="jr-doc-sub">{subtitle}</div> : null}
        {formNo ? <div className="jr-doc-ref">{formNo}</div> : null}
      </div>
      <div className="jr-doc-rule" />
    </header>
  );
}

export interface SignatureLineProps {
  label: string;
  name?: string;
  date?: string;
}

export function SignatureLine({ label, name, date }: SignatureLineProps) {
  return (
    <div className="jr-sig">
      <div className={cx('jr-sig-name', !name && 'jr-sig-name--empty')}>{name || 'Not yet signed'}</div>
      <div className="jr-sig-meta">
        <span>{label}</span>
        {date ? <time>{date}</time> : null}
      </div>
    </div>
  );
}

export interface ConfidentialPanelProps {
  rows: { label: string; value?: React.ReactNode; mono?: boolean }[];
  title?: string;
  note?: string;
  redacted?: boolean;
}

/**
 * Internal-only fields. When `redacted`, callers must not pass values at all —
 * the server never sends them — and each row renders a redaction bar.
 */
export function ConfidentialPanel({ rows, title, note, redacted }: ConfidentialPanelProps) {
  return (
    <section className="jr-conf" aria-label={title || 'Confidential'}>
      <div className="jr-conf-head">
        <Icon name="lock" size={16} />
        {title || 'Confidential'}
        <small>{note || 'Agents only'}</small>
      </div>
      <dl>
        {rows.flatMap((r, i) => [
          <dt key={'t' + i}>{r.label}</dt>,
          <dd key={'d' + i} className={r.mono ? 'num' : undefined}>
            {redacted ? <span className="jr-redact" role="img" aria-label="Hidden" /> : r.value}
          </dd>,
        ])}
      </dl>
    </section>
  );
}

export interface PipelineCardProps {
  status: StatusKey;
  address: string;
  value: number;
  client?: string;
  due?: string;
  agent?: string;
}

export function PipelineCard({ status, address, value, client, due, agent }: PipelineCardProps) {
  return (
    <article className="jr-pipe">
      <div>
        <StatusPill status={status} />
      </div>
      <h4>{address}</h4>
      {client ? <p>{client}</p> : null}
      <div className="jr-pipe-foot">
        <span>{money(value)}</span>
        {due ? <time>{due}</time> : null}
        {agent ? (
          <span className="jr-mono-avatar" title={agent}>
            {initials(agent)}
          </span>
        ) : null}
      </div>
    </article>
  );
}

export interface ToastProps {
  message: string;
  tone?: 'default' | 'success' | 'danger';
  action?: { label: string; onClick: () => void };
}

export function Toast({ message, tone, action }: ToastProps) {
  return (
    <div className={cx('jr-toast', tone && tone !== 'default' && 'jr-toast--' + tone)} role="status">
      <i className="jr-toast-mark" aria-hidden />
      <span>{message}</span>
      {action ? (
        <button type="button" onClick={action.onClick}>
          {action.label}
        </button>
      ) : null}
    </div>
  );
}

import Image from 'next/image';
import type * as React from 'react';
import { cx, initials } from '@/lib/cx';
import { Button } from './Button';

export interface AgentCardProps {
  name: string;
  title?: string;
  handle?: string;
  /** Image src for next/image: a storage ID or URL. */
  photo?: string;
  stats?: { value: React.ReactNode; label: string }[];
  onContact?: React.MouseEventHandler;
  href?: string;
  actionLabel?: string;
  action?: false;
  className?: string;
}

export function AgentCard({ name, title, handle, photo, stats, onContact, href, actionLabel, action, className }: AgentCardProps) {
  return (
    <article className={cx('jr-agent', className)}>
      <div className="jr-agent-avatar">
        {photo ? <Image src={photo} alt={name} width={72} height={72} className="jr-agent-photo" /> : initials(name)}
      </div>
      <div className="jr-min0">
        <h3 className="jr-agent-name">{name}</h3>
        {title ? <p className="jr-agent-title">{title}</p> : null}
        {handle ? <p className="jr-agent-handle">Chirper @{String(handle).replace(/^@/, '')}</p> : null}
        {stats && stats.length ? (
          <ul className="jr-agent-stats">
            {stats.map((s, i) => (
              <li key={i}>
                <b>{s.value}</b>
                <span>{s.label}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="jr-agent-gap" />
        )}
        {action !== false ? (
          <Button variant="secondary" size="sm" onClick={onContact} href={href}>
            {actionLabel || 'Contact ' + String(name || '').split(' ')[0]}
          </Button>
        ) : null}
      </div>
    </article>
  );
}

import Link from 'next/link';
import { cx } from '@/lib/cx';

export interface LogoProps {
  variant?: 'lockup' | 'mark';
  tone?: 'light' | 'dark';
  small?: boolean;
  size?: number;
  subline?: string | false;
  href?: string;
  className?: string;
}

export function Mark({ tone = 'light', size = 40, decorative }: { tone?: 'light' | 'dark'; size?: number; decorative?: boolean }) {
  const roof = tone === 'dark' ? 'var(--cream)' : 'var(--green-900)';
  const brass = { fill: 'none', stroke: 'var(--brass-500)' };
  return (
    <svg
      className="jr-mark"
      viewBox="0 0 48 48"
      width={size}
      height={size}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : 'Johnson’s Realty'}
      aria-hidden={decorative ? true : undefined}
    >
      <rect x={1.2} y={1.2} width={45.6} height={45.6} style={{ strokeWidth: 1.6, ...brass }} />
      <path d="M10 23 L24 11 L38 23" style={{ fill: 'none', stroke: roof, strokeWidth: 2.8, strokeLinecap: 'square' }} />
      <path d="M15.1 31a4.4 4.4 0 1 0 8.8 0a4.4 4.4 0 1 0 -8.8 0" style={{ strokeWidth: 2.4, ...brass }} />
      <path d="M23.9 31H36M31.5 31v4M34.6 31v3" style={{ strokeWidth: 2.4, ...brass }} />
    </svg>
  );
}

export function Logo({ variant, tone = 'light', small, size, subline, href, className }: LogoProps) {
  const s = size || (small ? 32 : 44);
  if (variant === 'mark') return <Mark tone={tone} size={s} />;
  const inner = (
    <>
      <Mark tone={tone} size={s} decorative />
      <span>
        <span className="jr-logo-word">Johnson’s Realty</span>
        {subline === false ? null : <span className="jr-logo-sub">{subline || 'Brokerage · Pennsylvania'}</span>}
      </span>
    </>
  );
  const cls = cx('jr-logo', 'jr-logo--' + tone, small && 'jr-logo--sm', className);
  return href ? (
    <Link className={cls} href={href} aria-label="Johnson’s Realty home">
      {inner}
    </Link>
  ) : (
    <span className={cls}>{inner}</span>
  );
}

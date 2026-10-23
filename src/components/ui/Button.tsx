import Link from 'next/link';
import type * as React from 'react';
import { cx } from '@/lib/cx';
import { Icon, type IconName } from './Icon';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'md' | 'sm';
  icon?: IconName;
  iconRight?: IconName;
  withKey?: boolean;
  loading?: boolean;
  href?: string;
  children?: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size,
  icon,
  iconRight,
  withKey,
  loading,
  href,
  children,
  className,
  type,
  ...rest
}: ButtonProps) {
  const cls = cx(
    'jr-btn',
    'jr-btn--' + variant,
    size === 'sm' && 'jr-btn--sm',
    loading && 'jr-btn--loading',
    className,
  );
  const inner = (
    <>
      {icon ? <Icon name={icon} size={18} /> : null}
      {children}
      {withKey ? (
        <Icon name="key" size={18} className="jr-btn-key" />
      ) : iconRight ? (
        <Icon name={iconRight} size={18} />
      ) : null}
    </>
  );
  if (href) {
    const external = /^(https?:|mailto:)/.test(href);
    const anchorProps = rest as React.AnchorHTMLAttributes<HTMLAnchorElement>;
    return external ? (
      <a {...anchorProps} href={href} className={cls} aria-busy={loading || undefined}>
        {inner}
      </a>
    ) : (
      <Link {...anchorProps} href={href} className={cls} aria-busy={loading || undefined}>
        {inner}
      </Link>
    );
  }
  return (
    <button {...rest} type={type ?? 'button'} className={cls} aria-busy={loading || undefined}>
      {inner}
    </button>
  );
}

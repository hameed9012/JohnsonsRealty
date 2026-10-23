import { cx } from '@/lib/cx';
import { statusOf, type StatusKey } from './status';

export interface StatusStampProps {
  status: StatusKey;
  label?: string;
  variant?: 'stamp' | 'ribbon';
  size?: 'sm' | 'lg';
  press?: boolean;
  className?: string;
}

export function StatusStamp({ status, label, variant, size, press, className }: StatusStampProps) {
  const [word, tone] = statusOf(status);
  if (variant === 'ribbon') {
    return <span className={cx('jr-ribbon', 'jr-tone-' + tone, className)}>{label || word}</span>;
  }
  return (
    <span className={cx('jr-stamp', 'jr-tone-' + tone, size && 'jr-stamp--' + size, press && 'jr-stamp--press', className)}>
      {label || word}
    </span>
  );
}

export interface StatusPillProps {
  status: StatusKey;
  label?: string;
  className?: string;
}

export function StatusPill({ status, label, className }: StatusPillProps) {
  const [word, tone] = statusOf(status);
  return (
    <span className={cx('jr-pill', 'jr-tone-' + tone, className)}>
      <i className="jr-pill-dot" aria-hidden />
      {label || word}
    </span>
  );
}

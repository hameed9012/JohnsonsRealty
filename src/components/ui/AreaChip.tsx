import Link from 'next/link';
import { Icon } from './Icon';

export interface AreaChipProps {
  name: string;
  zip?: string;
  count?: number;
  href?: string;
}

export function AreaChip({ name, zip, count, href }: AreaChipProps) {
  const inner = (
    <>
      <Icon name="pin" size={16} />
      {name}
      {zip ? <span className="jr-chip-zip">{zip}</span> : null}
      {count !== undefined ? (
        <span className="jr-chip-count" aria-label={`${count} active listings`}>
          {count}
        </span>
      ) : null}
    </>
  );
  return href ? (
    <Link className="jr-chip" href={href}>
      {inner}
    </Link>
  ) : (
    <span className="jr-chip">{inner}</span>
  );
}

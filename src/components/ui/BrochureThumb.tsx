import Image from 'next/image';
import Link from 'next/link';
import { money } from '@/lib/format';
import { Mark } from './Logo';

export interface BrochureThumbProps {
  href: string;
  cover: string | null;
  address: string;
  price: number;
  leased?: boolean;
}

/**
 * A miniature of the 1080×1350 brochure for ledger rows: green band, cover photo with the ribbon, price.
 * The address in the same row is the accessible link; this copy is for pointers only.
 */
export function BrochureThumb({ href, cover, address, price, leased }: BrochureThumbProps) {
  return (
    <Link href={href} className="bthumb" aria-hidden tabIndex={-1} title={`${address}: open the listing and its brochure`}>
      <span className="bthumb-band">
        <Mark tone="dark" size={10} decorative />
      </span>
      <span className="bthumb-photo">
        {cover ? <Image src={cover} alt="" width={120} height={64} sizes="60px" /> : null}
        <span className="bthumb-ribbon">{leased ? 'Leased' : 'Sold'}</span>
      </span>
      <span className="bthumb-body">
        <span className="bthumb-line" />
        <span className="bthumb-price">{money(price)}</span>
      </span>
      <span className="bthumb-foot" />
    </Link>
  );
}

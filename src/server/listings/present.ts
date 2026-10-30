import 'server-only';
import { listingFields, siteUrl, type WebhookMessage } from '@/lib/discord';
import { money, rent, sqft } from '@/lib/format';
import { publicImageUrl } from '@/lib/storage';
import type { ListingBundle } from './bundle';

/** The public name of a listing: the teaser when a business name is withheld. */
export function publicTitle(b: Pick<ListingBundle, 'addressLine' | 'unit' | 'type' | 'business' | 'area'>): string {
  if (b.type === 'business' && b.business?.nameWithheld) return b.business.teaser || `Business, ${b.area?.name ?? 'Dauphin County'}`;
  // A business that isn't confidential goes by its name ("Common Cents Laundromat"), not its building.
  if (b.type === 'business' && b.business?.businessName) return b.business.businessName.replace(/\s*\(.*\)\s*$/, '');
  const addr = [b.addressLine, b.unit ? `Unit ${b.unit}` : null].filter(Boolean).join(', ');
  return addr || 'Address to be confirmed';
}

export function factsOf(b: Pick<ListingBundle, 'beds' | 'baths' | 'sqft' | 'type' | 'business' | 'lot'>): string[] {
  const f: string[] = [];
  if (b.type === 'business') {
    if (b.business?.businessType) f.push(b.business.businessType);
    if (b.business?.employees) f.push(`${b.business.employees} staff`);
  } else {
    if (b.beds !== null && b.beds !== undefined) f.push(`${b.beds} bed`);
    if (b.baths !== null && b.baths !== undefined) f.push(`${b.baths} bath`);
  }
  if (b.sqft) f.push(sqft(b.sqft));
  if (b.lot && b.type === 'land') f.push(b.lot);
  return f;
}

export function priceText(b: Pick<ListingBundle, 'price' | 'purpose'>): string | null {
  if (!b.price) return null;
  return b.purpose === 'rent' ? rent(b.price) : money(b.price);
}

export function coverOf(b: Pick<ListingBundle, 'photos'>) {
  return b.photos.find((p) => p.isCover) ?? b.photos[0] ?? null;
}

export function agentName(b: Pick<ListingBundle, 'agent'>): string | null {
  return b.agent?.agentProfile?.publicName ?? b.agent?.displayName ?? b.agent?.name ?? null;
}

export function webhookMessageFor(b: ListingBundle, title: string, path: string, opts: { internal?: boolean } = {}): WebhookMessage {
  const cover = coverOf(b);
  const area = [b.area?.name, b.area?.parent?.name].filter(Boolean).join(', ');
  return {
    title,
    heading: publicTitle(b),
    url: siteUrl(path),
    imageUrl: cover ? publicImageUrl(cover.media.storageId, { width: 1200, height: 675, crop: true }) : null,
    fields: listingFields({
      area,
      price: priceText(b),
      facts: factsOf(b),
      agent: agentName(b) ?? (b.source === 'owner_submitted' ? 'Listed by Owner' : null),
      refNo: opts.internal ? b.refNo : null,
    }),
    footer: b.source === 'owner_submitted' ? 'Johnson’s Realty · Listed by Owner' : 'Johnson’s Realty',
  };
}

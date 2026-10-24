import 'server-only';
import { desc, eq } from 'drizzle-orm';
import type { Stamp, StudioData } from '@/components/studio/Artboards';
import { db } from '@/db/client';
import { sales } from '@/db/schema';
import type { ChirpKind } from '@/lib/chirper';
import { money, sqft } from '@/lib/format';
import { displayStatus, type ListingStatus } from '@/lib/listing-status';
import { publicImageUrl } from '@/lib/storage';
import type { ListingBundle } from './bundle';
import { agentName, coverOf, priceText, publicTitle } from './present';

interface Brand {
  brokerageSubline: string;
  tagline: string | null;
  chirperHandle: string | null;
  brokerageName: string;
}

function stampFor(b: ListingBundle): Stamp {
  const shown = displayStatus({ status: b.status as ListingStatus, publishedAt: b.publishedAt, price: b.price, previousPrice: b.previousPrice });
  if (shown === 'price-reduced') return 'reduced';
  switch (b.status) {
    case 'under_offer':
    case 'under_contract':
      return 'contract';
    case 'sold':
      return b.type === 'business' ? 'bsold' : 'sold';
    case 'for_lease':
      return 'lease';
    case 'leased':
      return 'leased';
    default:
      return b.purpose === 'rent' ? 'lease' : 'listed';
  }
}

/** First sentence of the description, for the one-line blurb. */
function firstSentence(text: string | null): string {
  if (!text) return '';
  const s = text.replace(/\s+/g, ' ').trim();
  const m = /^(.{20,200}?[.!?])(\s|$)/.exec(s);
  return m ? m[1]! : s.slice(0, 200);
}

function statsFor(b: ListingBundle): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  if (b.type === 'business') {
    if (b.business?.employees) out.push({ value: String(b.business.employees), label: 'Staff' });
    if (b.business?.openedYear) out.push({ value: String(b.business.openedYear), label: 'Since' });
  } else {
    if (b.beds !== null) out.push({ value: String(b.beds), label: b.beds === 1 ? 'Bedroom' : 'Bedrooms' });
    if (b.baths !== null) out.push({ value: String(b.baths), label: b.baths === 1 ? 'Bathroom' : 'Bathrooms' });
  }
  if (b.sqft) out.push({ value: sqft(b.sqft).replace(' sq ft', ''), label: 'Sq ft' });
  if (b.type === 'land' && b.lot) out.push({ value: b.lot, label: 'Lot' });
  return out.slice(0, 4);
}

/** The brochure, square post and Chirper draft for a listing. Public fields only: brochures are shared outside. */
export interface StudioChirp {
  kind: ChirpKind;
  area: string;
  facts: string[];
  /** For the Just Listed and Marketplace posts. */
  areaName: string;
  postal: string | null;
  description: string;
  furnishedPrice: string | null;
  brokerageName: string;
  purpose: 'sale' | 'rent';
}

export async function studioDataFrom(b: ListingBundle, brand: Brand): Promise<{ data: StudioData; chirp: StudioChirp }> {
  const stamp = stampFor(b);
  const sale = b.status === 'sold' || b.status === 'leased' ? await db.query.sales.findFirst({ where: eq(sales.listingId, b.id), orderBy: [desc(sales.soldOn)] }) : null;
  const cover = coverOf(b);
  const photos = [cover, ...b.photos.filter((p) => p !== cover)].filter(Boolean).slice(0, 3).map((p) => publicImageUrl(p!.media.storageId, { width: 1400 }));
  const area = b.area ? [b.area.name, b.area.parent?.name].filter(Boolean).join(' · ') : '';
  const owner = b.source === 'owner_submitted';
  const price = sale ? money(sale.price) + (b.purpose === 'rent' ? '/mo' : '') : priceText(b);
  const facts = statsFor(b).map((s) => `${s.value} ${s.label.toLowerCase()}`);
  return {
    data: {
      stamp,
      date: sale?.soldOn ?? (b.publishedAt ? b.publishedAt.toISOString().slice(0, 10) : ''),
      address: publicTitle(b),
      areaLine: area ? `${area}, PA` : '',
      stats: statsFor(b),
      blurb: firstSentence(b.description),
      price: price ?? '',
      showPrice: !!price,
      represented: b.purpose === 'rent' ? 'The landlord' : b.type === 'business' ? 'The owner' : 'The sellers',
      photos,
      agent: owner
        ? { name: brand.brokerageName, title: 'Listed by Owner', chirper: brand.chirperHandle ?? '', contact: '' }
        : {
            name: agentName(b) ?? brand.brokerageName,
            title: b.agent?.agentProfile?.title ?? 'Real Estate Agent',
            chirper: b.agent?.chirperHandle ?? '',
            contact: b.agent?.agentProfile?.contactLine ?? b.agent?.robloxUsername ?? '',
          },
      brokerage: { subline: brand.brokerageSubline, tagline: brand.tagline ?? '', chirper: brand.chirperHandle ?? '' },
    },
    chirp: {
      kind: stamp === 'bsold' ? 'sold' : stamp,
      area,
      facts,
      areaName: b.area?.name ?? '',
      postal: b.postal,
      description: b.description ?? '',
      furnishedPrice: b.terms?.furnishedPrice ? money(b.terms.furnishedPrice) : null,
      brokerageName: brand.brokerageName,
      purpose: b.purpose,
    },
  };
}

// The public property page as plain data, so the same view renders the live page, the wizard preview
// and the review screen. Built on the server; never carries confidential fields or a withheld business name.
import type { StatusKey } from '@/components/ui/status';
import type { IconName } from '@/components/ui/Icon';

export interface PhotoView {
  id: string;
  src: string;
  width: number;
  height: number;
  alt: string;
  caption: string | null;
}

export interface FactRow {
  label: string;
  value: string;
  mono?: boolean;
}

export interface PropertyView {
  id: string;
  refNo: string;
  slug: string;
  title: string;
  areaName: string | null;
  areaSlug: string | null;
  areaParentName: string | null;
  postalCode: string | null;
  status: StatusKey;
  rawStatus: string;
  purpose: 'sale' | 'rent';
  type: string;
  typeLabel: string;
  ownerListed: boolean;
  price: number | null;
  previousPrice: number | null;
  stats: { icon: IconName; value: string; label: string }[];
  facts: FactRow[];
  features: { label: string; icon: IconName | null }[];
  description: string | null;
  photos: PhotoView[];
  cover: PhotoView | null;
  priceHistory: { date: string; event: string; price: number }[];
  agent: { name: string; title: string | null; handle: string | null; photo: string | null; slug: string | null } | null;
  ownerContact: { name: string; lines: { label: string; value: string }[] } | null;
  areaFacts: FactRow[];
  publishedAt: string | null;
  cardFacts: { icon?: IconName; text: string }[];
}

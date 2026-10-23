import type { Metadata } from 'next';
import { SearchPage } from '@/components/search/SearchPage';
import { parseSearch } from '@/lib/search';

export const metadata: Metadata = {
  title: 'Homes for sale',
  description: 'Houses, apartments and land for sale in Harrisburg, Swatara Township and Susquehanna Township.',
  alternates: { canonical: '/buy' },
};

export default async function BuyPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = parseSearch(await searchParams);
  return (
    <SearchPage
      eyebrow="Buy"
      title="Homes for sale"
      basePath="/buy"
      purpose="sale"
      scope={{ purpose: 'sale', excludeTypes: ['business'] }}
      types={['house', 'apartment', 'land']}
      rooms
      noun={['home', 'homes']}
      q={q}
    />
  );
}

import type { Metadata } from 'next';
import { SearchPage } from '@/components/search/SearchPage';
import { parseSearch } from '@/lib/search';

export const metadata: Metadata = {
  title: 'Homes for rent',
  description: 'Rental homes and apartments in Dauphin County, with lease terms and availability.',
  alternates: { canonical: '/rent' },
};

export default async function RentPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = parseSearch(await searchParams);
  return (
    <SearchPage
      scopeKey="rent"
      eyebrow="Rent"
      title="Homes for rent"
      basePath="/rent"
      purpose="rent"
      scope={{ purpose: 'rent', excludeTypes: ['business'] }}
      types={['rental', 'house', 'apartment']}
      rooms
      noun={['rental', 'rentals']}
      q={q}
    />
  );
}

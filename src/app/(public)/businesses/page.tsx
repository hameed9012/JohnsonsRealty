import type { Metadata } from 'next';
import { SearchPage } from '@/components/search/SearchPage';
import { parseSearch } from '@/lib/search';

export const metadata: Metadata = {
  title: 'Businesses for sale',
  description: 'Established businesses for sale in Dauphin County. Some are listed without their name until a confidentiality agreement is signed.',
  alternates: { canonical: '/businesses' },
};

export default async function BusinessesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = parseSearch(await searchParams);
  return (
    <SearchPage
      eyebrow="Businesses"
      title="Businesses for sale"
      intro="Some owners list without their business name. You’ll see it once you’ve signed a confidentiality agreement with us."
      basePath="/businesses"
      purpose="sale"
      scope={{ types: ['business'] }}
      types={[]}
      rooms={false}
      noun={['business', 'businesses']}
      q={q}
    />
  );
}

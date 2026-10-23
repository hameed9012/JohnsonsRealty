import Link from 'next/link';
import type { Metadata } from 'next';
import { EmptyState } from '@/components/ui/blocks';
import { date } from '@/lib/format';
import { publishedPosts } from '@/server/queries/content';

export const metadata: Metadata = { title: 'Guides and news', description: 'Buyer, seller and renter guides, and brokerage news.', alternates: { canonical: '/guides' } };

export default async function GuidesIndex() {
  const all = await publishedPosts();
  const guides = all.filter((p) => p.kind === 'guide');
  const news = all.filter((p) => p.kind === 'news');
  const list = (items: typeof all) => (
    <ul className="post-list">
      {items.map((p) => (
        <li key={p.id}>
          <span className="id muted">{date(p.publishedAt)}</span>
          <h3 className="heading-3">
            <Link href={`/guides/${p.slug}`}>{p.title}</Link>
          </h3>
          {p.excerpt ? <p className="body muted">{p.excerpt}</p> : null}
        </li>
      ))}
    </ul>
  );
  return (
    <div className="container section stack-lg">
      <header className="stack prose">
        <span className="label label--brass">Guides and news</span>
        <h1 className="display-m">Guides and news</h1>
      </header>
      {all.length === 0 ? <EmptyState icon="document" title="Nothing published yet" text="Buyer, seller and renter guides will appear here." /> : null}
      {guides.length ? (
        <section className="stack">
          <h2 className="heading-1">Guides</h2>
          {list(guides)}
        </section>
      ) : null}
      {news.length ? (
        <section className="stack">
          <h2 className="heading-1">News</h2>
          {list(news)}
        </section>
      ) : null}
    </div>
  );
}

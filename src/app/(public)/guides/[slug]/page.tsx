import Image from 'next/image';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Markdown } from '@/components/public/Markdown';
import { Breadcrumbs } from '@/components/ui/layout';
import { date } from '@/lib/format';
import { publishedPost } from '@/server/queries/content';
import { mediaSrc } from '@/server/queries/media';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = await publishedPost((await params).slug);
  return r ? { title: r.post.title, description: r.post.excerpt ?? undefined, alternates: { canonical: `/guides/${r.post.slug}` }, openGraph: { type: 'article' } } : { title: 'Not found' };
}

export default async function GuidePage({ params }: Props) {
  const r = await publishedPost((await params).slug);
  if (!r) notFound();
  const hero = await mediaSrc(r.post.heroMediaId);
  return (
    <article className="container section stack-lg">
      <Breadcrumbs items={[{ label: 'Guides and news', href: '/guides' }, { label: r.post.title }]} />
      <header className="stack prose">
        <span className="label label--brass">{r.post.kind === 'guide' ? 'Guide' : 'News'}</span>
        <h1 className="display-m">{r.post.title}</h1>
        <p className="id muted">
          {date(r.post.publishedAt)}
          {r.author ? ` · ${r.author}` : ''}
        </p>
        {r.post.excerpt ? <p className="body-l muted">{r.post.excerpt}</p> : null}
      </header>
      {hero ? (
        <div className="post-hero">
          <Image src={hero} alt="" fill sizes="(max-width: 1240px) 100vw, 1240px" className="photo-grade" priority />
        </div>
      ) : null}
      <Markdown source={r.post.body} />
    </article>
  );
}

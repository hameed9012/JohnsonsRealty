import { eq } from 'drizzle-orm';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PostForm } from '@/components/portal/ContentForms';
import { ImageField } from '@/components/ui/ImageField';
import { Breadcrumbs } from '@/components/ui/layout';
import { db } from '@/db/client';
import { posts } from '@/db/schema';
import { can } from '@/lib/permissions';
import { clearImage, getImageTarget, setImage } from '@/server/actions/images';
import { mediaSrc } from '@/server/queries/media';
import { requireStaff } from '@/server/session';

export const metadata: Metadata = { title: 'Article' };

export default async function PostEdit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireStaff(`/portal/content/posts/${id}`);
  if (!can(actor, 'content.manage')) notFound();
  const isNew = id === 'new';
  const p = isNew ? null : await db.query.posts.findFirst({ where: eq(posts.id, id) });
  if (!isNew && !p) notFound();
  const hero = p ? await mediaSrc(p.heroMediaId) : null;
  const slot = p ? { kind: 'post' as const, id: p.id } : null;
  return (
    <div className="stack-lg">
      <Breadcrumbs items={[{ label: 'Content', href: '/portal/content' }, { label: p?.title ?? 'New article' }]} />
      <h1 className="heading-1">{p?.title ?? 'New article'}</h1>
      {slot ? (
        <div className="panel">
          <ImageField label="Header photo (optional)" ratio="21 / 9" current={hero} getTarget={getImageTarget.bind(null, slot)} save={setImage.bind(null, slot)} clear={clearImage.bind(null, slot)} />
        </div>
      ) : null}
      <div className="panel">
        <PostForm
          id={p?.id ?? null}
          values={{ kind: p?.kind ?? 'guide', title: p?.title ?? '', slug: p?.slug ?? '', excerpt: p?.excerpt ?? '', body: p?.body ?? '', published: !!p?.publishedAt }}
        />
      </div>
    </div>
  );
}

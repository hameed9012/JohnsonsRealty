import 'server-only';
import { and, asc, desc, eq, isNotNull, lte } from 'drizzle-orm';
import { db } from '@/db/client';
import { careers, posts, users } from '@/db/schema';

export async function publishedPosts(kind?: 'guide' | 'news') {
  return db
    .select({ id: posts.id, kind: posts.kind, title: posts.title, slug: posts.slug, excerpt: posts.excerpt, publishedAt: posts.publishedAt, heroMediaId: posts.heroMediaId })
    .from(posts)
    .where(and(isNotNull(posts.publishedAt), lte(posts.publishedAt, new Date()), kind ? eq(posts.kind, kind) : undefined))
    .orderBy(desc(posts.publishedAt));
}

export async function publishedPost(slug: string) {
  const [p] = await db
    .select({ post: posts, author: users.displayName })
    .from(posts)
    .leftJoin(users, eq(users.id, posts.authorId))
    .where(and(eq(posts.slug, slug), isNotNull(posts.publishedAt), lte(posts.publishedAt, new Date())));
  return p ?? null;
}

export async function openCareers() {
  return db.select().from(careers).where(eq(careers.open, true)).orderBy(asc(careers.displayOrder), asc(careers.title));
}

export async function openCareer(slug: string) {
  return (await db.query.careers.findFirst({ where: and(eq(careers.slug, slug), eq(careers.open, true)) })) ?? null;
}

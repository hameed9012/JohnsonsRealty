'use server';

import { and, eq, ne } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/db/client';
import { careers, posts } from '@/db/schema';
import { fieldErrors, formObject, type ActionState } from '@/lib/action-result';
import { can } from '@/lib/permissions';
import { careerSchema, postSchema } from '@/lib/schemas/enquiry';
import { slugify } from '@/lib/slug';
import { audit } from '@/server/audit';
import { actorOrThrow } from '@/server/session';

const DENIED = { ok: false as const, message: 'You don’t have access to that.' };

export async function savePost(id: string | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await actorOrThrow();
  if (!can(actor, 'content.manage')) return DENIED;
  const p = postSchema.safeParse(formObject(fd));
  if (!p.success) return { ok: false, fieldErrors: fieldErrors(p.error) };
  const d = p.data;
  const slug = d.slug || slugify(d.title!);
  const clash = await db.query.posts.findFirst({ where: id ? and(eq(posts.slug, slug), ne(posts.id, id)) : eq(posts.slug, slug) });
  if (clash) return { ok: false, fieldErrors: { slug: 'Another article already uses this address.' } };
  const existing = id ? await db.query.posts.findFirst({ where: eq(posts.id, id) }) : null;
  const values = {
    kind: d.kind ?? 'guide',
    title: d.title!,
    slug,
    excerpt: d.excerpt,
    body: d.body ?? '',
    publishedAt: d.published ? (existing?.publishedAt ?? new Date()) : null,
  };
  let saved = id;
  if (id && existing) {
    await db.update(posts).set(values).where(eq(posts.id, id));
  } else {
    const [row] = await db.insert(posts).values({ ...values, authorId: actor.id }).returning({ id: posts.id });
    saved = row!.id;
  }
  await audit(db, { actorId: actor.id, action: id ? 'post.update' : 'post.create', entity: 'post', entityId: saved, summary: `${id ? 'Updated' : 'Wrote'} “${values.title}”${d.published ? ' (published)' : ''}` });
  revalidatePath('/guides');
  revalidatePath(`/guides/${slug}`);
  if (!id) redirect(`/portal/content/posts/${saved}`);
  return { ok: true, message: d.published ? 'Article published' : 'Draft saved' };
}

export async function saveCareer(id: string | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const actor = await actorOrThrow();
  if (!can(actor, 'content.manage')) return DENIED;
  const p = careerSchema.safeParse(formObject(fd));
  if (!p.success) return { ok: false, fieldErrors: fieldErrors(p.error) };
  const d = p.data;
  const slug = d.slug || slugify(d.title!);
  const clash = await db.query.careers.findFirst({ where: id ? and(eq(careers.slug, slug), ne(careers.id, id)) : eq(careers.slug, slug) });
  if (clash) return { ok: false, fieldErrors: { slug: 'Another role already uses this address.' } };
  const values = { title: d.title!, slug, summary: d.summary, body: d.body ?? '', open: d.open, displayOrder: d.displayOrder ?? 0 };
  let saved = id;
  if (id) await db.update(careers).set(values).where(eq(careers.id, id));
  else saved = (await db.insert(careers).values(values).returning({ id: careers.id }))[0]!.id;
  await audit(db, { actorId: actor.id, action: id ? 'career.update' : 'career.create', entity: 'career', entityId: saved, summary: `${id ? 'Updated' : 'Added'} role “${values.title}”${values.open ? '' : ' (closed)'}` });
  revalidatePath('/careers');
  if (!id) redirect(`/portal/content/careers/${saved}`);
  return { ok: true, message: 'Role saved' };
}

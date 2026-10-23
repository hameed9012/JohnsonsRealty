import { eq } from 'drizzle-orm';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CareerForm } from '@/components/portal/ContentForms';
import { Breadcrumbs } from '@/components/ui/layout';
import { db } from '@/db/client';
import { careers } from '@/db/schema';
import { can } from '@/lib/permissions';
import { requireStaff } from '@/server/session';

export const metadata: Metadata = { title: 'Role' };

export default async function CareerEdit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireStaff(`/portal/content/careers/${id}`);
  if (!can(actor, 'content.manage')) notFound();
  const isNew = id === 'new';
  const c = isNew ? null : await db.query.careers.findFirst({ where: eq(careers.id, id) });
  if (!isNew && !c) notFound();
  return (
    <div className="stack-lg">
      <Breadcrumbs items={[{ label: 'Content', href: '/portal/content' }, { label: c?.title ?? 'New role' }]} />
      <h1 className="heading-1">{c?.title ?? 'New role'}</h1>
      <div className="panel">
        <CareerForm
          id={c?.id ?? null}
          values={{ title: c?.title ?? '', slug: c?.slug ?? '', summary: c?.summary ?? '', body: c?.body ?? '', open: c?.open ?? true, displayOrder: String(c?.displayOrder ?? 0) }}
        />
      </div>
    </div>
  );
}

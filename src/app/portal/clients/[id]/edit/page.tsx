import { asc, eq } from 'drizzle-orm';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ClientFileForm } from '@/components/portal/ClientFileForm';
import { Breadcrumbs } from '@/components/ui/layout';
import { db } from '@/db/client';
import { clients } from '@/db/schema';
import { can } from '@/lib/permissions';
import { clientValues, confValues } from '@/server/listings/editor';
import { staffOptions } from '@/server/queries/review';
import { requireStaff } from '@/server/session';

export const metadata: Metadata = { title: 'Edit client file' };

export default async function ClientEdit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireStaff(`/portal/clients/${id}/edit`);
  const isNew = id === 'new';
  const c = isNew ? null : await db.query.clients.findFirst({ where: eq(clients.id, id), with: { people: { orderBy: (p) => [asc(p.sortOrder)] }, confidential: true } });
  if (!isNew && !c) notFound();
  if (c && !can(actor, 'client.edit', { agentId: c.agentId, userId: c.userId })) notFound();
  const manager = actor.role === 'owner' || actor.role === 'admin';
  const seeConf = isNew || can(actor, 'client.viewConfidential', { agentId: c!.agentId, userId: c!.userId });
  const agents = manager ? (await staffOptions()).map((s) => ({ value: s.id, label: s.name ?? 'Agent' })) : null;
  return (
    <div className="stack-lg">
      <Breadcrumbs items={[{ label: 'Clients', href: '/portal/clients' }, ...(c ? [{ label: c.displayName, href: `/portal/clients/${c.id}` }] : []), { label: c ? 'Edit' : 'New client file' }]} />
      <h1 className="heading-1">{c ? `Edit ${c.displayName}` : 'New client file'}</h1>
      <ClientFileForm
        id={c?.id ?? null}
        client={clientValues(c as Parameters<typeof clientValues>[0])}
        confidential={seeConf ? confValues(c?.confidential ?? null) : null}
        roles={c?.roles ?? []}
        agentId={c?.agentId ?? (manager ? null : actor.id)}
        agents={agents}
      />
    </div>
  );
}

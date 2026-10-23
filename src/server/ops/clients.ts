import 'server-only';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Executor } from '@/db/client';
import { clientConfidential, clientPeople, clients } from '@/db/schema';
import { fieldErrors } from '@/lib/action-result';
import { can, type Actor } from '@/lib/permissions';
import { clientConfidentialSchema, clientSchema } from '@/lib/schemas/listing';
import { audit, diffOf } from '@/server/audit';
import { ServiceError } from '@/server/listings/service';

const roles = z.array(z.enum(['buyer', 'seller', 'landlord', 'tenant', 'business_owner'])).max(5).default([]);
const clientFileSchema = z.object({ client: clientSchema, confidential: clientConfidentialSchema.optional(), roles, agentId: z.string().max(100).nullable().optional() });

/** Creates or updates a client file from the portal. Confidential notes are only written by people who can see them. */
export async function saveClientFile(ex: Executor, actor: Actor, id: string | null, input: unknown): Promise<string> {
  const p = clientFileSchema.safeParse(input);
  if (!p.success) throw new ServiceError('Check the highlighted fields.', fieldErrors(p.error));
  const d = p.data;
  if (!d.client.displayName) throw new ServiceError('Check the highlighted fields.', { 'client.displayName': 'Add the client’s name.' });
  const manager = actor.role === 'owner' || actor.role === 'admin';
  const existing = id ? await ex.query.clients.findFirst({ where: eq(clients.id, id) }) : null;
  if (id && !existing) throw new ServiceError('That client file doesn’t exist.');
  if (existing ? !can(actor, 'client.edit', { agentId: existing.agentId, userId: existing.userId }) : !can(actor, 'client.list')) throw new ServiceError('You can’t edit this client file.');
  const values = {
    kind: d.client.kind ?? 'person',
    displayName: d.client.displayName,
    legalNameOnForms: d.client.legalNameOnForms,
    source: d.client.source,
    bestContact: d.client.bestContact,
    emergencyContact: d.client.emergencyContact,
    businessAddress: d.client.businessAddress,
    currentlyOccupying: d.client.currentlyOccupying,
    mailingAddressAfter: d.client.mailingAddressAfter,
    reason: d.client.reason,
    timeline: d.client.timeline,
    whoDecides: d.client.whoDecides,
    background: d.client.background,
    roles: d.roles,
    // Agents own the files they open; only managers move a file to another agent.
    agentId: manager && d.agentId !== undefined ? d.agentId : (existing?.agentId ?? actor.id),
  };
  let clientId = id;
  if (existing) {
    await ex.update(clients).set(values).where(eq(clients.id, existing.id));
    await audit(ex, { actorId: actor.id, action: 'client.update', entity: 'client', entityId: existing.id, summary: `Updated client file ${values.displayName}`, diff: diffOf(existing as unknown as Record<string, unknown>, values) });
  } else {
    const [c] = await ex.insert(clients).values({ ...values, createdBy: actor.id }).returning({ id: clients.id });
    clientId = c!.id;
    await audit(ex, { actorId: actor.id, action: 'client.create', entity: 'client', entityId: clientId, summary: `Opened client file ${values.displayName}` });
  }
  await ex.delete(clientPeople).where(eq(clientPeople.clientId, clientId!));
  const people = d.client.people.filter((x) => x.legalName);
  if (people.length) {
    await ex.insert(clientPeople).values(people.map((x, i) => ({ clientId: clientId!, legalName: x.legalName!, goesBy: x.goesBy, ageOccupation: x.ageOccupation, maritalStatus: x.maritalStatus, signs: x.signs, roleLabel: x.roleLabel, discord: x.discord, robloxUsername: x.robloxUsername, chirper: x.chirper, sortOrder: i })));
  }
  if (d.confidential && can(actor, 'client.viewConfidential', { agentId: values.agentId, userId: existing?.userId })) {
    await ex.insert(clientConfidential).values({ clientId: clientId!, ...d.confidential }).onConflictDoUpdate({ target: clientConfidential.clientId, set: d.confidential });
  }
  return clientId!;
}

export async function archiveClient(ex: Executor, actor: Actor, id: string, archived: boolean) {
  const c = await ex.query.clients.findFirst({ where: eq(clients.id, id) });
  if (!c) throw new ServiceError('That client file doesn’t exist.');
  if (!can(actor, 'client.edit', { agentId: c.agentId, userId: c.userId })) throw new ServiceError('You can’t change this client file.');
  await ex.update(clients).set({ archived }).where(eq(clients.id, id));
  await audit(ex, { actorId: actor.id, action: archived ? 'client.archive' : 'client.restore', entity: 'client', entityId: id, summary: `${archived ? 'Archived' : 'Restored'} client file ${c.displayName}` });
}

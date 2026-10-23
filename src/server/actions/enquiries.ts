'use server';

import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { areas, careers, enquiries, listings, users } from '@/db/schema';
import { fieldErrors, formObject, type ActionState } from '@/lib/action-result';
import { postWebhook, siteUrl } from '@/lib/discord';
import { MARKET_STATUSES } from '@/lib/listing-status';
import { nextRef } from '@/lib/refs';
import { careerApplicationSchema, contactSchema, valuationSchema } from '@/lib/schemas/enquiry';
import { audit } from '@/server/audit';
import { notifyUsers } from '@/server/notify';
import { getActor, type SessionActor } from '@/server/session';

type Result = ActionState<{ refNo: string }>;
type Status = (typeof listings.status.enumValues)[number];

async function managers(): Promise<string[]> {
  const rows = await db.select({ id: users.id }).from(users).where(and(inArray(users.role, ['owner', 'admin']), eq(users.status, 'active')));
  return rows.map((r) => r.id);
}

async function record(actor: SessionActor, type: (typeof enquiries.type.enumValues)[number], payload: Record<string, unknown>, opts: { listingId?: string | null; notify: string[]; title: string; body: string }) {
  return db.transaction(async (tx) => {
    const refNo = await nextRef(tx);
    const [e] = await tx
      .insert(enquiries)
      .values({ refNo, type, payload: { ...payload, from: { name: actor.displayName, roblox: actor.robloxUsername } }, listingId: opts.listingId ?? null, userId: actor.id })
      .returning({ id: enquiries.id });
    await audit(tx, { actorId: actor.id, action: `enquiry.${type}`, entity: 'enquiry', entityId: e!.id, summary: `${opts.title} (${refNo})` });
    await notifyUsers(tx, opts.notify.filter((u) => u !== actor.id), { kind: `enquiry.${type}`, title: opts.title, body: `${opts.body} · ${refNo}`, link: '/portal/inbox' });
    return refNo;
  });
}

const SIGN_IN = { ok: false as const, message: 'Sign in with Discord to send this. It lets us reply to you.' };

export async function requestValuation(_prev: Result, fd: FormData): Promise<Result> {
  const actor = await getActor();
  if (!actor) return SIGN_IN;
  const p = valuationSchema.safeParse(formObject(fd));
  if (!p.success) return { ok: false, fieldErrors: fieldErrors(p.error) };
  const area = p.data.areaId ? await db.query.areas.findFirst({ where: eq(areas.id, p.data.areaId) }) : null;
  const refNo = await record(actor, 'valuation_request', { ...p.data, areaName: area?.name ?? null }, {
    notify: await managers(),
    title: 'Valuation requested',
    body: `${p.data.addressLine}${area ? ', ' + area.name : ''} from ${actor.displayName}`,
  });
  return { ok: true, message: 'Valuation requested', data: { refNo } };
}

export async function sendContact(_prev: Result, fd: FormData): Promise<Result> {
  const actor = await getActor();
  if (!actor) return SIGN_IN;
  const p = contactSchema.safeParse(formObject(fd));
  if (!p.success) return { ok: false, fieldErrors: fieldErrors(p.error) };
  let listing: typeof listings.$inferSelect | undefined;
  if (p.data.listingId) {
    listing = await db.query.listings.findFirst({ where: and(eq(listings.id, p.data.listingId), inArray(listings.status, MARKET_STATUSES as Status[])) });
  }
  const notify = [...(await managers()), ...(listing?.listingAgentId ? [listing.listingAgentId] : [])];
  const refNo = await record(actor, listing ? 'listing_question' : 'general_contact', p.data, {
    listingId: listing?.id ?? null,
    notify,
    title: listing ? 'Question about a listing' : 'New message',
    body: `${p.data.topic ?? 'General'} from ${actor.displayName}`,
  });
  return { ok: true, message: 'Message sent', data: { refNo } };
}

export async function applyForRole(_prev: Result, fd: FormData): Promise<Result> {
  const actor = await getActor();
  if (!actor) return SIGN_IN;
  const p = careerApplicationSchema.safeParse(formObject(fd));
  if (!p.success) return { ok: false, fieldErrors: fieldErrors(p.error) };
  const role = await db.query.careers.findFirst({ where: and(eq(careers.id, p.data.careerId!), eq(careers.open, true)) });
  if (!role) return { ok: false, message: 'That role isn’t open any more.' };
  const refNo = await record(actor, 'career_application', { ...p.data, role: role.title }, {
    notify: await managers(),
    title: 'Career application',
    body: `${role.title} from ${actor.displayName}`,
  });
  await postWebhook('career_application', {
    title: 'Career application',
    heading: role.title,
    description: p.data.why?.slice(0, 300) ?? undefined,
    url: siteUrl('/portal/inbox'),
    fields: [
      { name: 'Applicant', value: actor.displayName, inline: true },
      ...(actor.robloxUsername ? [{ name: 'Roblox', value: actor.robloxUsername, inline: true }] : []),
      { name: 'Reference', value: refNo, inline: true },
    ],
  });
  return { ok: true, message: 'Application sent', data: { refNo } };
}

// Buttons, modals and slash commands arrive here through Discord's interactions endpoint (no gateway).
// Every request is checked against the app's Ed25519 public key before anything else happens. Discord needs
// an answer within 3 seconds, so slow work (opening or closing a ticket) is acknowledged first and finished
// in `later`, which the route runs after responding.
import { createPublicKey, verify } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { InteractionResponseType, InteractionType, MessageFlags, PermissionFlagsBits as P } from 'discord-api-types/v10';
import type { APIChannel, APIInteraction, APIInteractionResponse, APIMessageComponentInteraction, APIModalSubmitInteraction } from 'discord-api-types/v10';
import type { Executor } from '@/db/client';
import { enquiries, notifications, shifts, users } from '@/db/schema';
import { slugify } from '@/lib/slug';
import { audienceRoles, CUSTOM_ID, type RoleKey } from './blueprint';
import { link, tokenHex, type BrandContext } from './brand';
import { agentCommand, autocomplete, listingCommand, listingsCommand } from './commands';
import { applicationMessage, TICKET_ID } from './embeds';
import type { DiscordRest } from './rest';
import { syncUser } from './roles';
import { mapData } from '@/server/map/data';
import { mapMessage } from '@/server/map/discord';
import { CLOSE_MODAL_ID, closeModal, closeTicket, isTicketType, openTicket, parseTopic, ticketModal } from './tickets';

const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

/** True when the body was signed by Discord with this app's key. */
export function verifyDiscordRequest(rawBody: string, signatureHex: string | null, timestamp: string | null, publicKeyHex: string): boolean {
  if (!signatureHex || !timestamp || !/^[0-9a-f]{128}$/i.test(signatureHex) || !/^[0-9a-f]{64}$/i.test(publicKeyHex)) return false;
  try {
    const key = createPublicKey({ key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(publicKeyHex, 'hex')]), format: 'der', type: 'spki' });
    return verify(null, Buffer.from(timestamp + rawBody), key, Buffer.from(signatureHex, 'hex'));
  } catch {
    return false;
  }
}

export interface InteractionDeps {
  rest: DiscordRest;
  guildId: string;
  /** A stored Discord ID by blueprint key, e.g. "role:verified" or "channel:new-listings". */
  id: (key: string) => Promise<string | null>;
  /** Needed for tickets, shifts, applications and commands. */
  ex?: Executor;
  brand?: BrandContext;
  appId?: string;
}

export interface Handled {
  response: APIInteractionResponse;
  later?: () => Promise<void>;
}

const reply = (content: string): APIInteractionResponse => ({ type: InteractionResponseType.ChannelMessageWithSource, data: { content, flags: MessageFlags.Ephemeral, allowed_mentions: { parse: [] } } });
const now = (r: APIInteractionResponse): Handled => ({ response: r });

type Member = NonNullable<APIMessageComponentInteraction['member']>;

async function hasAudience(d: InteractionDeps, m: Member | undefined, keys: RoleKey[]): Promise<boolean> {
  if (!m) return false;
  if ((BigInt(m.permissions ?? '0') & P.Administrator) === P.Administrator) return true;
  const ids = await Promise.all(keys.map((k) => d.id(`role:${k}`)));
  return ids.some((id) => id && m.roles.includes(id));
}

const memberName = (m: Member | undefined) => m?.nick || m?.user.global_name || m?.user.username || 'Staff';

async function toggleRole(i: APIMessageComponentInteraction, d: InteractionDeps, roleKey: string, label: string): Promise<APIInteractionResponse> {
  const user = i.member?.user.id;
  const roleId = await d.id(roleKey);
  if (!user || !roleId) return reply('That button isn’t set up yet. Ask a staff member to run the server setup.');
  const has = i.member!.roles.includes(roleId);
  const path = `/guilds/${d.guildId}/members/${user}/roles/${roleId}`;
  if (has) await d.rest.delete(path, { reason: 'Get roles panel' });
  else await d.rest.put(path, undefined, { reason: 'Get roles panel' });
  return reply(has ? `${label} pings are off.` : `${label} pings are on. Press again to turn them off.`);
}

/** Finish a deferred reply. */
function followUp(d: InteractionDeps, token: string, content: string) {
  return d.rest.patch(`/webhooks/${d.appId}/${token}/messages/@original`, { content, allowed_mentions: { parse: [] } }).catch(() => undefined);
}

async function shift(i: APIMessageComponentInteraction, d: InteractionDeps, clockIn: boolean): Promise<APIInteractionResponse> {
  if (!d.ex) return reply('Shifts aren’t available right now.');
  if (!(await hasAudience(d, i.member, audienceRoles('staff')))) return reply('Shifts are for staff.');
  const discordUserId = i.member!.user.id;
  const open = await d.ex.query.shifts.findFirst({ where: and(eq(shifts.discordUserId, discordUserId), isNull(shifts.endedAt)) });
  const t = (x: Date) => `<t:${Math.floor(x.getTime() / 1000)}:t>`;
  if (clockIn) {
    if (open) return reply(`You're already clocked in since ${t(open.startedAt)}.`);
    const linked = await d.ex.query.users.findFirst({ where: eq(users.discordId, discordUserId), columns: { id: true } });
    const startedAt = new Date();
    await d.ex.insert(shifts).values({ discordUserId, userId: linked?.id ?? null, displayName: memberName(i.member), startedAt });
    return reply(`Clocked in at ${t(startedAt)}. Have a good shift.`);
  }
  if (!open) return reply('You aren’t clocked in.');
  const endedAt = new Date();
  await d.ex.update(shifts).set({ endedAt }).where(eq(shifts.id, open.id));
  const mins = Math.max(1, Math.round((endedAt.getTime() - open.startedAt.getTime()) / 60000));
  return reply(`Clocked out after ${Math.floor(mins / 60)}h ${mins % 60}m.`);
}

async function decideApplication(i: APIMessageComponentInteraction, d: InteractionDeps, accept: boolean, enquiryId: string): Promise<APIInteractionResponse> {
  if (!d.ex || !d.brand) return reply('Applications aren’t available right now.');
  if (!(await hasAudience(d, i.member, audienceRoles('management')))) return reply('Only Management can decide applications.');
  const e = await d.ex.query.enquiries.findFirst({ where: eq(enquiries.id, enquiryId) });
  if (!e) return reply('That application no longer exists.');
  if (e.decision) return reply(`Already ${e.decision}.`);
  const by = memberName(i.member);
  await d.ex.update(enquiries).set({ decision: accept ? 'accepted' : 'declined', status: 'closed' }).where(eq(enquiries.id, enquiryId));
  const p = e.payload as { role?: string; why?: string };
  if (e.userId) {
    await d.ex.insert(notifications).values({
      userId: e.userId,
      kind: 'application',
      title: accept ? `Your application for ${p.role ?? 'the role'} was accepted` : `Update on your application for ${p.role ?? 'the role'}`,
      body: accept ? 'Management will be in touch on Discord about next steps.' : 'Thanks for applying. We won’t be taking it further this time.',
      link: '/careers',
    });
  }
  const u = e.userId ? await d.ex.query.users.findFirst({ where: eq(users.id, e.userId), columns: { displayName: true, robloxUsername: true } }) : null;
  return {
    type: InteractionResponseType.UpdateMessage,
    data: applicationMessage(d.brand, { enquiryId, refNo: e.refNo, role: p.role ?? 'Career application', applicant: u?.displayName ?? 'Applicant', roblox: u?.robloxUsername ?? null, why: p.why ?? null, decision: { accepted: accept, by } }),
  };
}

async function component(i: APIMessageComponentInteraction, d: InteractionDeps): Promise<Handled> {
  const id = i.data.custom_id;
  if (id === CUSTOM_ID.verify) {
    const user = i.member?.user.id;
    const [roleId, listings] = await Promise.all([d.id('role:verified'), d.id('channel:new-listings')]);
    if (!user || !roleId) return now(reply('Verification isn’t set up yet. Ask a staff member to run the server setup.'));
    if (!i.member!.roles.includes(roleId)) await d.rest.put(`/guilds/${d.guildId}/members/${user}/roles/${roleId}`, undefined, { reason: 'Verify button' });
    const ticket = await d.id('channel:open-a-ticket');
    return now(reply(`You're in. Head to ${listings ? `<#${listings}>` : '#new-listings'} or open a ticket${ticket ? ` in <#${ticket}>` : ''} when you're ready.`));
  }
  if (id === CUSTOM_ID.role('listings')) return now(await toggleRole(i, d, 'role:pingListings', 'New listing'));
  if (id === CUSTOM_ID.role('announcements')) return now(await toggleRole(i, d, 'role:pingAnnouncements', 'Announcement'));

  if (id.startsWith('jr:ticket:')) {
    const t = id.slice('jr:ticket:'.length);
    if (!isTicketType(t)) return now(reply('Unknown ticket type.'));
    return now({ type: InteractionResponseType.Modal, data: ticketModal(t) });
  }
  if (id === TICKET_ID.claim) {
    if (!(await hasAudience(d, i.member, audienceRoles('staff')))) return now(reply('Only staff can claim tickets.'));
    const name = memberName(i.member);
    const embed = { ...i.message.embeds[0], fields: [...(i.message.embeds[0]?.fields ?? []).filter((f) => f.name !== 'Claimed by'), { name: 'Claimed by', value: name, inline: true }] };
    const components = i.message.components?.map((r) => ({ ...r, components: (r as { components: { custom_id?: string }[] }).components.map((c) => (c.custom_id === TICKET_ID.claim ? { ...c, disabled: true } : c)) }));
    return {
      response: { type: InteractionResponseType.UpdateMessage, data: { embeds: [embed], components: components as never } },
      later: async () => {
        const ch = await d.rest.get<APIChannel & { topic?: string | null }>(`/channels/${i.channel.id}`);
        const t = parseTopic(ch.topic);
        if (t) await d.rest.patch(`/channels/${i.channel.id}`, { name: `${t.type}-${t.number}-${slugify(name) || 'agent'}` }, { reason: `Claimed by ${name}` });
        await d.rest.post(`/channels/${i.channel.id}/messages`, { content: `Claimed by <@${i.member!.user.id}>.`, allowed_mentions: { parse: [] } });
      },
    };
  }
  if (id === TICKET_ID.close) {
    const ch = await d.rest.get<APIChannel & { topic?: string | null }>(`/channels/${i.channel.id}`);
    const t = parseTopic(ch.topic);
    const isOpener = t?.openerId === i.member?.user.id;
    if (!isOpener && !(await hasAudience(d, i.member, audienceRoles('staff')))) return now(reply('Only staff or the person who opened it can close a ticket.'));
    return now({ type: InteractionResponseType.Modal, data: closeModal });
  }
  if (id === CUSTOM_ID.shiftIn) return now(await shift(i, d, true));
  if (id === CUSTOM_ID.shiftOut) return now(await shift(i, d, false));
  const app = /^jr:app:(accept|decline):([0-9a-f-]{36})$/.exec(id);
  if (app) return now(await decideApplication(i, d, app[1] === 'accept', app[2]!));
  return now(reply('That button isn’t active any more.'));
}

function modalValues(i: APIModalSubmitInteraction): Record<string, string> {
  const out: Record<string, string> = {};
  for (const row of i.data.components) for (const c of (row as { components?: { custom_id: string; value?: string }[] }).components ?? []) out[c.custom_id] = (c.value ?? '').trim();
  return out;
}

async function modal(i: APIModalSubmitInteraction, d: InteractionDeps): Promise<Handled> {
  const id = i.data.custom_id;
  if (!d.ex || !d.brand || !d.appId) return now(reply('Tickets aren’t available right now.'));
  const ticketDeps = { ex: d.ex, rest: d.rest, guildId: d.guildId, botId: d.appId, brand: d.brand, id: d.id };
  if (id.startsWith('jr:tkm:')) {
    const t = id.slice('jr:tkm:'.length);
    if (!isTicketType(t) || !i.member) return now(reply('That ticket form is out of date. Press the button again.'));
    const opener = i.member.user.id;
    const values = modalValues(i);
    return {
      response: { type: InteractionResponseType.DeferredChannelMessageWithSource, data: { flags: MessageFlags.Ephemeral } },
      later: async () => {
        try {
          const channelId = await openTicket(ticketDeps, t, opener, values);
          await followUp(d, i.token, `Your ticket is open: <#${channelId}>. An agent will reply there shortly.`);
        } catch (e) {
          console.error('[discord] ticket open failed', e);
          await followUp(d, i.token, 'Sorry, the ticket couldn’t be opened. Please try again, or message a staff member.');
        }
      },
    };
  }
  if (id === CLOSE_MODAL_ID) {
    const summary = modalValues(i).summary || 'Closed';
    const by = memberName(i.member);
    const byId = i.member?.user.id ?? '';
    return {
      response: { type: InteractionResponseType.ChannelMessageWithSource, data: { content: `Closing this ticket. Summary: ${summary}`, allowed_mentions: { parse: [] } } },
      later: async () => {
        const ch = await d.rest.get<APIChannel & { topic?: string | null; name?: string }>(`/channels/${i.channel!.id}`);
        await closeTicket(ticketDeps, ch, byId, by, summary, { green: tokenHex('green-900'), brass: tokenHex('brass-500'), paper: tokenHex('paper'), ink: tokenHex('ink'), muted: tokenHex('ink-muted') }).catch(async (e) => {
          console.error('[discord] ticket close failed', e);
          await d.rest.post(`/channels/${i.channel!.id}/messages`, { content: 'The transcript couldn’t be saved, so the ticket is still open. Try closing it again.' }).catch(() => undefined);
        });
      },
    };
  }
  return now(reply('That form isn’t active any more.'));
}

export async function handleInteraction(i: APIInteraction, d: InteractionDeps): Promise<Handled> {
  if (i.type === InteractionType.Ping) return now({ type: InteractionResponseType.Pong });
  if (i.guild_id && i.guild_id !== d.guildId) return now(reply('This bot only works in the Johnson’s Realty server.'));
  if (i.type === InteractionType.MessageComponent) return component(i, d);
  if (i.type === InteractionType.ModalSubmit) return modal(i, d);
  if (i.type === InteractionType.ApplicationCommandAutocomplete) return now(d.ex ? await autocomplete(d.ex, i) : { type: 8, data: { choices: [] } });
  if (i.type === InteractionType.ApplicationCommand) {
    if (!d.ex || !d.brand) return now(reply('Commands aren’t available right now.'));
    const chat = i as Parameters<typeof listingsCommand>[2];
    switch (i.data.name) {
      case 'listings':
        return now(await listingsCommand(d.ex, d.brand, chat));
      case 'listing':
        return now(await listingCommand(d.ex, d.brand, chat));
      case 'agent':
        return now(await agentCommand(d.ex, d.brand, chat));
      case 'map': {
        const data = await mapData(d.ex);
        if (!data.image) return now(reply(`The property map: ${link(d.brand, '/buy?view=map')}`));
        return now({ type: InteractionResponseType.ChannelMessageWithSource, data: mapMessage(d.brand, data) });
      }
      case 'link': {
        const discordUserId = i.member?.user.id ?? i.user?.id;
        const u = discordUserId ? await d.ex.query.users.findFirst({ where: eq(users.discordId, discordUserId) }) : null;
        if (!u) return now(reply(`Sign in on the website with this Discord account first: ${link(d.brand, '/signin')}. Then run /link again.`));
        const ex = d.ex;
        return {
          response: reply(`You're linked to the website as ${u.displayName ?? u.name ?? 'your account'}. Your roles are being updated.`),
          later: async () => void (await syncUser(ex, { rest: d.rest, guildId: d.guildId, id: d.id }, u.id).catch((e) => console.error('[discord] role sync failed', e))),
        };
      }
    }
  }
  return now(reply('That didn’t work. Try again in a moment.'));
}

// Buttons, modals and slash commands arrive here through Discord's interactions endpoint (no gateway).
// Every request is checked against the app's Ed25519 public key before anything else happens.
import { createPublicKey, verify } from 'node:crypto';
import { InteractionResponseType, InteractionType, MessageFlags } from 'discord-api-types/v10';
import type { APIInteraction, APIInteractionResponse, APIMessageComponentInteraction } from 'discord-api-types/v10';
import { CUSTOM_ID } from './blueprint';
import type { DiscordRest } from './rest';

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
}

const reply = (content: string): APIInteractionResponse => ({ type: InteractionResponseType.ChannelMessageWithSource, data: { content, flags: MessageFlags.Ephemeral } });

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

export async function handleInteraction(i: APIInteraction, d: InteractionDeps): Promise<APIInteractionResponse> {
  if (i.type === InteractionType.Ping) return { type: InteractionResponseType.Pong };
  if (i.guild_id && i.guild_id !== d.guildId) return reply('This bot only works in the Johnson’s Realty server.');

  if (i.type === InteractionType.MessageComponent) {
    const id = i.data.custom_id;
    if (id === CUSTOM_ID.verify) {
      const user = i.member?.user.id;
      const [roleId, listings] = await Promise.all([d.id('role:verified'), d.id('channel:new-listings')]);
      if (!user || !roleId) return reply('Verification isn’t set up yet. Ask a staff member to run the server setup.');
      if (!i.member!.roles.includes(roleId)) await d.rest.put(`/guilds/${d.guildId}/members/${user}/roles/${roleId}`, undefined, { reason: 'Verify button' });
      const ticket = await d.id('channel:open-a-ticket');
      return reply(`You're in. Head to ${listings ? `<#${listings}>` : '#new-listings'} or open a ticket${ticket ? ` in <#${ticket}>` : ''} when you're ready.`);
    }
    if (id === CUSTOM_ID.role('listings')) return toggleRole(i, d, 'role:pingListings', 'New listing');
    if (id === CUSTOM_ID.role('announcements')) return toggleRole(i, d, 'role:pingAnnouncements', 'Announcement');
    if (id.startsWith('jr:ticket:')) return reply('Tickets open here very soon. Until then, message any staff member and they’ll help you.');
    if (id.startsWith('jr:shift:')) return reply('Shift tracking starts very soon. Keep a note of your hours until then.');
  }
  if (i.type === InteractionType.ApplicationCommand) return reply('Commands are coming soon.');
  return reply('That didn’t work. Try again in a moment.');
}

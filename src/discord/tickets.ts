// Tickets from #open-a-ticket: a modal per type, a private channel under HELP DESK, Claim and Close, an HTML
// transcript in #ticket-transcripts, and a record in the site's enquiries table.
// The channel topic carries the ticket's identity ("ticket:<type>:<n>:<opener>") so no extra table is needed.
import { eq } from 'drizzle-orm';
import { ChannelType, ComponentType, OverwriteType, PermissionFlagsBits as P, TextInputStyle } from 'discord-api-types/v10';
import type { APIChannel, APIEmbed, APIMessage, APIModalInteractionResponseCallbackData } from 'discord-api-types/v10';
import type { Executor } from '@/db/client';
import { enquiries, users } from '@/db/schema';
import { nextCounter } from '@/lib/refs';
import { slugify } from '@/lib/slug';
import { audienceRoles, TICKET_TYPES, type RoleKey, type TicketType } from './blueprint';
import { author, EMBED_COLOR, typeFont, type BrandContext } from './brand';
import { ticketIntakeMessage, TICKET_ID } from './embeds';
import type { DiscordRest } from './rest';

export interface TicketField {
  id: string;
  label: string;
  long?: boolean;
  required?: boolean;
}

/** Modal fields per ticket type (blueprint). Discord allows five per modal. */
export const TICKET_FIELDS: Record<TicketType, TicketField[]> = {
  buy: [
    { id: 'roblox', label: 'Roblox username', required: true },
    { id: 'area', label: 'Area you want' },
    { id: 'budget', label: 'Budget' },
    { id: 'beds', label: 'Beds needed' },
    { id: 'notes', label: 'Anything else', long: true },
  ],
  rent: [
    { id: 'roblox', label: 'Roblox username', required: true },
    { id: 'area', label: 'Area you want' },
    { id: 'budget', label: 'Rent per month' },
    { id: 'beds', label: 'Beds needed' },
    { id: 'notes', label: 'Anything else', long: true },
  ],
  sell: [
    { id: 'roblox', label: 'Roblox username', required: true },
    { id: 'address', label: 'Property address and postal', required: true },
    { id: 'hope', label: 'What you hope to get' },
    { id: 'notes', label: 'Anything else', long: true },
  ],
  business: [
    { id: 'roblox', label: 'Roblox username', required: true },
    { id: 'side', label: 'Buying or selling', required: true },
    { id: 'kind', label: 'Business type and area' },
    { id: 'money', label: 'Budget or asking price' },
  ],
  general: [
    { id: 'roblox', label: 'Roblox username', required: true },
    { id: 'about', label: 'What it’s about', long: true, required: true },
  ],
  complaint: [
    { id: 'roblox', label: 'Roblox username', required: true },
    { id: 'about', label: 'What it’s about', long: true, required: true },
  ],
};

export const TICKET_MODAL_ID = (t: TicketType) => `jr:tkm:${t}`;
export const CLOSE_MODAL_ID = 'jr:tkc';
export const typeLabel = (t: TicketType) => TICKET_TYPES.find((x) => x.type === t)?.label ?? 'General';
export const isTicketType = (t: string): t is TicketType => TICKET_TYPES.some((x) => x.type === t);

export function ticketModal(t: TicketType): APIModalInteractionResponseCallbackData {
  return {
    custom_id: TICKET_MODAL_ID(t),
    title: `${typeLabel(t)}: talk to an agent`,
    components: TICKET_FIELDS[t].map((f) => ({
      type: ComponentType.ActionRow,
      components: [{ type: ComponentType.TextInput, custom_id: f.id, label: f.label, style: f.long ? TextInputStyle.Paragraph : TextInputStyle.Short, required: !!f.required, max_length: f.long ? 1000 : 120 }],
    })),
  };
}

export const closeModal: APIModalInteractionResponseCallbackData = {
  custom_id: CLOSE_MODAL_ID,
  title: 'Close this ticket',
  components: [{ type: ComponentType.ActionRow, components: [{ type: ComponentType.TextInput, custom_id: 'summary', label: 'One-line summary', style: TextInputStyle.Short, required: true, max_length: 200 }] }],
};

export interface TicketTopic {
  type: TicketType;
  number: string;
  openerId: string;
}

export function parseTopic(topic: string | null | undefined): TicketTopic | null {
  const m = /^ticket:([a-z]+):(\d+):(\d+)/.exec(topic ?? '');
  return m && isTicketType(m[1]!) ? { type: m[1] as TicketType, number: m[2]!, openerId: m[3]! } : null;
}

export const ticketNumber = (n: number) => String(n).padStart(4, '0');

export interface TicketDeps {
  ex: Executor;
  rest: DiscordRest;
  guildId: string;
  botId: string;
  brand: BrandContext;
  id: (key: string) => Promise<string | null>;
}

const OPENER_ALLOW = P.ViewChannel | P.SendMessages | P.AttachFiles | P.EmbedLinks | P.ReadMessageHistory;

/** Creates the private channel and posts the intake. Returns the new channel's ID. */
export async function openTicket(d: TicketDeps, t: TicketType, openerId: string, answers: Record<string, string>): Promise<string> {
  const n = ticketNumber(await nextCounter(d.ex, 'ticket', 0));
  const category = await d.id('category:HELP DESK');
  const audience: RoleKey[] = t === 'complaint' ? audienceRoles('management') : audienceRoles('staff');
  const roleIds = (await Promise.all(audience.map((k) => d.id(`role:${k}`)))).filter((x): x is string => !!x);
  const overwrites = [
    { id: d.guildId, type: OverwriteType.Role, allow: '0', deny: String(P.ViewChannel) },
    { id: openerId, type: OverwriteType.Member, allow: String(OPENER_ALLOW), deny: '0' },
    ...roleIds.map((id) => ({ id, type: OverwriteType.Role, allow: String(OPENER_ALLOW), deny: '0' })),
    { id: d.botId, type: OverwriteType.Member, allow: String(OPENER_ALLOW | P.ManageChannels | P.ManageMessages), deny: '0' },
  ];
  const channel = await d.rest.post<APIChannel>(
    `/guilds/${d.guildId}/channels`,
    { name: `ticket-${t}-${n}`, type: ChannelType.GuildText, parent_id: category ?? undefined, topic: `ticket:${t}:${n}:${openerId}`, permission_overwrites: overwrites },
    { reason: `Ticket ${n} opened` },
  );
  const fields = TICKET_FIELDS[t].map((f) => ({ label: f.label, value: answers[f.id] ?? '' }));
  await d.rest.post(`/channels/${channel.id}/messages`, ticketIntakeMessage(d.brand, { number: n, typeLabel: typeLabel(t), openerId, answers: fields }));
  return channel.id;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** A simple self-contained HTML transcript in the house style. Colours are the design tokens' values, inlined so the file stands alone. */
export function renderTranscript(o: { brokerageName: string; title: string; summary: string; closedBy: string; messages: APIMessage[]; palette: { green: string; brass: string; paper: string; ink: string; muted: string } }): string {
  const rows = [...o.messages]
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .map((m) => {
      const embeds = (m.embeds ?? []).map((e: APIEmbed) => `<div class="embed">${e.title ? `<b>${esc(e.title)}</b>` : ''}${e.description ? `<p>${esc(e.description)}</p>` : ''}${(e.fields ?? []).map((f) => `<p><span>${esc(f.name)}</span> ${esc(f.value)}</p>`).join('')}</div>`).join('');
      const files = (m.attachments ?? []).map((a) => `<a href="${esc(a.url)}">${esc(a.filename)}</a>`).join(' ');
      const who = m.author.global_name || m.author.username;
      return `<li><div class="meta"><b>${esc(who)}</b> <time>${esc(new Date(m.timestamp).toUTCString())}</time></div>${m.content ? `<p>${esc(m.content)}</p>` : ''}${embeds}${files ? `<p>${files}</p>` : ''}</li>`;
    })
    .join('\n');
  const c = o.palette;
  const f = { body: typeFont('body'), title: typeFont('heading-3'), small: typeFont('caption') };
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(o.title)}</title>
<style>body{margin:0;background:${c.paper};color:${c.ink};font:${f.body}}header{background:${c.green};color:${c.paper};padding:20px 28px;border-bottom:3px solid ${c.brass}}header h1{margin:0;font:${f.title}}header p{margin:4px 0 0;opacity:.85}main{max-width:820px;margin:0 auto;padding:16px 28px}ol{list-style:none;padding:0}li{padding:12px 0;border-bottom:1px solid rgba(0,0,0,.07)}.meta time{color:${c.muted};font:${f.small};margin-left:8px}.embed{border-left:3px solid ${c.brass};padding:4px 12px;margin:6px 0;background:rgba(0,0,0,.04)}.embed span{color:${c.muted}}</style></head>
<body><header><h1>${esc(o.title)}</h1><p>${esc(o.brokerageName)} · Closed by ${esc(o.closedBy)} · ${esc(o.summary)}</p></header><main><ol>${rows}</ol></main></body></html>`;
}

/** Fetches every message in the channel, oldest first (100 per request). */
export async function fetchAllMessages(rest: DiscordRest, channelId: string, cap = 2000): Promise<APIMessage[]> {
  const out: APIMessage[] = [];
  let before: string | undefined;
  while (out.length < cap) {
    const page = await rest.get<APIMessage[]>(`/channels/${channelId}/messages`, { query: { limit: 100, before } });
    out.push(...page);
    if (page.length < 100) break;
    before = page[page.length - 1]!.id;
  }
  return out.reverse();
}

/** Close: transcript to #ticket-transcripts, the enquiry record, then the channel is deleted. */
export async function closeTicket(d: TicketDeps, channel: APIChannel & { topic?: string | null; name?: string }, closedById: string, closedByName: string, summary: string, palette: Parameters<typeof renderTranscript>[0]['palette']) {
  const t = parseTopic(channel.topic);
  if (!t) throw new Error('Not a ticket channel');
  const messages = await fetchAllMessages(d.rest, channel.id);
  const title = `${typeLabel(t.type)} ticket ${t.number}`;
  const html = renderTranscript({ brokerageName: d.brand.brokerageName, title, summary, closedBy: closedByName, messages, palette });
  const transcripts = await d.id('channel:ticket-transcripts');
  let transcriptUrl: string | null = null;
  if (transcripts) {
    const m = await d.rest.post<APIMessage>(
      `/channels/${transcripts}/messages`,
      {
        embeds: [{ author: author(d.brand), color: t.type === 'complaint' ? EMBED_COLOR.danger() : EMBED_COLOR.default(), title, description: summary, fields: [{ name: 'Opened by', value: `<@${t.openerId}>`, inline: true }, { name: 'Closed by', value: `<@${closedById}>`, inline: true }, { name: 'Messages', value: String(messages.length), inline: true }], timestamp: new Date().toISOString() }],
        allowed_mentions: { parse: [] },
      },
      { files: [{ name: `ticket-${t.type}-${t.number}.html`, data: new TextEncoder().encode(html), contentType: 'text/html' }] },
    );
    transcriptUrl = `https://discord.com/channels/${d.guildId}/${transcripts}/${m.id}`;
  }
  const linked = await d.ex.query.users.findFirst({ where: eq(users.discordId, t.openerId), columns: { id: true } });
  const intake = messages.find((m) => m.author.id === d.botId && m.embeds?.[0]?.title?.startsWith(typeLabel(t.type)));
  await d.ex
    .insert(enquiries)
    .values({
      refNo: `TK-${t.number}`,
      type: 'discord_ticket',
      payload: { ticketType: t.type, number: t.number, channel: channel.name ?? null, answers: Object.fromEntries((intake?.embeds?.[0]?.fields ?? []).map((f) => [f.name, f.value])) },
      userId: linked?.id ?? null,
      discordUserId: t.openerId,
      summary,
      transcriptUrl,
      status: 'closed',
    })
    .onConflictDoNothing();
  await d.rest.delete(`/channels/${channel.id}`, { reason: `Ticket ${t.number} closed by ${closedByName}` });
  return { number: t.number, transcriptUrl, linkedUserId: linked?.id ?? null, slug: slugify(closedByName) };
}

export { TICKET_ID };

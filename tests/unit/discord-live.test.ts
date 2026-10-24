import { eq } from 'drizzle-orm';
import { InteractionResponseType, InteractionType } from 'discord-api-types/v10';
import type { APIInteraction } from 'discord-api-types/v10';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '@/db/client';
import { seedBase } from '@/db/seed-base';
import { areas, discordOutbox, enquiries, listings, notifications, shifts, users } from '@/db/schema';
import {
  agentCardMessage,
  announcementMessage,
  applicationMessage,
  dealMessage,
  listingMessage,
  noLongerAvailableMessage,
  openHouseMessage,
  priceReducedMessage,
  reviewPendingMessage,
  soldMessage,
  summaryOf,
  ticketIntakeMessage,
  type ListingEmbedData,
} from '@/discord/embeds';
import { sendToDiscord } from '@/discord/events';
import { handleInteraction, type InteractionDeps } from '@/discord/interactions';
import { DiscordApiError, type DiscordRest } from '@/discord/rest';
import { desiredRoles, syncMember } from '@/discord/roles';
import { closeTicket, openTicket, parseTopic, renderTranscript, ticketModal } from '@/discord/tickets';
import { resetDb, testDb } from './helpers/db';

const brand = { site: 'https://example.test', brokerageName: 'Example Realty', chirperHandle: 'ExampleHandle', civopsLine: null };
const G = '100000000000000001';
const APP = '200000000000000002';

/** A recording REST fake: answers by route with the given handlers, records every call. */
function fakeRest(handlers: Record<string, (body: unknown, path: string) => unknown> = {}) {
  const calls: { method: string; path: string; body?: unknown; files?: unknown }[] = [];
  const request = async (method: string, path: string, o: { body?: unknown; files?: unknown } = {}) => {
    calls.push({ method, path, body: o.body, files: o.files });
    for (const [k, h] of Object.entries(handlers)) {
      const [m, re] = k.split(' ');
      if (m === method && new RegExp(`^${re}$`).test(path)) return h(o.body, path);
    }
    return { id: String(900000 + calls.length) };
  };
  const rest = {
    request,
    get: (p: string, o?: object) => request('GET', p, o),
    post: (p: string, b?: unknown, o?: object) => request('POST', p, { ...o, body: b }),
    patch: (p: string, b?: unknown, o?: object) => request('PATCH', p, { ...o, body: b }),
    put: (p: string, b?: unknown, o?: object) => request('PUT', p, { ...o, body: b }),
    delete: (p: string, o?: object) => request('DELETE', p, o),
  } as unknown as DiscordRest;
  return { rest, calls };
}

const sale: ListingEmbedData = {
  kind: 'sale',
  title: 'Example Lane',
  slug: 'example-lane',
  description: 'Example first sentence. Example second sentence! Example third sentence.',
  coverUrl: 'https://example.test/cover.jpg',
  price: 760000,
  beds: 4,
  baths: 1.5,
  areaName: 'Example Area',
  postal: '601',
  agentName: 'Example Agent',
  refNo: 'JR-2026-00001',
};

/** Timestamps change every run; snapshots compare everything else. */
const stable = (m: unknown) => JSON.parse(JSON.stringify(m).replace(/"timestamp":"[^"]+"/g, '"timestamp":"T"'));

describe('embeds', () => {
  it('new listing: title, summary, cover, fields, ping and buttons', () => {
    const m = listingMessage(brand, sale, '42');
    expect(stable(m)).toMatchSnapshot();
    const e = m.embeds![0]!;
    expect(e.title).toBe('Just Listed · Example Lane');
    expect(e.description).toBe('Example first sentence. Example second sentence!');
    expect(e.fields!.map((f) => [f.name, f.value])).toEqual([['Price', '$760,000'], ['Beds', '4'], ['Baths', '1.5'], ['Area', 'Example Area · Postal 601'], ['Agent', 'Example Agent']]);
    expect(e.footer!.text).toBe('Ref JR-2026-00001 · Example Realty');
    expect(m.content).toBe('<@&42>');
    expect(m.allowed_mentions).toEqual({ roles: ['42'], parse: [] });
  });

  it('rental shows rent per month and Listed by Owner when there is no agent', () => {
    const e = listingMessage(brand, { ...sale, kind: 'rent', price: 1900, agentName: null }).embeds![0]!;
    expect(e.title).toBe('For Rent · Example Lane');
    expect(e.fields!.find((f) => f.name === 'Rent')!.value).toBe('$1,900/mo');
    expect(e.fields!.find((f) => f.name === 'Agent')!.value).toBe('Listed by Owner');
  });

  it('a withheld business name never appears; the teaser is the title', () => {
    const m = listingMessage(brand, { ...sale, kind: 'business', title: 'Established diner, Example Area', businessType: 'Restaurant / diner' });
    expect(JSON.stringify(m)).not.toContain('Example Lane');
    expect(m.embeds![0]!.title).toBe('Business for Sale · Established diner, Example Area');
  });

  it('every other message type matches its snapshot', () => {
    expect(
      stable({
        price: priceReducedMessage(brand, { ...sale, price: 735000 }, 760000, '42'),
        gone: noLongerAvailableMessage(brand, sale),
        sold: soldMessage(brand, { title: 'Example Lane', saleNo: 'Sale No. 001', price: 752000, rent: false, areaName: 'Example Area', postal: '601', agentName: 'Example Agent', thumbUrl: null, refNo: sale.refNo }),
        review: reviewPendingMessage(brand, { title: 'Example Lane', listingId: 'L1', submitter: 'Example Agent', source: 'owner_submitted', round: 2, thumbUrl: null, price: '$760,000', refNo: sale.refNo }, '7'),
        deal: dealMessage(brand, { title: 'Example Lane', dealId: 'D1', from: 'Active', to: 'Under Offer', agentName: 'Example Agent', refNo: sale.refNo, tone: 'offer' }),
        app: applicationMessage(brand, { enquiryId: 'E1', refNo: 'JR-2026-00002', role: 'Agent', applicant: 'Example Applicant', roblox: 'ExampleRbx', why: 'Example reason.' }),
        appDone: applicationMessage(brand, { enquiryId: 'E1', refNo: 'JR-2026-00002', role: 'Agent', applicant: 'Example Applicant', roblox: null, why: null, decision: { accepted: true, by: 'Example Owner' } }),
        news: announcementMessage(brand, { title: 'Example news', body: 'Example **body**.', imageUrl: null, authorName: 'Example Owner' }, null),
        open: openHouseMessage(brand, { title: 'Example Lane', slug: 'example-lane', startsAt: new Date('2026-11-07T19:00:00Z'), endsAt: new Date('2026-11-07T21:00:00Z'), notes: null, coverUrl: null, agentName: null, refNo: sale.refNo }),
        ticket: ticketIntakeMessage(brand, { number: '0001', typeLabel: 'Buy', openerId: '55', answers: [{ label: 'Roblox username', value: 'ExampleRbx' }, { label: 'Budget', value: '' }] }),
        agent: agentCardMessage(brand, { name: 'Example Agent', title: null, slug: 'example-agent', photoUrl: null, chirper: null, activeListings: 2, sales: 0 }),
      }),
    ).toMatchSnapshot();
  });

  it('price cut strikes the old price; sold shows no buyer', () => {
    expect(priceReducedMessage(brand, { ...sale, price: 735000 }, 760000).embeds![0]!.description).toBe('~~$760,000~~ → **$735,000**');
    expect(soldMessage(brand, { title: 'Example Lane', saleNo: 'Sale No. 007', price: 1, rent: false, areaName: null, postal: null, agentName: null, thumbUrl: null, refNo: 'R' }).embeds![0]!.description).toBe('Sale No. 007');
  });

  it('summaries keep two sentences', () => {
    expect(summaryOf('One. Two? Three.')).toBe('One. Two?');
    expect(summaryOf(null)).toBe('');
  });
});

describe('role sync', () => {
  it('maps site roles to the managed Discord roles', () => {
    expect(desiredRoles({ role: 'owner', closedDeal: false })).toEqual(['owner']);
    expect(desiredRoles({ role: 'admin', closedDeal: true })).toEqual(['coOwner', 'client']);
    expect(desiredRoles({ role: 'client', closedDeal: false })).toEqual([]);
    expect(desiredRoles({ role: 'agent', status: 'deactivated', closedDeal: false })).toEqual([]);
  });

  it('adds and removes only managed roles, and never takes Owner from the server owner', async () => {
    const ids: Record<string, string> = { 'role:owner': 'r-owner', 'role:coOwner': 'r-co', 'role:agent': 'r-agent', 'role:client': 'r-client' };
    const { rest, calls } = fakeRest({ 'GET /guilds/\\d+/members/\\d+': () => ({ roles: ['r-owner', 'r-agent', 'r-senior'] }) });
    const r = await syncMember({ rest, guildId: G, id: async (k) => ids[k] ?? null }, '777', ['client'], '777');
    expect(r).toBe('updated');
    const writes = calls.filter((c) => c.method !== 'GET').map((c) => `${c.method} ${c.path.split('/').pop()}`);
    expect(writes).toEqual(['DELETE r-agent', 'PUT r-client']);
  });

  it('reports a member who is not in the server', async () => {
    const { rest } = fakeRest({ 'GET /guilds/\\d+/members/\\d+': () => { throw new DiscordApiError(404, 10007, 'Unknown Member', {}); } });
    const ids = { 'role:owner': 'a', 'role:coOwner': 'b', 'role:agent': 'c', 'role:client': 'd' } as Record<string, string>;
    expect(await syncMember({ rest, guildId: G, id: async (k) => ids[k] ?? null }, '1', ['agent'])).toBe('not-in-server');
  });
});

describe('with a database', () => {
  let db: DB;
  beforeAll(async () => {
    db = await testDb();
  });
  beforeEach(async () => {
    await resetDb(db);
    await seedBase(db);
    await db.insert(users).values([
      { id: 'u-owner', role: 'owner', displayName: 'Example Owner', discordId: '700' },
      { id: 'u-agent', role: 'agent', displayName: 'Example Agent', discordId: '701' },
      { id: 'u-applicant', role: 'client', displayName: 'Example Applicant', robloxUsername: 'ExampleRbx' },
    ]);
  });

  const ids: Record<string, string> = {
    'role:traineeAgent': 'r-trainee',
    'role:agent': 'r-agent',
    'role:seniorAgent': 'r-senior',
    'role:management': 'r-mgmt',
    'role:coOwner': 'r-co',
    'role:owner': 'r-owner',
    'category:HELP DESK': 'cat-help',
    'channel:ticket-transcripts': 'ch-transcripts',
  };
  const deps = (rest: DiscordRest): InteractionDeps => ({ rest, guildId: G, appId: APP, ex: db, brand, id: async (k) => ids[k] ?? null });
  const member = (id: string, roles: string[] = []) => ({ user: { id, username: `user${id}` }, roles, permissions: '0', nick: null });

  it('a failed post goes to the outbox and the bot log; a good one is remembered on the listing', async () => {
    const area = await db.query.areas.findFirst({ where: eq(areas.slug, 'fairview') });
    const [l] = await db.insert(listings).values({ refNo: 'JR-2026-00001', slug: 'example-lane', type: 'house', purpose: 'sale', source: 'agent', status: 'active', addressLine: 'Example Lane', areaId: area!.id }).returning();
    const ok = fakeRest({ 'POST /channels/ch-new/messages': () => ({ id: 'm-1' }) });
    const r1 = await sendToDiscord(db, { event: 'listing_approved', channel: 'new-listings', message: listingMessage(brand, sale), remember: { listingId: l!.id } }, { rest: ok.rest, brand, id: async (k) => (k === 'channel:new-listings' ? 'ch-new' : null) });
    expect(r1).toBe('sent');
    expect((await db.query.listings.findFirst({ where: eq(listings.id, l!.id) }))!.discordMessageId).toBe('m-1');

    const bad = fakeRest({ 'POST /channels/ch-new/messages': () => { throw new DiscordApiError(403, 50013, 'Missing Permissions', {}); } });
    const r2 = await sendToDiscord(db, { event: 'listing_approved', channel: 'new-listings', message: listingMessage(brand, sale) }, { rest: bad.rest, brand, id: async (k) => ({ 'channel:new-listings': 'ch-new', 'channel:bot-log': 'ch-log' })[k] ?? null });
    expect(r2).toBe('failed');
    const out = await db.select().from(discordOutbox);
    expect(out).toHaveLength(1);
    expect(out[0]!.error).toContain('Missing Permissions');
    expect(bad.calls.some((c) => c.path === '/channels/ch-log/messages')).toBe(true);
  });

  it('without the bot it skips quietly (no webhook configured)', async () => {
    expect(await sendToDiscord(db, { event: 'x', channel: 'new-listings', message: {} }, null)).toBe('skipped');
  });

  it('opens a ticket in a private channel and closes it with a transcript and a record', async () => {
    const { rest, calls } = fakeRest({ 'POST /guilds/\\d+/channels': (b) => ({ id: 'ch-ticket', ...(b as object) }) });
    const td = { ex: db, rest, guildId: G, botId: APP, brand, id: async (k: string) => ids[k] ?? null };
    const channelId = await openTicket(td, 'complaint', '555', { roblox: 'ExampleRbx', about: 'Example complaint' });
    expect(channelId).toBe('ch-ticket');
    const created = calls.find((c) => c.path.endsWith('/channels'))!.body as { name: string; topic: string; parent_id: string; permission_overwrites: { id: string }[] };
    expect(created.name).toBe('ticket-complaint-0001');
    expect(parseTopic(created.topic)).toEqual({ type: 'complaint', number: '0001', openerId: '555' });
    expect(created.parent_id).toBe('cat-help');
    // Complaints: opener + Management and up, not agents.
    const who = created.permission_overwrites.map((o) => o.id);
    expect(who).toEqual(expect.arrayContaining(['555', 'r-mgmt', 'r-co', 'r-owner']));
    expect(who).not.toContain('r-agent');

    const history = [
      { id: '2', timestamp: '2026-10-24T10:01:00Z', content: 'Example reply', author: { id: '701', username: 'agent' }, embeds: [], attachments: [] },
      { id: '1', timestamp: '2026-10-24T10:00:00Z', content: '', author: { id: APP, username: 'bot' }, embeds: [{ title: 'Complaint ticket 0001', fields: [{ name: 'Roblox username', value: 'ExampleRbx' }] }], attachments: [] },
    ];
    const close = fakeRest({ 'GET /channels/ch-ticket/messages': () => history, 'POST /channels/ch-transcripts/messages': () => ({ id: 'm-t' }) });
    const res = await closeTicket({ ...td, rest: close.rest }, { id: 'ch-ticket', type: 0, topic: created.topic, name: created.name } as never, '701', 'Example Agent', 'Example summary', { green: 'g', brass: 'b', paper: 'p', ink: 'i', muted: 'm' });
    expect(res.transcriptUrl).toBe(`https://discord.com/channels/${G}/ch-transcripts/m-t`);
    const upload = close.calls.find((c) => c.path === '/channels/ch-transcripts/messages')!;
    expect((upload.files as { name: string }[])[0]!.name).toBe('ticket-complaint-0001.html');
    expect(close.calls.at(-1)).toMatchObject({ method: 'DELETE', path: '/channels/ch-ticket' });
    const rec = await db.query.enquiries.findFirst({ where: eq(enquiries.refNo, 'TK-0001') });
    expect(rec).toMatchObject({ type: 'discord_ticket', discordUserId: '555', summary: 'Example summary', status: 'closed' });
    expect((rec!.payload as { answers: Record<string, string> }).answers['Roblox username']).toBe('ExampleRbx');
  });

  it('the transcript escapes what people typed', () => {
    const html = renderTranscript({ brokerageName: 'Example Realty', title: 'T', summary: '<b>x</b>', closedBy: 'A', palette: { green: 'g', brass: 'b', paper: 'p', ink: 'i', muted: 'm' }, messages: [{ id: '1', timestamp: '2026-10-24T10:00:00Z', content: '<script>alert(1)</script>', author: { id: '1', username: 'u' }, embeds: [], attachments: [] } as never] });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('ticket buttons open the right modal; only staff can claim', async () => {
    const { rest } = fakeRest();
    const press = (custom_id: string, roles: string[] = []) => ({ type: InteractionType.MessageComponent, guild_id: G, member: member('555', roles), channel: { id: 'c1' }, message: { embeds: [{ title: 'Buy ticket 0001', fields: [] }], components: [] }, data: { custom_id } }) as unknown as APIInteraction;
    const modal = await handleInteraction(press('jr:ticket:sell'), deps(rest));
    expect(modal.response).toEqual({ type: InteractionResponseType.Modal, data: ticketModal('sell') });
    const denied = await handleInteraction(press('jr:tk:claim'), deps(rest));
    expect(JSON.stringify(denied.response)).toContain('Only staff');
    const claimed = await handleInteraction(press('jr:tk:claim', ['r-agent']), deps(rest));
    expect(claimed.response.type).toBe(InteractionResponseType.UpdateMessage);
    expect(JSON.stringify(claimed.response)).toContain('Claimed by');
    expect(claimed.later).toBeTypeOf('function');
  });

  it('staff clock in and out; others can’t', async () => {
    const { rest } = fakeRest();
    const press = (custom_id: string, roles: string[]) => ({ type: InteractionType.MessageComponent, guild_id: G, member: member('701', roles), data: { custom_id } }) as unknown as APIInteraction;
    expect(JSON.stringify((await handleInteraction(press('jr:shift:in', []), deps(rest))).response)).toContain('Shifts are for staff');
    expect(JSON.stringify((await handleInteraction(press('jr:shift:in', ['r-agent']), deps(rest))).response)).toContain('Clocked in');
    expect(JSON.stringify((await handleInteraction(press('jr:shift:in', ['r-agent']), deps(rest))).response)).toContain('already clocked in');
    expect(JSON.stringify((await handleInteraction(press('jr:shift:out', ['r-agent']), deps(rest))).response)).toContain('Clocked out after');
    const rows = await db.select().from(shifts);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.userId).toBe('u-agent');
    expect(rows[0]!.endedAt).not.toBeNull();
  });

  it('Management accepts an application: the site records it and tells the applicant', async () => {
    const [e] = await db.insert(enquiries).values({ refNo: 'JR-2026-00009', type: 'career_application', payload: { role: 'Agent', why: 'Example' }, userId: 'u-applicant' }).returning();
    const { rest } = fakeRest();
    const press = (roles: string[]) => ({ type: InteractionType.MessageComponent, guild_id: G, member: member('700', roles), data: { custom_id: `jr:app:accept:${e!.id}` } }) as unknown as APIInteraction;
    expect(JSON.stringify((await handleInteraction(press(['r-agent']), deps(rest))).response)).toContain('Only Management');
    const ok = await handleInteraction(press(['r-mgmt']), deps(rest));
    expect(ok.response.type).toBe(InteractionResponseType.UpdateMessage);
    expect(JSON.stringify(ok.response)).toContain('Accepted by user700');
    expect((await db.query.enquiries.findFirst({ where: eq(enquiries.id, e!.id) }))!.decision).toBe('accepted');
    const n = await db.select().from(notifications).where(eq(notifications.userId, 'u-applicant'));
    expect(n[0]!.title).toContain('accepted');
    expect(JSON.stringify((await handleInteraction(press(['r-mgmt']), deps(rest))).response)).toContain('Already accepted');
  });
});

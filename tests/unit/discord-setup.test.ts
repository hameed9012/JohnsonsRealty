import { OverwriteType, PermissionFlagsBits as P } from 'discord-api-types/v10';
import { describe, expect, it } from 'vitest';
import { BOT_PERMISSIONS, CHANNELS, FAQ, MESSAGES, ROLES, sumPermissions } from '@/discord/blueprint';
import { inviteUrl } from '@/discord/config';
import { bucketOf, DiscordApiError, discordRest, type DiscordRest } from '@/discord/rest';
import { channelOverwrites, runSetup, type ConfigStore, type StoredItem } from '@/discord/setup';

const G = '100000000000000001';
const BOT = '200000000000000002';
const BOT_ROLE = '300000000000000003';
const brand = { site: 'https://example.test', brokerageName: 'Example Realty', chirperHandle: 'ExampleHandle', civopsLine: null };

type Obj = Record<string, unknown> & { id: string };

/** An in-memory Discord guild that answers the REST calls setup makes, and records every write. */
function fakeGuild(opts: { botPerms?: bigint; community?: boolean } = {}) {
  let seq = 400000000000000000n;
  const nextId = () => String(++seq);
  const roles: Obj[] = [
    { id: G, name: '@everyone', position: 0, permissions: String(sumPermissions([P.ViewChannel, P.SendMessages])), color: 0, hoist: false, mentionable: false },
    { id: BOT_ROLE, name: 'Example Bot', position: 1, permissions: String(opts.botPerms ?? sumPermissions(BOT_PERMISSIONS)), color: 0, hoist: false, mentionable: false, managed: true },
  ];
  const channels: Obj[] = [];
  const messages = new Map<string, Obj>();
  const automod: Obj[] = [];
  const guild: Obj = { id: G, name: 'Old name', features: opts.community ? ['COMMUNITY'] : [], verification_level: 0, explicit_content_filter: 0, default_message_notifications: 0, icon: null, rules_channel_id: null, public_updates_channel_id: null };
  const writes: string[] = [];

  const rest: DiscordRest = {
    async request<T>(method: string, path: string, o: { body?: unknown } = {}): Promise<T> {
      const body = (o.body ?? {}) as Record<string, unknown>;
      if (method !== 'GET') writes.push(`${method} ${path}`);
      const m = (re: RegExp) => re.exec(path);
      let r: RegExpExecArray | null;
      if (method === 'GET' && path === '/users/@me') return { id: BOT, username: 'bot' } as T;
      if (method === 'GET' && path === `/guilds/${G}`) return guild as T;
      if (method === 'PATCH' && path === `/guilds/${G}`) return Object.assign(guild, body) as T;
      if (method === 'GET' && path === `/guilds/${G}/roles`) return roles.map((x) => ({ ...x })) as T;
      if (method === 'GET' && path === `/guilds/${G}/channels`) return channels.map((x) => ({ ...x })) as T;
      if (method === 'GET' && path === `/guilds/${G}/members/${BOT}`) return { roles: [BOT_ROLE] } as T;
      if (method === 'POST' && path === `/guilds/${G}/roles`) {
        const role = { id: nextId(), position: 1, color: 0, hoist: false, mentionable: false, permissions: '0', ...body };
        roles.push(role);
        return role as T;
      }
      if (method === 'PATCH' && path === `/guilds/${G}/roles`) {
        for (const p of body as unknown as { id: string; position: number }[]) roles.find((x) => x.id === p.id)!.position = p.position;
        return roles as T;
      }
      if ((r = m(/^\/guilds\/\d+\/roles\/(\d+)$/)) && method === 'PATCH') return Object.assign(roles.find((x) => x.id === r![1])!, body) as T;
      if (method === 'POST' && path === `/guilds/${G}/channels`) {
        if ((body.type === 5 || body.type === 15) && !(guild.features as string[]).includes('COMMUNITY')) throw new DiscordApiError(400, 50024, 'Community required', {});
        const c = { id: nextId(), ...body };
        channels.push(c);
        return c as T;
      }
      if ((r = m(/^\/channels\/(\d+)$/)) && method === 'PATCH') return Object.assign(channels.find((x) => x.id === r![1]) ?? {}, body) as T;
      if ((r = m(/^\/channels\/(\d+)\/messages$/)) && method === 'POST') {
        const msg = { id: nextId(), channel_id: r[1], ...body };
        messages.set(msg.id, msg);
        return msg as T;
      }
      if ((r = m(/^\/channels\/(\d+)\/messages\/(\d+)$/)) && method === 'PATCH') {
        const msg = messages.get(r[2]!);
        if (!msg) throw new DiscordApiError(404, 10008, 'Unknown Message', {});
        return Object.assign(msg, body) as T;
      }
      if (m(/^\/channels\/\d+\/pins\/\d+$/) && method === 'PUT') return undefined as T;
      if ((r = m(/^\/channels\/(\d+)\/threads$/)) && method === 'POST') {
        const t = { id: nextId(), parent_id: r[1], ...body };
        channels.push(t);
        messages.set(t.id, { id: t.id, ...(body.message as object) });
        return t as T;
      }
      if (method === 'POST' && path === `/guilds/${G}/auto-moderation/rules`) {
        const a = { id: nextId(), ...body };
        automod.push(a);
        return a as T;
      }
      if ((r = m(/auto-moderation\/rules\/(\d+)$/)) && method === 'PATCH') return Object.assign(automod.find((x) => x.id === r![1])!, body) as T;
      if (method === 'PUT' && path === `/guilds/${G}/onboarding`) throw new DiscordApiError(400, 350000, 'Onboarding needs at least 7 default channels', {});
      throw new Error(`Unhandled ${method} ${path}`);
    },
    get: (p, o) => rest.request('GET', p, o),
    post: (p, b, o) => rest.request('POST', p, { ...o, body: b }),
    patch: (p, b, o) => rest.request('PATCH', p, { ...o, body: b }),
    put: (p, b, o) => rest.request('PUT', p, { ...o, body: b }),
    delete: (p, o) => rest.request('DELETE', p, o),
  };
  return { rest, roles, channels, messages, automod, guild, writes, botRole: roles[1]! };
}

function memoryStore(): ConfigStore & { map: Map<string, StoredItem> } {
  const map = new Map<string, StoredItem>();
  return { map, all: async () => new Map(map), set: async (k, _kind, v) => void map.set(k, v) };
}

describe('discord setup', () => {
  it('builds the whole server on the first run', async () => {
    const d = fakeGuild();
    d.botRole.position = 20;
    const store = memoryStore();
    const report = await runSetup({ rest: d.rest, store, guildId: G, brand, icon: new Uint8Array([1, 2, 3]) });

    expect(d.roles.filter((r) => ROLES.some((x) => x.name === r.name))).toHaveLength(ROLES.length);
    // Roles sit under the bot in blueprint order.
    const order = ROLES.map((def) => d.roles.find((r) => r.name === def.name)!.position as number);
    expect(order).toEqual([...order].sort((a, b) => b - a));
    expect(Math.max(...order)).toBeLessThan(20);

    expect(d.channels.filter((c) => c.type === 4)).toHaveLength(7);
    for (const def of CHANNELS) expect(d.channels.some((c) => c.name === def.name)).toBe(true);
    expect(d.channels.find((c) => c.name === 'new-listings')!.type).toBe(5);
    expect(d.channels.find((c) => c.name === 'faq')!.type).toBe(15);
    expect(d.guild.features).toContain('COMMUNITY');
    expect(d.guild.name).toBe("Johnson's Realty | PARP");

    // Every panel posted once, channel mentions resolved, the welcome footer built from settings.
    const posted = [...d.messages.values()];
    expect(posted.length).toBe(MESSAGES.length + FAQ.length + 1); // + the summary in #bot-log
    const welcome = posted.find((x) => (x.embeds as { title?: string }[] | undefined)?.[0]?.title === 'Welcome to Example Realty')!;
    expect(JSON.stringify(welcome)).not.toContain('<#rules>');
    expect(JSON.stringify(welcome)).toContain('Chirper @ExampleHandle');
    expect(d.automod).toHaveLength(3);

    // Things only a person can do are listed, including the refused onboarding.
    expect(report.manual.some((m) => m.includes('Owner: turn on Administrator'))).toBe(true);
    expect(report.manual.some((m) => m.startsWith('Onboarding was refused'))).toBe(true);
  });

  it('changes nothing when run again', async () => {
    const d = fakeGuild();
    d.botRole.position = 20;
    const store = memoryStore();
    await runSetup({ rest: d.rest, store, guildId: G, brand });
    d.writes.length = 0;
    const again = await runSetup({ rest: d.rest, store, guildId: G, brand });
    expect(again.changes).toEqual([]);
    expect(d.writes.filter((w) => !w.includes('/messages') || !w.startsWith('POST') || !w.includes(store.map.get('channel:bot-log')!.discordId))).toEqual(['PUT /guilds/100000000000000001/onboarding']);
  });

  it('edits panels in place when their text changes, and re-creates a deleted one', async () => {
    const d = fakeGuild();
    d.botRole.position = 20;
    const store = memoryStore();
    await runSetup({ rest: d.rest, store, guildId: G, brand });
    const welcomeId = store.map.get('message:welcome')!.discordId;
    d.messages.delete(store.map.get('message:rules')!.discordId);
    const r = await runSetup({ rest: d.rest, store, guildId: G, brand: { ...brand, chirperHandle: 'NewHandle' } });
    expect(r.changes).toContain('Edit the welcome message');
    expect(store.map.get('message:welcome')!.discordId).toBe(welcomeId);
    expect(JSON.stringify(d.messages.get(welcomeId))).toContain('Chirper @NewHandle');
    // Rules text didn't change, so it isn't touched even though it was deleted by hand.
    expect(r.changes.some((c) => c.includes('rules'))).toBe(false);
  });

  it('a dry run reads the server and writes nothing', async () => {
    const d = fakeGuild();
    d.botRole.position = 20;
    const store = memoryStore();
    const r = await runSetup({ rest: d.rest, store, guildId: G, brand, dryRun: true });
    expect(d.writes).toEqual([]);
    expect(store.map.size).toBe(0);
    expect(r.changes.filter((c) => c.startsWith('Create role'))).toHaveLength(ROLES.length);
    expect(r.changes).toContain('Create #general');
  });

  it("asks for the bot's role to be moved up when it is too low to order the roles", async () => {
    const d = fakeGuild();
    const r = await runSetup({ rest: d.rest, store: memoryStore(), guildId: G, brand });
    expect(r.manual.some((m) => m.includes("drag the bot's role to the very top"))).toBe(true);
  });

  it('never grants permissions the bot lacks, and says so', async () => {
    const d = fakeGuild({ botPerms: sumPermissions(BOT_PERMISSIONS.filter((p) => p !== P.KickMembers)) });
    d.botRole.position = 20;
    const r = await runSetup({ rest: d.rest, store: memoryStore(), guildId: G, brand });
    const mgmt = d.roles.find((x) => x.name === 'Management')!;
    expect(BigInt(mgmt.permissions as string) & P.KickMembers).toBe(0n);
    expect(r.manual.some((m) => m.startsWith('Give the Management role'))).toBe(true);
  });
});

describe('channel permissions', () => {
  const ids = Object.fromEntries(ROLES.map((r, i) => [r.key, String(500 + i)]));
  const ow = (key: string) => channelOverwrites(CHANNELS.find((c) => c.key === key)!, ids, G, BOT);
  const of = (o: ReturnType<typeof ow>, id: string) => o.find((x) => x.id === id);

  it('front desk channels are visible to everyone but only the bot posts in #verify', () => {
    const e = of(ow('verify'), G)!;
    expect(BigInt(e.allow) & P.ViewChannel).toBe(P.ViewChannel);
    expect(BigInt(e.deny) & P.SendMessages).toBe(P.SendMessages);
    expect(ow('verify').filter((x) => x.type === OverwriteType.Role && BigInt(x.allow) & P.SendMessages)).toEqual([]);
    expect(BigInt(of(ow('verify'), BOT)!.allow) & P.SendMessages).toBe(P.SendMessages);
  });

  it('listing review is hidden from agents and visible to management', () => {
    const o = ow('listing-review');
    expect(BigInt(of(o, G)!.deny) & P.ViewChannel).toBe(P.ViewChannel);
    expect(of(o, ids.agent!)).toBeUndefined();
    expect(BigInt(of(o, ids.management!)!.allow) & P.ViewChannel).toBe(P.ViewChannel);
  });

  it('verified members read #new-listings but cannot post; clients post reviews', () => {
    expect(BigInt(of(ow('new-listings'), ids.verified!)!.allow)).toBe(P.ViewChannel);
    expect(BigInt(of(ow('reviews'), ids.client!)!.allow) & P.SendMessages).toBe(P.SendMessages);
    expect(BigInt(of(ow('reviews'), ids.verified!)!.allow) & P.SendMessages).toBe(0n);
  });

  it('the FAQ forum lets staff start posts and verified members reply', () => {
    const o = ow('faq');
    expect(BigInt(of(o, ids.agent!)!.allow) & P.CreatePublicThreads).toBe(P.CreatePublicThreads);
    expect(BigInt(of(o, ids.verified!)!.allow) & P.CreatePublicThreads).toBe(0n);
    expect(BigInt(of(o, ids.verified!)!.allow) & P.SendMessagesInThreads).toBe(P.SendMessagesInThreads);
  });
});

describe('bot invite and REST client', () => {
  it('asks for exactly the blueprint permissions and never Administrator', () => {
    const u = new URL(inviteUrl('123', '456'));
    const perms = BigInt(u.searchParams.get('permissions')!);
    expect(perms & P.Administrator).toBe(0n);
    expect(perms & P.ManageRoles).toBe(P.ManageRoles);
    expect(u.searchParams.get('scope')).toBe('bot applications.commands');
    expect(u.searchParams.get('guild_id')).toBe('456');
  });

  it('groups rate-limit buckets by their major parameter', () => {
    expect(bucketOf('PATCH', '/channels/111111111111111111/messages/222222222222222222')).toBe('PATCH /channels/111111111111111111/messages/:id');
    expect(bucketOf('GET', '/users/@me')).toBe('GET /users/@me');
  });

  it('waits out a 429 and retries', async () => {
    let calls = 0;
    const fakeFetch = (async () => {
      calls++;
      if (calls === 1) return new Response(JSON.stringify({ retry_after: 0.01, global: false }), { status: 429 });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as typeof fetch;
    const rest = discordRest('token', { fetch: fakeFetch });
    await expect(rest.get('/users/@me')).resolves.toEqual({ ok: true });
    expect(calls).toBe(2);
  });

  it('raises Discord errors with their code', async () => {
    const rest = discordRest('token', { fetch: (async () => new Response(JSON.stringify({ code: 50013, message: 'Missing Permissions' }), { status: 403 })) as typeof fetch });
    await expect(rest.post('/channels/1/messages', {})).rejects.toMatchObject({ status: 403, code: 50013 });
  });
});

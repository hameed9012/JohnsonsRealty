import { generateKeyPairSync, sign } from 'node:crypto';
import { InteractionResponseType, InteractionType } from 'discord-api-types/v10';
import type { APIInteraction } from 'discord-api-types/v10';
import { describe, expect, it } from 'vitest';
import { handleInteraction, verifyDiscordRequest } from '@/discord/interactions';
import type { DiscordRest } from '@/discord/rest';

const G = '100000000000000001';

describe('request signatures', () => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const pubHex = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex');
  const body = JSON.stringify({ type: 1 });
  const ts = '1730000000';
  const sig = sign(null, Buffer.from(ts + body), privateKey).toString('hex');

  it('accepts a request Discord signed', () => {
    expect(verifyDiscordRequest(body, sig, ts, pubHex)).toBe(true);
  });

  it('rejects a changed body, a changed timestamp, a missing header or another key', () => {
    expect(verifyDiscordRequest(body.replace('1', '2'), sig, ts, pubHex)).toBe(false);
    expect(verifyDiscordRequest(body, sig, '1730000001', pubHex)).toBe(false);
    expect(verifyDiscordRequest(body, null, ts, pubHex)).toBe(false);
    const other = generateKeyPairSync('ed25519').publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex');
    expect(verifyDiscordRequest(body, sig, ts, other)).toBe(false);
    expect(verifyDiscordRequest(body, 'zz', ts, pubHex)).toBe(false);
  });
});

function fakeRest() {
  const calls: string[] = [];
  const rest = {
    request: async () => undefined,
    get: async () => undefined,
    post: async () => undefined,
    patch: async () => undefined,
    put: async (p: string) => void calls.push(`PUT ${p}`),
    delete: async (p: string) => void calls.push(`DELETE ${p}`),
  } as unknown as DiscordRest;
  return { rest, calls };
}

const ids: Record<string, string> = { 'role:verified': '901', 'role:pingListings': '902', 'channel:new-listings': '777', 'channel:open-a-ticket': '778' };
const click = (custom_id: string, roles: string[] = []) =>
  ({ type: InteractionType.MessageComponent, guild_id: G, member: { user: { id: '55' }, roles }, data: { custom_id, component_type: 2 } }) as unknown as APIInteraction;

describe('interaction handlers', () => {
  it('answers Discord’s ping', async () => {
    const { rest } = fakeRest();
    expect(await handleInteraction({ type: InteractionType.Ping } as APIInteraction, { rest, guildId: G, id: async () => null })).toEqual({ type: InteractionResponseType.Pong });
  });

  it('Verify gives the Verified role and replies privately with links', async () => {
    const { rest, calls } = fakeRest();
    const r = await handleInteraction(click('jr:verify'), { rest, guildId: G, id: async (k) => ids[k] ?? null });
    expect(calls).toEqual([`PUT /guilds/${G}/members/55/roles/901`]);
    expect(r).toMatchObject({ type: InteractionResponseType.ChannelMessageWithSource, data: { flags: 64 } });
    expect(JSON.stringify(r)).toContain('<#777>');
  });

  it('Get-roles toggles the ping role on and off', async () => {
    const { rest, calls } = fakeRest();
    const deps = { rest, guildId: G, id: async (k: string) => ids[k] ?? null };
    const on = await handleInteraction(click('jr:role:listings'), deps);
    const off = await handleInteraction(click('jr:role:listings', ['902']), deps);
    expect(calls).toEqual([`PUT /guilds/${G}/members/55/roles/902`, `DELETE /guilds/${G}/members/55/roles/902`]);
    expect(JSON.stringify(on)).toContain('pings are on');
    expect(JSON.stringify(off)).toContain('pings are off');
  });

  it('says so politely before setup has run', async () => {
    const { rest, calls } = fakeRest();
    const r = await handleInteraction(click('jr:verify'), { rest, guildId: G, id: async () => null });
    expect(calls).toEqual([]);
    expect(JSON.stringify(r)).toContain('isn’t set up yet');
  });
});

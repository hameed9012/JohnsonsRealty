import type { APIInteraction } from 'discord-api-types/v10';
import { db } from '@/db/client';
import { configId, discordEnv } from '@/discord/config';
import { handleInteraction, verifyDiscordRequest } from '@/discord/interactions';
import { discordRest } from '@/discord/rest';

// Discord's interactions endpoint. Unsigned or wrongly signed requests are rejected before anything runs.
export async function POST(req: Request) {
  const env = discordEnv();
  if (!env.ok) return new Response('Discord is not configured', { status: 503 });
  const raw = await req.text();
  if (!verifyDiscordRequest(raw, req.headers.get('x-signature-ed25519'), req.headers.get('x-signature-timestamp'), env.value.publicKey)) {
    return new Response('Bad request signature', { status: 401 });
  }
  const interaction = JSON.parse(raw) as APIInteraction;
  const res = await handleInteraction(interaction, { rest: discordRest(env.value.token), guildId: env.value.guildId, id: (key) => configId(db, key) });
  return Response.json(res);
}

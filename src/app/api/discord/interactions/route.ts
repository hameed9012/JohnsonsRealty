import { after } from 'next/server';
import type { APIInteraction } from 'discord-api-types/v10';
import { db } from '@/db/client';
import { brandContext, configId, discordEnv } from '@/discord/config';
import { handleInteraction, verifyDiscordRequest } from '@/discord/interactions';
import { discordRest } from '@/discord/rest';

// Discord's interactions endpoint. Unsigned or wrongly signed requests are rejected before anything runs.
// Slow work (opening or closing a ticket) runs after the response, within this function's time limit.
export const maxDuration = 60;

export async function POST(req: Request) {
  const env = discordEnv();
  if (!env.ok) return new Response('Discord is not configured', { status: 503 });
  const raw = await req.text();
  if (!verifyDiscordRequest(raw, req.headers.get('x-signature-ed25519'), req.headers.get('x-signature-timestamp'), env.value.publicKey)) {
    return new Response('Bad request signature', { status: 401 });
  }
  const interaction = JSON.parse(raw) as APIInteraction;
  const handled = await handleInteraction(interaction, {
    rest: discordRest(env.value.token),
    guildId: env.value.guildId,
    appId: env.value.appId,
    ex: db,
    brand: await brandContext(db),
    id: (key) => configId(db, key),
  });
  if (handled.later) after(handled.later);
  return Response.json(handled.response);
}

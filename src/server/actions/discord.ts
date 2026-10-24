'use server';

import { readFile } from 'node:fs/promises';
import { db } from '@/db/client';
import { SERVER } from '@/discord/blueprint';
import { brandContext, dbConfigStore, discordEnv } from '@/discord/config';
import { discordRest, DiscordApiError } from '@/discord/rest';
import { runSetup, type SetupReport } from '@/discord/setup';
import { can } from '@/lib/permissions';
import { audit } from '@/server/audit';
import { actorOrThrow } from '@/server/session';

export type SetupResult = { ok: true; report: SetupReport } | { ok: false; message: string };

/** The server icon: the logo file in the repo, or the copy the site serves when the file isn't bundled. */
async function icon(site: string): Promise<Uint8Array | null> {
  try {
    return await readFile(SERVER.iconFile);
  } catch {
    const r = await fetch(`${site}/brand/jr-avatar-green.png`).catch(() => null);
    return r?.ok ? new Uint8Array(await r.arrayBuffer()) : null;
  }
}

/** Owner only. Runs the blueprint setup against the server, or a dry run that only reports. */
export async function runDiscordSetupAction(dryRun: boolean): Promise<SetupResult> {
  const actor = await actorOrThrow();
  if (!can(actor, 'settings.manage')) return { ok: false, message: 'Only the Owner can set up the Discord server.' };
  const env = discordEnv();
  if (!env.ok) return { ok: false, message: `Add these environment variables first: ${env.missing.join(', ')}.` };
  try {
    const brand = await brandContext(db);
    const report = await runSetup({ rest: discordRest(env.value.token), store: dbConfigStore(db), guildId: env.value.guildId, brand, dryRun, icon: await icon(brand.site) });
    if (!dryRun) await audit(db, { actorId: actor.id, action: 'discord.setup', entity: 'discord', summary: `Ran Discord server setup (${report.changes.length} changes)`, diff: { changes: report.changes, manual: report.manual } });
    return { ok: true, report };
  } catch (e) {
    console.error(e);
    if (e instanceof DiscordApiError && (e.status === 401 || e.status === 403)) {
      return { ok: false, message: e.status === 401 ? 'Discord rejected the bot token. Check DISCORD_BOT_TOKEN.' : 'The bot is missing a permission or isn’t in the server. Invite it with the link on this page.' };
    }
    if (e instanceof DiscordApiError && e.status === 404) return { ok: false, message: 'Discord couldn’t find that server. Check DISCORD_GUILD_ID and that the bot has joined it.' };
    return { ok: false, message: e instanceof Error ? e.message : 'Setup failed. Try again.' };
  }
}

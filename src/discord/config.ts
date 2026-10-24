// Discord settings from the environment, the brand context from site settings, and the discord_config store.
import { eq } from 'drizzle-orm';
import type { Executor } from '@/db/client';
import { discordConfig, siteSettings } from '@/db/schema';
import { BOT_PERMISSIONS, sumPermissions } from './blueprint';
import type { BrandContext } from './brand';
import type { ConfigStore, StoredItem } from './setup';

export interface DiscordEnv {
  token: string;
  appId: string;
  publicKey: string;
  guildId: string;
}

/** The bot's env vars, or the names of the ones missing. DISCORD_APP_ID falls back to the sign-in app's ID. */
export function discordEnv(env: NodeJS.ProcessEnv = process.env): { ok: true; value: DiscordEnv } | { ok: false; missing: string[] } {
  const value = {
    token: env.DISCORD_BOT_TOKEN ?? '',
    appId: env.DISCORD_APP_ID || env.AUTH_DISCORD_ID || '',
    publicKey: env.DISCORD_PUBLIC_KEY ?? '',
    guildId: env.DISCORD_GUILD_ID ?? '',
  };
  const missing = [
    !value.token && 'DISCORD_BOT_TOKEN',
    !value.appId && 'DISCORD_APP_ID',
    !value.publicKey && 'DISCORD_PUBLIC_KEY',
    !value.guildId && 'DISCORD_GUILD_ID',
  ].filter(Boolean) as string[];
  return missing.length ? { ok: false, missing } : { ok: true, value };
}

/** The bot's invite link, with exactly the permissions the blueprint needs (never Administrator). */
export function inviteUrl(appId: string, guildId?: string): string {
  const u = new URL('https://discord.com/oauth2/authorize');
  u.searchParams.set('client_id', appId);
  u.searchParams.set('permissions', String(sumPermissions(BOT_PERMISSIONS)));
  u.searchParams.set('scope', 'bot applications.commands');
  u.searchParams.set('integration_type', '0');
  if (guildId) {
    u.searchParams.set('guild_id', guildId);
    u.searchParams.set('disable_guild_select', 'true');
  }
  return u.toString();
}

export async function brandContext(ex: Executor, env: NodeJS.ProcessEnv = process.env): Promise<BrandContext> {
  const s = await ex.query.siteSettings.findFirst({ where: eq(siteSettings.id, 1) });
  return {
    site: (env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, ''),
    brokerageName: s?.brokerageName ?? 'Johnson’s Realty',
    chirperHandle: s?.chirperHandle ?? null,
    civopsLine: s?.civopsLine ?? null,
  };
}

export function dbConfigStore(ex: Executor): ConfigStore {
  return {
    async all() {
      const rows = await ex.select().from(discordConfig);
      return new Map<string, StoredItem>(rows.map((r) => [r.key, { discordId: r.discordId, parentId: r.parentId, hash: r.hash }]));
    },
    async set(key, kind, item) {
      const values = { key, kind, discordId: item.discordId, parentId: item.parentId ?? null, hash: item.hash ?? null };
      await ex.insert(discordConfig).values(values).onConflictDoUpdate({ target: discordConfig.key, set: values });
    },
  };
}

/** One stored Discord ID by key (e.g. "role:verified"), for the interaction handlers. */
export async function configId(ex: Executor, key: string): Promise<string | null> {
  const r = await ex.query.discordConfig.findFirst({ where: eq(discordConfig.key, key) });
  return r?.discordId ?? null;
}

// npm run discord:setup [-- --dry-run]   makes the Discord server match the blueprint
// npm run discord:invite                 prints the bot's invite link
// Uses the same database as the site (DATABASE_URL), so the IDs it stores are the ones the site uses.
import { config } from 'dotenv';
import { readFile } from 'node:fs/promises';
import { getDb } from '@/db/client';
import { SERVER } from './blueprint';
import { brandContext, dbConfigStore, discordEnv, inviteUrl } from './config';
import { discordRest } from './rest';
import { runSetup } from './setup';

config({ path: '.env.local' });
config();

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const env = discordEnv();
  if (command === 'invite') {
    const appId = process.env.DISCORD_APP_ID || process.env.AUTH_DISCORD_ID;
    if (!appId) throw new Error('Set DISCORD_APP_ID (or AUTH_DISCORD_ID) first.');
    console.log(inviteUrl(appId, process.env.DISCORD_GUILD_ID));
    return;
  }
  if (command !== 'setup') throw new Error('Usage: discord:setup [--dry-run] | discord:invite');
  if (!env.ok) throw new Error(`Missing env vars: ${env.missing.join(', ')}. See the README's Discord section.`);
  const dryRun = args.includes('--dry-run');
  const db = getDb();
  const report = await runSetup({
    rest: discordRest(env.value.token),
    store: dbConfigStore(db),
    guildId: env.value.guildId,
    brand: await brandContext(db),
    dryRun,
    icon: await readFile(SERVER.iconFile),
    appId: env.value.appId,
  });
  console.log(dryRun ? '\nDry run: nothing was changed. This is what setup would do:\n' : '\nSetup finished.\n');
  console.log(report.changes.length ? report.changes.map((c) => `  · ${c}`).join('\n') : '  Everything already matches the blueprint.');
  console.log(`\n${report.unchanged} items already up to date.`);
  if (report.manual.length) console.log(`\nTo do by hand:\n${report.manual.map((m) => `  · ${m}`).join('\n')}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });

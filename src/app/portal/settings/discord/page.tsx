import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DiscordSetupPanel } from '@/components/portal/DiscordSetupPanel';
import { Breadcrumbs } from '@/components/ui/layout';
import { db } from '@/db/client';
import { discordConfig } from '@/db/schema';
import { discordEnv, inviteUrl } from '@/discord/config';
import { can } from '@/lib/permissions';
import { requireStaff } from '@/server/session';

export const metadata: Metadata = { title: 'Discord' };
// Setup makes many rate-limited Discord calls; give the action room to finish.
export const maxDuration = 300;

const VARS = [
  { name: 'DISCORD_BOT_TOKEN', where: 'Developer Portal → your app → Bot → Reset Token' },
  { name: 'DISCORD_PUBLIC_KEY', where: 'Developer Portal → your app → General Information → Public Key' },
  { name: 'DISCORD_GUILD_ID', where: 'Discord → right-click the server icon → Copy Server ID (Developer Mode on)' },
  { name: 'DISCORD_APP_ID', where: 'Optional: the Application ID. Defaults to AUTH_DISCORD_ID (same app).' },
];

export default async function DiscordSettingsPage() {
  const actor = await requireStaff('/portal/settings/discord');
  if (!can(actor, 'settings.manage')) notFound();
  const env = discordEnv();
  const missing = env.ok ? [] : env.missing;
  const appId = process.env.DISCORD_APP_ID || process.env.AUTH_DISCORD_ID || '';
  const site = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
  const stored = await db.select({ key: discordConfig.key }).from(discordConfig);
  const count = (prefix: string) => stored.filter((s) => s.key.startsWith(prefix)).length;

  return (
    <div className="stack-lg">
      <Breadcrumbs items={[{ label: 'Site settings', href: '/portal/settings' }, { label: 'Discord' }]} />
      <div className="page-head">
        <div>
          <span className="label label--brass">Owner</span>
          <h1 className="heading-1">Discord server</h1>
          <p className="body muted">The bot builds and maintains the server from the blueprint: roles, channels, permissions, panels, the FAQ and AutoMod. Running it again only fixes what changed.</p>
        </div>
      </div>

      <section className="panel stack" aria-labelledby="d-1">
        <h2 id="d-1" className="panel-title">
          1. Connect the bot
        </h2>
        <ul className="saved-list">
          {VARS.map((v) => {
            const isMissing = missing.includes(v.name);
            return (
              <li key={v.name}>
                <span className="stack">
                  <code className="id">{v.name}</code>
                  <span className="body-s muted">{v.where}</span>
                </span>
                <span className="body-s">{v.name === 'DISCORD_APP_ID' ? (appId ? 'Set' : 'Missing') : isMissing ? 'Missing' : 'Set'}</span>
              </li>
            );
          })}
        </ul>
        <p className="body-s muted">Add them in Vercel → Settings → Environment Variables (Production), then redeploy.</p>
      </section>

      <section className="panel stack" aria-labelledby="d-2">
        <h2 id="d-2" className="panel-title">
          2. Invite the bot and set the interactions URL
        </h2>
        {appId ? (
          <p className="body-s">
            <a href={inviteUrl(appId, process.env.DISCORD_GUILD_ID)} target="_blank" rel="noreferrer">
              Invite the bot to the server
            </a>{' '}
            (asks for exactly the permissions setup needs, never Administrator).
          </p>
        ) : (
          <p className="body-s muted">The invite link appears once DISCORD_APP_ID or AUTH_DISCORD_ID is set.</p>
        )}
        <p className="body-s">
          In the Developer Portal → General Information, set <b>Interactions Endpoint URL</b> to <code className="id">{site}/api/discord/interactions</code>. The Verify and Get-roles buttons need it.
        </p>
      </section>

      <section className="panel stack" aria-labelledby="d-3">
        <h2 id="d-3" className="panel-title">
          3. Build the server
        </h2>
        <p className="body-s muted">
          Created so far: {count('role:')} roles, {count('category:') + count('channel:')} categories and channels, {count('message:') + count('faq:')} panels and posts. Preview first to see every change without touching the server.
        </p>
        <DiscordSetupPanel ready={missing.length === 0} />
      </section>
    </div>
  );
}

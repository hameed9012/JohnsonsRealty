// Makes the Discord server match the blueprint. Idempotent: everything it creates is stored by key in
// discord_config, so a re-run updates by ID (roles re-ordered, overwrites fixed, panels edited in place)
// instead of creating duplicates. With dryRun it reads the server and reports what it would change.
import { createHash } from 'node:crypto';
import { ChannelType, OverwriteType, PermissionFlagsBits as P } from 'discord-api-types/v10';
import type { APIChannel, APIGuild, APIGuildMember, APIMessage, APIOverwrite, APIRole, APIUser } from 'discord-api-types/v10';
import {
  audienceRoles,
  CATEGORIES,
  CHANNEL_TYPE,
  CHANNELS,
  EVERYONE_PERMISSIONS,
  FAQ,
  faqEmbed,
  MESSAGES,
  resolveMentions,
  ROLES,
  SENIOR_MANAGE_IN,
  SERVER,
  sumPermissions,
  SUMMARY_COLOR,
  type ChannelDef,
  type RoleKey,
} from './blueprint';
import { author, tokenColor, type BrandContext } from './brand';
import { DiscordApiError, type DiscordRest } from './rest';

export interface StoredItem {
  discordId: string;
  parentId?: string | null;
  hash?: string | null;
}

/** Where created IDs live. The app uses the discord_config table; tests use a Map. */
export interface ConfigStore {
  all(): Promise<Map<string, StoredItem>>;
  set(key: string, kind: string, item: StoredItem): Promise<void>;
}

export interface SetupOptions {
  rest: DiscordRest;
  store: ConfigStore;
  guildId: string;
  brand: BrandContext;
  dryRun?: boolean;
  /** PNG bytes for the server icon; omitted = leave the icon alone. */
  icon?: Uint8Array | null;
}

export interface SetupReport {
  dryRun: boolean;
  /** Changes made (or, in a dry run, that would be made). */
  changes: string[];
  /** Things Discord refused or that only a person can do. */
  manual: string[];
  unchanged: number;
}

const SEND = P.SendMessages | P.SendMessagesInThreads | P.CreatePublicThreads | P.CreatePrivateThreads;
const BOT_IN_CHANNEL = P.ViewChannel | P.SendMessages | P.SendMessagesInThreads | P.CreatePublicThreads | P.EmbedLinks | P.AttachFiles | P.ReadMessageHistory | P.ManageMessages | P.ManageThreads | P.MentionEveryone;

export const digest = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16);

/** The permission overwrites a channel should have, as Discord stores them (allow/deny as decimal strings). */
export function channelOverwrites(def: ChannelDef, roleIds: Partial<Record<RoleKey, string>>, everyoneId: string, botId: string): APIOverwrite[] {
  const voice = def.kind === 'voice';
  const forum = def.kind === 'forum';
  const postPerms = voice ? P.Connect | P.Speak : forum ? P.CreatePublicThreads | P.SendMessagesInThreads : P.SendMessages | P.SendMessagesInThreads | P.CreatePublicThreads;
  const allow = new Map<string, bigint>();
  const add = (id: string | undefined, bits: bigint) => id && allow.set(id, (allow.get(id) ?? 0n) | bits);
  for (const r of audienceRoles(def.view)) add(roleIds[r], P.ViewChannel);
  for (const a of def.post) for (const r of audienceRoles(a)) add(roleIds[r], P.ViewChannel | postPerms);
  if (def.reply) for (const r of audienceRoles(def.reply)) add(roleIds[r], P.ViewChannel | P.SendMessagesInThreads);
  if (SENIOR_MANAGE_IN.has(def.key)) add(roleIds.seniorAgent, P.ManageMessages);

  const everyoneAllow = def.view === 'everyone' ? P.ViewChannel : 0n;
  const everyoneDeny = (def.view === 'everyone' ? 0n : P.ViewChannel) | SEND | (voice ? P.Connect : 0n);
  const out: APIOverwrite[] = [{ id: everyoneId, type: OverwriteType.Role, allow: String(everyoneAllow), deny: String(everyoneDeny) }];
  for (const [id, bits] of allow) out.push({ id, type: OverwriteType.Role, allow: String(bits), deny: '0' });
  out.push({ id: botId, type: OverwriteType.Member, allow: String(BOT_IN_CHANNEL | (voice ? P.Connect : 0n)), deny: '0' });
  return out;
}

const norm = (o: APIOverwrite[] = []) =>
  o
    .map((x) => `${x.type}:${x.id}:${x.allow}:${x.deny}`)
    .sort()
    .join('|');

/** A Discord-style snowflake for new onboarding prompts (Discord wants snowflake IDs even for new ones). */
function snowflake(i: number) {
  return String(((BigInt(Date.now()) - 1420070400000n) << 22n) + BigInt(i));
}

function describe(e: unknown): string {
  if (e instanceof DiscordApiError) {
    const d = e.body as { message?: string; errors?: unknown } | null;
    return d?.message ?? e.message;
  }
  return e instanceof Error ? e.message : String(e);
}

export async function runSetup(o: SetupOptions): Promise<SetupReport> {
  const { rest, store, guildId: g, brand } = o;
  const dry = !!o.dryRun;
  const report: SetupReport = { dryRun: dry, changes: [], manual: [], unchanged: 0 };
  const stored = await store.all();
  let fakeId = 0;
  /** A change: recorded always, performed only outside a dry run. */
  async function change<T>(what: string, fn: () => Promise<T>, dryValue: T): Promise<T> {
    report.changes.push(what);
    if (dry) return dryValue;
    try {
      return await fn();
    } catch (e) {
      // A refused change wasn't made; the caller reports it as a by-hand step if it can't recover.
      report.changes.splice(report.changes.lastIndexOf(what), 1);
      throw e;
    }
  }
  async function remember(key: string, kind: string, item: StoredItem) {
    stored.set(key, item);
    if (!dry) await store.set(key, kind, item);
  }

  const [me, guild, roles, channels] = await Promise.all([
    rest.get<APIUser>('/users/@me'),
    rest.get<APIGuild>(`/guilds/${g}`),
    rest.get<APIRole[]>(`/guilds/${g}/roles`),
    rest.get<APIChannel[]>(`/guilds/${g}/channels`),
  ]);
  const member = await rest.get<APIGuildMember>(`/guilds/${g}/members/${me.id}`);
  const everyone = roles.find((r) => r.id === g)!;
  const botRoles = roles.filter((r) => member.roles.includes(r.id));
  const botPerms = [everyone, ...botRoles].reduce((a, r) => a | BigInt(r.permissions), 0n);
  const botTop = Math.max(0, ...botRoles.map((r) => r.position));
  const isAdmin = (botPerms & P.Administrator) === P.Administrator;
  const can = (bits: bigint) => isAdmin || (botPerms & bits) === bits;

  // ---- @everyone: no View Channels at server level ----
  const everyoneWanted = sumPermissions(EVERYONE_PERMISSIONS);
  if (BigInt(everyone.permissions) !== everyoneWanted) {
    await change('Set @everyone permissions (no View Channels at server level)', () => rest.patch(`/guilds/${g}/roles/${g}`, { permissions: String(everyoneWanted) }, { reason: 'Blueprint setup' }), null);
  } else report.unchanged++;

  // ---- Roles ----
  const roleIds: Partial<Record<RoleKey, string>> = {};
  const byId = new Map(roles.map((r) => [r.id, r]));
  for (const def of ROLES) {
    const wanted = sumPermissions(def.permissions);
    const grantable = isAdmin ? wanted : wanted & botPerms;
    if (grantable !== wanted) report.manual.push(`Give the ${def.name} role the permissions the bot couldn't (it lacks them): re-invite the bot with the README link, then run setup again.`);
    const existing = byId.get(stored.get(`role:${def.key}`)?.discordId ?? '');
    // Keep Administrator if a person ticked it on Owner or Co-Owner.
    const keepAdmin = existing && def.byHand ? BigInt(existing.permissions) & P.Administrator : 0n;
    const body = { name: def.name, color: def.color ? tokenColor(def.color) : 0, hoist: def.hoist, mentionable: !!def.mentionable, permissions: String(grantable | keepAdmin) };
    if (!existing) {
      const r = await change(`Create role ${def.name}`, () => rest.post<APIRole>(`/guilds/${g}/roles`, body, { reason: 'Blueprint setup' }), { id: `dry-${++fakeId}` } as APIRole);
      roleIds[def.key] = r.id;
      await remember(`role:${def.key}`, 'role', { discordId: r.id });
    } else {
      roleIds[def.key] = existing.id;
      const same = existing.name === body.name && existing.color === body.color && existing.hoist === body.hoist && existing.mentionable === body.mentionable && existing.permissions === body.permissions;
      if (!same) await change(`Update role ${def.name}`, () => rest.patch(`/guilds/${g}/roles/${existing.id}`, body, { reason: 'Blueprint setup' }), null);
      else report.unchanged++;
    }
    if (def.byHand && !keepAdmin) report.manual.push(`Server Settings → Roles → ${def.name}: turn on ${def.byHand}. (Bots can't grant it.)`);
  }

  // ---- Role order: blueprint order, directly under the bot's role ----
  const ordered = ROLES.map((d) => roleIds[d.key]!).filter((id) => !id.startsWith('dry-'));
  if (botTop - ROLES.length < 1) {
    report.manual.push("Server Settings → Roles: drag the bot's role to the very top (above Owner), then run setup again so it can order the roles.");
  } else if (ordered.length) {
    const positions = ordered.map((id, i) => ({ id, position: botTop - 1 - i }));
    const current = positions.every((p) => byId.get(p.id)?.position === p.position);
    if (!current) {
      await change('Re-order roles to match the blueprint', () => rest.patch(`/guilds/${g}/roles`, positions, { reason: 'Blueprint setup' }), null).catch((e) => {
        report.manual.push(`Couldn't re-order roles (${describe(e)}). Drag them into the blueprint order by hand.`);
      });
    } else report.unchanged++;
  }

  // ---- Categories ----
  const channelById = new Map(channels.map((c) => [c.id, c]));
  const categoryIds: Record<string, string> = {};
  for (const [i, name] of CATEGORIES.entries()) {
    const key = `category:${name}`;
    const existing = channelById.get(stored.get(key)?.discordId ?? '');
    const overwrites = [
      { id: g, type: OverwriteType.Role, allow: '0', deny: String(P.ViewChannel) },
      { id: me.id, type: OverwriteType.Member, allow: String(BOT_IN_CHANNEL), deny: '0' },
    ];
    if (!existing) {
      const c = await change(`Create category ${name}`, () => rest.post<APIChannel>(`/guilds/${g}/channels`, { name, type: ChannelType.GuildCategory, position: i, permission_overwrites: overwrites }, { reason: 'Blueprint setup' }), { id: `dry-${++fakeId}` } as APIChannel);
      categoryIds[name] = c.id;
      await remember(key, 'category', { discordId: c.id });
    } else {
      categoryIds[name] = existing.id;
      const ex = existing as APIChannel & { name: string; permission_overwrites?: APIOverwrite[] };
      if (ex.name !== name || norm(ex.permission_overwrites) !== norm(overwrites)) await change(`Update category ${name}`, () => rest.patch(`/channels/${existing.id}`, { name, permission_overwrites: overwrites }), null);
      else report.unchanged++;
    }
  }

  // ---- Channels. Announcement and forum channels need Community, so they come after it's switched on. ----
  const channelIds: Record<string, string> = {};
  async function ensureChannel(def: ChannelDef, asType: ChannelType) {
    const key = `channel:${def.key}`;
    const existing = channelById.get(stored.get(key)?.discordId ?? '') as (APIChannel & { name: string; parent_id?: string | null; permission_overwrites?: APIOverwrite[]; type: ChannelType }) | undefined;
    const overwrites = channelOverwrites(def, roleIds, g, me.id);
    const body = { name: def.name, type: asType, parent_id: categoryIds[def.category], permission_overwrites: overwrites, position: CHANNELS.indexOf(def) };
    if (!existing) {
      const c = await change(`Create #${def.name}`, () => rest.post<APIChannel>(`/guilds/${g}/channels`, body, { reason: 'Blueprint setup' }), { id: `dry-${++fakeId}` } as APIChannel);
      channelIds[def.key] = c.id;
      await remember(key, 'channel', { discordId: c.id });
      return;
    }
    channelIds[def.key] = existing.id;
    const patch: Record<string, unknown> = {};
    if (existing.name !== def.name) patch.name = def.name;
    if (existing.parent_id !== body.parent_id) patch.parent_id = body.parent_id;
    if (norm(existing.permission_overwrites) !== norm(overwrites)) patch.permission_overwrites = overwrites;
    // Text ↔ announcement can be converted in place; anything else is left alone and reported.
    if (existing.type !== asType) {
      const convertible = [ChannelType.GuildText, ChannelType.GuildAnnouncement];
      if (convertible.includes(existing.type) && convertible.includes(asType)) patch.type = asType;
      else report.manual.push(`#${def.name} should be a ${def.kind} channel. Discord can't convert it: delete it and run setup again to recreate it.`);
    }
    if (Object.keys(patch).length) await change(`Update #${def.name} (${Object.keys(patch).join(', ')})`, () => rest.patch(`/channels/${existing.id}`, patch, { reason: 'Blueprint setup' }), null);
    else report.unchanged++;
  }
  const needsCommunity = (d: ChannelDef) => d.kind === 'announcement' || d.kind === 'forum';
  for (const def of CHANNELS.filter((d) => !needsCommunity(d))) await ensureChannel(def, CHANNEL_TYPE[def.kind]);

  // ---- Server settings and Community ----
  const hasCommunity = guild.features.includes('COMMUNITY' as never);
  const settings: Record<string, unknown> = {};
  if (guild.name !== SERVER.name) settings.name = SERVER.name;
  if (guild.verification_level !== SERVER.verificationLevel) settings.verification_level = SERVER.verificationLevel;
  if (guild.explicit_content_filter !== SERVER.explicitContentFilter) settings.explicit_content_filter = SERVER.explicitContentFilter;
  if (guild.default_message_notifications !== SERVER.defaultNotifications) settings.default_message_notifications = SERVER.defaultNotifications;
  if (guild.rules_channel_id !== channelIds[SERVER.rulesChannel]) settings.rules_channel_id = channelIds[SERVER.rulesChannel];
  if (guild.public_updates_channel_id !== channelIds[SERVER.updatesChannel]) settings.public_updates_channel_id = channelIds[SERVER.updatesChannel];
  if (!hasCommunity) settings.features = [...guild.features, 'COMMUNITY'];
  let iconHash: string | null = null;
  if (o.icon) {
    const h = digest(Buffer.from(o.icon).toString('base64'));
    if (stored.get('setting:icon')?.hash !== h || !guild.icon) {
      settings.icon = `data:image/png;base64,${Buffer.from(o.icon).toString('base64')}`;
      iconHash = h;
    }
  }
  let communityOn = hasCommunity;
  if (Object.keys(settings).length) {
    if (!can(P.ManageGuild)) report.manual.push('The bot lacks Manage Server, so server settings, Community, AutoMod and onboarding were skipped. Re-invite it with the README link.');
    else {
      try {
        await change(`Update server settings (${Object.keys(settings).join(', ')})`, () => rest.patch(`/guilds/${g}`, settings, { reason: 'Blueprint setup' }), null);
        communityOn = true;
        if (iconHash) await remember('setting:icon', 'setting', { discordId: g, hash: iconHash });
      } catch (e) {
        report.manual.push(`Discord refused some server settings (${describe(e)}). Set them in Server Settings: verification Medium, explicit content filter for all members, notifications "Only @mentions", then Enable Community with #rules and #staff-announcements.`);
      }
    }
  } else report.unchanged++;

  for (const def of CHANNELS.filter(needsCommunity)) {
    if (communityOn) await ensureChannel(def, CHANNEL_TYPE[def.kind]);
    else {
      await ensureChannel(def, ChannelType.GuildText);
      report.manual.push(`#${def.name} was made a text channel because Community is off. After enabling Community, run setup again.`);
    }
  }

  // ---- Panels and messages, edited in place ----
  for (const def of MESSAGES) {
    const channel = channelIds[def.channel];
    const payload = resolveMentions(def.build(brand), channelIds);
    const hash = digest(payload);
    const key = `message:${def.key}`;
    const prev = stored.get(key);
    if (prev && prev.parentId === channel && prev.hash === hash) {
      report.unchanged++;
      continue;
    }
    let messageId = prev && prev.parentId === channel ? prev.discordId : undefined;
    if (messageId) {
      try {
        await change(`Edit the ${def.key} message`, () => rest.patch(`/channels/${channel}/messages/${messageId}`, payload), null);
      } catch (e) {
        if (!(e instanceof DiscordApiError && e.status === 404)) throw e;
        messageId = undefined;
      }
    }
    if (!messageId) {
      const m = await change(`Post the ${def.key} message in #${def.channel}`, () => rest.post<APIMessage>(`/channels/${channel}/messages`, payload), { id: `dry-${++fakeId}` } as APIMessage);
      messageId = m.id;
      if (def.pin) await change(`Pin the ${def.key} message`, () => rest.put(`/channels/${channel}/pins/${m.id}`), null);
    }
    await remember(key, 'message', { discordId: messageId, parentId: channel, hash });
  }

  // ---- FAQ forum posts ----
  const forum = channelIds.faq;
  if (communityOn) {
    for (const f of FAQ) {
      const key = `faq:${f.key}`;
      const payload = { embeds: [faqEmbed(brand, f)] };
      const hash = digest({ name: f.title, payload });
      const prev = stored.get(key);
      if (prev?.hash === hash && prev.parentId === forum) {
        report.unchanged++;
        continue;
      }
      if (prev && prev.parentId === forum) {
        try {
          await change(`Edit FAQ post "${f.title}"`, async () => {
            await rest.patch(`/channels/${prev.discordId}`, { name: f.title });
            await rest.patch(`/channels/${prev.discordId}/messages/${prev.discordId}`, payload);
          }, undefined);
          await remember(key, 'faq', { discordId: prev.discordId, parentId: forum, hash });
          continue;
        } catch (e) {
          if (!(e instanceof DiscordApiError && e.status === 404)) throw e;
        }
      }
      const t = await change(`Create FAQ post "${f.title}"`, () => rest.post<APIChannel>(`/channels/${forum}/threads`, { name: f.title, message: payload }), { id: `dry-${++fakeId}` } as APIChannel);
      await remember(key, 'faq', { discordId: t.id, parentId: forum, hash });
    }
  }

  // ---- AutoMod ----
  if (can(P.ManageGuild)) {
    const alert = { type: 2, metadata: { channel_id: channelIds[SERVER.automod.alertChannel] } };
    const block = { type: 1, metadata: { custom_message: 'Blocked by the server rules.' } };
    const rules = [
      { key: 'mentions', name: 'JR · Mass mentions', trigger_type: 5, trigger_metadata: { mention_total_limit: SERVER.automod.mentionLimit, mention_raid_protection_enabled: true }, exempt_channels: [] as string[] },
      { key: 'slurs', name: 'JR · Slurs', trigger_type: 4, trigger_metadata: { presets: [3] }, exempt_channels: [] as string[] },
      { key: 'invites', name: 'JR · Invite links', trigger_type: 1, trigger_metadata: { regex_patterns: ['discord(?:\\.gg|(?:app)?\\.com/invite)/\\S+'] }, exempt_channels: [channelIds[SERVER.automod.invitesExemptChannel]!] },
    ];
    for (const r of rules) {
      const key = `automod:${r.key}`;
      const body = { name: r.name, event_type: 1, trigger_type: r.trigger_type, trigger_metadata: r.trigger_metadata, actions: [block, alert], enabled: true, exempt_channels: r.exempt_channels };
      const hash = digest(body);
      const prev = stored.get(key);
      if (prev?.hash === hash) {
        report.unchanged++;
        continue;
      }
      try {
        if (prev) {
          const { trigger_type: _t, ...patch } = body;
          void _t;
          await change(`Update AutoMod rule ${r.name}`, () => rest.patch(`/guilds/${g}/auto-moderation/rules/${prev.discordId}`, patch), null);
          await remember(key, 'automod', { discordId: prev.discordId, hash });
        } else {
          const made = await change(`Create AutoMod rule ${r.name}`, () => rest.post<{ id: string }>(`/guilds/${g}/auto-moderation/rules`, body), { id: `dry-${++fakeId}` });
          await remember(key, 'automod', { discordId: made.id, hash });
        }
      } catch (e) {
        report.manual.push(`AutoMod rule "${r.name}" was refused (${describe(e)}). Add it in Server Settings → AutoMod, alerting #bot-log.`);
      }
    }

    // ---- Onboarding (Discord asks for more default channels than the blueprint lists; report if refused) ----
    if (communityOn) {
      const onboarding = {
        enabled: true,
        mode: 0,
        default_channel_ids: SERVER.onboarding.defaultChannels.map((k) => channelIds[k]).filter(Boolean),
        prompts: SERVER.onboarding.prompts.map((p, i) => ({
          id: snowflake(i * 10),
          type: 0,
          title: p.title,
          single_select: false,
          required: false,
          in_onboarding: true,
          options: p.options.map((opt, j) => ({ id: snowflake(i * 10 + j + 1), title: opt.title, role_ids: 'role' in opt && opt.role ? [roleIds[opt.role]] : [], channel_ids: [] })),
        })),
      };
      const hash = digest({ ...onboarding, prompts: onboarding.prompts.map((p) => ({ ...p, id: 0, options: p.options.map((x) => ({ ...x, id: 0 })) })) });
      if (stored.get('setting:onboarding')?.hash !== hash) {
        try {
          await change('Set up onboarding questions', () => rest.put(`/guilds/${g}/onboarding`, onboarding, { reason: 'Blueprint setup' }), null);
          await remember('setting:onboarding', 'setting', { discordId: g, hash });
        } catch (e) {
          report.manual.push(
            `Onboarding was refused (${describe(e)}). In Server Settings → Onboarding: default channels #welcome, #announcements, #new-listings, #open-a-ticket, #general (Discord may ask for more), question "What brings you here?" (Buying, Selling, Renting, Business, Just looking) and "Want pings?" (New listings → Notifications: Listings, Announcements → Notifications: Announcements).`,
          );
        }
      } else report.unchanged++;
    }
  }

  report.manual.push('Server Settings → Safety Setup: require 2FA for moderator actions (only the server owner can turn this on).');
  report.manual = [...new Set(report.manual)];

  // ---- Summary in #bot-log ----
  if (!dry && channelIds['bot-log']) {
    const summary = {
      embeds: [
        {
          author: author(brand),
          color: SUMMARY_COLOR(),
          title: 'Server setup finished',
          description: report.changes.length ? report.changes.slice(0, 25).map((c) => `· ${c}`).join('\n') + (report.changes.length > 25 ? `\n…and ${report.changes.length - 25} more` : '') : 'Everything already matched the blueprint.',
          fields: report.manual.length ? [{ name: 'To do by hand', value: report.manual.map((m) => `· ${m}`).join('\n').slice(0, 1024) }] : [],
          footer: { text: `${report.unchanged} already up to date` },
          timestamp: new Date().toISOString(),
        },
      ],
    };
    await rest.post(`/channels/${channelIds['bot-log']}/messages`, summary).catch(() => undefined);
  }
  return report;
}

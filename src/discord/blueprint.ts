// The Discord server as data, written from discord/discord-blueprint.md (the source of truth). `npm run
// discord:setup` makes the server match this. Message wording is the blueprint's; brokerage facts that live in
// site settings (name, Chirper handle, CivOps line, site address) are filled in from there.
import { ButtonStyle, ChannelType, ComponentType, PermissionFlagsBits as P } from 'discord-api-types/v10';
import type { APIActionRowComponent, APIButtonComponent, APIEmbed } from 'discord-api-types/v10';
import { author, EMBED_COLOR, link, tokenColor, type BrandContext } from './brand';

// ---- Roles ----

export type RoleKey = 'owner' | 'coOwner' | 'management' | 'seniorAgent' | 'agent' | 'traineeAgent' | 'client' | 'verified' | 'partner' | 'pingListings' | 'pingAnnouncements';

export interface RoleDef {
  key: RoleKey;
  name: string;
  /** Design token name; none = Discord's default grey. */
  color?: string;
  hoist: boolean;
  /** Permissions on top of @everyone's. */
  permissions: bigint[];
  /** Ping roles the bot mentions in posts. */
  mentionable?: boolean;
  /** Permissions only a person can grant (the bot never has them); printed as a by-hand step. */
  byHand?: string;
}

/** Top to bottom. The bot's own role (from its invite) sits above all of these. */
export const ROLES: RoleDef[] = [
  { key: 'owner', name: 'Owner', color: 'brass-500', hoist: true, permissions: [], byHand: 'Administrator' },
  { key: 'coOwner', name: 'Co-Owner', color: 'brass-300', hoist: true, permissions: [], byHand: 'Administrator' },
  { key: 'management', name: 'Management', color: 'green-300', hoist: true, permissions: [P.ManageMessages, P.ManageThreads, P.ModerateMembers, P.KickMembers, P.ManageRoles, P.ViewAuditLog, P.ManageNicknames] },
  { key: 'seniorAgent', name: 'Senior Agent', color: 'green-700', hoist: true, permissions: [] },
  { key: 'agent', name: 'Agent', color: 'green-800', hoist: true, permissions: [] },
  { key: 'traineeAgent', name: 'Trainee Agent', color: 'line-strong', hoist: true, permissions: [] },
  { key: 'client', name: 'Client', color: 'cream', hoist: true, permissions: [] },
  { key: 'verified', name: 'Verified', hoist: false, permissions: [] },
  { key: 'partner', name: 'Partner', color: 'brass-700', hoist: false, permissions: [] },
  { key: 'pingListings', name: 'Notifications: Listings', hoist: false, permissions: [] },
  { key: 'pingAnnouncements', name: 'Notifications: Announcements', hoist: false, permissions: [] },
];

/**
 * @everyone keeps Discord's usual member permissions but not View Channels: every channel grants its own access.
 * (Trainee's colour in the blueprint is the dark-mode value of the line-strong token.)
 */
export const EVERYONE_PERMISSIONS: bigint[] = [
  P.CreateInstantInvite, P.ChangeNickname, P.SendMessages, P.SendMessagesInThreads, P.CreatePublicThreads, P.EmbedLinks, P.AttachFiles,
  P.AddReactions, P.UseExternalEmojis, P.UseExternalStickers, P.ReadMessageHistory, P.UseApplicationCommands, P.Connect, P.Speak, P.Stream, P.UseVAD,
];

/** What the bot's invite asks for: what it does itself, plus what it hands to roles and channels. Never Administrator. */
export const BOT_PERMISSIONS: bigint[] = [
  P.ViewChannel, P.SendMessages, P.SendMessagesInThreads, P.CreatePublicThreads, P.CreatePrivateThreads, P.EmbedLinks, P.AttachFiles, P.ReadMessageHistory,
  P.AddReactions, P.UseExternalEmojis, P.MentionEveryone, P.ManageMessages, P.ManageThreads, P.ManageChannels, P.ManageRoles, P.ManageGuild,
  P.ModerateMembers, P.KickMembers, P.ViewAuditLog, P.ManageNicknames, P.ChangeNickname, P.CreateInstantInvite, P.UseApplicationCommands,
  P.UseExternalStickers, P.Connect, P.Speak, P.Stream, P.UseVAD,
];

export const sumPermissions = (ps: bigint[]) => ps.reduce((a, b) => a | b, 0n);

// ---- Who can see / post ----

export type Audience = 'everyone' | 'verified' | 'staff' | 'agentPlus' | 'seniorPlus' | 'management' | 'clientStaff' | 'client' | 'owner' | 'bot';

const STAFF: RoleKey[] = ['traineeAgent', 'agent', 'seniorAgent', 'management', 'coOwner', 'owner'];

/** The roles behind each audience. "everyone" and "bot" are handled by @everyone and the bot's own overwrite. */
export function audienceRoles(a: Audience): RoleKey[] {
  switch (a) {
    case 'everyone':
    case 'bot':
      return [];
    case 'verified':
      return ['verified', 'client', 'partner', ...STAFF];
    case 'staff':
      return STAFF;
    case 'agentPlus':
      return ['agent', 'seniorAgent', 'management', 'coOwner', 'owner'];
    case 'seniorPlus':
      return ['seniorAgent', 'management', 'coOwner', 'owner'];
    case 'management':
      return ['management', 'coOwner', 'owner'];
    case 'clientStaff':
      return ['client', ...STAFF];
    case 'client':
      return ['client'];
    case 'owner':
      return ['owner'];
  }
}

// ---- Categories and channels ----

export type ChannelKind = 'text' | 'announcement' | 'forum' | 'voice';

export interface ChannelDef {
  key: string;
  name: string;
  category: string;
  kind: ChannelKind;
  view: Audience;
  /** Who can post (start threads, for a forum). Empty = only the bot. */
  post: Audience[];
  /** Forums: who can reply inside posts. */
  reply?: Audience;
  topic?: string;
}

export const CATEGORIES = ['FRONT DESK', 'PROPERTIES', 'HELP DESK', 'COMMUNITY', 'CLIENT LOUNGE', 'STAFF', 'MANAGEMENT'] as const;

export const CHANNELS: ChannelDef[] = [
  { key: 'welcome', name: 'welcome', category: 'FRONT DESK', kind: 'text', view: 'everyone', post: ['owner'] },
  { key: 'rules', name: 'rules', category: 'FRONT DESK', kind: 'text', view: 'everyone', post: ['owner'] },
  { key: 'verify', name: 'verify', category: 'FRONT DESK', kind: 'text', view: 'everyone', post: [] },
  { key: 'announcements', name: 'announcements', category: 'FRONT DESK', kind: 'announcement', view: 'verified', post: ['management'] },
  { key: 'about-us', name: 'about-us', category: 'FRONT DESK', kind: 'text', view: 'verified', post: ['owner'] },
  { key: 'get-roles', name: 'get-roles', category: 'FRONT DESK', kind: 'text', view: 'verified', post: [] },
  { key: 'new-listings', name: 'new-listings', category: 'PROPERTIES', kind: 'announcement', view: 'verified', post: [] },
  { key: 'for-rent', name: 'for-rent', category: 'PROPERTIES', kind: 'text', view: 'verified', post: [] },
  { key: 'businesses-for-sale', name: 'businesses-for-sale', category: 'PROPERTIES', kind: 'text', view: 'verified', post: [] },
  { key: 'sold', name: 'sold', category: 'PROPERTIES', kind: 'text', view: 'verified', post: [] },
  { key: 'property-map', name: 'property-map', category: 'PROPERTIES', kind: 'text', view: 'verified', post: [] },
  { key: 'open-houses', name: 'open-houses', category: 'PROPERTIES', kind: 'text', view: 'verified', post: ['agentPlus'] },
  { key: 'open-a-ticket', name: 'open-a-ticket', category: 'HELP DESK', kind: 'text', view: 'verified', post: [] },
  { key: 'faq', name: 'faq', category: 'HELP DESK', kind: 'forum', view: 'verified', post: ['staff'], reply: 'verified' },
  { key: 'general', name: 'general', category: 'COMMUNITY', kind: 'text', view: 'verified', post: ['verified'] },
  { key: 'in-game-photos', name: 'in-game-photos', category: 'COMMUNITY', kind: 'text', view: 'verified', post: ['verified'] },
  { key: 'reviews', name: 'reviews', category: 'COMMUNITY', kind: 'text', view: 'verified', post: ['client'] },
  { key: 'partners', name: 'partners', category: 'COMMUNITY', kind: 'text', view: 'verified', post: ['management'] },
  { key: 'client-lounge', name: 'client-lounge', category: 'CLIENT LOUNGE', kind: 'text', view: 'clientStaff', post: ['clientStaff'] },
  { key: 'staff-announcements', name: 'staff-announcements', category: 'STAFF', kind: 'text', view: 'staff', post: ['management'] },
  { key: 'staff-chat', name: 'staff-chat', category: 'STAFF', kind: 'text', view: 'staff', post: ['staff'] },
  { key: 'listing-review', name: 'listing-review', category: 'STAFF', kind: 'text', view: 'management', post: ['management'] },
  { key: 'deal-board', name: 'deal-board', category: 'STAFF', kind: 'text', view: 'staff', post: [] },
  { key: 'shifts', name: 'shifts', category: 'STAFF', kind: 'text', view: 'staff', post: ['staff'] },
  { key: 'training', name: 'training', category: 'STAFF', kind: 'forum', view: 'staff', post: ['seniorPlus'], reply: 'staff' },
  { key: 'staff-meeting', name: 'Staff Meeting', category: 'STAFF', kind: 'voice', view: 'staff', post: ['staff'] },
  { key: 'management', name: 'management', category: 'MANAGEMENT', kind: 'text', view: 'management', post: ['management'] },
  { key: 'applications', name: 'applications', category: 'MANAGEMENT', kind: 'text', view: 'management', post: ['management'] },
  { key: 'ticket-transcripts', name: 'ticket-transcripts', category: 'MANAGEMENT', kind: 'text', view: 'management', post: [] },
  { key: 'bot-log', name: 'bot-log', category: 'MANAGEMENT', kind: 'text', view: 'management', post: [] },
];

/** Senior Agents get Manage Messages in the channels staff use (blueprint: "set per channel"). */
export const SENIOR_MANAGE_IN = new Set(['general', 'in-game-photos', 'reviews', 'client-lounge', 'staff-chat', 'shifts', 'training', 'open-houses']);

export const CHANNEL_TYPE: Record<ChannelKind, ChannelType> = {
  text: ChannelType.GuildText,
  announcement: ChannelType.GuildAnnouncement,
  forum: ChannelType.GuildForum,
  voice: ChannelType.GuildVoice,
};

// ---- Panels and messages ----

export const CUSTOM_ID = {
  verify: 'jr:verify',
  role: (r: 'listings' | 'announcements') => `jr:role:${r}`,
  ticket: (t: TicketType) => `jr:ticket:${t}`,
  shiftIn: 'jr:shift:in',
  shiftOut: 'jr:shift:out',
} as const;

export type TicketType = 'buy' | 'rent' | 'sell' | 'business' | 'general' | 'complaint';
export const TICKET_TYPES: { type: TicketType; label: string; style: ButtonStyle.Primary | ButtonStyle.Secondary | ButtonStyle.Danger }[] = [
  { type: 'buy', label: 'Buy', style: ButtonStyle.Primary },
  { type: 'rent', label: 'Rent', style: ButtonStyle.Primary },
  { type: 'sell', label: 'Sell', style: ButtonStyle.Primary },
  { type: 'business', label: 'Business', style: ButtonStyle.Primary },
  { type: 'general', label: 'General', style: ButtonStyle.Secondary },
  { type: 'complaint', label: 'Complaint', style: ButtonStyle.Danger },
];

export interface MessageDef {
  key: string;
  channel: string;
  pin?: boolean;
  build: (b: BrandContext) => { embeds: APIEmbed[]; components?: APIActionRowComponent<APIButtonComponent>[] };
}

const linkButton = (label: string, url: string): APIButtonComponent => ({ type: ComponentType.Button, style: ButtonStyle.Link, label, url });
type ActionStyle = ButtonStyle.Primary | ButtonStyle.Secondary | ButtonStyle.Success | ButtonStyle.Danger;
const button = (label: string, custom_id: string, style: ActionStyle): APIButtonComponent => ({ type: ComponentType.Button, style, label, custom_id });
const row = (...components: APIButtonComponent[]): APIActionRowComponent<APIButtonComponent> => ({ type: ComponentType.ActionRow, components });

function base(b: BrandContext, e: APIEmbed): APIEmbed {
  return { author: author(b), color: EMBED_COLOR.default(), ...e };
}

function chirperFooter(b: BrandContext): string {
  return [b.chirperHandle ? `Chirper @${b.chirperHandle}` : null, b.civopsLine || 'Registered PARP Civilian Operations business'].filter(Boolean).join(' · ');
}

export const MESSAGES: MessageDef[] = [
  {
    key: 'welcome',
    channel: 'welcome',
    build: (b) => ({
      embeds: [
        base(b, {
          title: `Welcome to ${b.brokerageName}`,
          color: EMBED_COLOR.listing(),
          description: [
            'Independent real estate brokerage on PARP, serving all of Dauphin County: Harrisburg, Swatara Township and Susquehanna Township.',
            'We help you **buy**, **sell**, **rent** and **list businesses**, from first viewing to keys in hand.',
            '',
            '**Start here**',
            '1. Read <#rules>',
            '2. Verify in <#verify>',
            '3. Browse <#new-listings> or the website',
            '4. Ready to move? Open a ticket in <#open-a-ticket>',
          ].join('\n'),
          footer: { text: chirperFooter(b) },
        }),
      ],
      components: [row(linkButton('Visit the website', link(b, '/')), linkButton('Browse listings', link(b, '/buy')), linkButton('List your property', link(b, '/account/listings/new')))],
    }),
  },
  {
    key: 'rules',
    channel: 'rules',
    build: (b) => ({
      embeds: [
        base(b, {
          title: 'Server rules',
          description: [
            '1. **Respect everyone.** No harassment, hate speech, slurs or personal attacks.',
            "2. **Follow Discord's Terms of Service and PARP's rules**, including CivOps rules.",
            "3. **Keep it in the right channel.** Property questions go in a ticket, not <#general>.",
            '4. **No advertising** other servers or businesses outside <#partners> without permission.',
            '5. **No spam**, mass pings or begging for discounts.',
            '6. **Deals happen through tickets and the website.** Staff will never ask for payment through DMs.',
            '7. **RP stays RP.** Prices, contracts and properties are in-game only. Never share real personal information.',
            '8. **Staff decisions are final.** Disagree respectfully through a Complaint ticket.',
          ].join('\n'),
          footer: { text: 'Breaking these may lead to a warning, a timeout or a ban.' },
        }),
      ],
    }),
  },
  {
    key: 'verify',
    channel: 'verify',
    build: (b) => ({
      embeds: [base(b, { title: 'Verify', description: 'Press the button below to get access to the rest of the server.' })],
      components: [row(button('Verify', CUSTOM_ID.verify, ButtonStyle.Success))],
    }),
  },
  {
    key: 'about-us',
    channel: 'about-us',
    build: (b) => ({
      embeds: [
        base(b, {
          title: `About ${b.brokerageName}`,
          description: [
            `Founded by Hameed Johnson, ${b.brokerageName} is a full-service brokerage on PARP. Every listing is checked and approved before it goes live, every client gets a named agent, and every deal is backed by proper paperwork.`,
            '',
            '**What we do**',
            '· Homes for sale across Dauphin County',
            '· Rentals with clear lease terms',
            '· Business sales, with names kept private until you’re serious',
            '· Free valuations if you want to sell',
          ].join('\n'),
        }),
        base(b, {
          title: 'How it works',
          description: [
            '1. Tell us what you want in a ticket or on the website',
            '2. Book a showing with your agent',
            '3. Make an offer, and we handle the documents',
            '4. Sign, settle and take your keys',
          ].join('\n'),
        }),
      ],
      components: [row(linkButton('Website', link(b, '/')), linkButton('List your property', link(b, '/account/listings/new')))],
    }),
  },
  {
    key: 'get-roles',
    channel: 'get-roles',
    build: (b) => ({
      embeds: [base(b, { title: 'Pick your pings', description: 'Toggle the pings you want. Press again to turn one off.' })],
      components: [row(button('New listings', CUSTOM_ID.role('listings'), ButtonStyle.Secondary), button('Announcements', CUSTOM_ID.role('announcements'), ButtonStyle.Secondary))],
    }),
  },
  {
    key: 'open-a-ticket',
    channel: 'open-a-ticket',
    build: (b) => ({
      embeds: [base(b, { title: 'Talk to an agent', description: 'Pick what you need and an agent will be with you shortly. Have your Roblox username ready, plus your budget or asking price.' })],
      components: [row(...TICKET_TYPES.slice(0, 4).map((t) => button(t.label, CUSTOM_ID.ticket(t.type), t.style))), row(...TICKET_TYPES.slice(4).map((t) => button(t.label, CUSTOM_ID.ticket(t.type), t.style)))],
    }),
  },
  {
    key: 'reviews',
    channel: 'reviews',
    pin: true,
    build: (b) => ({
      embeds: [base(b, { title: 'How reviews work', description: 'Bought, sold or rented with us? Leave one message here about how it went. Clients only, one review each, no edits after 24 hours. We never write or pay for reviews.' })],
    }),
  },
  {
    key: 'staff-guide',
    channel: 'staff-chat',
    pin: true,
    build: (b) => ({
      embeds: [
        base(b, {
          title: 'Agent basics',
          description: [
            '· Claim a ticket before replying, and close it with a summary when done.',
            '· Every listing goes through the website: Portal → Add listing, with at least 3 photos. It goes live only after the Owner approves it.',
            "· Never share a seller's bottom line, motivation or commission with a client. That stays in the portal.",
            '· Book showings through the website so they show up on the calendar.',
            '· Use the portal documents for every deal, and attach them to the client file.',
            '· Clock in and out in <#shifts>.',
            '· Professional at all times: you represent the brokerage in game and on Discord.',
          ].join('\n'),
        }),
      ],
      components: [row(linkButton('Open the portal', link(b, '/portal')))],
    }),
  },
  {
    key: 'shifts',
    channel: 'shifts',
    build: (b) => ({
      embeds: [base(b, { title: 'Shifts', description: 'Clock in when you start working and clock out when you finish. Your hours show in the portal.' })],
      components: [row(button('Clock in', CUSTOM_ID.shiftIn, ButtonStyle.Success), button('Clock out', CUSTOM_ID.shiftOut, ButtonStyle.Secondary))],
    }),
  },
  {
    key: 'property-map',
    channel: 'property-map',
    build: (b) => ({
      embeds: [base(b, { title: `${b.brokerageName} · Property map`, description: 'The live property map appears here and updates as listings change.' })],
      components: [row(linkButton('View the map on the website', link(b, '/buy?view=map')))],
    }),
  },
];

/** Channel mentions are written as <#key> above and swapped for real IDs at setup. */
export function resolveMentions<T>(payload: T, channelIds: Record<string, string>): T {
  return JSON.parse(JSON.stringify(payload).replace(/<#([a-z-]+)>/g, (m, k: string) => (channelIds[k] ? `<#${channelIds[k]}>` : `#${k}`))) as T;
}

// ---- FAQ forum posts ----

export const FAQ: { key: string; title: string; answer: string }[] = [
  { key: 'book-showing', title: 'How do I book a showing?', answer: 'Open a ticket or press "Book a showing" on the listing\'s page on the website.' },
  { key: 'list-own', title: 'Can I list my own property?', answer: 'Yes. Sign in on the website with Discord and use "List your property". The Owner reviews it before it goes live.' },
  { key: 'negotiable', title: 'Are prices negotiable?', answer: 'Make an offer through your agent. Every offer goes to the seller.' },
  { key: 'listed-by-owner', title: 'What does "Listed by Owner" mean?', answer: 'The property owner listed it themselves. You can still book a showing through the website.' },
  { key: 'become-agent', title: 'How do I become an agent?', answer: "Apply on the website's Careers page." },
];

export function faqEmbed(b: BrandContext, f: (typeof FAQ)[number]): APIEmbed {
  return base(b, { title: f.title, description: f.answer });
}

// ---- Server settings ----

export const SERVER = {
  name: "Johnson's Realty | PARP",
  iconFile: 'design-system/assets/Logos/jr-avatar-green.png',
  /** Discord: 2 = Medium, explicit content filter 2 = all members, default notifications 1 = only mentions. */
  verificationLevel: 2,
  explicitContentFilter: 2,
  defaultNotifications: 1,
  rulesChannel: 'rules',
  updatesChannel: 'staff-announcements',
  onboarding: {
    defaultChannels: ['welcome', 'announcements', 'new-listings', 'open-a-ticket', 'general'],
    prompts: [
      { title: 'What brings you here?', options: ['Buying', 'Selling', 'Renting', 'Business', 'Just looking'].map((o) => ({ title: o })) },
      {
        title: 'Want pings?',
        options: [
          { title: 'New listings', role: 'pingListings' as RoleKey },
          { title: 'Announcements', role: 'pingAnnouncements' as RoleKey },
        ],
      },
    ],
  },
  automod: {
    mentionLimit: 5,
    invitesExemptChannel: 'partners',
    alertChannel: 'bot-log',
  },
} as const;

export const SUMMARY_COLOR = () => tokenColor('green-900');

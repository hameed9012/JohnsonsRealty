// Guild slash commands: /listings, /listing, /agent, /map, /link. Registered by setup (bulk overwrite, so
// re-running setup keeps them in sync with this file).
import { and, asc, desc, eq, ilike, inArray, lte, or, sql } from 'drizzle-orm';
import { ApplicationCommandOptionType, ApplicationCommandType } from 'discord-api-types/v10';
import type { APIApplicationCommandAutocompleteInteraction, APIApplicationCommandOptionChoice, APIChatInputApplicationCommandInteraction, APIInteractionResponse, RESTPutAPIApplicationGuildCommandsJSONBody } from 'discord-api-types/v10';
import type { Executor } from '@/db/client';
import { agentProfiles, areas, listingPhotos, listings, media, saleAgents, users } from '@/db/schema';
import { MARKET_STATUSES, PUBLIC_STATUSES } from '@/lib/listing-status';
import { publicImageUrl } from '@/lib/storage';
import { link, type BrandContext } from './brand';
import { agentCardMessage, compactListingEmbed, type DiscordMessage, type ListingEmbedData, listingMessage } from './embeds';

export const COMMANDS: RESTPutAPIApplicationGuildCommandsJSONBody = [
  {
    name: 'listings',
    type: ApplicationCommandType.ChatInput,
    description: 'Find listings on the market',
    options: [
      { name: 'area', description: 'Town or neighbourhood', type: ApplicationCommandOptionType.String, autocomplete: true },
      {
        name: 'type',
        description: 'What kind of property',
        type: ApplicationCommandOptionType.String,
        choices: [
          { name: 'Homes for sale', value: 'sale' },
          { name: 'Rentals', value: 'rent' },
          { name: 'Businesses', value: 'business' },
          { name: 'Land', value: 'land' },
        ],
      },
      { name: 'max_price', description: 'Highest price (or rent per month)', type: ApplicationCommandOptionType.Integer, min_value: 0 },
    ],
  },
  { name: 'listing', type: ApplicationCommandType.ChatInput, description: 'Show one listing by its reference', options: [{ name: 'ref', description: 'Reference, e.g. JR-2026-00041', type: ApplicationCommandOptionType.String, required: true }] },
  { name: 'agent', type: ApplicationCommandType.ChatInput, description: 'Show an agent’s card', options: [{ name: 'name', description: 'Agent', type: ApplicationCommandOptionType.String, required: true, autocomplete: true }] },
  { name: 'map', type: ApplicationCommandType.ChatInput, description: 'The current property map' },
  { name: 'link', type: ApplicationCommandType.ChatInput, description: 'Link your Discord account to the website and sync your roles' },
];

type Opt = { name: string; value?: string | number | boolean; focused?: boolean };
const opt = (i: { data: { options?: Opt[] } }, name: string) => i.data.options?.find((o) => o.name === name)?.value;
const ephemeral = (data: DiscordMessage): APIInteractionResponse => ({ type: 4, data: { ...data, flags: 64 } });

const cover = sql<string | null>`(select ${media.storageId} from ${listingPhotos} join ${media} on ${media.id} = ${listingPhotos.mediaId} where ${listingPhotos.listingId} = ${listings.id} order by ${listingPhotos.isCover} desc, ${listingPhotos.sortOrder} asc limit 1)`;

type Row = { agentName: string | null; slug: string; refNo: string; addressLine: string; unit: string | null; type: string; purpose: string; source: string; price: number | null; beds: number | null; baths: number | null; description: string | null; areaName: string | null; cover: string | null };

function toEmbedData(r: Row, b: BrandContext): ListingEmbedData {
  return {
    kind: r.type === 'business' ? 'business' : r.purpose === 'rent' ? 'rent' : 'sale',
    title: [r.addressLine, r.unit ? `Unit ${r.unit}` : null].filter(Boolean).join(', ') || 'Address to be confirmed',
    slug: r.slug,
    description: r.description,
    coverUrl: r.cover ? publicImageUrl(r.cover, { width: 800 }) : null,
    price: r.price,
    beds: r.beds,
    baths: r.baths,
    areaName: r.areaName,
    postal: null,
    agentName: r.source === 'owner_submitted' ? null : (r.agentName ?? b.brokerageName),
    refNo: r.refNo,
  };
}

const COLUMNS = { agentName: agentProfiles.publicName, slug: listings.slug, refNo: listings.refNo, addressLine: listings.addressLine, unit: listings.unit, type: listings.type, purpose: listings.purpose, source: listings.source, price: listings.price, beds: listings.beds, baths: listings.baths, description: listings.description, areaName: areas.name, cover };

export async function listingsCommand(ex: Executor, b: BrandContext, i: APIChatInputApplicationCommandInteraction): Promise<APIInteractionResponse> {
  const area = opt(i as never, 'area') as string | undefined;
  const type = opt(i as never, 'type') as string | undefined;
  const max = opt(i as never, 'max_price') as number | undefined;
  const conds = [inArray(listings.status, [...MARKET_STATUSES]), eq(listings.photosHold, false), sql`${listings.type} <> 'business' or exists (select 1 from listing_business lb where lb.listing_id = ${listings.id} and lb.name_withheld = false)`];
  if (area) conds.push(sql`${listings.areaId} in (select id from ${areas} a where a.slug = ${area} or a.parent_id = (select id from ${areas} p where p.slug = ${area}))`);
  if (type === 'business') conds.push(eq(listings.type, 'business'));
  else if (type === 'land') conds.push(eq(listings.type, 'land'));
  else if (type === 'rent' || type === 'sale') conds.push(and(eq(listings.purpose, type), sql`${listings.type} <> 'business'`)!);
  if (max) conds.push(lte(listings.price, max));
  const rows = (await ex.select(COLUMNS).from(listings).leftJoin(areas, eq(areas.id, listings.areaId)).leftJoin(agentProfiles, eq(agentProfiles.userId, listings.listingAgentId)).where(and(...conds)).orderBy(desc(listings.publishedAt)).limit(5)) as Row[];
  if (!rows.length) return ephemeral({ content: `Nothing matches right now. See everything at ${link(b, '/buy')}` });
  return ephemeral({ embeds: rows.map((r) => compactListingEmbed(b, toEmbedData(r, b))) });
}

export async function listingCommand(ex: Executor, b: BrandContext, i: APIChatInputApplicationCommandInteraction): Promise<APIInteractionResponse> {
  const ref = String(opt(i as never, 'ref') ?? '').trim().toUpperCase();
  const [r] = (await ex.select(COLUMNS).from(listings).leftJoin(areas, eq(areas.id, listings.areaId)).leftJoin(agentProfiles, eq(agentProfiles.userId, listings.listingAgentId)).where(and(eq(listings.refNo, ref), inArray(listings.status, [...PUBLIC_STATUSES]), eq(listings.photosHold, false))).limit(1)) as Row[];
  if (!r) return ephemeral({ content: `No public listing has the reference ${ref}.` });
  const msg = listingMessage(b, toEmbedData(r, b));
  // The full listing embed, shown to the channel (no pings).
  return { type: 4, data: { ...msg, content: undefined, allowed_mentions: { parse: [] } } };
}

export async function agentCommand(ex: Executor, b: BrandContext, i: APIChatInputApplicationCommandInteraction): Promise<APIInteractionResponse> {
  const name = String(opt(i as never, 'name') ?? '');
  const a = await ex.query.agentProfiles.findFirst({ where: and(eq(agentProfiles.active, true), or(eq(agentProfiles.slug, name), ilike(agentProfiles.publicName, `%${name}%`))), with: { photo: true } });
  if (!a) return ephemeral({ content: `No agent called ${name}.` });
  const u = await ex.query.users.findFirst({ where: eq(users.id, a.userId), columns: { chirperHandle: true } });
  const [counts] = await ex
    .select({
      active: sql<number>`(select count(*)::int from ${listings} where ${listings.listingAgentId} = ${a.userId} and ${listings.status} in ('active','for_lease','under_offer','under_contract','coming_soon') and ${listings.photosHold} = false)`,
      sales: sql<number>`(select count(*)::int from ${saleAgents} where ${saleAgents.agentId} = ${a.userId})`,
    })
    .from(agentProfiles)
    .where(eq(agentProfiles.userId, a.userId));
  const photo = (a as { photo?: { storageId: string } | null }).photo;
  return { type: 4, data: agentCardMessage(b, { name: a.publicName, title: a.title, slug: a.slug, photoUrl: photo ? publicImageUrl(photo.storageId, { width: 256 }) : null, chirper: u?.chirperHandle ?? null, activeListings: counts?.active ?? 0, sales: counts?.sales ?? 0 }) };
}

export async function autocomplete(ex: Executor, i: APIApplicationCommandAutocompleteInteraction): Promise<APIInteractionResponse> {
  const focused = (i.data.options as Opt[] | undefined)?.find((o) => o.focused);
  const q = String(focused?.value ?? '').trim();
  let choices: APIApplicationCommandOptionChoice[] = [];
  if (i.data.name === 'listings' && focused?.name === 'area') {
    const rows = await ex.select({ name: areas.name, slug: areas.slug }).from(areas).where(q ? ilike(areas.name, `%${q}%`) : undefined).orderBy(asc(areas.displayOrder), asc(areas.name)).limit(25);
    choices = rows.map((r) => ({ name: r.name, value: r.slug }));
  } else if (i.data.name === 'agent') {
    const rows = await ex.select({ name: agentProfiles.publicName, slug: agentProfiles.slug }).from(agentProfiles).where(and(eq(agentProfiles.active, true), q ? ilike(agentProfiles.publicName, `%${q}%`) : undefined)).orderBy(asc(agentProfiles.displayOrder)).limit(25);
    choices = rows.map((r) => ({ name: r.name, value: r.slug }));
  }
  return { type: 8, data: { choices } };
}

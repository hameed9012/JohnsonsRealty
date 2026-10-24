// Every embed the bot posts, built from plain data (so they are snapshot-tested and previewed in the portal).
// Brand pattern (brief 1c): author line with the mark, colour strip by meaning, "Ref … · brokerage" footer,
// numbers formatted like the site, no emoji in titles, public image URLs only.
import { ButtonStyle, ComponentType } from 'discord-api-types/v10';
import type { APIActionRowComponent, APIButtonComponent, APIEmbed, APIEmbedField, RESTPostAPIChannelMessageJSONBody } from 'discord-api-types/v10';
import { money } from '@/lib/format';
import { author, EMBED_COLOR, link, type BrandContext } from './brand';

export type DiscordMessage = RESTPostAPIChannelMessageJSONBody;

type Row = APIActionRowComponent<APIButtonComponent>;
const linkBtn = (label: string, url: string): APIButtonComponent => ({ type: ComponentType.Button, style: ButtonStyle.Link, label, url });
const actionBtn = (label: string, custom_id: string, style: ButtonStyle.Primary | ButtonStyle.Secondary | ButtonStyle.Success | ButtonStyle.Danger, disabled = false): APIButtonComponent => ({
  type: ComponentType.Button,
  style,
  label,
  custom_id,
  disabled,
});
const row = (...c: APIButtonComponent[]): Row => ({ type: ComponentType.ActionRow, components: c });
const field = (name: string, value: string | null | undefined, inline = true): APIEmbedField[] => (value ? [{ name, value: value.slice(0, 1024), inline }] : []);
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
/** Discord's own timestamp markup, shown in each reader's time zone. */
const when = (d: Date, style: 'F' | 'f' | 't' | 'R' = 'F') => `<t:${Math.floor(d.getTime() / 1000)}:${style}>`;

function footer(b: BrandContext, ref?: string | null) {
  return { text: ref ? `Ref ${ref} · ${b.brokerageName}` : b.brokerageName };
}
function ping(roleId: string | null | undefined): Pick<DiscordMessage, 'content' | 'allowed_mentions'> {
  return roleId ? { content: `<@&${roleId}>`, allowed_mentions: { roles: [roleId], parse: [] } } : { allowed_mentions: { parse: [] } };
}

/** The first two sentences of a description, for listing embeds. */
export function summaryOf(description: string | null | undefined, sentences = 2): string {
  if (!description) return '';
  const flat = description.replace(/\s+/g, ' ').trim();
  const parts = flat.match(/[^.!?]+[.!?]+(\s|$)/g);
  return clip((parts ? parts.slice(0, sentences).join('') : flat).trim(), 350);
}

// ---- Listings ----

export interface ListingEmbedData {
  kind: 'sale' | 'rent' | 'business';
  /** Address, or the public teaser when a business name is withheld. */
  title: string;
  slug: string;
  description: string | null;
  coverUrl: string | null;
  price: number | null;
  beds: number | null;
  baths: number | null;
  areaName: string | null;
  postal: string | null;
  /** null = Listed by Owner. */
  agentName: string | null;
  refNo: string;
  businessType?: string | null;
}

const listingColor = (k: ListingEmbedData['kind']) => (k === 'rent' ? EMBED_COLOR.rental() : EMBED_COLOR.listing());
const priceText = (d: ListingEmbedData, price = d.price) => (price ? (d.kind === 'rent' ? `${money(price)}/mo` : money(price)) : null);
const areaText = (d: ListingEmbedData) => [d.areaName, d.postal ? `Postal ${d.postal}` : null].filter(Boolean).join(' · ') || null;

function listingFields(d: ListingEmbedData, price = d.price): APIEmbedField[] {
  return [
    ...field(d.kind === 'rent' ? 'Rent' : 'Price', priceText(d, price)),
    ...(d.kind === 'business' ? field('Business', d.businessType ?? null) : [...field('Beds', d.beds !== null ? String(d.beds) : null), ...field('Baths', d.baths !== null ? String(d.baths) : null)]),
    ...field('Area', areaText(d)),
    ...field('Agent', d.agentName ?? 'Listed by Owner'),
  ];
}

const TITLE_PREFIX: Record<ListingEmbedData['kind'], string> = { sale: 'Just Listed', rent: 'For Rent', business: 'Business for Sale' };

/** New listing, rental or business (they share a shape). Pings @Notifications: Listings. */
export function listingMessage(b: BrandContext, d: ListingEmbedData, pingRoleId?: string | null): DiscordMessage {
  const url = link(b, `/property/${d.slug}`);
  return {
    ...ping(pingRoleId),
    embeds: [
      {
        author: author(b),
        color: listingColor(d.kind),
        title: clip(`${TITLE_PREFIX[d.kind]} · ${d.title}`, 256),
        url,
        description: summaryOf(d.description) || undefined,
        image: d.coverUrl ? { url: d.coverUrl } : undefined,
        fields: listingFields(d),
        footer: footer(b, d.refNo),
        timestamp: new Date().toISOString(),
      },
    ],
    components: [row(linkBtn('View listing', url), linkBtn('Book a showing', `${url}#book`))],
  };
}

/** Price cut: old price struck through. Posted to #new-listings. */
export function priceReducedMessage(b: BrandContext, d: ListingEmbedData, oldPrice: number, pingRoleId?: string | null): DiscordMessage {
  const url = link(b, `/property/${d.slug}`);
  const unit = d.kind === 'rent' ? '/mo' : '';
  return {
    ...ping(pingRoleId),
    embeds: [
      {
        author: author(b),
        color: EMBED_COLOR.listing(),
        title: clip(`Price Reduced · ${d.title}`, 256),
        url,
        description: `~~${money(oldPrice)}${unit}~~ → **${priceText(d) ?? ''}**`,
        thumbnail: d.coverUrl ? { url: d.coverUrl } : undefined,
        fields: listingFields(d).filter((f) => f.name !== 'Price' && f.name !== 'Rent'),
        footer: footer(b, d.refNo),
        timestamp: new Date().toISOString(),
      },
    ],
    components: [row(linkBtn('View listing', url), linkBtn('Book a showing', `${url}#book`))],
  };
}

/** Edits the original announcement when a listing is withdrawn or removed: no Book button. */
export function noLongerAvailableMessage(b: BrandContext, d: ListingEmbedData): DiscordMessage {
  return {
    content: '',
    allowed_mentions: { parse: [] },
    embeds: [
      {
        author: author(b),
        color: EMBED_COLOR.default(),
        title: clip(`No longer available · ${d.title}`, 256),
        description: 'This listing has been taken off the market.',
        thumbnail: d.coverUrl ? { url: d.coverUrl } : undefined,
        fields: field('Area', areaText(d)),
        footer: footer(b, d.refNo),
      },
    ],
    components: [row(linkBtn('Browse current listings', link(b, d.kind === 'rent' ? '/rent' : d.kind === 'business' ? '/businesses' : '/buy')))],
  };
}

export interface SoldEmbedData {
  title: string;
  saleNo: string;
  price: number;
  rent: boolean;
  areaName: string | null;
  postal: string | null;
  agentName: string | null;
  thumbUrl: string | null;
  refNo: string;
}

/** Sold or leased. No buyer names. */
export function soldMessage(b: BrandContext, d: SoldEmbedData): DiscordMessage {
  return {
    allowed_mentions: { parse: [] },
    embeds: [
      {
        author: author(b),
        color: EMBED_COLOR.sold(),
        title: clip(`${d.rent ? 'Leased' : 'Sold'} · ${d.title}`, 256),
        url: link(b, '/sold'),
        description: `${d.saleNo}`,
        thumbnail: d.thumbUrl ? { url: d.thumbUrl } : undefined,
        fields: [
          ...field(d.rent ? 'Rent' : 'Sold for', d.rent ? `${money(d.price)}/mo` : money(d.price)),
          ...field('Area', [d.areaName, d.postal ? `Postal ${d.postal}` : null].filter(Boolean).join(' · ') || null),
          ...field('Agent', d.agentName ?? 'Listed by Owner'),
        ],
        footer: footer(b, d.refNo),
        timestamp: new Date().toISOString(),
      },
    ],
    components: [row(linkBtn('See all sales', link(b, '/sold')))],
  };
}

// ---- Staff ----

export interface ReviewEmbedData {
  title: string;
  listingId: string;
  submitter: string;
  source: 'agent' | 'owner_submitted';
  round: number;
  thumbUrl: string | null;
  price: string | null;
  refNo: string;
}

/** Waiting for review. Pings Management. */
export function reviewPendingMessage(b: BrandContext, d: ReviewEmbedData, managementRoleId?: string | null): DiscordMessage {
  return {
    ...ping(managementRoleId),
    embeds: [
      {
        author: author(b),
        color: EMBED_COLOR.review(),
        title: clip(`${d.round > 1 ? 'Resubmitted for review' : 'Waiting for review'} · ${d.title}`, 256),
        url: link(b, `/portal/review/${d.listingId}`),
        thumbnail: d.thumbUrl ? { url: d.thumbUrl } : undefined,
        fields: [...field('Submitted by', d.submitter), ...field('Source', d.source === 'owner_submitted' ? 'Listed by Owner' : 'Agent'), ...field('Round', String(d.round)), ...field('Price', d.price)],
        footer: footer(b, d.refNo),
        timestamp: new Date().toISOString(),
      },
    ],
    components: [row(linkBtn('Open in portal', link(b, `/portal/review/${d.listingId}`)))],
  };
}

export interface DealEmbedData {
  title: string;
  dealId: string;
  from: string;
  to: string;
  agentName: string | null;
  refNo: string;
  /** Under offer and under contract use the offer colour; closed uses sold. */
  tone: 'offer' | 'sold' | 'default';
}

export function dealMessage(b: BrandContext, d: DealEmbedData): DiscordMessage {
  const color = d.tone === 'offer' ? EMBED_COLOR.offer() : d.tone === 'sold' ? EMBED_COLOR.sold() : EMBED_COLOR.default();
  return {
    allowed_mentions: { parse: [] },
    embeds: [
      {
        author: author(b),
        color,
        title: clip(`Deal moved to ${d.to} · ${d.title}`, 256),
        url: link(b, `/portal/deals/${d.dealId}`),
        fields: [...field('From', d.from), ...field('To', d.to), ...field('Agent', d.agentName)],
        footer: footer(b, d.refNo),
        timestamp: new Date().toISOString(),
      },
    ],
    components: [row(linkBtn('Open deal', link(b, `/portal/deals/${d.dealId}`)))],
  };
}

export interface ApplicationEmbedData {
  enquiryId: string;
  refNo: string;
  role: string;
  applicant: string;
  roblox: string | null;
  why: string | null;
  decision?: { accepted: boolean; by: string } | null;
}

export const APPLICATION_ID = { accept: (id: string) => `jr:app:accept:${id}`, decline: (id: string) => `jr:app:decline:${id}` };

/** Career application with Accept / Decline; after a decision the buttons are disabled and the outcome shown. */
export function applicationMessage(b: BrandContext, d: ApplicationEmbedData): DiscordMessage {
  const decided = d.decision;
  return {
    allowed_mentions: { parse: [] },
    embeds: [
      {
        author: author(b),
        color: decided ? (decided.accepted ? EMBED_COLOR.sold() : EMBED_COLOR.danger()) : EMBED_COLOR.review(),
        title: clip(`Application · ${d.role}`, 256),
        url: link(b, '/portal/inbox'),
        description: d.why ? clip(d.why, 600) : undefined,
        fields: [...field('Applicant', d.applicant), ...field('Roblox', d.roblox), ...(decided ? field('Decision', `${decided.accepted ? 'Accepted' : 'Declined'} by ${decided.by}`, false) : [])],
        footer: footer(b, d.refNo),
        timestamp: new Date().toISOString(),
      },
    ],
    components: [
      row(
        actionBtn('Accept', APPLICATION_ID.accept(d.enquiryId), ButtonStyle.Success, !!decided),
        actionBtn('Decline', APPLICATION_ID.decline(d.enquiryId), ButtonStyle.Danger, !!decided),
        linkBtn('Open in portal', link(b, '/portal/inbox')),
      ),
    ],
  };
}

export interface AnnouncementEmbedData {
  title: string;
  body: string;
  imageUrl: string | null;
  authorName: string | null;
}

export function announcementMessage(b: BrandContext, d: AnnouncementEmbedData, pingRoleId?: string | null): DiscordMessage {
  return {
    ...ping(pingRoleId),
    embeds: [
      {
        author: author(b),
        color: EMBED_COLOR.default(),
        title: clip(d.title, 256),
        description: clip(d.body, 4000),
        image: d.imageUrl ? { url: d.imageUrl } : undefined,
        footer: { text: d.authorName ? `${d.authorName} · ${b.brokerageName}` : b.brokerageName },
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

export interface OpenHouseEmbedData {
  title: string;
  slug: string;
  startsAt: Date;
  endsAt: Date;
  notes: string | null;
  coverUrl: string | null;
  agentName: string | null;
  refNo: string;
  cancelled?: boolean;
}

export function openHouseMessage(b: BrandContext, d: OpenHouseEmbedData): DiscordMessage {
  const url = link(b, `/property/${d.slug}`);
  return {
    allowed_mentions: { parse: [] },
    embeds: [
      {
        author: author(b),
        color: d.cancelled ? EMBED_COLOR.default() : EMBED_COLOR.listing(),
        title: clip(`${d.cancelled ? 'Cancelled: Open House' : 'Open House'} · ${d.title}`, 256),
        url,
        description: `${when(d.startsAt)} to ${when(d.endsAt, 't')}${d.notes ? `\n\n${clip(d.notes, 500)}` : ''}`,
        image: d.coverUrl ? { url: d.coverUrl } : undefined,
        fields: field('Agent', d.agentName),
        footer: footer(b, d.refNo),
      },
    ],
    components: d.cancelled ? [] : [row(linkBtn('View listing', url))],
  };
}

// ---- Tickets ----

export const TICKET_ID = { claim: 'jr:tk:claim', close: 'jr:tk:close' } as const;

export interface TicketIntakeData {
  number: string;
  typeLabel: string;
  openerId: string;
  answers: { label: string; value: string }[];
  claimedBy?: string | null;
}

export function ticketIntakeMessage(b: BrandContext, d: TicketIntakeData, staffRoleIds: string[] = []): DiscordMessage {
  return {
    content: `<@${d.openerId}>${staffRoleIds.length ? ' ' + staffRoleIds.map((r) => `<@&${r}>`).join(' ') : ''}`,
    allowed_mentions: { users: [d.openerId], roles: staffRoleIds, parse: [] },
    embeds: [
      {
        author: author(b),
        color: d.typeLabel === 'Complaint' ? EMBED_COLOR.danger() : EMBED_COLOR.default(),
        title: `${d.typeLabel} ticket ${d.number}`,
        description: `Thanks for reaching out to ${b.brokerageName}. An agent will reply here shortly.`,
        fields: [...d.answers.filter((a) => a.value).map((a) => ({ name: a.label, value: clip(a.value, 1024), inline: false })), ...(d.claimedBy ? field('Claimed by', d.claimedBy) : [])],
        footer: footer(b, d.number),
        timestamp: new Date().toISOString(),
      },
    ],
    components: [row(actionBtn('Claim', TICKET_ID.claim, ButtonStyle.Primary, !!d.claimedBy), actionBtn('Close', TICKET_ID.close, ButtonStyle.Secondary))],
  };
}

// ---- Commands ----

export function compactListingEmbed(b: BrandContext, d: ListingEmbedData): APIEmbed {
  return {
    color: listingColor(d.kind),
    title: clip(d.title, 256),
    url: link(b, `/property/${d.slug}`),
    thumbnail: d.coverUrl ? { url: d.coverUrl } : undefined,
    description: [priceText(d), d.kind === 'business' ? d.businessType : [d.beds !== null ? `${d.beds} bed` : null, d.baths !== null ? `${d.baths} bath` : null].filter(Boolean).join(' · '), areaText(d)].filter(Boolean).join(' · '),
    footer: footer(b, d.refNo),
  };
}

export interface AgentCardData {
  name: string;
  title: string | null;
  slug: string;
  photoUrl: string | null;
  chirper: string | null;
  activeListings: number;
  sales: number;
}

export function agentCardMessage(b: BrandContext, d: AgentCardData): DiscordMessage {
  return {
    allowed_mentions: { parse: [] },
    embeds: [
      {
        author: author(b),
        color: EMBED_COLOR.default(),
        title: d.name,
        url: link(b, `/agents/${d.slug}`),
        description: d.title ?? undefined,
        thumbnail: d.photoUrl ? { url: d.photoUrl } : undefined,
        fields: [...field('Active listings', String(d.activeListings)), ...field('Sales', String(d.sales)), ...field('Chirper', d.chirper ? `@${d.chirper}` : null)],
        footer: footer(b),
      },
    ],
    components: [row(linkBtn('View profile', link(b, `/agents/${d.slug}`)))],
  };
}

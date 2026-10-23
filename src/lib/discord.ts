// Per-event Discord webhooks. Each event has its own optional env var; unset means skipped silently.
// Posts are rich embeds plus a "View on website" link button. Never throws: a failed post is logged and
// the action that triggered it carries on.
import { colorToken } from './tokens';

export const WEBHOOK_EVENTS = {
  review_pending: 'DISCORD_WEBHOOK_REVIEW_PENDING',
  new_listing: 'DISCORD_WEBHOOK_NEW_LISTING',
  new_rental: 'DISCORD_WEBHOOK_NEW_RENTAL',
  new_business: 'DISCORD_WEBHOOK_NEW_BUSINESS',
  sale_recorded: 'DISCORD_WEBHOOK_SALE_RECORDED',
  deal_stage: 'DISCORD_WEBHOOK_DEAL_STAGE',
  career_application: 'DISCORD_WEBHOOK_CAREER_APPLICATION',
} as const;

export type WebhookEvent = keyof typeof WEBHOOK_EVENTS;

function tokenColor(name: string): number {
  return parseInt(colorToken(name).slice(1), 16);
}

const COLORS: Record<WebhookEvent, number> = {
  review_pending: tokenColor('brass-500'),
  new_listing: tokenColor('green-900'),
  new_rental: tokenColor('green-700'),
  new_business: tokenColor('green-800'),
  sale_recorded: tokenColor('brass-700'),
  deal_stage: tokenColor('green-700'),
  career_application: tokenColor('brass-500'),
};

export interface EmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface WebhookMessage {
  /** Embed title, e.g. "Listing waiting for review". */
  title: string;
  /** Usually the address. */
  heading?: string;
  description?: string;
  url: string;
  imageUrl?: string | null;
  fields?: EmbedField[];
  footer?: string;
  timestamp?: Date;
}

/** Fields for listing-shaped posts: area, price, key facts and agent. */
export function listingFields(l: { area?: string | null; price?: string | null; facts?: string[]; agent?: string | null; refNo?: string | null }): EmbedField[] {
  const f: EmbedField[] = [];
  if (l.area) f.push({ name: 'Area', value: l.area, inline: true });
  if (l.price) f.push({ name: 'Price', value: l.price, inline: true });
  if (l.facts?.length) f.push({ name: 'Key facts', value: l.facts.join(' · ') });
  if (l.agent) f.push({ name: 'Agent', value: l.agent, inline: true });
  if (l.refNo) f.push({ name: 'Reference', value: l.refNo, inline: true });
  return f;
}

export function buildPayload(event: WebhookEvent, m: WebhookMessage, withComponents = true) {
  const embed = {
    title: m.heading ? `${m.title}: ${m.heading}` : m.title,
    url: m.url,
    description: m.description?.slice(0, 1000),
    color: COLORS[event],
    fields: (m.fields ?? []).slice(0, 10).map((x) => ({ ...x, value: x.value.slice(0, 1000) })),
    image: m.imageUrl ? { url: m.imageUrl } : undefined,
    footer: { text: m.footer ?? 'Johnson’s Realty' },
    timestamp: (m.timestamp ?? new Date()).toISOString(),
  };
  return {
    username: 'Johnson’s Realty',
    allowed_mentions: { parse: [] as string[] },
    embeds: [embed],
    ...(withComponents
      ? { components: [{ type: 1, components: [{ type: 2, style: 5, label: 'View on website', url: m.url }] }] }
      : {}),
  };
}

export function webhookUrl(event: WebhookEvent, env: Record<string, string | undefined> = process.env): string | null {
  const v = env[WEBHOOK_EVENTS[event]]?.trim();
  return v && /^https:\/\/(discord|discordapp)\.com\/api\/webhooks\//.test(v) ? v : null;
}

export type PostResult = 'sent' | 'skipped' | 'failed';

export async function postWebhook(event: WebhookEvent, m: WebhookMessage, fetcher: typeof fetch = fetch): Promise<PostResult> {
  const url = webhookUrl(event);
  if (!url) return 'skipped';
  const send = (withComponents: boolean) =>
    fetcher(withComponents ? `${url}${url.includes('?') ? '&' : '?'}with_components=true` : url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildPayload(event, m, withComponents)),
      signal: AbortSignal.timeout(5000),
    });
  try {
    let res = await send(true);
    // Webhooks that refuse components still get the embed, whose title links to the site.
    if (res.status === 400) res = await send(false);
    if (!res.ok) {
      console.error(`[discord] ${event} webhook answered ${res.status}`);
      return 'failed';
    }
    return 'sent';
  } catch (e) {
    console.error(`[discord] ${event} webhook failed`, e);
    return 'failed';
  }
}

export function siteUrl(path = '/'): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
  return base + (path.startsWith('/') ? path : '/' + path);
}

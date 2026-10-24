// Colours, author line and footers for everything the bot posts. Colours come from the design tokens by name,
// never as literals, so Discord matches the website.
import tokens from '../../design-system/tokens.json';

type TokenValue = string | { light: string; dark: string };
const byName = new Map<string, TokenValue>((tokens as { color: { tokens: { name: string; value: TokenValue }[] } }).color.tokens.map((t) => [t.name, t.value]));

/** A colour token as Discord's integer colour (light mode, as embeds sit on Discord's own theme). */
export function tokenColor(name: string): number {
  const v = byName.get(name);
  if (!v) throw new Error(`Unknown colour token: ${name}`);
  const hex = typeof v === 'string' ? v : v.light;
  return parseInt(hex.replace(/^#/, ''), 16);
}

/** Strip colour by meaning (brief 1c). */
export const EMBED_COLOR = {
  listing: () => tokenColor('brass-500'),
  rental: () => tokenColor('status-lease'),
  sold: () => tokenColor('green-900'),
  offer: () => tokenColor('status-offer'),
  review: () => tokenColor('brass-700'),
  danger: () => tokenColor('danger'),
  default: () => tokenColor('green-900'),
} as const;

export interface BrandContext {
  /** Public site origin, no trailing slash. */
  site: string;
  brokerageName: string;
  chirperHandle: string | null;
  civopsLine: string | null;
}

export function author(b: BrandContext) {
  return { name: b.brokerageName, icon_url: `${b.site}/brand/jr-avatar-green.png`, url: b.site };
}

export function link(b: BrandContext, path: string): string {
  return b.site + path;
}

/** A colour token's value as text (for the standalone HTML transcript). */
export function tokenHex(name: string): string {
  return '#' + tokenColor(name).toString(16).padStart(6, '0');
}

type TypeStyle = { name: string; fontSize: string; lineHeight: string; fontWeight: number };
const typeStyles = new Map<string, TypeStyle>(
  (tokens as unknown as { type: { groups: { styles: TypeStyle[] }[] } }).type.groups.flatMap((g) => g.styles).map((st) => [st.name, st]),
);

/** A type token as a CSS `font` shorthand (for the standalone HTML transcript). */
export function typeFont(name: string, family = 'system-ui, sans-serif'): string {
  const t = typeStyles.get(name);
  if (!t) throw new Error(`Unknown type token: ${name}`);
  return `${t.fontWeight} ${t.fontSize}/${t.lineHeight} ${family}`;
}

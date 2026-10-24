import 'server-only';
// Server-side PNG of the property map (brief 4b): the map image at 1500px wide with an SVG overlay composited
// by sharp. librsvg can't load web fonts, so every word is turned into SVG paths with opentype.js from the
// brand fonts (@fontsource). Never draws addresses or prices: it's a representation, not a locator.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import opentype from 'opentype.js';
import sharp from 'sharp';
import { tokenHex } from '@/discord/brand';
import { circleRadius, MAP_GROUPS, type MapGroup } from '@/lib/map';
import { publicImageUrl } from '@/lib/storage';
import type { MapData } from './data';

export const MAP_WIDTH = 1500;

// Paths under node_modules/@fontsource, written out statically so the build traces only these files.
const FONT_FILES = {
  title: () => path.join(process.cwd(), 'node_modules', '@fontsource', 'manrope', 'files', 'manrope-latin-800-normal.woff'),
  text: () => path.join(process.cwd(), 'node_modules', '@fontsource', 'ibm-plex-sans', 'files', 'ibm-plex-sans-latin-500-normal.woff'),
  strong: () => path.join(process.cwd(), 'node_modules', '@fontsource', 'ibm-plex-sans', 'files', 'ibm-plex-sans-latin-600-normal.woff'),
} as const;

type Fonts = Record<keyof typeof FONT_FILES, opentype.Font>;
let fonts: Fonts | null = null;
async function loadFonts() {
  if (fonts) return fonts;
  const entries = await Promise.all(
    Object.entries(FONT_FILES).map(async ([k, f]) => {
      const buf = await readFile(f());
      return [k, opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))] as const;
    }),
  );
  fonts = Object.fromEntries(entries) as Fonts;
  return fonts;
}

async function loadImage(storageId: string): Promise<Buffer> {
  if (storageId.startsWith('/')) return readFile(path.join(process.cwd(), 'public', storageId));
  const res = await fetch(publicImageUrl(storageId, { width: MAP_WIDTH }));
  if (!res.ok) throw new Error(`Map image fetch failed (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

/** Text as an SVG path; `anchor` centres or right-aligns it on x. */
function text(font: opentype.Font, s: string, x: number, y: number, size: number, fill: string, anchor: 'start' | 'middle' | 'end' = 'start') {
  const w = font.getAdvanceWidth(s, size);
  const x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
  return `<path d="${font.getPath(s, x0, y, size).toPathData(2)}" fill="${fill}"/>`;
}

export interface RenderOptions {
  brokerageName: string;
  /** Shown in the legend, already formatted for the reader. */
  updatedLabel: string;
}

const cache = new Map<string, Buffer>();

export async function renderMapPng(data: MapData, o: RenderOptions): Promise<Buffer> {
  if (!data.image) throw new Error('No map image is set.');
  const cached = cache.get(data.hash);
  if (cached) return cached;
  const f = await loadFonts();
  const W = MAP_WIDTH;
  const H = Math.round((W * data.image.height) / data.image.width);
  const base = await sharp(await loadImage(data.image.storageId)).resize(W, H, { fit: 'fill' }).png().toBuffer();

  const color = Object.fromEntries(MAP_GROUPS.map((g) => [g.key, tokenHex(g.token)])) as Record<MapGroup, string>;
  const cream = tokenHex('cream');
  const brass = tokenHex('brass-500');
  const panel = tokenHex('green-950');
  const parts: string[] = [];

  // Biggest first, so small circles stay visible on top.
  for (const c of [...data.layout.circles].sort((a, b) => b.listings.length - a.listings.length)) {
    const r = (circleRadius(c.listings.length) / 100) * W;
    const cx = (c.x / 100) * W;
    const cy = (c.y / 100) * H;
    const ring = c.group === 'sold' ? `stroke="${brass}" stroke-width="4"` : `stroke="${cream}" stroke-width="3"`;
    parts.push(`<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(r + 10).toFixed(1)}" fill="${color[c.group]}" fill-opacity="0.22"/>`);
    parts.push(`<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="${color[c.group]}" ${ring}/>`);
    if (c.listings.length > 1) parts.push(text(f.strong, String(c.listings.length), cx, cy + r * 0.32, r * 0.95, cream, 'middle'));
  }

  // Legend panel in the bottom-right corner (open water on the in-game map).
  const pw = 430;
  const rows = MAP_GROUPS.filter((g) => g.key !== 'sold' || data.layout.counts.sold > 0);
  const ph = 112 + rows.length * 44;
  const px = W - pw - 32;
  const py = H - ph - 32;
  parts.push(`<rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="6" fill="${panel}" fill-opacity="0.94" stroke="${brass}" stroke-width="2"/>`);
  parts.push(text(f.title, `${o.brokerageName} · Property map`, px + 24, py + 44, 24, cream));
  rows.forEach((g, i) => {
    const y = py + 84 + i * 44;
    parts.push(`<circle cx="${px + 36}" cy="${y}" r="12" fill="${color[g.key]}" ${g.key === 'sold' ? `stroke="${brass}" stroke-width="3"` : `stroke="${cream}" stroke-width="2"`}/>`);
    parts.push(text(f.text, g.label, px + 60, y + 7, 20, cream));
    parts.push(text(f.strong, String(data.layout.counts[g.key]), px + pw - 24, y + 7, 20, cream, 'end'));
  });
  parts.push(text(f.text, `Updated ${o.updatedLabel}`, px + 24, py + ph - 20, 16, tokenHex('green-300')));

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join('')}</svg>`;
  const png = await sharp(base).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).png({ compressionLevel: 9 }).toBuffer();
  cache.set(data.hash, png);
  if (cache.size > 4) cache.delete(cache.keys().next().value!);
  return png;
}

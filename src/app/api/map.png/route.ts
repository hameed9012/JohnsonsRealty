import { db } from '@/db/client';
import { getSettings } from '@/server/settings';
import { mapData } from '@/server/map/data';
import { renderMapPng } from '@/server/map/render';

// The property map as a PNG (for Discord and sharing). `?v=<hash>` URLs are immutable: the image only changes
// when the map's hash does, so the CDN and Discord can cache each version for good.
export async function GET(req: Request) {
  const v = new URL(req.url).searchParams.get('v');
  const [data, settings] = await Promise.all([mapData(db), getSettings()]);
  if (!data.image) return new Response('No map image is set', { status: 404 });
  const updated = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/New_York' }) + ' ET';
  const png = await renderMapPng(data, { brokerageName: settings.brokerageName, updatedLabel: updated });
  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      ETag: `"${data.hash}"`,
      'Cache-Control': v === data.hash ? 'public, max-age=31536000, immutable' : 'public, max-age=60, s-maxage=60',
    },
  });
}

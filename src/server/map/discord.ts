import 'server-only';
// The one live map message in #property-map (created by setup), edited in place with a new image whenever
// the map's hash changes: a listing approved, sold, leased, under offer or withdrawn, or a zone moved.
import { ButtonStyle, ComponentType } from 'discord-api-types/v10';
import type { Executor } from '@/db/client';
import { discordConfig } from '@/db/schema';
import { author, EMBED_COLOR, link, type BrandContext } from '@/discord/brand';
import { configId } from '@/discord/config';
import type { DiscordMessage } from '@/discord/embeds';
import { discordDeps } from '@/discord/events';
import { MAP_GROUPS } from '@/lib/map';
import { mapData, type MapData } from './data';

export function mapImageUrl(b: BrandContext, hash: string) {
  return link(b, `/api/map.png?v=${hash}`);
}

export function mapMessage(b: BrandContext, data: MapData): DiscordMessage {
  return {
    allowed_mentions: { parse: [] },
    embeds: [
      {
        author: author(b),
        color: EMBED_COLOR.default(),
        title: `${b.brokerageName} · Property map`,
        description: 'Every listing on the market, shown at its postal zone. Circles show the area, never the exact house.',
        image: data.image ? { url: mapImageUrl(b, data.hash) } : undefined,
        fields: MAP_GROUPS.filter((g) => g.key !== 'sold' || data.layout.counts.sold > 0).map((g) => ({ name: g.label, value: String(data.layout.counts[g.key]), inline: true })),
        footer: { text: b.brokerageName },
        timestamp: new Date().toISOString(),
      },
    ],
    components: [{ type: ComponentType.ActionRow, components: [{ type: ComponentType.Button, style: ButtonStyle.Link, label: 'View the map on the website', url: link(b, '/buy?view=map') }] }],
  };
}

/** Edits the map message if the map changed since the last edit. Quietly does nothing without the bot. */
export async function updatePropertyMapMessage(ex: Executor, opts: { force?: boolean } = {}): Promise<'updated' | 'unchanged' | 'skipped'> {
  const deps = await discordDeps(ex);
  if (!deps) return 'skipped';
  const [channelId, messageId] = await Promise.all([configId(ex, 'channel:property-map'), configId(ex, 'message:property-map')]);
  if (!channelId || !messageId) return 'skipped';
  const data = await mapData(ex);
  if (!data.image) return 'skipped';
  const last = await configId(ex, 'map:hash');
  if (!opts.force && last === data.hash) return 'unchanged';
  try {
    await deps.rest.patch(`/channels/${channelId}/messages/${messageId}`, mapMessage(deps.brand, data));
    await ex
      .insert(discordConfig)
      .values({ key: 'map:hash', kind: 'map', discordId: data.hash })
      .onConflictDoUpdate({ target: discordConfig.key, set: { discordId: data.hash } });
    return 'updated';
  } catch (e) {
    console.error('[discord] map update failed', e);
    return 'skipped';
  }
}

import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildPayload, listingFields, postWebhook, webhookUrl, WEBHOOK_EVENTS } from '@/lib/discord';

const HOOK = 'https://discord.com/api/webhooks/123/abc';
const msg = {
  title: 'Listing waiting for review',
  heading: 'Example Lane',
  url: 'https://example.test/portal/review/1',
  imageUrl: 'https://img.test/cover.webp',
  fields: listingFields({ area: 'Fairview', price: '$365,000', facts: ['3 bed', '2 bath'], agent: 'Example Agent' }),
};

afterEach(() => {
  for (const v of Object.values(WEBHOOK_EVENTS)) delete process.env[v];
});

describe('discord webhooks', () => {
  it('has one env var per event', () => {
    expect(Object.keys(WEBHOOK_EVENTS)).toEqual([
      'review_pending',
      'new_listing',
      'new_rental',
      'new_business',
      'sale_recorded',
      'deal_stage',
      'career_application',
    ]);
  });

  it('only accepts Discord webhook URLs', () => {
    expect(webhookUrl('new_listing', { DISCORD_WEBHOOK_NEW_LISTING: HOOK })).toBe(HOOK);
    expect(webhookUrl('new_listing', { DISCORD_WEBHOOK_NEW_LISTING: 'https://evil.test/hook' })).toBeNull();
    expect(webhookUrl('new_listing', {})).toBeNull();
  });

  it('builds a rich embed with photo, fields and a link button', () => {
    const p = buildPayload('review_pending', msg);
    expect(p.embeds[0]!.title).toBe('Listing waiting for review: Example Lane');
    expect(p.embeds[0]!.image).toEqual({ url: msg.imageUrl });
    expect(p.embeds[0]!.fields.map((f) => f.name)).toEqual(['Area', 'Price', 'Key facts', 'Agent']);
    expect(p.embeds[0]!.color).toBeGreaterThan(0);
    expect(p.components![0]!.components[0]).toMatchObject({ type: 2, style: 5, label: 'View on website', url: msg.url });
    expect(p.allowed_mentions.parse).toEqual([]);
  });

  it('skips silently when the env var is unset', async () => {
    const f = vi.fn();
    expect(await postWebhook('sale_recorded', msg, f as never)).toBe('skipped');
    expect(f).not.toHaveBeenCalled();
  });

  it('retries without components when Discord refuses them', async () => {
    process.env.DISCORD_WEBHOOK_DEAL_STAGE = HOOK;
    const f = vi.fn().mockResolvedValueOnce(new Response('', { status: 400 })).mockResolvedValueOnce(new Response(null, { status: 204 }));
    expect(await postWebhook('deal_stage', msg, f as never)).toBe('sent');
    expect(f.mock.calls[0]![0]).toBe(HOOK + '?with_components=true');
    expect(f.mock.calls[1]![0]).toBe(HOOK);
    expect(JSON.parse(f.mock.calls[1]![1].body).components).toBeUndefined();
  });

  it('never throws on network errors', async () => {
    process.env.DISCORD_WEBHOOK_NEW_RENTAL = HOOK;
    const f = vi.fn().mockRejectedValue(new Error('offline'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await postWebhook('new_rental', msg, f as never)).toBe('failed');
  });
});

import { writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { circleRadius, layoutMap, mapGroup, mapHash, postalFromAddress, type MapListing } from '@/lib/map';
import { renderMapPng } from '@/server/map/render';
import zonesFile from '../../map/postal-zones.json';
import { ZONE_AREA } from '@/db/seed-zones';

const zones = Object.entries(zonesFile.zones).map(([code, z]) => ({ code, label: z.label, x: z.x, y: z.y }));
const L = (o: Partial<MapListing>): MapListing => ({ id: Math.random().toString(36).slice(2), slug: 's', title: 'Example', status: 'active', price: 1, purpose: 'sale', postal: '601', mapX: null, mapY: null, closedAt: null, ...o });

describe('postal codes', () => {
  it('drops the last digit of the house number', () => {
    expect(postalFromAddress('6012 Estate Drive')).toBe('601');
    expect(postalFromAddress('8095 Lakeway Street, Fairview')).toBe('809');
    expect(postalFromAddress('10031 Maple Street')).toBe('1003');
    expect(postalFromAddress('Estate Drive')).toBeNull();
    expect(postalFromAddress('7 Main St')).toBeNull();
  });

  it('every seeded zone is on the map, and every zone with an area maps to a real area slug', () => {
    expect(zones).toHaveLength(62);
    for (const z of zones) {
      expect(z.x).toBeGreaterThan(0);
      expect(z.x).toBeLessThan(100);
    }
    expect(new Set(Object.values(ZONE_AREA))).toEqual(new Set(['fairview', 'springfield', 'north-residential', 'west-downtown', 'east-downtown']));
    expect(ZONE_AREA['601']).toBe('fairview');
    expect(ZONE_AREA['1101']).toBe('springfield');
    expect(ZONE_AREA['1200']).toBeUndefined(); // High Rock Park is a state park
  });
});

describe('layout', () => {
  const now = new Date('2026-10-24T12:00:00Z');

  it('groups listings into one circle per zone per status, side by side', () => {
    const lay = layoutMap([L({}), L({}), L({ status: 'for_lease' }), L({ postal: '809' })], zones, { soldDays: 30, now });
    const at601 = lay.circles.filter((c) => c.zone === '601');
    expect(at601.map((c) => [c.group, c.listings.length])).toEqual([['available', 2], ['lease', 1]]);
    expect(at601[0]!.x).not.toBe(at601[1]!.x);
    expect(lay.counts).toEqual({ available: 3, lease: 1, offer: 0, sold: 0 });
  });

  it('keeps sold listings for N days only, and leaves off drafts and withdrawn ones', () => {
    const lay = layoutMap(
      [L({ status: 'sold', closedAt: new Date('2026-10-10T00:00:00Z') }), L({ status: 'sold', closedAt: new Date('2026-08-01T00:00:00Z') }), L({ status: 'draft' }), L({ status: 'withdrawn' })],
      zones,
      { soldDays: 30, now },
    );
    expect(lay.counts.sold).toBe(1);
    expect(lay.circles).toHaveLength(1);
  });

  it('a manual override gets its own circle; an unknown postal is reported for the Owner', () => {
    const lay = layoutMap([L({ mapX: 10, mapY: 20 }), L({ postal: '60' })], zones, { soldDays: 30, now });
    expect(lay.circles.map((c) => [c.key.startsWith('pin:'), c.x, c.y])).toEqual([[true, 10, 20]]);
    expect(lay.unplaced).toEqual(['60']);
  });

  it('the hash changes only when what is drawn changes', () => {
    const a = layoutMap([L({ id: 'a' })], zones, { soldDays: 30, now });
    const b = layoutMap([L({ id: 'b' })], zones, { soldDays: 30, now });
    const c = layoutMap([L({ id: 'a' }), L({ id: 'b' })], zones, { soldDays: 30, now });
    expect(mapHash(a, zones, 'img')).toBe(mapHash(b, zones, 'img'));
    expect(mapHash(a, zones, 'img')).not.toBe(mapHash(c, zones, 'img'));
    expect(mapHash(a, zones, 'img')).not.toBe(mapHash(a, zones, 'other-image'));
  });

  it('maps statuses to groups and grows circles gently', () => {
    expect([mapGroup('active'), mapGroup('under_contract'), mapGroup('leased'), mapGroup('draft')]).toEqual(['available', 'offer', 'sold', null]);
    expect(circleRadius(1)).toBeLessThan(circleRadius(5));
    expect(circleRadius(500)).toBeLessThanOrEqual(3.2);
  });
});

describe('PNG', () => {
  it('renders the map at 1500px wide with circles and a legend', async () => {
    const lay = layoutMap([L({}), L({}), L({ postal: '809' }), L({ status: 'for_lease', postal: '1101' }), L({ status: 'under_offer', postal: '409' })], zones, { soldDays: 30 });
    const png = await renderMapPng(
      { image: { storageId: '/map/liberty-county-map.png', width: 1026, height: 971 }, zones: zones.map((z) => ({ ...z, areaId: null })), layout: lay, hash: 'test-' + Date.now(), soldDays: 30 },
      { brokerageName: 'Example Realty', updatedLabel: 'Oct 24, 2026, 8:00 AM ET' },
    );
    const meta = await sharp(png).metadata();
    expect(meta.format).toBe('png');
    expect(meta.width).toBe(1500);
    expect(meta.height).toBe(Math.round((1500 * 971) / 1026));
    if (process.env.MAP_PREVIEW_OUT) await writeFile(process.env.MAP_PREVIEW_OUT, png);
  }, 30_000);
});

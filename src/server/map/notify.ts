import 'server-only';
import { and, eq, isNull } from 'drizzle-orm';
import type { Executor } from '@/db/client';
import { listings, notifications, postalZones, users } from '@/db/schema';

/** A listing's postal code has no zone yet: ask the Owner to place it (once, while unread). */
export async function notifyUnplacedPostal(ex: Executor, listingId: string): Promise<boolean> {
  const l = await ex.query.listings.findFirst({ where: eq(listings.id, listingId), columns: { postal: true, addressLine: true } });
  if (!l?.postal) return false;
  if (await ex.query.postalZones.findFirst({ where: eq(postalZones.code, l.postal) })) return false;
  const owners = await ex.select({ id: users.id }).from(users).where(and(eq(users.role, 'owner'), eq(users.status, 'active')));
  const title = `Postal ${l.postal} isn’t on the map yet`;
  let sent = false;
  for (const o of owners) {
    const pending = await ex.query.notifications.findFirst({ where: and(eq(notifications.userId, o.id), eq(notifications.title, title), isNull(notifications.readAt)) });
    if (pending) continue;
    await ex.insert(notifications).values({ userId: o.id, kind: 'map_zone', title, body: `${l.addressLine || 'A listing'} uses it. Add the zone so it shows on the property map.`, link: `/portal/settings/map?add=${l.postal}` });
    sent = true;
  }
  return sent;
}

import type { MetadataRoute } from 'next';
import { and, inArray, isNotNull, lte, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { agentProfiles, areas, careers, listings, posts } from '@/db/schema';
import { siteUrl } from '@/lib/discord';
import { PUBLIC_STATUSES } from '@/lib/listing-status';

type Status = (typeof listings.status.enumValues)[number];

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const fixed = ['/', '/buy', '/rent', '/businesses', '/sell', '/areas', '/sold', '/agents', '/about', '/guides', '/careers', '/contact', '/privacy', '/terms'];
  const [l, a, ag, p, c] = await Promise.all([
    db.select({ slug: listings.slug, updatedAt: listings.updatedAt }).from(listings).where(inArray(listings.status, PUBLIC_STATUSES as Status[])),
    db.select({ slug: areas.slug, updatedAt: areas.updatedAt }).from(areas),
    db.select({ slug: agentProfiles.slug, updatedAt: agentProfiles.updatedAt }).from(agentProfiles).where(eq(agentProfiles.active, true)),
    db.select({ slug: posts.slug, updatedAt: posts.updatedAt }).from(posts).where(and(isNotNull(posts.publishedAt), lte(posts.publishedAt, new Date()))),
    db.select({ slug: careers.slug, updatedAt: careers.updatedAt }).from(careers).where(eq(careers.open, true)),
  ]);
  return [
    ...fixed.map((path) => ({ url: siteUrl(path) })),
    ...l.map((x) => ({ url: siteUrl(`/property/${x.slug}`), lastModified: x.updatedAt })),
    ...a.map((x) => ({ url: siteUrl(`/areas/${x.slug}`), lastModified: x.updatedAt })),
    ...ag.map((x) => ({ url: siteUrl(`/agents/${x.slug}`), lastModified: x.updatedAt })),
    ...p.map((x) => ({ url: siteUrl(`/guides/${x.slug}`), lastModified: x.updatedAt })),
    ...c.map((x) => ({ url: siteUrl(`/careers/${x.slug}`), lastModified: x.updatedAt })),
  ];
}

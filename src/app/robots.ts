import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/discord';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/portal', '/account', '/api', '/signin', '/styleguide'] }],
    sitemap: siteUrl('/sitemap.xml'),
  };
}

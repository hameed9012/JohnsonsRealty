import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // End-to-end tests build into their own folder so they never clobber the dev server's build.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  images: {
    loader: 'custom',
    loaderFile: './src/lib/storage/image-loader.ts',
  },
  serverExternalPackages: ['@electric-sql/pglite', 'sharp'],
  // Files read at runtime by route handlers, so Vercel bundles them with those functions.
  outputFileTracingIncludes: {
    '/api/map.png': ['./public/map/**', './node_modules/@fontsource/manrope/files/manrope-latin-800-normal.woff', './node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-{500,600}-normal.woff'],
    '/portal/settings/discord': ['./design-system/assets/Logos/jr-avatar-green.png'],
    '/portal/settings/import': ['./import/*.md', './import/forms-pa-latest.html', './photos/**'],
    '/portal/listings/new': ['./import/*.md', './import/forms-pa-latest.html'],
  },
  // The cloud name is not secret; the image loader needs it in the browser.
  env: { NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME ?? '' },
};

export default nextConfig;
